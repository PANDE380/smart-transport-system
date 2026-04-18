from datetime import datetime, timezone

try:
    from ..database import db
except ImportError:
    from database import db

class TripLog(db.Model):
    __tablename__ = 'trip_logs'
    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey('trips.id'), nullable=False, index=True)
    event_type = db.Column(db.String(50), nullable=False) # REQUEST, APPROVAL, COMPLETION, SOS, REJECTION, RATE
    message = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    trip = db.relationship('Trip', backref=db.backref('logs', lazy=True, cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'trip_id': self.trip_id,
            'event_type': self.event_type,
            'message': self.message,
            'created_at': self.created_at.isoformat(),
            'timestamp': self.created_at.strftime('%I:%M %p')
        }
