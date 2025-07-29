from flask import request, Flask, jsonify
from app.auth import authenticate_user
from app.db import get_db_connection
from datetime import datetime, timedelta
import bcrypt
import os
from flask import send_from_directory
import mysql.connector
import pandas as pd
from app.token_utils import generate_token
from app.token_utils import validate_token as verify_token
from datetime import datetime

import requests
import certifi
import feedparser



PDF_DIR = os.path.join(os.getcwd(), "pdfs")
os.makedirs(PDF_DIR, exist_ok=True)


def setup_routes(app):
    @app.route("/")
    def home():
        return jsonify({"message": "API is running!"})
    
    
    @app.route('/api/shifts/<int:shift_id>/notes', methods=['GET'])
    def get_shift_notes(shift_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
            # Simplified query - just get notes with employee_id
            query = """
                SELECT employee_id, note, created_at
                FROM handover_notes
                WHERE shift_id = %s
            """
            cursor.execute(query, (shift_id,))
            notes = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            return jsonify(notes)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/save_notes', methods=['POST'])
    def save_notes():
        data = request.get_json()
        shift_id = data.get("shift_id")
        employee_id = data.get("employee_id")
        note = data.get("notes")

        if not all([shift_id, employee_id, note is not None]):
            return jsonify({"error": "Missing required fields"}), 400

        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Verify employee is actually in this shift
            cursor.execute(
                "SELECT id FROM shift_employee_map WHERE shift_id = %s AND employee_id = %s",
                (shift_id, employee_id)
            )
            if not cursor.fetchone():
                return jsonify({"error": "Employee not in this shift"}), 403
            
            # Check if note already exists
            cursor.execute(
                "SELECT id FROM handover_notes WHERE shift_id = %s AND employee_id = %s",
                (shift_id, employee_id)
            )
            existing_note = cursor.fetchone()
            
            if existing_note:
                # Update existing note
                query = """
                    UPDATE handover_notes
                    SET note = %s, created_at = NOW()
                    WHERE shift_id = %s AND employee_id = %s
                """
                cursor.execute(query, (note, shift_id, employee_id))
            else:
                # Create new note
                query = """
                    INSERT INTO handover_notes (shift_id, employee_id, note, created_at)
                    VALUES (%s, %s, %s, NOW())
                """
                cursor.execute(query, (shift_id, employee_id, note))
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return jsonify({"message": "Notes saved successfully"}), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    


    @app.route('/api/update_cab_status', methods=['PATCH'])
    def update_cab_status():
        data = request.get_json()
        shift_id = data.get("shift_id")
        employee_id = data.get("employee_id")
        cab_facility = data.get("cab_facility")  # "Yes" or "No"

        if not all([shift_id, employee_id, cab_facility]):
            return jsonify({"error": "Missing required fields"}), 400

        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            query = """
                UPDATE shift_employee_map
                SET cab_facility = %s
                WHERE shift_id = %s AND employee_id = %s
            """
            cursor.execute(query, (cab_facility, shift_id, employee_id))
            conn.commit()
            cursor.close()
            conn.close()

            return jsonify({"message": "Cab status updated successfully"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    
    @app.route('/api/shifts/<int:shift_id>/cab-status', methods=['GET'])
    def get_cab_status(shift_id):
        try:
            conn=get_db_connection()
            cursor=conn.cursor(dictionary=True)
            query = """
                SELECT u.id, u.username, sem.cab_facility
                FROM shift_employee_map sem
                JOIN users u ON sem.employee_id = u.id
                WHERE sem.shift_id = %s
            """
            cursor.execute(query, (shift_id,))
            employees = cursor.fetchall()
            conn.close()
            return jsonify(employees), 200
        except Exception as e:
            print("Error fetching employees for shift:", e)
            return jsonify({'error': 'Internal Server Error'}), 500
    
    @app.route("/api/login", methods=["POST", "OPTIONS"])
    def login():
        if request.method == "OPTIONS":
            return jsonify({'message': 'CORS preflight response'}), 200

        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        user = authenticate_user(username, password)
        if user:
            print("Login successful:", username)
            token = generate_token(username)
            return jsonify({
                "message": "Login successful!",
                "token": token,
                "username": user["username"],
                "user_id": user["id"],
                "role": user["role"] 
            }), 200
        else:
            print("Login failed:", username)
            return jsonify({"error": "Invalid credentials"}), 401


    @app.route("/api/register", methods=["POST"])
    def register():
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")
        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        existing_user = cursor.fetchone()

        if existing_user:
            conn.close()
            return jsonify({"error": "Username already taken"}), 409
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8') 
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
    
    @app.route("/api/validate", methods=["GET"])
    def validate_token():
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401

        token = auth_header.split(" ")[1]
        username = verify_token(token)

        if username:
            return jsonify({"message": "Token is valid", "username": username}), 200
        else:
            return jsonify({"error": "Invalid or expired token"}), 401


    @app.route('/api/shifts', methods=['GET'])
    def get_shifts():
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            query = """
                SELECT sa.id AS shift_id,
                    sa.shift_type,
                    sa.start_datetime,
                    sa.end_datetime,
                    GROUP_CONCAT(u.username ORDER BY u.username SEPARATOR ', ') AS employees
                FROM shift_assignments sa
                LEFT JOIN shift_employee_map sem ON sa.id = sem.shift_id
                LEFT JOIN users u ON sem.employee_id = u.id
                GROUP BY sa.id
                ORDER BY sa.start_datetime;
            """
            cursor.execute(query)
            results = cursor.fetchall()

            shifts = []
            for row in results:
                shifts.append({
                    "id": row["shift_id"],
                    "title": f"{row['shift_type'].capitalize()} - {row['employees'] or 'No One'}",
                    "start": row["start_datetime"].strftime("%Y-%m-%dT%H:%M:%S"),
                    "end": row["end_datetime"].strftime("%Y-%m-%dT%H:%M:%S"),
                    "shift_type": row["shift_type"],
                    "employees": row["employees"].split(', ') if row["employees"] else []
                })

            return jsonify(shifts)

        except mysql.connector.Error as err:
            return jsonify({"error": str(err)}), 500


    @app.route('/api/user_shifts/<int:user_id>', methods=['GET'])
    def get_user_shifts(user_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            query = """
                SELECT sa.id, sa.shift_type, sa.start_datetime, sa.end_datetime
                FROM shift_assignments sa
                JOIN shift_employee_map sem ON sa.id = sem.shift_id
                WHERE sem.employee_id = %s AND sa.start_datetime >= CURDATE()
                ORDER BY sa.start_datetime
            """
            cursor.execute(query, (user_id,))
            raw_shifts = cursor.fetchall()

            shifts = []
            for shift in raw_shifts:
                shifts.append({
                    "id": shift["id"],
                    "date": shift["start_datetime"].strftime("%Y-%m-%d"),
                    "shift_type": shift["shift_type"],
                    "start_time": shift["start_datetime"].strftime("%H:%M"),
                    "end_time": shift["end_datetime"].strftime("%H:%M")
                })

            return jsonify(shifts)

        except mysql.connector.Error as err:
            return jsonify({"error": str(err)}), 500


    @app.route("/api/analysts")
    def get_analysts():
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT id, username FROM users WHERE role = 'analyst'")
            analysts = cur.fetchall()
            result = []

            if analysts:
                result = [{"id": a[0], "username": a[1]} for a in analysts]

            return jsonify(result)

        except Exception as e:
            print("Error fetching analysts:", e)
            return jsonify({"error": "Failed to fetch analysts"}), 500

        finally:
            if conn:
                conn.close()


    @app.route('/api/create_shift', methods=['POST'])
    def create_shift():
        data = request.get_json()
        start_datetime = data.get("start_datetime")
        end_datetime = data.get("end_datetime")
        shift_type = data.get("shift_type")
        employee_ids = data.get("employee_ids")

        if not start_datetime or not end_datetime or not shift_type or not employee_ids:
            return jsonify({"error": "Missing required fields"}), 400

        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            # Check if a shift already exists with same start, end, and type
            cursor.execute("""
                SELECT id FROM shift_assignments
                WHERE start_datetime = %s AND end_datetime = %s AND shift_type = %s
            """, (start_datetime, end_datetime, shift_type))
            existing_shift = cursor.fetchone()

            if existing_shift:
                shift_id = existing_shift[0]
            else:
                # Create new shift
                cursor.execute("""
                    INSERT INTO shift_assignments (shift_type, start_datetime, end_datetime)
                    VALUES (%s, %s, %s)
                """, (shift_type, start_datetime, end_datetime))
                conn.commit()
                shift_id = cursor.lastrowid

            # Link employees to the shift
            for emp_id in employee_ids:
                cursor.execute("""
                    SELECT 1 FROM shift_employee_map
                    WHERE shift_id = %s AND employee_id = %s
                """, (shift_id, emp_id))
                already_assigned = cursor.fetchone()

                if not already_assigned:
                    cursor.execute("""
                        INSERT INTO shift_employee_map (shift_id, employee_id, cab_facility)
                        VALUES (%s, %s, 'No')
                    """, (shift_id, emp_id))

            conn.commit()
            return jsonify({"message": "Shift created successfully", "shift_id": shift_id}), 200

        except mysql.connector.Error as err:
            conn.rollback()
            return jsonify({"error": str(err)}), 500




    @app.route('/api/edit_shift', methods=['PUT'])
    def edit_shift():
        data = request.get_json()
        shift_id = data.get('shift_id')
        date = data.get('date')  # format: 'YYYY-MM-DD'
        shift_type = data.get('shift_type')  # e.g., 'morning'
        new_employee_id = data.get('employee_id')  # new employee reassignment

        if not all([shift_id, date, shift_type, new_employee_id]):
            return jsonify({'error': 'Missing required parameters'}), 400

        # Define start/end times for shift types
        shift_times = {
            'morning': ('08:00:00', '16:00:00'),
            'evening': ('16:00:00', '00:00:00'),
            'night': ('00:00:00', '08:00:00'),
        }
        if shift_type not in shift_times:
            return jsonify({'error': 'Invalid shift type'}), 400

        start_time, end_time = shift_times[shift_type]

        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            # Update shift_assignments
            cursor.execute("""
                UPDATE shift_assignments
                SET date = %s,
                    shift_type = %s,
                    start_time = %s,
                    end_time = %s
                WHERE id = %s
            """, (date, shift_type, start_time, end_time, shift_id))

            # Update assigned employee
            cursor.execute("""
                UPDATE shift_employee_map
                SET employee_id = %s
                WHERE shift_id = %s
            """, (new_employee_id, shift_id))

            conn.commit()
            conn.close()

            return jsonify({'message': 'Shift updated and reassigned successfully'}), 200

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    

    # Delete Route
    @app.route('/api/delete_shift', methods=['DELETE'])
    def delete_shift():
        data = request.get_json()
        shift_id = data.get('shift_id')

        if not shift_id:
            return jsonify({'error': 'Missing shift_id'}), 400

        try:
            conn=get_db_connection()
            cursor=conn.cursor()

            # First delete from dependent table
            cursor.execute("DELETE FROM shift_employee_map WHERE shift_id = %s", (shift_id,))

            # then notes
            # 1. First delete all notes associated with this shift
            cursor.execute("DELETE FROM handover_notes WHERE shift_id = %s", (shift_id,))

            # Then delete the shift itself
            cursor.execute("DELETE FROM shift_assignments WHERE id = %s", (shift_id,))
            conn.commit()
            conn.close()
            return jsonify({'message': 'Shift deleted successfully'}), 200

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    
    @app.route('/api/kb-search', methods=['GET'])
    def search():
        query = request.args.get('query', '').strip()
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
 
        try:
            if not query:
                cursor.execute("SELECT id, entity_name, asset, itsm_ref, asset_details, status, reason, context, remarks FROM knowledge_base")
                results = cursor.fetchall()
                return jsonify(results)
 
            words = query.split()
            conditions = []
            params = []
 
            for word in words:
                conditions.append(
                    "("
                    "CAST(id AS CHAR) LIKE %s OR "
                    "entity_name LIKE %s OR "
                    "asset LIKE %s OR "
                    "itsm_ref LIKE %s OR "
                    "asset_details LIKE %s OR "
                    "status LIKE %s OR "
                    "reason LIKE %s OR "
                    "context LIKE %s OR "
                    "remarks LIKE %s"
                    ")"
                )
                for _ in range(9):
                    params.append(f"%{word}%")
 
            where_clause = " AND ".join(conditions)
            sql = f"""
                SELECT id, entity_name, asset, itsm_ref, asset_details,
                    status, reason, context, remarks
                FROM knowledge_base
                WHERE {where_clause}
            """
            cursor.execute(sql, params)
            results = cursor.fetchall()
            return jsonify(results)
 
        finally:
            cursor.close()
            conn.close()

    
    @app.route('/api/kb_table-add', methods=['POST'])
    def add_kb_entry():
        try:
            data = request.get_json()

            required_fields = [
                'entity_name', 'asset', 'itsm_ref', 'asset_details',
                'status', 'reason', 'context', 'remarks'
            ]

        # Check for missing fields
            if not all(field in data and data[field] for field in required_fields):
                return jsonify({"message": "All fields are required."}), 400

            conn = get_db_connection()
            cursor = conn.cursor()

            insert_query = """
                INSERT INTO knowledge_base (
                    entity_name, asset, itsm_ref, asset_details,
                    status, reason, context, remarks
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """

            values = (
                data['entity_name'],
                data['asset'],
                data['itsm_ref'],
                data['asset_details'],
                data['status'],
                data['reason'],
                data['context'],
                data['remarks']
            )

            cursor.execute(insert_query, values)
            conn.commit()

            return jsonify({"message": "Entry added successfully!"}), 201

        except Exception as e:
            print("Error adding entry:", str(e))
            return jsonify({"message": str(e)}), 500

        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()


    @app.route('/api/kb_table-delete', methods=['POST'])
    def delete_entries():
        try:
            data = request.get_json()
            ids = data.get('ids', [])
            if not ids:
                return jsonify({"message": "No IDs provided"}), 400
 
            conn = get_db_connection()
            cursor = conn.cursor()
            format_strings = ','.join(['%s'] * len(ids))
            cursor.execute(f"DELETE FROM knowledge_base WHERE id IN ({format_strings})", tuple(ids))
            conn.commit()
 
            return jsonify({"message": "Entries deleted successfully!"}), 200
 
        except Exception as e:
            print("Error deleting entries:", str(e))
            return jsonify({"message": str(e)}), 500
 
        finally:
            cursor.close()
            conn.close()

        
    @app.route('/api/kb_table-import', methods=['POST'])
    def import_data():
        if 'file' not in request.files:
            return jsonify({"message": "No file part in the request"}), 400

        file = request.files['file']
        if file.filename == "":
            return jsonify({"message": "No file selected"}), 400

        try:
            filename = file.filename.lower()
            if filename.endswith('.csv'):
                df = pd.read_csv(file)
            elif filename.endswith(('.xls', '.xlsx')):
                df = pd.read_excel(file)
            else:
                return jsonify({"message": "Unsupported file type"}), 400

            required_columns = [
                'entity_name', 'asset', 'itsm_ref', 'asset_details',
                'status', 'reason', 'context', 'remarks'
            ]
            if not all(col in df.columns for col in required_columns):
                return jsonify({
                    "message": f"Missing required columns. Expected: {', '.join(required_columns)}"
                }), 400

            conn = get_db_connection()
            cursor = conn.cursor()

            insert_query = """
                INSERT INTO knowledge_base (
                entity_name, asset, itsm_ref, asset_details,
                status, reason, context, remarks
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """

            for index, row in df.iterrows():
                try:
                    values = (
                        row['entity_name'],
                        row['asset'],
                        row['itsm_ref'],
                        row['asset_details'],
                        row['status'],
                        row['reason'],
                        row['context'],
                        row['remarks']
                    )
                    cursor.execute(insert_query, values)
                    print(f"Inserted row {index}: {values}")
                except Exception as insert_error:
                    print(f"Error inserting row {index}: {insert_error}")
                    conn.rollback()
                    return jsonify({"message": f"Error inserting row {index}: {str(insert_error)}"}), 500

            conn.commit()
            return jsonify({"message": "Import successful!"}), 200

        except Exception as e:
            conn.rollback()
            print(f"Error: {str(e)}")
            return jsonify({"message": str(e)}), 500

        finally:
            cursor.close()
            conn.close()

    @app.route("/api/clients", methods=["GET", "POST"])
    def clients():
        conn = get_db_connection()
        cursor = conn.cursor()

        if request.method == "GET":
            cursor.execute("SELECT * FROM clients")
            return jsonify(cursor.fetchall())

        if request.method == "POST":
            data = request.get_json()
            name = data.get("name")

            if not name:
                return jsonify({"error": "Client name is required"}), 400

            cursor.execute("INSERT INTO clients (name) VALUES (%s)", (name,))
            conn.commit()

            client_id = cursor.lastrowid
            return jsonify({"id": client_id, "name": name}), 201

    
    @app.route("/api/assets", methods=["GET", "POST"])
    def assets():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)  

        try:
            if request.method == "GET":
                client_id = request.args.get("client")
                if not client_id:
                    return jsonify({"error": "client_id is required in query parameters"}), 400

                cursor.execute("SELECT * FROM client_assets WHERE client_id = %s", (client_id,))
                assets = cursor.fetchall()
                conn.close()
                if not assets:
                    return jsonify({"message": "No assets found for this client"}), 404
                return jsonify(assets), 200

            elif request.method == "POST":
                data = request.get_json()

                required_fields = ["asset_name", "location", "ip_address", "mode", "asset_type", "asset_owner", "client_id"]
                missing_fields = [field for field in required_fields if not data.get(field)]
                if missing_fields:
                    return jsonify({"error": f"Missing fields: {', '.join(missing_fields)}"}), 400

                asset_name = data.get("asset_name")
                location = data.get("location")
                ip_address = data.get("ip_address")
                mode = data.get("mode")
                asset_type = data.get("asset_type")
                asset_owner = data.get("asset_owner")
                remarks = data.get("remarks", "")  # remarks is optional
                client_id = data.get("client_id")

                cursor.execute(
                    """
                    INSERT INTO client_assets 
                    (asset_name, location, ip_address, mode, asset_type, asset_owner, remarks, client_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (asset_name, location, ip_address, mode, asset_type, asset_owner, remarks, client_id)
                )

                conn.commit()
                return jsonify({"message": "Asset added successfully"}), 201

        except mysql.connector.Error as err:
            conn.rollback()
            return jsonify({"error": f"MySQL Error: {str(err)}"}), 500

        except Exception as e:
            conn.rollback()
            return jsonify({"error": f"Unexpected Error: {str(e)}"}), 500

        finally:
            cursor.close()
            conn.close()



    @app.route("/api/escalation-matrix", methods=["GET", "POST"])
    def escalation_matrix():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if request.method == "GET":
            client_id = request.args.get("client")
            if not client_id:
                return jsonify({"error": "Missing client ID"}), 400

            cursor.execute("SELECT * FROM escalation_matrix WHERE client_id = %s", (client_id,))
            data = cursor.fetchall()
            conn.close()
            return jsonify(data), 200

        if request.method == "POST":
            data = request.get_json()
            try:
                cursor.execute(
                    """
                    INSERT INTO escalation_matrix (
                        client_id, level,
                        client_name, client_email, client_contact, client_designation,
                        gtb_name, gtb_email, gtb_contact, gtb_designation
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        data["client_id"], data["level"],
                        data["client_name"], data["client_email"], data["client_contact"], data["client_designation"],
                        data["gtb_name"], data["gtb_email"], data["gtb_contact"], data["gtb_designation"]
                    )
                )
                conn.commit()
                return jsonify({"message": "Escalation entry added successfully"}), 201
            except Exception as e:
                conn.rollback()
                return jsonify({"error": str(e)}), 500
            finally:
                conn.close()




    @app.route("/api/sla", methods=["GET", "POST"])
    def sla_policies():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if request.method == "GET":
            client_id = request.args.get("client")
            cursor.execute("SELECT * FROM sla_policies WHERE client_id = %s", (client_id,))
            policies = cursor.fetchall()
            conn.close()
            return jsonify(policies), 200

        if request.method == "POST":
            data = request.get_json()
            try:
                cursor.execute(
                    "INSERT INTO sla_policies (client_id, priority, response_time, resolution_time) VALUES (%s, %s, %s, %s)",
                    (data["client_id"], data["priority"], data["response_time"], data["resolution_time"])
                )
                conn.commit()
                return jsonify({"message": "SLA policy added successfully"}), 201
            except Exception as e:
                conn.rollback()
                return jsonify({"error": str(e)}), 500
            finally:
                conn.close()



    

    @app.route("/api/passwords", methods=["GET", "POST"])
    def passwords():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if request.method == "GET":
            client_id = request.args.get("client")
            if not client_id:
                return jsonify({"error": "Missing client ID"}), 400

            cursor.execute("""
                SELECT ap.id, ca.asset_name, ca.mode, ap.username, ap.password
                FROM asset_passwords ap
                JOIN client_assets ca ON ap.asset_id = ca.id
                WHERE ca.client_id = %s
            """, (client_id,))
            passwords = cursor.fetchall()
            conn.close()
            return jsonify(passwords), 200

        if request.method == "POST":
            data = request.get_json()
            try:
                cursor.execute(
                    "INSERT INTO asset_passwords (asset_id, username, password) VALUES (%s, %s, %s)",
                    (data["asset_id"], data["username"], data["password"])
                )
                conn.commit()
                return jsonify({"message": "Password entry added successfully"}), 201
            except Exception as e:
                conn.rollback()
                return jsonify({"error": str(e)}), 500
            finally:
                conn.close()










    @app.route('/api/clusters', methods=['GET'])
    def get_clusters():
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT cluster FROM clusters ORDER BY cluster")
            clusters = [row[0] for row in cursor.fetchall()]
            conn.close()
            return jsonify(clusters), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        

    @app.route('/api/clusters/<int:cluster_id>', methods=['GET'])
    def get_users_by_cluster(cluster_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT id, username FROM clusters WHERE cluster = %s", (cluster_id,))
            users = cursor.fetchall()
            conn.close()
            return jsonify(users), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500

        

    @app.route('/api/clusters', methods=['POST'])
    def create_user_in_cluster():
        data = request.get_json()
        username = data.get('username')
        cluster = data.get('cluster')

        if not username or not cluster:
            return jsonify({'error': 'Username and cluster are required'}), 400

        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("INSERT INTO clusters (username, cluster) VALUES (%s, %s)", (username, cluster))
            conn.commit()
            conn.close()
            return jsonify({'message': 'User added to cluster successfully'}), 201
        except Exception as e:
            return jsonify({'error': str(e)}), 500


    @app.route('/api/clusters/<int:user_id>', methods=['DELETE'])
    def delete_user_from_cluster(user_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM clusters WHERE id = %s", (user_id,))
            conn.commit()
            conn.close()
            return jsonify({'message': 'User deleted from cluster successfully'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500















    @app.route('/api/upload-pdf', methods=['POST'])
    def upload_pdf():
        if 'pdf' not in request.files or 'clientId' not in request.form:
            return jsonify({"error": "Missing file or clientId"}), 400

        file = request.files['pdf']
        client_id = request.form['clientId']

        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        filename = f"client_{client_id}.pdf"
        filepath = os.path.join(PDF_DIR, filename)
        file.save(filepath)

        return jsonify({"fileName": filename}), 200


    @app.route('/api/get-client-pdf', methods=['GET'])
    def get_client_pdf():
        client_id = request.args.get('clientId')
        if not client_id:
            return jsonify({"error": "Missing clientId"}), 400

        filename = f"client_{client_id}.pdf"
        filepath = os.path.join(PDF_DIR, filename)

        if os.path.exists(filepath):
            return jsonify({"fileName": filename}), 200
        else:
            return jsonify({"fileName": None}), 200
        
    
    
    @app.route('/api/delete-client-pdf', methods=['DELETE'])
    def delete_client_pdf():
        client_id = request.args.get('clientId')
        if not client_id:
            return jsonify({"error": "Missing clientId"}), 400

        filename = f"client_{client_id}.pdf"
        filepath = os.path.join(PDF_DIR, filename)

        if os.path.exists(filepath):
            os.remove(filepath)
            return jsonify({"message": "PDF deleted successfully"}), 200
        else:
            return jsonify({"error": "PDF not found"}), 404


    @app.route('/pdfs/<path:filename>')
    def serve_pdf(filename):
        return send_from_directory(PDF_DIR, filename)




    @app.route('/api/advisories', methods=['GET', 'POST'])
    def advisories():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if request.method == 'GET':
            cursor.execute("SELECT * FROM advisories ORDER BY timestamp DESC")
            data = cursor.fetchall()
            conn.close()
            return jsonify(data)

        if request.method == 'POST':
            data = request.get_json()
            required_fields = [
                "client_id", "client_name", "service_or_os", "update_type",
                "description", "impact", "recommended_actions", "advisory_content"
            ]
            if not all(field in data and data[field] for field in required_fields):
                return jsonify({"error": "Missing required fields"}), 400

            query = """
            INSERT INTO advisories (
                client_id, client_name, service_or_os, update_type,
                description, impact, recommended_actions, advisory_content, timestamp
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
            values = (
                data["client_id"], data["client_name"], data["service_or_os"],
                data["update_type"], data["description"], data["impact"],
                data["recommended_actions"], data["advisory_content"],
                datetime.utcnow()
            )
            cursor.execute(query, values)
            conn.commit()
            conn.close()
            return jsonify({"message": "Advisory submitted successfully!"}), 201

    @app.route('/api/advisories/delete', methods=['POST'])
    def delete_advisories():
        data = request.get_json()
        ids = data.get('ids', [])
        if not ids:
            return jsonify({"message": "No IDs provided"}), 400

        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            format_strings = ','.join(['%s'] * len(ids))
            cursor.execute(f"DELETE FROM advisories WHERE id IN ({format_strings})", tuple(ids))
            conn.commit()
            deleted_count = cursor.rowcount
            cursor.close()
            conn.close()
            return jsonify({"message": f"{deleted_count} advisories deleted successfully!"}), 200
        except Exception as e:
            print(f"Error deleting advisories: {e}")
            return jsonify({"message": "An error occurred while deleting advisories."}), 500


    @app.route('/api/rss-feeds', methods=['GET', 'POST'])
    def rss_feeds():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if request.method == 'GET':
            client_id = request.args.get("client_id")
            if not client_id:
                return jsonify({"error": "Client ID is required"}), 400
            
            cursor.execute("SELECT * FROM rss_feeds WHERE client_id = %s", (client_id,))
            feeds = cursor.fetchall()
            conn.close()
            return jsonify(feeds)

        if request.method == 'POST':
            data = request.get_json()
            url = data.get("url")
            client_id = data.get("client_id")

            if not url or not client_id:
                return jsonify({"error": "RSS feed URL and client ID are required"}), 400

            cursor.execute("INSERT INTO rss_feeds (url, client_id) VALUES (%s, %s)", (url, client_id))
            conn.commit()
            feed_id = cursor.lastrowid
            conn.close()
            return jsonify({"id": feed_id, "url": url, "client_id": client_id}), 201


    @app.route('/api/rss-feeds/<int:id>', methods=['DELETE'])
    def delete_rss_feed(id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM rss_feeds WHERE id = %s", (id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "RSS Feed deleted successfully!"}), 200
    
    @app.route('/api/rss-feed-items', methods=['GET'])
    def get_rss_feed_items():
        client_id = request.args.get('client_id')
        search_query = request.args.get('q')

        if not client_id:
            return jsonify([])

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT url FROM rss_feeds WHERE client_id = %s", (client_id,))
        feeds = cursor.fetchall()
        conn.close()

        all_items = []
        for feed in feeds:
            url = feed['url']
            try:
                # Use certifi's certificate bundle for verification
                
                response = requests.get(url, verify=False)

                parsed = feedparser.parse(response.content)

                if parsed.bozo:
                    print(f"Error parsing feed {url}: {parsed.bozo_exception}")
                    continue
                
                entries_to_process = parsed.entries

                if search_query:
                    # Filter entries on the backend if a search query is provided
                    filtered_entries = [
                        entry for entry in entries_to_process
                        if search_query.lower() in entry.get("title", "").lower() or
                           search_query.lower() in entry.get("summary", "").lower()
                    ]
                    entries_to_process = filtered_entries
                else:
                    # Limit to the latest 5 if no search query
                    entries_to_process = entries_to_process[:5]

                for entry in entries_to_process:
                    all_items.append({
                        "title": entry.get("title", "No Title"),
                        "link": entry.get("link", "#"),
                        "summary": entry.get("summary", ""),
                        "published": entry.get("published", "")
                    })
            except requests.exceptions.SSLError as e:
                print(f"SSL Error for feed {url}: {e}")
                # Optionally, you can decide to skip this feed or handle the error differently
            except Exception as e:
                print(f"Error fetching feed {url}: {e}")

        return jsonify(all_items)