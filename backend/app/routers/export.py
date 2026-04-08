import csv
import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..auth import get_current_group

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/csv")
def export_csv(db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    months = db.query(models.Month).filter_by(group_id=group.id).order_by(
        models.Month.year, models.Month.month
    ).all()

    users = {u.id: u.username for u in db.query(models.User).all()}

    buf = io.StringIO()
    buf.write("\ufeff")  # BOM UTF-8 pour Excel
    writer = csv.writer(buf, delimiter=";")
    writer.writerow([
        "Mois", "Catégorie", "Libellé", "Montant",
        "Type de paiement", "Récurrente", "Avancé par",
        "Total mois", "Répartition", "Part user1", "Part user2",
        "Virement user1 effectué", "Virement user2 effectué",
    ])

    for month in months:
        total = sum(c.amount for c in month.charges)
        u1_due = round(total * month.user1_share / 100, 2)
        u2_due = round(total * (1 - month.user1_share / 100), 2)

        for charge in month.charges:
            writer.writerow([
                month.label,
                charge.category if charge.category else "",
                charge.label,
                f"{charge.amount:.2f}".replace(".", ","),
                charge.payment_type if charge.payment_type else "",
                "Oui" if charge.is_recurring else "Non",
                users.get(charge.paid_by, "") if charge.paid_by else "",
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
