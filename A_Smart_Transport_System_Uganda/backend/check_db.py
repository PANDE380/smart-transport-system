import sqlite3
import os

db_path = os.path.join('instance', 'smart_taxi.db')
print(f"Checking database at {db_path}")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT id, name, email FROM users")
    users = cursor.fetchall()
    print("Users found:")
    for u in users:
        print(u)
except Exception as e:
    print(f"Error: {e}")

conn.close()
