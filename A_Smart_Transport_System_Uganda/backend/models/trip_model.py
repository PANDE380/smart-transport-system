from datetime import datetime, timezone

try:
    from ..database import db
except ImportError:
    from database import db


class Trip(db.Model):
    __tablename__ = 'trips'
    id = db.Column(db.Integer, primary_key=True)
    passenger_id = db.Column(
        db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey(
        'vehicles.id'), nullable=False, index=True)
    start_location = db.Column(db.String(200), nullable=False)
    end_location = db.Column(db.String(200), nullable=False)
    fare = db.Column(db.Float, nullable=False)
    # pending, in_progress, completed, cancelled
    status = db.Column(db.String(20), default='pending', index=True)
    rating = db.Column(db.Integer, nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    is_sos = db.Column(db.Boolean, default=False)
    scheduled_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    passenger = db.relationship('User', backref=db.backref('trips', lazy=True))
    vehicle = db.relationship('Vehicle', back_populates='trips')
    payment = db.relationship('Payment', back_populates='trip', uselist=False)

    def to_dict(self):
        return {
            'id': self.id,
            'passenger_id': self.passenger_id,
            'vehicle_id': self.vehicle_id,
            'start_location': self.start_location,
            'end_location': self.end_location,
            'fare': self.fare,
            'status': self.status,
            'rating': self.rating,
            'feedback': self.feedback,
            'is_sos': self.is_sos,
            'scheduled_at': self.scheduled_at.isoformat() if self.scheduled_at else None,
            'created_at': self.created_at.isoformat(),
            'timestamp': self.created_at.strftime('%d %b %Y, %I:%M %p'),
            'passenger_name': self.passenger.name if self.passenger else None,
            'passenger_phone': self.passenger.phone if self.passenger else None,
            'vehicle_type': self.vehicle.vehicle_type if self.vehicle else None,
            'number_plate': self.vehicle.number_plate if self.vehicle else None,
            'driver_name': (
                self.vehicle.driver.user.name
                if self.vehicle and self.vehicle.driver and
                self.vehicle.driver.user else None
            )
        }
