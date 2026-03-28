import random


def predict_fare(
    distance_km: float,
    base_fare: float = 1000.0,
    rate_per_km: float = 500.0,
) -> float:
    """
    Mock AI Fare Prediction.
    In the final real-world system, this would use a proper ML model,
    such as a loaded .pkl file, to predict based on distance, traffic,
    and fuel prices.
    """
    # Simply calculate: base + distance * rate +
    # (small random variance for demo purposes)
    variance = random.uniform(-200.0, 200.0)
    total_fare = base_fare + (distance_km * rate_per_km) + variance

    # Round to nearest 500 for realistic Ugandan taxi fares
    rounded_fare = float(round(total_fare / 500) * 500)
    return max(rounded_fare, base_fare)
