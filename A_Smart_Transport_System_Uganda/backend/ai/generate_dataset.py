import pandas as pd
import numpy as np
import random
import os

def generate_uganda_transport_dataset(num_records=5000):
    """
    Generates a synthetic dataset for transport fare prediction in Uganda.
    Factors included: Distance, Time, Traffic, Weather, and Vehicle Type.
    """
    data = []
    
    # Uganda-specific parameters
    base_fare = 1000  # UGX
    rate_per_km = 500 # UGX
    
    vehicle_types = ['Taxi', 'Boda Boda', 'Special Hire', 'Mini Bus']
    vehicle_multipliers = {
        'Taxi': 1.0,
        'Boda Boda': 0.7,
        'Special Hire': 2.0,
        'Mini Bus': 0.5
    }

    for i in range(num_records):
        distance = round(random.uniform(0.5, 45.0), 2)
        hour = random.randint(0, 23)
        day_of_week = random.randint(0, 6) # 0=Mon, 6=Sun
        
        # Traffic levels: 1 (Low), 2 (Medium), 3 (High)
        # Rush hours in Kampala: 7-9 AM, 5-8 PM
        if (7 <= hour <= 9) or (17 <= hour <= 20):
            traffic_level = random.choices([2, 3], weights=[30, 70])[0]
        else:
            traffic_level = random.choices([1, 2], weights=[80, 20])[0]
            
        # Weather: 0 (Clear), 1 (Rainy)
        weather = random.choices([0, 1], weights=[85, 15])[0]
        
        v_type = random.choice(vehicle_types)
        multiplier = vehicle_multipliers[v_type]
        
        # Calculate fare with AI factors
        # Base + (Distance * Rate * Multiplier)
        # + Traffic Surcharge (1.1x to 1.5x)
        # + Weather Surcharge (1.2x if raining)
        # + Night Surcharge (1.1x if 10 PM - 5 AM)
        
        fare = base_fare + (distance * rate_per_km * multiplier)
        
        if traffic_level == 2: fare *= 1.2
        if traffic_level == 3: fare *= 1.5
        
        if weather == 1: fare *= 1.25
        
        if hour >= 22 or hour <= 5: fare *= 1.15
        
        # Add some random noise (-3% to +3%)
        fare *= random.uniform(0.97, 1.03)
        
        # Round to nearest 500 UGX
        fare = round(fare / 500) * 500
        
        data.append({
            'distance_km': distance,
            'hour': hour,
            'day_of_week': day_of_week,
            'traffic_level': traffic_level,
            'weather': weather,
            'vehicle_type': v_type,
            'fare': max(fare, base_fare)
        })
        
    df = pd.DataFrame(data)
    
    # Save to CSV
    output_path = os.path.join(os.path.dirname(__file__), 'fare_dataset.csv')
    df.to_csv(output_path, index=False)
    print(f"Generated {num_records} records in {output_path}")

if __name__ == "__main__":
    generate_uganda_transport_dataset()
