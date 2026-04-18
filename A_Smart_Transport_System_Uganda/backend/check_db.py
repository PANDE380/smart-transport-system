import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')

db = 'instance/smart_taxi.db'
conn = sqlite3.connect(db)
c = conn.cursor()

c.execute("SELECT id, name, phone FROM users WHERE phone='0700000000'")
user = c.fetchone()
print('User:', user)

if user:
    user_id = user[0]
    c.execute("SELECT balance FROM wallets WHERE user_id=?", (user_id,))
    wallet = c.fetchone()
    print('Wallet:', wallet)

    c.execute("SELECT COUNT(*) FROM trips WHERE passenger_id=? AND status='completed'", (user_id,))
    count = c.fetchone()
    print('Completed trips:', count)

    c.execute("PRAGMA table_info(trips)")
    cols = [row[1] for row in c.fetchall()]
    print('Trip columns:', cols)

conn.close()
