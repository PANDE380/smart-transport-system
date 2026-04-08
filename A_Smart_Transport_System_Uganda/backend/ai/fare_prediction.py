try:
    import joblib
    import pandas as pd
    AI_DEPS_AVAILABLE = True
except ImportError:
    AI_DEPS_AVAILABLE = False
import os
from datetime import datetime
import random

# Load the model at module level for efficiency
BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, 'fare_model.pkl')

model = None
if AI_DEPS_AVAILABLE:
    try:
        if os.path.exists(MODEL_PATH):
            model = joblib.load(MODEL_PATH)
    except Exception as e:
        print(f"Error loading AI model: {e}")

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
    # 1. Prepare inputs
    now = datetime.now()
    if hour is None: hour = now.hour
    if day_of_week is None: day_of_week = now.weekday()
    
    # Simulate traffic based on typical Kampala rush hours if not provided
    if traffic_level is None:
        if (7 <= hour <= 9) or (17 <= hour <= 20):
            traffic_level = 3 # High
        else:
            traffic_level = 1 # Low
            
    # Simulate weather if not provided
    if weather is None:
        weather = 0 # Clear
        
    # 2. Use AI Model if available
    if model:
        try:
            # Prepare a DataFrame matching the training data format
            input_data = pd.DataFrame([{
                'distance_km': distance_km,
                'hour': hour,
                'day_of_week': day_of_week,
                'traffic_level': traffic_level,
                'weather': weather,
                'vehicle_type': vehicle_type
            }])
            
            prediction = model.predict(input_data)[0]
            
            # Ensure we return a float and round to nearest 500
            return float(round(prediction / 500) * 500)
        except Exception as e:
            print(f"AI prediction error: {e}")
            
    # 3. Fallback logic (Mathematical approximation of the model)
    base_fare = 1000.0
    rate_per_km = 500.0
    
    multipliers = {
        'Taxi': 1.0,
        'Boda Boda': 0.7,
        'Special Hire': 2.0,
        'Mini Bus': 0.5,
        'Bus': 0.3,
        'Marine': 3.0
    }
    
    mult = multipliers.get(vehicle_type, 1.0)
    fare = base_fare + (distance_km * rate_per_km * mult)
    
    # Add modifiers
    if traffic_level == 3: fare *= 1.5
    elif traffic_level == 2: fare *= 1.2
    
    if weather == 1: fare *= 1.25
    if hour >= 22 or hour <= 5: fare *= 1.15
    
    return float(round(fare / 500) * 500)
