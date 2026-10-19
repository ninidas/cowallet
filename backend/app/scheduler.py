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
            send_notification(db, conn.user_id, title=title.format(n=days), body=body, url="/settings")
            logger.info("Bank expiry reminder (%s) sent to user_id=%s", kind, conn.user_id)
    except Exception:
        logger.exception("Bank expiry reminders failed")
    finally:
        db.close()


def import_bank_transactions():
    """Chaque matin : les nouveaux débits de la banque arrivent seuls dans le mois en cours.
    AUTO_IMPORT=0 le coupe (instance de dev : elle partage la connexion bancaire de la prod et
    doublerait les lectures, limitées à environ 4 par jour par la banque)."""
    if not enablebanking.is_configured() or os.environ.get("AUTO_IMPORT", "1") == "0":
        return
    db = SessionLocal()
    try:
        bank_sync.auto_import(db)
    except Exception:
        logger.exception("Automatic bank import failed")
    finally:
        db.close()


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    # Tous les jours à 9h
    scheduler.add_job(send_monthly_reminders, CronTrigger(hour=9, minute=0))
    scheduler.add_job(send_bank_expiry_reminders, CronTrigger(hour=9, minute=5))
    # 7 h à Paris (le conteneur est à l'heure UTC)
    scheduler.add_job(import_bank_transactions, CronTrigger(hour=7, minute=0, timezone="Europe/Paris"))
    return scheduler
