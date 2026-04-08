import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user, get_current_group
from .push import send_notification

router = APIRouter(prefix="/months", tags=["months"])

DEFAULT_USER1_SHARE = int(os.environ.get("DEFAULT_USER1_SHARE", "50"))

MONTH_LABELS = [
    "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
]


def effective_amount(c) -> float:
    """Retourne le montant réel si renseigné, sinon le montant prévu."""
    return c.actual_amount if c.actual_amount is not None else c.amount


def compute_totals(month: models.Month) -> dict:
    total = sum(effective_amount(c) for c in month.charges)
    user1_ratio = month.user1_share / 100
    user2_ratio = 1 - user1_ratio

    user1_due = total * user1_ratio
    user2_due = total * user2_ratio

    user1_advanced = sum(effective_amount(c) for c in month.charges if c.paid_by == 1)
    user2_advanced = sum(effective_amount(c) for c in month.charges if c.paid_by == 2)

    return {
        "total": round(total, 2),
        "user1_due": round(user1_due, 2),
        "user2_due": round(user2_due, 2),
        "user1_to_transfer": round(max(0, user1_due - user1_advanced), 2),
        "user2_to_transfer": round(max(0, user2_due - user2_advanced), 2),
    }


def _to_summary(m: models.Month) -> schemas.MonthSummary:
    totals = compute_totals(m)
    return schemas.MonthSummary(
        id=m.id, label=m.label, year=m.year, month=m.month,
        user1_share=m.user1_share, user2_share=100 - m.user1_share,
        user1_transferred=m.user1_transferred,
        user2_transferred=m.user2_transferred,
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
            prev_total  = round(sum(c.amount for c in prev.charges), 2)
    return schemas.MonthDetail(
        id=m.id, label=m.label, year=m.year, month=m.month,
        user1_share=m.user1_share, user2_share=100 - m.user1_share,
        user1_transferred=m.user1_transferred,
        user2_transferred=m.user2_transferred,
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
def create_month(body: schemas.MonthCreate, db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    existing = db.query(models.Month).filter_by(group_id=group.id).filter(
        models.Month.year == body.year, models.Month.month == body.month
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ce mois existe déjà")

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
                db.add(models.Charge(
                    month_id=month.id, label=c.label, amount=c.amount,
                    category=c.category, payment_type=c.payment_type,
                    is_recurring=False, paid_by=None,
                    installments_total=c.installments_total,
                    installments_left=c.installments_left - 1,
                ))

    db.commit()
    db.refresh(month)
    return _to_detail(month, db)


@router.get("/{month_id}", response_model=schemas.MonthDetail)
def get_month(month_id: int, db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    month = db.query(models.Month).filter_by(id=month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    return _to_detail(month, db)


@router.patch("/{month_id}/transfer", response_model=schemas.MonthDetail)
def update_transfer(
    month_id: int, body: schemas.TransferUpdate,
    db: Session = Depends(get_db), group: models.Group = Depends(get_current_group),
):
    month = db.query(models.Month).filter_by(id=month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    if body.user1_transferred is not None:
        month.user1_transferred = body.user1_transferred
    if body.user2_transferred is not None:
        month.user2_transferred = body.user2_transferred
    db.commit()
    db.refresh(month)
    return _to_detail(month, db)


@router.patch("/{month_id}/share", response_model=schemas.MonthDetail)
def update_share(
    month_id: int, body: schemas.ShareUpdate,
    db: Session = Depends(get_db), group: models.Group = Depends(get_current_group),
):
    month = db.query(models.Month).filter_by(id=month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    month.user1_share = body.user1_share
    db.commit()
    db.refresh(month)
    return _to_detail(month, db)


@router.post("/{month_id}/validate", response_model=schemas.MonthDetail)
def validate_month(
    month_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    group: models.Group = Depends(get_current_group),
):
    month = db.query(models.Month).filter_by(id=month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Mois introuvable")

    # Toggle : re-cliquer dévalide
    month.validated_by = None if month.validated_by == current_user.id else current_user.id
    db.commit()
    db.refresh(month)

    # Notifier le partenaire si validation (pas dévalidation)
    if month.validated_by == current_user.id:
        partner_id = group.user2_id if group.user1_id == current_user.id else group.user1_id
        if partner_id:
            totals = compute_totals(month)
            send_notification(
                db, partner_id,
                title=f"{current_user.username} a validé {month.label}",
                body=f"Total du mois : {totals['total']:.2f}€",
                url=f"/months/{month.id}",
            )

    return _to_detail(month, db)


@router.delete("/{month_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_month(month_id: int, db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    month = db.query(models.Month).filter_by(id=month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    db.delete(month)
    db.commit()
