from datetime import datetime, timezone

try:
    from ..database import db, bcrypt
except ImportError:
    from database import db, bcrypt
from sqlalchemy.orm import validates


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    # passenger, driver, admin, traffic_officer
    role = db.Column(db.String(20), nullable=False, default='passenger')
    preferred_language = db.Column(db.String(10), nullable=False, default='en')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    @validates('password')
    def _hash_password(self, key, password):
        if not password:
            return password
        # Check if it looks like a bcrypt hash already
        if password.startswith('$2b$') or password.startswith('$2a$'):
            return password
        return bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        try:
            return bcrypt.check_password_hash(self.password, password)
        except ValueError:
            # Handle 'Invalid salt' errors gracefully (e.g. if hash is malformed)
            return False

    driver_profile = db.relationship(
        'Driver', back_populates='user', uselist=False,
        cascade='all, delete-orphan')
    wallet = db.relationship(
        'Wallet', back_populates='user', uselist=False,
        cascade='all, delete-orphan')

    def to_dict(self):
        two_factor_setting = getattr(self, 'two_factor_setting', None)
        profile_image = getattr(self, 'profile_image', None)
        
        vehicle_type = None
        if self.role == 'driver' and self.driver_profile:
            # Get the vehicle type from the first vehicle associated with the driver
            vehicle = self.driver_profile.vehicles[0] if self.driver_profile.vehicles else None
            if vehicle:
                vehicle_type = vehicle.vehicle_type

        # Determine professional title
        profession = "User"
        if self.role == 'passenger':
            profession = "Passenger"
        elif self.role == 'admin':
            profession = "System Administrator"
        elif self.role == 'driver':
            if vehicle_type in ['Marine', 'Marine Transport']:
                profession = "Captain"
            elif vehicle_type in ['Boda Boda', 'Boda']:
                profession = "Rider"
            elif vehicle_type in ['Standard Taxi', 'Taxi']:
                profession = "Taxi Driver"
            elif vehicle_type in ['Smart Bus', 'Bus']:
                profession = "Bus Pilot"
            else:
                profession = "Driver"

        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
            'profession': profession,
            'vehicle_type': vehicle_type,
            'preferred_language': self.preferred_language,
            'profile_image_url': (
                profile_image.public_url() if profile_image else None
            ),
            'two_factor_enabled': bool(
                two_factor_setting and two_factor_setting.is_enabled
            ),
            'two_factor_method': (
                two_factor_setting.method
                if two_factor_setting and two_factor_setting.is_enabled else None
            ),
            'created_at': self.created_at.isoformat()
        }
