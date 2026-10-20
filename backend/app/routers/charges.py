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
NOTIF_CHARGE_UPDATED_SERIES = {
    "en": "{user} updated '{label}' from {old}€ to {new}€ on {n} months. Your share on settled months: {delta:+.0f}€",
    "fr": "{user} a modifié '{label}' de {old}€ à {new}€ sur {n} mois. Ta part sur les mois réglés : {delta:+.0f}€",
}
NOTIF_CHARGE_DELETED = {
    "en": "{user} deleted '{label}' ({amount}€) on {month}",
    "fr": "{user} a supprimé '{label}' ({amount}€) sur {month}",
}


def _effective(c) -> float:
    """Montant réel si renseigné, sinon le montant prévu (comme les totaux du mois)."""
    return c.actual_amount if c.actual_amount is not None else c.amount


def _eur(x: float) -> str:
    """12.5 -> « 12,50 » en français, « 12.50 » en anglais."""
    s = f"{x:.2f}"
    return s.replace(".", ",") if APP_LANG == "fr" else s


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


def _following_months(db: Session, group: models.Group, month: models.Month) -> list:
    return db.query(models.Month).filter_by(group_id=group.id).filter(
        (models.Month.year > month.year) |
        ((models.Month.year == month.year) & (models.Month.month > month.month))
    ).order_by(models.Month.year, models.Month.month).all()


def _copy_recurring(db: Session, charge: models.Charge, months: list) -> int:
    """Recopie une dépense récurrente dans les mois déjà créés après le sien. Un mois qui a déjà une dépense
    de ce nom la garde (son montant peut différer) et la marque récurrente. Renvoie le nombre de mois touchés."""
    n = 0
    for m in months:
        existing = db.query(models.Charge).filter(
            models.Charge.month_id == m.id,
            models.Charge.label == charge.label,
        ).first()
        if existing:
            if not existing.is_recurring:
                existing.is_recurring = True
                n += 1
            continue
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
        n += 1
    return n


def split_installments(total: float, n: int) -> tuple:
    """(1re échéance, échéances suivantes) : 100 € en 3 fois -> 33,34 € puis 33,33 €, comme PayPal
    (vol de Prague : 219,34 € puis 219,33 €). Avant : 3 × 33,33 € = 99,99 €."""
    cents = round(total * 100)
    rest = cents // n
    return (cents - rest * (n - 1)) / 100, rest / 100


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

    data = body.model_dump(exclude={"total_amount"})
    per_installment = data["amount"]
    if body.total_amount and body.installments_total > 1:
        data["amount"], per_installment = split_installments(body.total_amount, body.installments_total)
    charge = models.Charge(month_id=month_id, **data)
    if body.installments_total > 1:
        charge.installment_amount = per_installment
    db.add(charge)
    db.flush()

    if body.is_recurring or body.installments_total > 1:
        subsequent_months = _following_months(db, group, month)

        remaining = body.installments_left - 1
        if body.is_recurring:
            _copy_recurring(db, charge, subsequent_months)
        else:
            for m in subsequent_months:
                if remaining <= 0:
                    break
                db.add(models.Charge(
                    month_id=m.id,
                    label=charge.label,
                    amount=per_installment,
                    installment_amount=per_installment,
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
                amount=_eur(charge.amount),
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

    old_amount = _effective(charge)
    was_recurring = bool(charge.is_recurring)
    old_values = {f: getattr(charge, f) for f in SERIES_FIELDS}
    siblings = _series_siblings(db, group, charge, body.scope)
    for field, value in body.model_dump(exclude_unset=True, exclude={"scope"}).items():
        setattr(charge, field, value)
    # Même correction sur les autres mois de la dépense : seulement ce qui a changé ici
    changed = {f: getattr(charge, f) for f in SERIES_FIELDS if getattr(charge, f) != old_values[f]}
    if "amount" in changed:
        charge.installment_amount = None
        changed["installment_amount"] = None
    if not changed:
        siblings = []
    series_delta, series_months, any_settled = 0.0, 1, False
    for sib in siblings:
        before = _effective(sib)
        for f, v in changed.items():
            setattr(sib, f, v)
        if _both_transferred(sib.month):
            any_settled = True
            series_delta += (_effective(sib) - before) * _partner_share(group, sib.month, current_user.id)
        series_months += 1
    # Rendue récurrente après coup : elle rejoint aussi les mois suivants déjà créés (avant : seulement les mois créés plus tard)
    copied = 0
    if charge.is_recurring and not was_recurring and charge.installments_total <= 1:
        copied = _copy_recurring(db, charge, _following_months(db, group, charge.month))
    db.commit()
    db.refresh(charge)
    charge.also_updated = len(siblings) + copied

    new_amount = _effective(charge)
    if siblings and "amount" in changed:
        # Une seule notification qui résume tous les mois touchés, pas une par mois
        partner_id = _partner_id(group, current_user.id)
        month = charge.month
        if _both_transferred(month):
            any_settled = True
            series_delta += (new_amount - old_amount) * _partner_share(group, month, current_user.id)
        # Comme pour un seul mois : on ne prévient que si un mois déjà réglé change
        if partner_id and any_settled:
            send_notification(
                db, partner_id,
                title=NOTIF_CHARGE_UPDATED_SERIES.get(APP_LANG, NOTIF_CHARGE_UPDATED_SERIES["en"]).format(
                    user=current_user.get_display_name(), label=charge.label,
                    old=_eur(old_amount), new=_eur(new_amount), n=series_months, delta=series_delta,
                ),
                body="",
                url=f"/months/{month.id}",
            )
    elif _both_transferred(db.query(models.Month).filter_by(id=charge.month_id).first()):
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
                    old=_eur(old_amount),
                    new=_eur(new_amount),
                    delta=delta,
                ),
                body="",
                url=f"/months/{month.id}",
            )

    return charge


# Ce qu'une correction recopie sur les autres mois ; le montant réel, le payeur et la note restent propres à chaque mois
SERIES_FIELDS = ("label", "amount", "category", "payment_type")


def _series_siblings(db: Session, group: models.Group, charge: models.Charge, scope: str) -> list:
    """La même dépense dans les autres mois du groupe.
    Récurrente : même libellé, marquée récurrente. En plusieurs fois : même libellé, même nombre d'échéances
    et l'échéance attendue pour ce mois-là (deux achats du même nom ne se mélangent pas)."""
    if scope not in ("following", "all") or not (charge.is_recurring or charge.installments_total > 1):
        return []
    here = charge.month.year * 12 + charge.month.month
    result = []
    others = (db.query(models.Charge).join(models.Month)
              .filter(models.Month.group_id == group.id, models.Charge.id != charge.id,
                      models.Charge.label == charge.label).all())
    for c in others:
        at = c.month.year * 12 + c.month.month
        if at == here or (scope == "following" and at < here):
            continue
        if charge.installments_total > 1:
            if c.installments_total != charge.installments_total or c.installments_left != charge.installments_left - (at - here):
                continue
        elif not c.is_recurring:
            continue
        result.append(c)
    return result


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
    subsequent_months = _following_months(db, group, month)

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
    label, amount, month_label, month_id = charge.label, _effective(charge), month.label, month.id
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
                    amount=_eur(amount),
                    month=month_label,
                ),
                body="",
                url=f"/months/{month_id}",
            )
