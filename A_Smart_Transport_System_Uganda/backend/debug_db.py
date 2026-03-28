import os
import sys

backend_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(backend_dir)
if project_root not in sys.path:
    sys.path.append(project_root)

try:
    from backend.app import create_app
    from backend.database import db
    from backend.models.user_model import User
    from backend.models.wallet_model import Wallet
except ImportError:
    if backend_dir not in sys.path:
        sys.path.append(backend_dir)
    from app import create_app
    from database import db
    from models.user_model import User
    from models.wallet_model import Wallet

app = create_app()
with app.app_context():
    user = db.session.get(User, 6)
    if user:
        print(f"User 6: {user.name} ({user.role})")
        wallet = Wallet.query.filter_by(user_id=6).first()
        if wallet:
            print(f"Wallet found: {wallet.card_number}, Balance: {wallet.balance}")
        else:
            print("Wallet NOT found for user 6")
    else:
        print("User 6 NOT found in database")
