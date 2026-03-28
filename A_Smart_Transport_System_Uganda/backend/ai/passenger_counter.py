import random
from typing import Optional


def count_passengers(image_path: Optional[str] = None) -> int:
    """
    Mock AI Passenger Counter.
    In the real system, this would use OpenCV and a trained model,
    such as YOLO, to count people in a camera frame from inside the taxi.
    """
    # For MVP, we just return a random number of passengers
    # A standard commuter taxi has 14 capacity, so we'll guess 0 to 18
    # to occasionally trigger overloading
    return random.randint(0, 18)
