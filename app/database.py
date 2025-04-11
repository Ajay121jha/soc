import mysql.connector

db_config = {
    "host": "localhost",
    "user": "root", 
    "passwd": "12345", 
    "database": "soc"
}

def get_db_connection():
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except mysql.connector.Error as e:
        print(f"Error connecting to database: {e}")
        return None
