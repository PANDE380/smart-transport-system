try:
    from ..database import db
    from ..models import User, Driver, Vehicle
except ImportError:
    from database import db
    from models import User, Driver, Vehicle


def _upsert_user(name, email, phone, password, role):
    user = User.query.filter_by(email=email).first()
    if user:
        user.name = name
        user.phone = phone
        user.password = password
        user.role = role
        return user

    user = User(
        name=name,
        email=email,
        phone=phone,
        password=password,
        role=role
    )
    db.session.add(user)
    db.session.flush()
    return user


def _upsert_driver_profile(user, license_number, is_approved=True):
    driver = user.driver_profile
    if driver:
        driver.license_number = license_number
        driver.is_approved = is_approved
        return driver

    driver = Driver(
        user_id=user.id,
        license_number=license_number,
        is_approved=is_approved
    )
    db.session.add(driver)
    db.session.flush()
    return driver


def _upsert_vehicle(driver, number_plate, capacity, current_passengers, vehicle_type):
    vehicle = Vehicle.query.filter_by(number_plate=number_plate).first()
    if vehicle:
        vehicle.driver_id = driver.id
        vehicle.capacity = capacity
        vehicle.current_passengers = current_passengers
        vehicle.vehicle_type = vehicle_type
        vehicle.is_active = True
        return vehicle

    vehicle = Vehicle(
        driver_id=driver.id,
        number_plate=number_plate,
        capacity=capacity,
        current_passengers=current_passengers,
        is_active=True,
        vehicle_type=vehicle_type
    )
    db.session.add(vehicle)
    return vehicle


def seed_db():
    _upsert_user(
        name='Admin Uganda',
        email='admin@smarttaxi.ug',
        phone='0755999999',
        password='password123',
        role='admin'
    )

    driver_user = _upsert_user(
        name='John Driver',
        email='driver1@smarttaxi.ug',
        phone='0777123456',
        password='password123',
        role='driver'
    )
    driver_profile = _upsert_driver_profile(
        driver_user,
        license_number='DL12345',
        is_approved=True
    )

    _upsert_vehicle(
        driver_profile,
        number_plate='UAA 123A',
        capacity=14,
        current_passengers=0,
        vehicle_type='Taxi'
    )
    _upsert_vehicle(
        driver_profile,
        number_plate='UBB 456B',
        capacity=60,
        current_passengers=10,
        vehicle_type='Bus'
    )
    _upsert_vehicle(
        driver_profile,
        number_plate='MVA 789C',
        capacity=100,
        current_passengers=25,
        vehicle_type='Marine'
    )

    db.session.commit()
