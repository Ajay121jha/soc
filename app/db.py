import mysql.connector
from app.db_config import db_config

def get_db_connection():
    return mysql.connector.connect(**db_config)

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(50) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL)")
    conn.commit()
    conn.close()
