import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user, get_current_group
from .push import send_notification

APP_LANG = os.environ.get("APP_LANG", "en").lower()

NOTIF_CHARGE_ADDED = {
    "en": "{user} added '{label}' ({amount}€) on {month}",
    "fr": "{user} a ajouté '{label}' ({amount}€) sur {month}",
}
NOTIF_CHARGE_UPDATED = {
    "en": "{user} updated '{label}' from {old}€ to {new}€. Your share: {delta:+.0f}€",
    "fr": "{user} a modifié '{label}' de {old}€ à {new}€. Ta part : {delta:+.0f}€",
}
NOTIF_CHARGE_DELETED = {
    "en": "{user} deleted '{label}' ({amount}€) on {month}",
    "fr": "{user} a supprimé '{label}' ({amount}€) sur {month}",
}


def _both_transferred(month: models.Month) -> bool:
    return bool(month.user1_transferred and month.user2_transferred)


def _partner_id(group: models.Group, current_user_id: int):
    return group.user2_id if group.user1_id == current_user_id else group.user1_id


def _partner_share(group: models.Group, month: models.Month, current_user_id: int) -> float:
    """Retourne la part (0-1) du partenaire."""
    user1_share = month.user1_share / 100
    if group.user1_id == current_user_id:
        return 1 - user1_share  # partenaire = user2
    return user1_share  # partenaire = user1

router = APIRouter(tags=["charges"])


