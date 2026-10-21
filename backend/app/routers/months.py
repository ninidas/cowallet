import os
import logging

APP_LANG = os.environ.get("APP_LANG", "en").lower()

NOTIF_TRANSFERRED = {
    "en": "{user} made the transfer for {label}",
    "fr": "{user} a effectué le virement pour {label}",
}
NOTIF_MONTH_CREATED = {
    "en": "{user} created the month {label}",
    "fr": "{user} a créé le mois {label}",
}
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

logger = logging.getLogger(__name__)

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user, get_current_group
from .push import send_notification

router = APIRouter(prefix="/months", tags=["months"])

DEFAULT_USER1_SHARE = int(os.environ.get("DEFAULT_USER1_SHARE", "50"))

_MONTH_LABELS = {
    "en": ["", "January", "February", "March", "April", "May", "June",
           "July", "August", "September", "October", "November", "December"],
    "fr": ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
           "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
}
MONTH_LABELS = _MONTH_LABELS.get(APP_LANG, _MONTH_LABELS["en"])


def effective_amount(c) -> float:
    """Retourne le montant réel si renseigné, sinon le montant prévu."""
    return c.actual_amount if c.actual_amount is not None else c.amount


def compute_totals(month: models.Month) -> dict:
    total = round(sum(effective_amount(c) for c in month.charges), 2)
    # Les deux parts font toujours exactement le total : la seconde prend le centime d'arrondi
    user1_due = round(total * month.user1_share / 100, 2)
    user2_due = round(total - user1_due, 2)

    user1_advanced = sum(effective_amount(c) for c in month.charges if c.paid_by == 1)
    user2_advanced = sum(effective_amount(c) for c in month.charges if c.paid_by == 2)

    return {
        "total": total,
        "user1_due": user1_due,
        "user2_due": user2_due,
        "user1_to_transfer": round(max(0, user1_due - user1_advanced), 2),
        "user2_to_transfer": round(max(0, user2_due - user2_advanced), 2),
        # A avancé plus que sa part : le compte commun lui doit la différence (avant : perdue, affichée 0 €)
        "user1_to_receive": round(max(0, user1_advanced - user1_due), 2),
        "user2_to_receive": round(max(0, user2_advanced - user2_due), 2),
    }


def _uncategorized(m: models.Month) -> int:
    return sum(1 for t in m.bank_transactions if not t.category)


def _to_summary(m: models.Month) -> schemas.MonthSummary:
    totals = compute_totals(m)
    return schemas.MonthSummary(
        id=m.id, label=m.label, year=m.year, month=m.month,
        user1_share=m.user1_share, user2_share=100 - m.user1_share,
        user1_transferred=m.user1_transferred,
        user2_transferred=m.user2_transferred,
        validated_by=m.validated_by,
        uncategorized=_uncategorized(m),
        planned=round(sum(c.amount for c in m.charges), 2),
        spent=round(sum(t.amount for t in m.bank_transactions), 2) if m.bank_transactions else None,
        spent_from=min((t.date for t in m.bank_transactions), default=None),
        spent_to=max((t.date for t in m.bank_transactions), default=None),
        total=totals["total"],
        user1_due=totals["user1_due"],
        user2_due=totals["user2_due"],
    )



def _build_charges(m: models.Month, prev_lookup: dict) -> list:
    result = []
    for c in m.charges:
        out = schemas.ChargeOut.from_orm(c)
        prev_amount = prev_lookup.get((c.label, c.category))
        if prev_amount is not None and prev_amount != c.amount:
            out.delta = round(c.amount - prev_amount, 2)
        result.append(out)
    return result


def _to_detail(m: models.Month, db: Session = None) -> schemas.MonthDetail:
    totals = compute_totals(m)
    prev_lookup = {}
    prev_total = None
    if db:
        prev = db.query(models.Month).filter(
            models.Month.group_id == m.group_id,
            (models.Month.year < m.year) |
            ((models.Month.year == m.year) & (models.Month.month < m.month))
        ).order_by(models.Month.year.desc(), models.Month.month.desc()).first()
        if prev:
            prev_lookup = {(c.label, c.category): c.amount for c in prev.charges}
            prev_total  = compute_totals(prev)["total"]
    return schemas.MonthDetail(
        id=m.id, label=m.label, year=m.year, month=m.month,
        user1_share=m.user1_share, user2_share=100 - m.user1_share,
        user1_transferred=m.user1_transferred,
        user2_transferred=m.user2_transferred,
        validated_by=m.validated_by,
        uncategorized=_uncategorized(m),
        prev_total=prev_total,
        charges=_build_charges(m, prev_lookup),
        **totals,
    )


