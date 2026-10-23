import csv
import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..auth import get_current_group
from .months import compute_totals, effective_amount

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/csv")
def export_csv(db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    months = db.query(models.Month).filter_by(group_id=group.id).order_by(
        models.Month.year, models.Month.month
    ).all()

    # paid_by vaut 1 ou 2 : le rôle dans le groupe, pas un identifiant d'utilisateur
    def _name(user_id):
        u = db.query(models.User).filter_by(id=user_id).first() if user_id else None
        return u.get_display_name() if u else ""
    payers = {1: _name(group.user1_id), 2: _name(group.user2_id)}

    buf = io.StringIO()
    buf.write("\ufeff")  # BOM UTF-8 pour Excel
    writer = csv.writer(buf, delimiter=";")

    def cell(value) -> str:
        """Texte saisi par l'un ou l'autre : neutralisé s'il commencerait une formule dans Excel ou LibreOffice."""
        value = value or ""
        return "'" + value if value[:1] in ("=", "+", "-", "@", "\t", "\r") else value

    writer.writerow([
        "Mois", "Catégorie", "Libellé", "Montant", "Montant prévu",
        "Type de paiement", "Récurrente", "Avancé par",
        "Total mois", "Répartition", "Part user1", "Part user2",
        "Virement user1 effectué", "Virement user2 effectué",
    ])

    for month in months:
        totals = compute_totals(month)
        total, u1_due, u2_due = totals["total"], totals["user1_due"], totals["user2_due"]

        for charge in month.charges:
            writer.writerow([
                cell(month.label),
                cell(charge.category),
                cell(charge.label),
                f"{effective_amount(charge):.2f}".replace(".", ","),
                f"{charge.amount:.2f}".replace(".", ","),
                cell(charge.payment_type),
                "Oui" if charge.is_recurring else "Non",
                cell(payers.get(charge.paid_by, "")),
                f"{total:.2f}".replace(".", ","),
                f"{month.user1_share}/{100 - month.user1_share}",
                f"{u1_due:.2f}".replace(".", ","),
                f"{u2_due:.2f}".replace(".", ","),
                "Oui" if month.user1_transferred else "Non",
                "Oui" if month.user2_transferred else "Non",
            ])

    buf.seek(0)
    from datetime import date
    filename = f"cowallet-export-{date.today().strftime('%Y-%m-%d')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
