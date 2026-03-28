
import os
import sys
from datetime import datetime, timedelta, timezone

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.app import create_app
from backend.database import db
from backend.models.user_model import User
from backend.models.trip_model import Trip
from backend.models.wallet_model import Wallet
from backend.models.payment_model import Payment
from backend.models.vehicle_model import Vehicle
from backend.models.driver_model import Driver

app = create_app()

def populate():
    with app.app_context():
        # Reset DB to ensure schema sync with models
        db.drop_all()
        db.create_all()
        
        # Helper to get or create
        def get_or_create_user(name, email, phone, role):
            u = User.query.filter_by(email=email).first()
            if not u:
                u = User(name=name, email=email, phone=phone, role=role, password="password123")
                db.session.add(u)
                db.session.commit()
            return u

        # 1. Create Demo Users
        p1 = get_or_create_user("John Okello", "john@example.com", "0772000111", "passenger")
        user_d1 = get_or_create_user("Ssekandi Paul", "paul@example.com", "0700333444", "driver")
        admin = get_or_create_user("Admin Uganda", "admin@smarttaxi.ug", "0755999999", "admin")
        
        # 2. Setup Driver Profile
        dr_prof = Driver.query.filter_by(user_id=user_d1.id).first()
        if not dr_prof:
            dr_prof = Driver(user_id=user_d1.id, license_number="UG-TAX-99001", is_approved=True)
            db.session.add(dr_prof)
            db.session.commit()

        # 3. Setup Wallets & Vehicles
        if not Wallet.query.filter_by(user_id=p1.id).first():
            w1 = Wallet(user_id=p1.id, balance=150000.0, card_number="7700 1234 5678")
            db.session.add(w1)
        if not Wallet.query.filter_by(user_id=user_d1.id).first():
            wd = Wallet(user_id=user_d1.id, balance=0.0, card_number="7700 8888 9999")
            db.session.add(wd)
        
        v1 = Vehicle.query.filter_by(number_plate="UBL 123X").first()
        if not v1:
            v1 = Vehicle(driver_id=dr_prof.id, number_plate="UBL 123X", vehicle_type="Standard Taxi", capacity=4)
            db.session.add(v1)
        
        db.session.commit()
        
        # 4. Add History Trips
        if not Trip.query.filter_by(passenger_id=p1.id).first():
            t1 = Trip(passenger_id=p1.id, vehicle_id=v1.id, 
                     start_location="Kampala City Center", end_location="Entebbe Airport",
                     fare=45000.0, status="completed",
                     created_at=datetime.now(timezone.utc) - timedelta(days=2))
            
            t2 = Trip(passenger_id=p1.id, vehicle_id=v1.id, 
                     start_location="Jinja Road", end_location="Mukono Town",
                     fare=25000.0, status="completed",
                     created_at=datetime.now(timezone.utc) - timedelta(hours=5))
            
            db.session.add_all([t1, t2])
            db.session.commit()
            
            # 5. Add Payments
            pay1 = Payment(trip_id=t1.id, amount=45000.0, status="completed", transaction_id="TXN_77881122")
            pay2 = Payment(trip_id=t2.id, amount=25000.0, status="completed", transaction_id="TXN_99004455")
            db.session.add_all([pay1, pay2])
            db.session.commit()
            print("✅ Demo data populated successfully!")
        else:
            print("ℹ️ Demo trips already exist.")

if __name__ == "__main__":
    populate()