@router.get("/charges/suggestions", response_model=List[schemas.ChargeSuggestion])
def get_suggestions(db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    """Retourne le dernier usage de chaque libellé distinct, trié alphabétiquement."""
    group_month_ids = db.query(models.Month.id).filter_by(group_id=group.id).subquery()
    subq = (
        db.query(models.Charge.label, func.max(models.Charge.id).label("max_id"))
        .filter(models.Charge.month_id.in_(group_month_ids))
        .group_by(models.Charge.label)
        .subquery()
    )
    charges = (
        db.query(models.Charge)
        .join(subq, models.Charge.id == subq.c.max_id)
        .order_by(models.Charge.label)
        .all()
    )
    return charges


@router.post("/months/{month_id}/charges", response_model=schemas.ChargeOut, status_code=status.HTTP_201_CREATED)
def add_charge(
    month_id: int,
    body: schemas.ChargeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    group: models.Group = Depends(get_current_group),
):
    month = db.query(models.Month).filter_by(id=month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Month not found")

    charge = models.Charge(month_id=month_id, **body.model_dump())
    db.add(charge)
    db.flush()

    if body.is_recurring or body.installments_total > 1:
        subsequent_months = db.query(models.Month).filter_by(group_id=group.id).filter(
            (models.Month.year > month.year) |
            ((models.Month.year == month.year) & (models.Month.month > month.month))
        ).order_by(models.Month.year, models.Month.month).all()

        remaining = body.installments_left - 1
        for m in subsequent_months:
            if body.is_recurring:
                existing = db.query(models.Charge).filter(
                    models.Charge.month_id == m.id,
                    models.Charge.label == charge.label,
                ).first()
                if existing:
                    existing.is_recurring = True
                else:
                    db.add(models.Charge(
                        month_id=m.id,
                        label=charge.label,
                        amount=charge.amount,
                        category=charge.category,
                        payment_type=charge.payment_type,
                        is_recurring=True,
                        paid_by=None,
                        installments_total=1,
                        installments_left=1,
                    ))
            else:
                if remaining <= 0:
                    break
                db.add(models.Charge(
                    month_id=m.id,
                    label=charge.label,
                    amount=charge.amount,
                    category=charge.category,
                    payment_type=charge.payment_type,
                    is_recurring=False,
                    paid_by=None,
                    installments_total=charge.installments_total,
                    installments_left=remaining,
                ))
                remaining -= 1

    db.commit()
    db.refresh(charge)

    partner_id = _partner_id(group, current_user.id)
    if partner_id:
        send_notification(
            db, partner_id,
            title=NOTIF_CHARGE_ADDED.get(APP_LANG, NOTIF_CHARGE_ADDED["en"]).format(
                user=current_user.get_display_name(),
                label=charge.label,
                amount=charge.amount,
                month=month.label,
            ),
            body="",
            url=f"/months/{month.id}",
        )

    return charge


@router.put("/charges/{charge_id}", response_model=schemas.ChargeOut)
def update_charge(
    charge_id: int, body: schemas.ChargeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    group: models.Group = Depends(get_current_group),
):
    group_month_ids = [m.id for m in db.query(models.Month).filter_by(group_id=group.id).all()]
    charge = db.query(models.Charge).filter(
        models.Charge.id == charge_id, models.Charge.month_id.in_(group_month_ids)
    ).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")

    old_amount = charge.amount
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(charge, field, value)
    db.commit()
    db.refresh(charge)

    new_amount = charge.amount
    if _both_transferred(db.query(models.Month).filter_by(id=charge.month_id).first()):
        month = db.query(models.Month).filter_by(id=charge.month_id).first()
        partner_id = _partner_id(group, current_user.id)
        if partner_id and old_amount != new_amount:
            partner_share = _partner_share(group, month, current_user.id)
            delta = (new_amount - old_amount) * partner_share
            send_notification(
                db, partner_id,
                title=NOTIF_CHARGE_UPDATED.get(APP_LANG, NOTIF_CHARGE_UPDATED["en"]).format(
                    user=current_user.get_display_name(),
                    label=charge.label,
                    old=old_amount,
                    new=new_amount,
                    delta=delta,
                ),
                body="",
                url=f"/months/{month.id}",
            )

    return charge


@router.post("/charges/{charge_id}/fix-installments", response_model=schemas.ChargeOut)
def fix_installments(
    charge_id: int, body: schemas.FixInstallmentsBody,
    db: Session = Depends(get_db), group: models.Group = Depends(get_current_group),
):
    group_month_ids = [m.id for m in db.query(models.Month).filter_by(group_id=group.id).all()]
    charge = db.query(models.Charge).filter(
        models.Charge.id == charge_id, models.Charge.month_id.in_(group_month_ids)
    ).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")

    charge.installments_left = body.installments_left
    month = db.query(models.Month).filter_by(id=charge.month_id).first()
    subsequent_months = db.query(models.Month).filter_by(group_id=group.id).filter(
        (models.Month.year > month.year) |
        ((models.Month.year == month.year) & (models.Month.month > month.month))
    ).order_by(models.Month.year, models.Month.month).all()

    remaining = body.installments_left - 1
    for m in subsequent_months:
        matching = db.query(models.Charge).filter(
            models.Charge.month_id == m.id,
            models.Charge.label == charge.label,
            models.Charge.installments_total == charge.installments_total,
        ).first()
        if remaining <= 0:
            if matching:
                db.delete(matching)
            break
        else:
            if matching:
                matching.installments_left = remaining
        remaining -= 1

    db.commit()
    db.refresh(charge)
    return charge


@router.delete("/charges/{charge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_charge(
    charge_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    group: models.Group = Depends(get_current_group),
):
    group_month_ids = [m.id for m in db.query(models.Month).filter_by(group_id=group.id).all()]
    charge = db.query(models.Charge).filter(
        models.Charge.id == charge_id, models.Charge.month_id.in_(group_month_ids)
    ).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")

    month = db.query(models.Month).filter_by(id=charge.month_id).first()
    label, amount, month_label, month_id = charge.label, charge.amount, month.label, month.id
    both_done = _both_transferred(month)

    db.delete(charge)
    db.commit()

    if both_done:
        partner_id = _partner_id(group, current_user.id)
        if partner_id:
            send_notification(
                db, partner_id,
                title=NOTIF_CHARGE_DELETED.get(APP_LANG, NOTIF_CHARGE_DELETED["en"]).format(
                    user=current_user.get_display_name(),
                    label=label,
                    amount=amount,
                    month=month_label,
                ),
                body="",
                url=f"/months/{month_id}",
            )
