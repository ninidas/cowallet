import os
import logging
from datetime import date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .database import SessionLocal
from . import models, enablebanking, bank_sync
from .routers.push import send_notification

logger = logging.getLogger(__name__)

APP_LANG = os.environ.get("APP_LANG", "en").lower()

MONTH_LABELS = {
    "en": ["", "January", "February", "March", "April", "May", "June",
           "July", "August", "September", "October", "November", "December"],
    "fr": ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
           "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
}

NOTIF_REMINDER = {
    "en": "{label} is coming — time to prepare next month",
    "fr": "{label} arrive — pensez à préparer le mois",
}


def send_monthly_reminders():
    """
    Envoyé le 28 de chaque mois : rappelle aux deux membres d'un groupe
    de créer et remplir le mois suivant s'il n'existe pas encore.
    """
    today = date.today()
    if today.day != 28:
        return

    next_month  = today.month % 12 + 1
    next_year   = today.year + (1 if today.month == 12 else 0)
    lang        = APP_LANG if APP_LANG in MONTH_LABELS else "en"
    label       = f"{MONTH_LABELS[lang][next_month]} {next_year}"

    db = SessionLocal()
    try:
        groups = db.query(models.Group).all()
        for group in groups:
            # Vérifier si le mois suivant existe déjà
            exists = db.query(models.Month).filter_by(
                group_id=group.id, year=next_year, month=next_month
            ).first()
            if exists:
                continue

            # Notifier les deux membres
            title = NOTIF_REMINDER.get(lang, NOTIF_REMINDER["en"]).format(label=label)
            for user_id in filter(None, [group.user1_id, group.user2_id]):
                send_notification(db, user_id, title=title, body="", url="/months")
                logger.info("Reminder sent to user_id=%s for %s", user_id, label)
    finally:
        db.close()


NOTIF_BANK = {
    "en": {"soon": ("Your bank access ends in {n} days", "Reconnect your bank in Settings to keep importing transactions."),
           "last": ("Your bank access ends tomorrow", "Reconnect your bank in Settings to keep importing transactions."),
           "expired": ("Your bank access has expired", "Reconnect your bank in Settings to import your transactions again.")},
    "fr": {"soon": ("L'accès à votre banque expire dans {n} jours", "Reconnectez-la dans Réglages pour continuer à importer vos transactions."),
           "last": ("L'accès à votre banque expire demain", "Reconnectez-la dans Réglages pour continuer à importer vos transactions."),
           "expired": ("L'accès à votre banque a expiré", "Reconnectez-la dans Réglages pour importer de nouveau vos transactions.")},
}


def send_bank_expiry_reminders():
    """Chaque jour : prévient 7 jours et 1 jour avant la fin de l'accès bancaire, puis le jour où il expire."""
    if not enablebanking.is_configured():
        return
    lang = APP_LANG if APP_LANG in NOTIF_BANK else "en"
    db = SessionLocal()
    try:
        for conn in db.query(models.BankConnection).filter_by(status="active").all():
            info = enablebanking.consent_info(conn.saltedge_connection_id, max_age=0)
            if not info or not info["valid_until"]:
                continue
            days = (info["valid_until"] - date.today()).days
            kind = "soon" if days == 7 else "last" if days == 1 else "expired" if days == 0 else None
            if not kind:
                continue
            title, body = NOTIF_BANK[lang][kind]
            send_notification(db, conn.user_id, title=title.format(n=days), body=body, url="/settings/bank")
            logger.info("Bank expiry reminder (%s) sent to user_id=%s", kind, conn.user_id)
    except Exception:
        logger.exception("Bank expiry reminders failed")
    finally:
        db.close()


NOTIF_IMPORT = {
    "en": {"one": "1 new transaction", "many": "{n} new transactions",
           "todo": "{label} · {k} to categorise", "done": "{label} · all categorised",
           "error": "This morning's bank import failed",
           "error_limit": "Your bank limits how often it can be read: next try tomorrow morning.",
           "error_other": "Check your bank access in Settings."},
    "fr": {"one": "1 nouvelle transaction", "many": "{n} nouvelles transactions",
           "todo": "{label} · {k} à catégoriser", "done": "{label} · toutes catégorisées",
           "error": "L'import bancaire de ce matin a échoué",
           "error_limit": "La banque limite le nombre de lectures : nouvel essai demain matin.",
           "error_other": "Vérifiez l'accès à votre banque dans Réglages."},
}


