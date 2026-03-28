from datetime import datetime, timezone

try:
    from ..database import db
except ImportError:
    from database import db


class Payment(db.Model):
    __tablename__ = 'payments'
    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey('trips.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    # pending, completed, failed
    status = db.Column(db.String(20), default='pending')
    payment_method = db.Column(db.String(50), default='Mobile Money')
    transaction_id = db.Column(db.String(100), unique=True, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    trip = db.relationship('Trip', back_populates='payment')

    def to_dict(self):
        return {
            'id': self.id,
            'trip_id': self.trip_id,
            'amount': self.amount,
            'status': self.status,
            'payment_method': self.payment_method,
            'transaction_id': self.transaction_id,
            'created_at': self.created_at.isoformat()
        }
