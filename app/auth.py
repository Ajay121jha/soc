import bcrypt
from app.db import get_db_connection

def authenticate_user(username, password):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password, role FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        stored_hashed_password = user[2]
        if bcrypt.checkpw(password.encode('utf-8'), stored_hashed_password.encode('utf-8')):
            return {
                "id": user[0],
                "username": user[1],
                "role": user[3]  
            }
    
    return None


def register_user(username, password):
    conn = get_db_connection()
    cursor = conn.cursor()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    try:
        cursor.execute("INSERT INTO users (username, password) VALUES (%s, %s)", (username, hashed_password.decode('utf-8')))
        conn.commit()
        return True
    except:
        return False
    finally:
        conn.close()
