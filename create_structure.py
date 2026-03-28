import os

readme_content = """# Smart Taxi Monitoring and Fare System

## Problem in Uganda
Passengers face these problems:
- Hard to find a taxi quickly
- Taxi drivers sometimes overcharge passengers
- Taxis overload passengers
- Traffic officers cannot easily detect overloaded taxis
- Passengers do not know the correct transport fare

## Proposed System: Smart Taxi Fare & Monitoring System
A web and mobile system that:
- Helps passengers find nearby taxis
- Shows the correct fare automatically
- Allows digital payment
- Detects taxi overloading
- Helps traffic police monitor taxis using digital number plates

## System Architecture
User → Web App → Backend Server → Database
↓
AI Models
↓
Traffic Dashboard
"""

structure = {
    "backend": {
        "app.py": "",
        "config.py": "",
        "database.py": "",
        "models": {
            "user_model.py": "",
            "driver_model.py": "",
            "taxi_model.py": "",
            "trip_model.py": "",
            "payment_model.py": ""
        },
        "routes": {
            "user_routes.py": "",
            "taxi_routes.py": "",
            "trip_routes.py": "",
            "payment_routes.py": "",
            "admin_routes.py": ""
        },
        "ai": {
            "passenger_counter.py": "",
            "fare_prediction.py": "",
            "demand_prediction.py": ""
        },
        "utils": {
            "gps_tracking.py": "",
            "sms_service.py": "",
            "ussd_service.py": ""
        }
    },
    "frontend": {
        "index.html": "<!DOCTYPE html>\n<html>\n<head>\n  <title>Smart Taxi</title>\n  <link rel=\"stylesheet\" href=\"css/style.css\">\n</head>\n<body>\n  <h1>Welcome to Smart Taxi</h1>\n  <script src=\"js/app.js\"></script>\n</body>\n</html>",
        "login.html": "",
        "register.html": "",
        "passenger_dashboard.html": "",
        "driver_dashboard.html": "",
        "admin_dashboard.html": "",
        "css": {
            "style.css": "/* Main styling for Smart Taxi App */\nbody { font-family: sans-serif; }"
        },
        "js": {
            "app.js": "// Main app logic\nconsole.log('App loaded.');",
            "map.js": "",
            "payment.js": ""
        }
    },
    "database": {
        "smart_taxi_db.sql": "-- Database schema for Smart Taxi\n"
    },
    "ai_models": {
        "passenger_detection_model.pkl": "",
        "fare_prediction_model.pkl": ""
    },
    "README.md": readme_content
}

def create_struct(base, struct):
    for name, content in struct.items():
        path = os.path.join(base, name)
        if isinstance(content, dict):
            os.makedirs(path, exist_ok=True)
            create_struct(path, content)
        else:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)

os.makedirs("smart_taxi_system", exist_ok=True)
create_struct("smart_taxi_system", structure)
print("Scaffolding complete!")
