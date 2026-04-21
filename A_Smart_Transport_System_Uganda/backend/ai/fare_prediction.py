import os
from datetime import datetime
import random

BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, 'fare_model.pkl')

model = None
_joblib = None
_pandas = None
_deps_checked = False


def _load_ai_dependencies():
    global _joblib, _pandas, _deps_checked

    if _deps_checked:
        return _joblib, _pandas

    _deps_checked = True

    try:
        import joblib as joblib_module
        import pandas as pandas_module
    except ImportError:
        return None, None

    _joblib = joblib_module
    _pandas = pandas_module
    return _joblib, _pandas


def _load_model():
    global model

    if model is not None:
        return model

    joblib_module, _ = _load_ai_dependencies()
    if joblib_module is None:
        return None

    if os.path.exists(MODEL_PATH):
        try:
            model = joblib_module.load(MODEL_PATH)
        except Exception as error:
            print(f"Error loading AI model: {error}")

    return model

def get_live_fuel_price() -> float:
    """
    Simulates fetching the real-time market price for fuel in Uganda per litre.
    In a true production environment, this would hit an external commodity API.
    Prices generally fluctuate between 5000 and 6000 UGX.
    """
    return round(random.uniform(5300.0, 5600.0), 2)

def predict_fare(
    distance_km: float,
    vehicle_type: str = 'Taxi',
    hour: int = None,
    day_of_week: int = None,
    traffic_level: int = None,
    weather: int = None
) -> float:
    """
    Predicts transport fare using the trained Embedded AI model.
    Falls back to a robust calculation if the model is not found.
    """
    now = datetime.now()
    if hour is None: hour = now.hour
    if day_of_week is None: day_of_week = now.weekday()
    
    if traffic_level is None:
        if (7 <= hour <= 9) or (17 <= hour <= 20):
            traffic_level = 3
        else:
            traffic_level = 1
            
    if weather is None:
        weather = 0
        
    fuel_price = get_live_fuel_price()
        
    loaded_model = _load_model()
    if loaded_model is not None:
        try:
            _, pandas_module = _load_ai_dependencies()
            if pandas_module is None:
                raise RuntimeError('pandas is not installed')

            input_data = pandas_module.DataFrame([{
                'distance_km': distance_km,
                'fuel_price': fuel_price,
                'hour': hour,
                'day_of_week': day_of_week,
                'traffic_level': traffic_level,
                'weather': weather,
                'vehicle_type': vehicle_type
            }])
            
            prediction = loaded_model.predict(input_data)[0]
            return float(round(prediction / 500) * 500)
        except Exception as e:
            print(f"AI prediction error: {e}")
            
    # Fallback logic mirroring the new fuel correlation math
    base_fare = 1000.0
    active_rate_per_km = 500.0 + ((fuel_price - 4000) * 0.08)
    
    multipliers = {
        'Taxi': 1.0,
        'Boda Boda': 0.7,
        'Special Hire': 2.0,
        'Mini Bus': 0.5,
        'Bus': 0.3,
        'Marine': 3.0
    }
    
    mult = multipliers.get(vehicle_type, 1.0)
    fare = base_fare + (distance_km * active_rate_per_km * mult)
    
    if traffic_level == 3: fare *= 1.5
    elif traffic_level == 2: fare *= 1.2
    
    if weather == 1: fare *= 1.25
    if hour >= 22 or hour <= 5: fare *= 1.15
    
    return float(round(fare / 500) * 500)
