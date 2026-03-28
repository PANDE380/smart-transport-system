try:
    from ..database import db
except ImportError:
    from database import db


class Wallet(db.Model):
    __tablename__ = 'wallets'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey(
        'users.id'), unique=True, nullable=False)
    balance = db.Column(db.Float, default=0.0)
    card_number = db.Column(db.String(20), unique=True, nullable=False)

    user = db.relationship('User', back_populates='wallet')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'balance': self.balance,
            'card_number': self.card_number
        }