@router.get("", response_model=List[schemas.MonthSummary])
def list_months(db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    months = db.query(models.Month).filter_by(group_id=group.id).order_by(
        models.Month.year.desc(), models.Month.month.desc()
    ).all()
    return [_to_summary(m) for m in months]


@router.post("", response_model=schemas.MonthDetail, status_code=status.HTTP_201_CREATED)
def create_month(body: schemas.MonthCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user), group: models.Group = Depends(get_current_group)):
    existing = db.query(models.Month).filter_by(group_id=group.id).filter(
        models.Month.year == body.year, models.Month.month == body.month
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Month already exists")

    label = f"{MONTH_LABELS[body.month]} {body.year}"
    month = models.Month(
        group_id=group.id, label=label, year=body.year, month=body.month,
        user1_share=body.user1_share,
    )
    db.add(month)
    db.flush()

    prev = db.query(models.Month).filter_by(group_id=group.id).filter(
        (models.Month.year < body.year) |
        ((models.Month.year == body.year) & (models.Month.month < body.month))
    ).order_by(models.Month.year.desc(), models.Month.month.desc()).first()

    if not prev:
        prev = db.query(models.Month).filter_by(group_id=group.id).filter(
            (models.Month.year > body.year) |
            ((models.Month.year == body.year) & (models.Month.month > body.month))
        ).order_by(models.Month.year.asc(), models.Month.month.asc()).first()

    if prev:
        for c in prev.charges:
            if c.is_recurring:
                db.add(models.Charge(
                    month_id=month.id, label=c.label, amount=c.amount,
                    category=c.category, payment_type=c.payment_type,
                    is_recurring=True, paid_by=None,
                    installments_total=1, installments_left=1,
                ))
            elif c.installments_left > 1:
                # Jamais le montant de la 1re échéance (33,34 € de 100 € en 3 fois) : celui des suivantes
                db.add(models.Charge(
                    month_id=month.id, label=c.label,
                    amount=c.installment_amount if c.installment_amount is not None else c.amount,
                    installment_amount=c.installment_amount,
                    category=c.category, payment_type=c.payment_type,
                    is_recurring=False, paid_by=None,
                    installments_total=c.installments_total,
                    installments_left=c.installments_left - 1,
                ))

    db.commit()
    db.refresh(month)

    partner_id = group.user2_id if group.user1_id == current_user.id else group.user1_id
    if partner_id:
        send_notification(
            db, partner_id,
            title=NOTIF_MONTH_CREATED.get(APP_LANG, NOTIF_MONTH_CREATED["en"]).format(
                user=current_user.get_display_name(), label=month.label
            ),
            body="",
            url=f"/months/{month.id}", kind="partner",
        )

    return _to_detail(month, db)


@router.get("/{month_id}", response_model=schemas.MonthDetail)
def get_month(month_id: int, db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    month = db.query(models.Month).filter_by(id=month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Month not found")
    return _to_detail(month, db)


@router.patch("/{month_id}/transfer", response_model=schemas.MonthDetail)
def update_transfer(
    month_id: int, body: schemas.TransferUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    group: models.Group = Depends(get_current_group),
):
    month = db.query(models.Month).filter_by(id=month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Month not found")

    is_user1 = group.user1_id == current_user.id
    prev_transferred = month.user1_transferred if is_user1 else month.user2_transferred

    if body.user1_transferred is not None:
        month.user1_transferred = body.user1_transferred
    if body.user2_transferred is not None:
        month.user2_transferred = body.user2_transferred
    db.commit()
    db.refresh(month)

    new_transferred = month.user1_transferred if is_user1 else month.user2_transferred
    if not prev_transferred and new_transferred:
        partner_id = group.user2_id if is_user1 else group.user1_id
        if partner_id:
            send_notification(
                db, partner_id,
                title=NOTIF_TRANSFERRED.get(APP_LANG, NOTIF_TRANSFERRED["en"]).format(user=current_user.get_display_name(), label=month.label),
                body="",
                url=f"/months/{month.id}", kind="partner",
            )

    return _to_detail(month, db)


@router.patch("/{month_id}/share", response_model=schemas.MonthDetail)
def update_share(
    month_id: int, body: schemas.ShareUpdate,
    db: Session = Depends(get_db), group: models.Group = Depends(get_current_group),
):
    month = db.query(models.Month).filter_by(id=month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Month not found")
    month.user1_share = body.user1_share
    db.commit()
    db.refresh(month)
    return _to_detail(month, db)


@router.delete("/bulk", status_code=status.HTTP_204_NO_CONTENT)
def bulk_delete_months(
    body: schemas.BulkDeleteMonths,
    db: Session = Depends(get_db),
    group: models.Group = Depends(get_current_group),
):
    if not body.ids:
        return
    # Verify months belong to current group before deleting
    valid_ids = [
        m.id for m in db.query(models.Month.id).filter(
            models.Month.id.in_(body.ids),
            models.Month.group_id == group.id,
        ).all()
    ]
    if not valid_ids:
        return
    # Explicitly delete charges and imported bank transactions first (synchronize_session=False bypasses ORM cascade)
    db.query(models.Charge).filter(models.Charge.month_id.in_(valid_ids)).delete(synchronize_session=False)
    db.query(models.BankTransaction).filter(models.BankTransaction.month_id.in_(valid_ids)).delete(synchronize_session=False)
    db.query(models.Month).filter(models.Month.id.in_(valid_ids)).delete(synchronize_session=False)
    db.commit()


@router.delete("/{month_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_month(month_id: int, db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    month = db.query(models.Month).filter_by(id=month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Month not found")
    db.delete(month)
    db.commit()
