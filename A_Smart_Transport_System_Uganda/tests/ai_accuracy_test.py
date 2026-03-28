import sys
import os
import random
import statistics

# Add project root to path so we can import the backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.ai.fare_prediction import predict_fare
from backend.ai.passenger_counter import count_passengers

def test_fare_accuracy(num_samples=100):
    print(f"Testing Fare Prediction Accuracy ({num_samples} samples)...")
    errors = []
    
    for _ in range(num_samples):
        distance = random.uniform(1.0, 50.0)
        # Ground truth is deterministic: Base (1000) + Distance * Rate (500)
        ground_truth = 1000.0 + (distance * 500.0)
        
        # The model rounds to nearest 500 and adds variance +/- 200
        predicted = predict_fare(distance)
        
        error = abs(predicted - ground_truth)
        errors.append(error)
    
    mae = statistics.mean(errors)
    max_error = max(errors)
    
    print(f"  Mean Absolute Error (MAE): {mae:.2f} UGX")
    print(f"  Max Error: {max_error:.2f} UGX")
    print(f"  Accuracy Rating: {'High' if mae < 500 else 'Moderate' if mae < 1000 else 'Low'}")
    print("-" * 40)
    return mae

def test_passenger_counter_distribution(num_samples=100):
    print(f"Testing Passenger Counter Distribution ({num_samples} samples)...")
    counts = []
    
    for _ in range(num_samples):
        count = count_passengers()
        counts.append(count)
    
    avg_passengers = statistics.mean(counts)
    overloads = sum(1 for c in counts if c > 14)
    
    print(f"  Average Passengers: {avg_passengers:.2f}")
    print(f"  Overload Frequency (c > 14): {overloads / num_samples * 100:.1f}%")
    print(f"  Range: {min(counts)} to {max(counts)}")
    print("-" * 40)
    return avg_passengers

if __name__ == "__main__":
    test_fare_accuracy()
    test_passenger_counter_distribution()
    print("AI Accuracy Testing Complete.")
