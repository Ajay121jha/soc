from flask import request, jsonify
from flask_cors import CORS
from app.auth import authenticate_user
from app.db import get_db_connection
import bcrypt
import pandas as pd
import mysql.connector
import os
from datetime import datetime
import calendar

def setup_routes(app):
    @app.route("/")
    def home():
        return jsonify({"message": "API is running!"})
    @app.route("/api/login", methods=["POST", "OPTIONS"])

    def login():
        if request.method == "OPTIONS":
            return jsonify({'message': 'CORS preflight response'}), 200
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")


        if authenticate_user(username, password):
            print("Login successful: ", username)
            return jsonify({"message": "Login successful!"}), 200
        else:
            print("Login failed: ", username)
            return jsonify({"error": "Invalid credentials"}), 401

    @app.route("/api/register", methods=["POST"])
    def register():
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        # Ensure both username and password are provided
        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if the username already exists in the database
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        existing_user = cursor.fetchone()

        if existing_user:
            conn.close()
            return jsonify({"error": "Username already taken"}), 409

        # Hash the password before storing it in the database
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')  # Convert to string for storage

        # Insert the new user into the database
        cursor.execute("INSERT INTO users (username, password) VALUES (%s, %s)", (username, hashed_password))
        conn.commit()
        conn.close()

        return jsonify({"message": "Registration successful!"}), 201

    @app.route("/api/users", methods=["GET"])
    def get_users():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, username FROM users")
        users = cursor.fetchall()
        conn.close()

        return jsonify(users)
    

    @app.route("/api/customers", methods=["GET"])
    def get_customers():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT name, email, operatingSystem, location FROM customers")
        customers = cursor.fetchall()
        conn.close()
        return jsonify(customers)

    conn= mysql.connector.connect(
        host = "localhost",
        user ="root",
        passwd = "12345",
        database = "soc"
    )

    
    # def setup_routes(app):
        
    @app.route('/api/search', methods=['GET'])
    def search():
        query = request.args.get('query', '').lower()
        cursor = conn.cursor(dictionary=True)

        sql = """
            SELECT i.*, c.name AS client_name, c.email AS client_email, c.location AS client_location
            FROM issue i
            LEFT JOIN client c ON i.client_id = c.id
        """
        cursor.execute(sql)
        rows = cursor.fetchall()

        filtered = []
        for row in rows:
        # Format created_at safely
            created_at_str = row.get('created_at')
            created_day = ""
            created_date = ""

            if created_at_str:
                try:
                    dt = datetime.strptime(str(created_at_str), "%Y-%m-%d %H:%M:%S")
                    created_day = calendar.day_name[dt.weekday()].lower()
                    created_date = dt.strftime("%Y-%m-%d").lower()
                except ValueError:
                    pass  # Ignore invalid date formats

        # Match query against all fields including date and day
            if not query or (
                query in (row['ip_address'] or '').lower()
                or query in (row['title'] or '').lower()
                or query in (row['status'] or '').lower()
                or query in (row['client_name'] or '').lower()
                or query in (row['client_email'] or '').lower()
                or query in (row['client_location'] or '').lower()
                or query in created_day
                or query in created_date
            ):
                filtered.append(row)

        return jsonify(filtered)
    
 





    @app.route('/api/import', methods=['POST'])
    def import_excel():
        file = request.files['file']
        df = pd.read_excel(file)

        cursor = conn.cursor()
        for _, row in df.iterrows():
            cursor.execute("""
                INSERT INTO issue (client_id, ip_address, title, description, status, solution, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                row['client_id'], row['ip_address'], row['title'],
                row['description'], row['status'], row['solution'], row['created_at']
            ))
        conn.commit()
        return jsonify({"message": "Data imported successfully"}), 200