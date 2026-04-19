import os
import sys

# Add parent directory to path to allow absolute imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from app import create_app
    from database import db
    from models.user_model import User
except ImportError:
    from backend.app import create_app
    from backend.database import db
    from backend.models.user_model import User

def sync_captain_accounts():
    app = create_app()
    target_password = 'Captain123!@#'
    
    with app.app_context():
        print("\n--- STS Uganda Access Recovery Utility ---")
        
        # Target all accounts starting with 'captain'
        captain_users = User.query.filter(User.email.ilike('captain%')).all()
        
        if not captain_users:
            print("No 'Captain' accounts found in database.")
            return

        print(f"Standardizing {len(captain_users)} accounts to: {target_password}")
        
        for user in captain_users:
            print(f"Syncing: {user.email}")
            # Setting the password attribute triggers the @validates decorator
            user.password = target_password
        
        db.session.commit()
        print(f"\n✅ All Captain accounts have been synchronized successfully.")
        print("You can now log in with the standardized password.")

if __name__ == '__main__':
    sync_captain_accounts()
