try:
    from ..database import db
except ImportError:
    from database import db


class Driver(db.Model):
    __tablename__ = 'drivers'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    license_number = db.Column(db.String(50), unique=True, nullable=False)
    is_approved = db.Column(db.Boolean, default=False)

    user = db.relationship('User', back_populates='driver_profile')
    vehicles = db.relationship(
        'Vehicle', back_populates='driver', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'license_number': self.license_number,
            'is_approved': self.is_approved
        }
