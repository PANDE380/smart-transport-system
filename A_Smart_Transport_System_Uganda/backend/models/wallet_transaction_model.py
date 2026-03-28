from datetime import datetime, timezone

try:
    from ..database import db
except ImportError:
    from database import db


class WalletTransaction(db.Model):
    __tablename__ = 'wallet_transactions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey('users.id'), nullable=False, index=True
    )
    trip_id = db.Column(
        db.Integer, db.ForeignKey('trips.id'), nullable=True, index=True
    )
    amount = db.Column(db.Float, nullable=False)
    transaction_type = db.Column(db.String(30), nullable=False)
    payment_method = db.Column(db.String(50), nullable=False)
    reference = db.Column(db.String(100), unique=True, nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'trip_id': self.trip_id,
            'amount': self.amount,
            'transaction_type': self.transaction_type,
            'payment_method': self.payment_method,
            'reference': self.reference,
            'created_at': self.created_at.isoformat()
        }
