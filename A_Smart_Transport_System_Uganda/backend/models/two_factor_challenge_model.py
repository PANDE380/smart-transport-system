from datetime import datetime, timezone

try:
    from ..database import db
except ImportError:
    from database import db


class TwoFactorChallenge(db.Model):
    __tablename__ = 'two_factor_challenges'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey('users.id'), nullable=False, index=True
    )
    method = db.Column(db.String(20), nullable=False)
    code = db.Column(db.String(6), nullable=False)
    is_used = db.Column(db.Boolean, nullable=False, default=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = db.relationship(
        'User',
        backref=db.backref(
            'two_factor_challenges',
            lazy=True,
            cascade='all, delete-orphan'
        )
    )

    def is_expired(self):
        expires_at = self.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return expires_at <= datetime.now(timezone.utc)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'method': self.method,
            'is_used': self.is_used,
            'expires_at': self.expires_at.isoformat(),
            'created_at': self.created_at.isoformat()
        }
