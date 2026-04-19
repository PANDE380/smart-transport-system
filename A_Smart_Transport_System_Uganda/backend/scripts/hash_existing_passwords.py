import sqlite3
import os
from flask_bcrypt import Bcrypt
from flask import Flask

# Minimal Flask app to initialize Bcrypt
app = Flask(__name__)
bcrypt = Bcrypt(app)

db_path = os.path.join(os.path.dirname(__file__), '..', 'instance', 'smart_taxi.db')
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Scanning for plain-text passwords...")
cursor.execute("SELECT id, email, password FROM users")
users = cursor.fetchall()

updated_count = 0
for user_id, email, p_hash in users:
    # Check if it's already a bcrypt hash (usually starts with $2b$ or $2a$)
    if p_hash and not (p_hash.startswith('$2b$') or p_hash.startswith('$2a$')):
        print(f"Hashing password for user {user_id} ({email})...")
        new_hash = bcrypt.generate_password_hash(p_hash).decode('utf-8')
        cursor.execute("UPDATE users SET password = ? WHERE id = ?", (new_hash, user_id))
        updated_count += 1

conn.commit()
conn.close()

print(f"Migration complete. Updated {updated_count} user(s).")
