import os
from datetime import datetime, timezone

try:
    from ..database import db
except ImportError:
    from database import db


class ProfileImage(db.Model):
    __tablename__ = 'profile_images'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False
    )
    storage_path = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=True)
    content_type = db.Column(db.String(100), nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    user = db.relationship(
        'User',
        backref=db.backref(
            'profile_image',
            uselist=False,
            cascade='all, delete-orphan'
        )
    )

    def public_url(self):
        normalized = self.storage_path.replace(os.sep, '/')
        return f'/{normalized}'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'storage_path': self.storage_path,
            'public_url': self.public_url(),
            'original_name': self.original_name,
            'content_type': self.content_type,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
