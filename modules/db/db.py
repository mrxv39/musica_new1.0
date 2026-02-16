import sqlite3
import threading
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '../../data/musica_new.db')

SCHEMA = '''
CREATE TABLE IF NOT EXISTS hands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT UNIQUE,
    data TEXT
);
'''

def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    return conn

def init_db():
    conn = get_conn()
    conn.execute(SCHEMA)
    conn.commit()
    conn.close()

def insert_hand(fingerprint, data):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute('INSERT OR IGNORE INTO hands (fingerprint, data) VALUES (?, ?)', (fingerprint, data))
        conn.commit()
        cur.execute('SELECT id FROM hands WHERE fingerprint = ?', (fingerprint,))
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        conn.close()
