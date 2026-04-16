import os
import logging
from datetime import date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .database import SessionLocal
from . import models
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


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    # Tous les jours à 9h
    scheduler.add_job(send_monthly_reminders, CronTrigger(hour=9, minute=0))
    return scheduler
