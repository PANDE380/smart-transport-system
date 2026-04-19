import os
import sys

# Add parent directory to path to allow absolute imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from app import create_app
    from models.user_model import User
except ImportError:
    from backend.app import create_app
    from backend.models.user_model import User

def verify():
    app = create_app()
    test_email = 'captain00newtons@gmail.com'
    test_pass = 'Captain123!@#'
    
    with app.app_context():
        user = User.query.filter_by(email=test_email).first()
        if user:
            is_valid = user.check_password(test_pass)
            print(f"VERIFICATION_RESULT: {is_valid}")
        else:
            print("VERIFICATION_RESULT: USER_NOT_FOUND")

if __name__ == '__main__':
    verify()
