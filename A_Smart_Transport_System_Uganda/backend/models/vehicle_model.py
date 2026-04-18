try:
    from ..database import db
except ImportError:
    from database import db


class Vehicle(db.Model):
    __tablename__ = 'vehicles'
    id = db.Column(db.Integer, primary_key=True)
    driver_id = db.Column(db.Integer, db.ForeignKey(
        'drivers.id'), nullable=False)
    number_plate = db.Column(db.String(20), unique=True, nullable=False)
    capacity = db.Column(db.Integer, nullable=False, default=14)
    current_passengers = db.Column(db.Integer, default=0)
    current_lat = db.Column(db.Float, nullable=True, default=0.3476)
    current_lng = db.Column(db.Float, nullable=True, default=32.5825)
    is_active = db.Column(db.Boolean, default=False)

    # New Multi-Modal Field (Taxi, Bus, Marine, Train)
    vehicle_type = db.Column(db.String(20), nullable=False, default='Taxi')

    driver = db.relationship('Driver', back_populates='vehicles')
    trips = db.relationship('Trip', back_populates='vehicle')

    def to_dict(self):
        return {
            'id': self.id,
            'driver_id': self.driver_id,
            'driver_user_id': self.driver.user_id if self.driver else None,
            'driver_name': (
                self.driver.user.name
                if self.driver and self.driver.user else None
            ),
            'number_plate': self.number_plate,
            'capacity': self.capacity,
            'current_passengers': self.current_passengers,
            'available_seats': max(
                (self.capacity or 0) - (self.current_passengers or 0), 0
            ),
            'current_lat': self.current_lat,
            'current_lng': self.current_lng,
            'is_active': self.is_active,
            'vehicle_type': self.vehicle_type
        }
