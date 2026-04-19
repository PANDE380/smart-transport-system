from datetime import datetime, timezone

try:
    from ..database import db, bcrypt
except ImportError:
    from database import db, bcrypt


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

    def __init__(self, **kwargs):
        if 'password' in kwargs:
            kwargs['password'] = bcrypt.generate_password_hash(kwargs['password']).decode('utf-8')
        super(User, self).__init__(**kwargs)

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
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
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
