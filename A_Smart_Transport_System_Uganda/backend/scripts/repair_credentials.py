import os
import sys
from datetime import datetime, timezone

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

def repair_credentials():
    app = create_app()
    with app.app_context():
        print("\n--- STS Uganda Credential Repair Utility ---")
        users = User.query.all()
        print(f"Auditing {len(users)} user accounts...")
        
        repaired_count = 0
        skipped_count = 0
        
        for user in users:
            p_hash = user.password
            # Determine if current password is a hash
            is_hashed = p_hash.startswith('$2b$') or p_hash.startswith('$2a$')
            
            if not is_hashed:
                print(f"Repairing: {user.email} (Found plain-text)")
                # Setting the password attribute again triggers the @validates decorator
                user.password = p_hash
                repaired_count += 1
            else:
                skipped_count += 1
        
        if repaired_count > 0:
            print(f"\nFinalizing changes to database...")
            db.session.commit()
            print(f"✅ Success! Fixed {repaired_count} accounts.")
        else:
            print("\n✅ All accounts are already securely hashed.")
        
        print(f"Total processed: {len(users)} (Skipped: {skipped_count})\n")

if __name__ == '__main__':
    repair_credentials()
