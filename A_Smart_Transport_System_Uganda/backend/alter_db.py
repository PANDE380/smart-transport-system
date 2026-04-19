import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'instance', 'smart_taxi.db')

def upgrade_db():
    print(f"Connecting to {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute('ALTER TABLE trips ADD COLUMN sos_evidence_url VARCHAR(500)')
        print("Added sos_evidence_url")
    except sqlite3.OperationalError as e:
        print(f"Column may already exist: {e}")
        
    try:
        cursor.execute('ALTER TABLE trips ADD COLUMN sos_description TEXT')
        print("Added sos_description")
    except sqlite3.OperationalError as e:
        print(f"Column may already exist: {e}")
        
    conn.commit()
    conn.close()
    print("Database upgrade complete.")

if __name__ == '__main__':
    upgrade_db()
