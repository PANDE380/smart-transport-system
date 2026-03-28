from datetime import datetime, timezone

try:
    from ..database import db
except ImportError:
    from database import db


class TwoFactorSetting(db.Model):
    __tablename__ = 'two_factor_settings'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False
    )
    method = db.Column(db.String(20), nullable=False, default='sms')
    is_enabled = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = db.relationship(
        'User',
        backref=db.backref(
            'two_factor_setting',
            uselist=False,
            cascade='all, delete-orphan'
        )
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'method': self.method,
            'is_enabled': self.is_enabled,
            'created_at': self.created_at.isoformat()
        }