def notify_import_results(db, report: list):
    """Après l'import du matin : les deux membres du groupe sont prévenus s'il y a de nouvelles
    transactions ; le titulaire de la connexion l'est si la banque a refusé, une seule fois
    jusqu'à ce que l'import réussisse de nouveau (pas une notification chaque matin)."""
    lang = APP_LANG if APP_LANG in NOTIF_IMPORT else "en"
    txt = NOTIF_IMPORT[lang]

    by_group = {}
    for r in report:
        if "error" not in r and r["imported"]:
            g = by_group.setdefault(r["group_id"], {"n": 0, "k": 0, "month": r})
            g["n"] += r["imported"]
            g["k"] += r["imported"] - r["auto_categorized"]
    for group_id, g in by_group.items():
        group = db.get(models.Group, group_id)
        title = txt["one"] if g["n"] == 1 else txt["many"].format(n=g["n"])
        body = (txt["todo"] if g["k"] else txt["done"]).format(label=g["month"]["month"], k=g["k"])
        # Le mois le plus récent qui a reçu des transactions (le rapport va du plus récent au plus ancien)
        url = f"/months/{g['month']['month_id']}?tab=transactions"
        for user_id in filter(None, [group.user1_id, group.user2_id]):
            send_notification(db, user_id, title=title, body=body, url=url)

    for r in report:
        key = f"bank_import_failing:{r['connection_id']}"
        flag = db.get(models.AppConfig, key)
        if "error" not in r:
            if flag:
                db.delete(flag)
            continue
        if flag:
            continue
        limit = "429" in r["error"] or "RATE_LIMIT" in r["error"]
        send_notification(db, r["user_id"], title=txt["error"],
                          body=txt["error_limit" if limit else "error_other"], url="/settings/bank")
        db.add(models.AppConfig(key=key, value=date.today().isoformat()))
    db.commit()


RETRY_KEY = "bank_import_retry:"


def _retry_later(r: dict) -> bool:
    """Échec à retenter à midi : banque injoignable ou en panne, pas un refus pour trop de lectures
    (un nouvel essai le jour même serait refusé lui aussi)."""
    return "error" in r and not ("429" in r["error"] or "RATE_LIMIT" in r["error"])


def _auto_import_enabled() -> bool:
    # AUTO_IMPORT=0 coupe l'import (instance de dev : elle partage la connexion bancaire de la prod
    # et doublerait les lectures, limitées à environ 4 par jour par la banque)
    return enablebanking.is_configured() and os.environ.get("AUTO_IMPORT", "1") != "0"


def import_bank_transactions(today: date = None):
    """Chaque matin : les nouveaux débits de la banque arrivent seuls dans le mois en cours.
    Une banque injoignable est relue une fois à midi ; on ne prévient de l'échec qu'après ce second essai."""
    if not _auto_import_enabled():
        return
    today = today or date.today()
    db = SessionLocal()
    try:
        report = bank_sync.auto_import(db, today=today)
        later = [r for r in report if _retry_later(r)]
        for r in later:
            db.merge(models.AppConfig(key=f"{RETRY_KEY}{r['connection_id']}", value=today.isoformat()))
        db.commit()
        notify_import_results(db, [r for r in report if r not in later])
    except Exception:
        logger.exception("Automatic bank import failed")
    finally:
        db.close()


def retry_bank_import(today: date = None):
    """Midi : nouvel essai, une seule fois, pour les banques en échec ce matin."""
    if not _auto_import_enabled():
        return
    today = today or date.today()
    db = SessionLocal()
    try:
        flags = db.query(models.AppConfig).filter(models.AppConfig.key.startswith(RETRY_KEY)).all()
        ids = {int(f.key[len(RETRY_KEY):]) for f in flags if f.value == today.isoformat()}
        for f in flags:
            db.delete(f)
        db.commit()
        if ids:
            logger.info("Import automatique : nouvel essai pour %s", sorted(ids))
            notify_import_results(db, bank_sync.auto_import(db, today=today, only=ids))
    except Exception:
        logger.exception("Automatic bank import retry failed")
    finally:
        db.close()


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    # Tous les jours à 9h
    scheduler.add_job(send_monthly_reminders, CronTrigger(hour=9, minute=0))
    scheduler.add_job(send_bank_expiry_reminders, CronTrigger(hour=9, minute=5))
    # 7 h à Paris (le conteneur est à l'heure UTC)
    scheduler.add_job(import_bank_transactions, CronTrigger(hour=7, minute=0, timezone="Europe/Paris"))
    scheduler.add_job(retry_bank_import, CronTrigger(hour=12, minute=0, timezone="Europe/Paris"))
    return scheduler
