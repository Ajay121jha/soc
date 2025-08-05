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
from itertools import groupby
from operator import itemgetter
import msal
import requests
import certifi
import feedparser
from flask_mail import Mail, Message








AZURE_TENANT_ID = 'YOUR_TENANT_ID'
AZURE_CLIENT_ID = 'YOUR_CLIENT_ID'
AZURE_CLIENT_SECRET = 'YOUR_CLIENT_SECRET'
GRAPH_SCOPE = ['https://graph.microsoft.com/.default']
GRAPH_ENDPOINT = 'https://graph.microsoft.com/v1.0'



def get_graph_access_token():
    authority = f'https://login.microsoftonline.com/{AZURE_TENANT_ID}'
    app = msal.ConfidentialClientApplication(
        client_id=AZURE_CLIENT_ID,
        client_credential=AZURE_CLIENT_SECRET,
        authority=authority
    )
    result = app.acquire_token_for_client(scopes=GRAPH_SCOPE)
    if 'access_token' in result:
        return result['access_token']
    else:
        raise Exception(result.get('error_description') or 'Failed to get access token')




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
            
            cursor.execute(
                "SELECT id FROM shift_employee_map WHERE shift_id = %s AND employee_id = %s",
                (shift_id, employee_id)
            )
            if not cursor.fetchone():
                return jsonify({"error": "Employee not in this shift"}), 403
            
            cursor.execute(
                "SELECT id FROM handover_notes WHERE shift_id = %s AND employee_id = %s",
                (shift_id, employee_id)
            )
            existing_note = cursor.fetchone()
            
            if existing_note:
                query = """
                    UPDATE handover_notes
                    SET note = %s, created_at = NOW()
                    WHERE shift_id = %s AND employee_id = %s
                """
                cursor.execute(query, (note, shift_id, employee_id))
            else:
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
        cab_facility = data.get("cab_facility")

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

            cursor.execute("""
                SELECT id FROM shift_assignments
                WHERE start_datetime = %s AND end_datetime = %s AND shift_type = %s
            """, (start_datetime, end_datetime, shift_type))
            existing_shift = cursor.fetchone()

            if existing_shift:
                shift_id = existing_shift[0]
            else:
                cursor.execute("""
                    INSERT INTO shift_assignments (shift_type, start_datetime, end_datetime)
                    VALUES (%s, %s, %s)
                """, (shift_type, start_datetime, end_datetime))
                conn.commit()
                shift_id = cursor.lastrowid

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
        date = data.get('date')
        shift_type = data.get('shift_type')
        new_employee_id = data.get('employee_id')

        if not all([shift_id, date, shift_type, new_employee_id]):
            return jsonify({'error': 'Missing required parameters'}), 400

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

            cursor.execute("""
                UPDATE shift_assignments
                SET date = %s,
                    shift_type = %s,
                    start_time = %s,
                    end_time = %s
                WHERE id = %s
            """, (date, shift_type, start_time, end_time, shift_id))

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

    

    @app.route('/api/delete_shift', methods=['DELETE'])
    def delete_shift():
        data = request.get_json()
        shift_id = data.get('shift_id')

        if not shift_id:
            return jsonify({'error': 'Missing shift_id'}), 400

        try:
            conn=get_db_connection()
            cursor=conn.cursor()

            cursor.execute("DELETE FROM shift_employee_map WHERE shift_id = %s", (shift_id,))
            cursor.execute("DELETE FROM handover_notes WHERE shift_id = %s", (shift_id,))
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
                remarks = data.get("remarks", "")
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





















    

    def get_contacts_for_tech_map(cursor, client_tech_map_id):
        """Fetches all contacts for a given client_tech_map entry."""
        cursor.execute("SELECT id, email FROM client_tech_contacts WHERE client_tech_map_id = %s", (client_tech_map_id,))
        return cursor.fetchall()

    # --- API Endpoints ---

  

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


    @app.route("/api/tech-stacks", methods=["GET", "POST"])
    def tech_stacks():
        """Fetches all available technology stacks or adds a new one."""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if request.method == "GET":
            cursor.execute("SELECT id, name FROM tech_stacks ORDER BY name")
            stacks = cursor.fetchall()
            conn.close()
            return jsonify(stacks)

        if request.method == "POST":
            data = request.get_json()
            name = data.get("name")
            description = data.get("description", "") # Optional description
            if not name:
                conn.close()
                return jsonify({"error": "Tech stack name is required"}), 400
            
            try:
                cursor.execute("INSERT INTO tech_stacks (name, description) VALUES (%s, %s)", (name, description))
                conn.commit()
                new_stack_id = cursor.lastrowid
                conn.close()
                return jsonify({"id": new_stack_id, "name": name, "description": description}), 201
            except mysql.connector.Error as err:
                conn.close()
                if err.errno == 1062:
                    return jsonify({"error": f"Tech stack '{name}' already exists."}), 409
                return jsonify({"error": str(err)}), 500

    @app.route("/api/clients/<int:client_id>/tech", methods=["GET", "POST"])
    def manage_client_tech(client_id):
        """Manages the technologies assigned to a specific client."""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        if request.method == "GET":
            query = """
                SELECT ctm.id, ts.name as tech_stack_name, ctm.version
                FROM client_tech_map ctm
                JOIN tech_stacks ts ON ctm.tech_stack_id = ts.id
                WHERE ctm.client_id = %s
            """
            cursor.execute(query, (client_id,))
            tech_details = cursor.fetchall()
            for detail in tech_details:
                detail['contacts'] = get_contacts_for_tech_map(cursor, detail['id'])
            conn.close()
            return jsonify(tech_details)

        if request.method == "POST":
            data = request.get_json()
            tech_stack_id = data.get("tech_stack_id")
            version = data.get("version")
            if not tech_stack_id or not version:
                return jsonify({"error": "tech_stack_id and version are required"}), 400
            
            try:
                cursor.execute(
                    "INSERT INTO client_tech_map (client_id, tech_stack_id, version) VALUES (%s, %s, %s)",
                    (client_id, tech_stack_id, version)
                )
                conn.commit()
                return jsonify({"message": "Tech stack assigned to client successfully"}), 201
            except Exception as e:
                conn.rollback()
                return jsonify({"error": f"Failed to assign tech stack: {e}"}), 500
            finally:
                conn.close()

    @app.route("/api/client-tech/<int:client_tech_map_id>/contacts", methods=["POST"])
    def add_client_tech_contact(client_tech_map_id):
        """Adds a new notification email contact for a client's technology."""
        conn = get_db_connection()
        cursor = conn.cursor()
        data = request.get_json()
        email = data.get("email")
        if not email:
            return jsonify({"error": "Email is required"}), 400
        
        try:
            cursor.execute(
                "INSERT INTO client_tech_contacts (client_tech_map_id, email) VALUES (%s, %s)",
                (client_tech_map_id, email)
            )
            conn.commit()
            return jsonify({"message": "Contact added successfully"}), 201
        except Exception as e:
            conn.rollback()
            return jsonify({"error": f"Failed to add contact: {e}"}), 500
        finally:
            conn.close()
    
   # <<< FIXED & REFACTORED FUNCTION TO CREATE AND UPDATE A SINGLE CONSOLIDATED DRAFT >>>
    @app.route("/api/clients/<int:client_id>/feed-items", methods=["GET"])
    def get_client_feed_items(client_id):
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
            # 1. Find all RSS feed URLs and their associated tech_stack_id for the client
            query = """
                SELECT DISTINCT rf.url, rf.tech_stack_id, ts.name as tech_stack_name
                FROM rss_feeds rf
                JOIN client_tech_map ctm ON rf.tech_stack_id = ctm.tech_stack_id
                JOIN tech_stacks ts ON rf.tech_stack_id = ts.id
                WHERE ctm.client_id = %s
            """
            cursor.execute(query, (client_id,))
            feeds = cursor.fetchall()
            cursor.close()

            # 2. Get all item GUIDs that have already been processed
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT item_guid FROM processed_feed_items")
            seen_items_results = cursor.fetchall()
            seen_items_set = {item['item_guid'] for item in seen_items_results}
            cursor.close()
            
            # 3. Process feeds, filter for keywords, and check for newness
            RELEVANT_KEYWORDS = [
                'vulnerability', 'threat', 'security', 'update', 
                'patch', 'advisory', 'cve-', 'malware', 'exploit'
            ]
            
            new_items_found = []
            new_guids_to_log = []

            for feed in feeds:
                try:
                    tech_stack_id_for_feed = feed['tech_stack_id']
                    tech_stack_name_for_feed = feed['tech_stack_name']
                    parsed_feed = feedparser.parse(feed['url'])

                    for entry in parsed_feed.entries:
                        item_guid = entry.get('guid', entry.get('link'))
                        if not item_guid or item_guid in seen_items_set:
                            continue

                        content_to_check = (entry.get("title", "") + entry.get("summary", "")).lower()
                        if any(keyword in content_to_check for keyword in RELEVANT_KEYWORDS):
                            feed_item_data = {
                                "title": entry.get("title", "No Title"),
                                "link": entry.get("link", "#"),
                                "summary": entry.get("summary", "No summary available."),
                                "tech_stack_id": tech_stack_id_for_feed,
                                "tech_stack_name": tech_stack_name_for_feed
                            }
                            new_items_found.append(feed_item_data)
                            new_guids_to_log.append(item_guid)
                            seen_items_set.add(item_guid)

                except Exception as e:
                    print(f"Error fetching or parsing feed {feed['url']}: {e}")

            if not new_items_found:
                return jsonify([])

            # 4. Log the new GUIDs so we don't process them again
            if new_guids_to_log:
                cursor = conn.cursor()
                insert_guid_query = "INSERT INTO processed_feed_items (item_guid) VALUES (%s)"
                guid_values_to_insert = [(guid,) for guid in new_guids_to_log]
                cursor.executemany(insert_guid_query, guid_values_to_insert)
                cursor.close()
                conn.commit()

            # 5. Group new items by tech_stack_id to create consolidated drafts
            items_by_tech = {}
            for item in new_items_found:
                tech_id = item['tech_stack_id']
                if tech_id not in items_by_tech:
                    items_by_tech[tech_id] = []
                items_by_tech[tech_id].append(item)

            for tech_id, items_list in items_by_tech.items():
                # For each tech group, find the one client we're operating on
                tech_stack_name = items_list[0]['tech_stack_name']

                # Format the new information block from all new feed items in this group
                new_findings_block = ""
                for item in items_list:
                    new_findings_block += f"""
---
**New Finding:** {item['title']}
**Source:** {item['link']}
**Summary:** {item['summary']}
"""
                
                cursor = conn.cursor(dictionary=True)
                # Check for an existing draft for THIS client and THIS tech stack
                cursor.execute(
                    "SELECT id, advisory_content FROM advisories WHERE client_id = %s AND service_or_os = %s AND status = 'Draft'",
                    (client_id, tech_stack_name)
                )
                existing_draft = cursor.fetchone()

                if existing_draft:
                    # Append new findings to the existing draft
                    updated_content = existing_draft['advisory_content'] + new_findings_block
                    cursor.execute(
                        "UPDATE advisories SET advisory_content = %s, timestamp = NOW() WHERE id = %s",
                        (updated_content, existing_draft['id'])
                    )
                else:
                    # Create a new consolidated draft
                    cursor.execute("SELECT name FROM clients WHERE id = %s", (client_id,))
                    client_name = cursor.fetchone()['name']
                    initial_content = f"""**Automated Advisory Draft**

**Topic:** Potential Issues for {tech_stack_name}
**Date Generated:** {datetime.now().strftime('%d/%m/%Y')}

This is a consolidated summary of new findings related to your technology stack. Please review, edit, and dispatch.
{new_findings_block}
---
*This is an automated draft. Please review for accuracy.*
"""
                    cursor.execute(
                        """
                        INSERT INTO advisories (client_id, client_name, service_or_os, update_type, description, advisory_content, status, timestamp)
                        VALUES (%s, %s, %s, %s, %s, %s, 'Draft', NOW())
                        """,
                        (
                            client_id, client_name, tech_stack_name,
                            "Automated Consolidated Alert",
                            f"Multiple new findings for {tech_stack_name}",
                            initial_content
                        )
                    )
                conn.commit()
                cursor.close()

            return jsonify(new_items_found)

        except Exception as e:
            # Print the full traceback to the console for detailed debugging
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500
        finally:
            if conn and conn.is_connected():
                conn.close()
        
    @app.route("/api/advisories/bulk", methods=['POST'])
    def create_bulk_advisory():
        """
        Creates and dispatches advisories manually. Status is set to 'Sent'.
        """
        data = request.get_json()
        tech_stack_id = data.get("techStackId")
        version_pattern = data.get("version", "").replace('*', '%')
        update_type = data.get("updateType")
        description = data.get("description")
        impact = data.get("impact", "Not specified.")
        recommended_actions = data.get("recommendedActions", "Review and apply updates as per your internal policies.")

        if not all([tech_stack_id, version_pattern, update_type, description]):
            return jsonify({"error": "Missing required advisory fields"}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        find_clients_query = """
            SELECT c.id as client_id, c.name as client_name, ts.name as tech_stack_name
            FROM clients c
            JOIN client_tech_map ctm ON c.id = ctm.client_id
            JOIN tech_stacks ts ON ctm.tech_stack_id = ts.id
            WHERE ctm.tech_stack_id = %s AND ctm.version LIKE %s
        """
        cursor.execute(find_clients_query, (tech_stack_id, version_pattern))
        affected_clients = cursor.fetchall()
        
        if not affected_clients:
            conn.close()
            return jsonify({"message": "No clients found matching the specified technology and version."}), 200

        for client in affected_clients:
            advisory_content = f"""**Cybersecurity Advisory: {update_type} for {client['tech_stack_name']}**

**Client:** {client['client_name']}
**Date:** {datetime.now().strftime('%d/%m/%Y')}

**1. Overview**
This advisory provides critical information regarding a recent {update_type} for your {client['tech_stack_name']} environment (Version Pattern: {data.get("version")}).

**2. Description**
{description}

**3. Potential Impact**
{impact}

**4. Recommended Actions**
{recommended_actions}

---
*This is a manually dispatched advisory from the SOC Advisory System.*
"""
            insert_query = """
                INSERT INTO advisories (client_id, client_name, service_or_os, update_type, description, impact, recommended_actions, advisory_content, status, timestamp)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Sent', NOW())
            """
            cursor.execute(insert_query, (
                client['client_id'], client['client_name'], client['tech_stack_name'],
                update_type, description, impact, recommended_actions, advisory_content
            ))

        conn.commit()
        conn.close()
        
        return jsonify({"message": f"Advisory has been dispatched and recorded for {len(affected_clients)} clients."}), 201

    @app.route('/api/advisories', methods=['GET'])
    def get_advisories():
        """Fetches all advisories for the main feed, including status."""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, client_id, client_name, advisory_content, status, timestamp FROM advisories ORDER BY timestamp DESC")
        data = cursor.fetchall()
        conn.close()
        return jsonify(data)

    @app.route('/api/advisories/<int:advisory_id>', methods=['PUT'])
    def update_advisory(advisory_id):
        """Updates the content and/or status of an advisory."""
        data = request.get_json()
        new_content = data.get('advisory_content')
        new_status = data.get('status')

        if not new_content and not new_status:
            return jsonify({'error': 'No content or status provided for update'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        
        fields_to_update = []
        params = []
        if new_content:
            fields_to_update.append("advisory_content = %s")
            params.append(new_content)
        if new_status in ['Draft', 'Sent']:
            fields_to_update.append("status = %s")
            params.append(new_status)
        
        if not fields_to_update:
            return jsonify({'error': 'Invalid fields for update'}), 400

        params.append(advisory_id)
        query = f"UPDATE advisories SET {', '.join(fields_to_update)}, timestamp = NOW() WHERE id = %s"
        
        cursor.execute(query, tuple(params))
        conn.commit()
        conn.close()

        return jsonify({'message': 'Advisory updated successfully'}), 200

    @app.route('/api/rss-feeds', methods=['GET', 'POST', 'DELETE'])
    def manage_rss_feeds():
        conn = get_db_connection()
        # Use dictionary=True for GET, but not for others to avoid issues
        cursor = conn.cursor(dictionary=True if request.method == 'GET' else False)

        if request.method == 'GET':
            tech_stack_id = request.args.get('techStackId')
            if not tech_stack_id:
                conn.close()
                return jsonify({'error': 'Missing techStackId'}), 400
            cursor.execute("SELECT url FROM rss_feeds WHERE tech_stack_id = %s", (tech_stack_id,))
            feeds = cursor.fetchall()
            conn.close()
            return jsonify(feeds)

        elif request.method == 'POST':
            data = request.get_json()
            tech_stack_id = data.get('tech_stack_id')
            url = data.get('url')
            if not tech_stack_id or not url:
                conn.close()
                return jsonify({'error': 'Missing tech_stack_id or url'}), 400
            try:
                cursor.execute("INSERT INTO rss_feeds (tech_stack_id, url) VALUES (%s, %s)", (tech_stack_id, url))
                conn.commit()
                return jsonify({'message': 'RSS feed added successfully'})
            except mysql.connector.Error as err:
                 # Check for duplicate entry error
                if err.errno == 1062:
                    return jsonify({"error": "This RSS feed URL already exists for this tech stack."}), 409
                return jsonify({"error": str(err)}), 500
            finally:
                conn.close()

        # <<< NEW: Handle DELETE requests >>>
        elif request.method == 'DELETE':
            data = request.get_json()
            tech_stack_id = data.get('tech_stack_id')
            urls_to_delete = data.get('urls')

            if not tech_stack_id or not urls_to_delete or not isinstance(urls_to_delete, list):
                conn.close()
                return jsonify({'error': 'A tech_stack_id and a list of urls are required.'}), 400
            
            try:
                # Prepare query with placeholders for the IN clause
                placeholders = ', '.join(['%s'] * len(urls_to_delete))
                query = f"DELETE FROM rss_feeds WHERE tech_stack_id = %s AND url IN ({placeholders})"
                
                # Combine parameters into a single tuple
                params = (tech_stack_id,) + tuple(urls_to_delete)
                
                cursor.execute(query, params)
                conn.commit()
                
                # Check how many rows were deleted
                deleted_count = cursor.rowcount
                return jsonify({'message': f'{deleted_count} RSS feed(s) deleted successfully.'}), 200
            except Exception as e:
                conn.rollback()
                return jsonify({'error': f"Failed to delete feeds: {e}"}), 500
            finally:
                conn.close()




    @app.route('/api/client-tech/<int:client_tech_map_id>', methods=['DELETE'])
    def delete_client_tech(client_tech_map_id):
        """Deletes a specific tech stack assigned to a client."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            query = "DELETE FROM client_tech_map WHERE id = %s"
            cursor.execute(query, (client_tech_map_id,))
            conn.commit()

            if cursor.rowcount == 0:
                return jsonify({"error": "No tech stack assignment found with that ID."}), 404

            return jsonify({"message": "Tech stack assignment deleted successfully"}), 200

        except Exception as e:
            conn.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conn.close()



    


    @app.route('/api/clients/<int:client_id>/advisories', methods=['GET'])
    def get_client_advisories(client_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            # 1. Fetch all RSS URLs for the client
            rss_query = "SELECT rss_url FROM client_rss_feeds WHERE client_id = %s"
            cursor.execute(rss_query, (client_id,))
            rss_urls = [row['rss_url'] for row in cursor.fetchall()]

            combined_advisory_text = ""
            advisory_entries = []

            # 2. Iterate through each URL and combine the feed content
            for url in rss_urls:
                feed = feedparser.parse(url)
                for entry in feed.entries:
                    advisory_entries.append({
                        "title": entry.title,
                        "summary": getattr(entry, 'summary', getattr(entry, 'description', '')),
                        "link": entry.link
                    })
            
            # You can now format this combined data however you like.
            # For example, create a single large advisory text.
            for entry in advisory_entries:
                combined_advisory_text += f"Title: {entry['title']}\n"
                combined_advisory_text += f"Summary: {entry['summary']}\n"
                combined_advisory_text += "-----\n"

            # 3. Create a single advisory object
            single_advisory = {
                "title": f"Combined Advisory for Client ID {client_id}",
                "content": combined_advisory_text,
                "source_feeds": [entry["title"] for entry in advisory_entries]
            }

            return jsonify([single_advisory]) # Return as a list with one item
        
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conn.close()






    @app.route('/api/dispatch-advisory', methods=['POST'])
    def dispatch_advisory():
        try:
            data = request.get_json()
            advisory_title = data.get('title')
            advisory_content = data.get('content')
            client_tech_map_id = data.get('clientTechMapId') # This will identify the client-tech assignment

            if not all([advisory_title, advisory_content, client_tech_map_id]):
                return jsonify({"error": "Missing advisory details"}), 400

            # Fetch contacts for the specific client-tech assignment
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            query = """
                SELECT c.email 
                FROM contacts c
                WHERE c.client_tech_map_id = %s
            """
            cursor.execute(query, (client_tech_map_id,))
            recipients = [row['email'] for row in cursor.fetchall()]
            
            if not recipients:
                return jsonify({"message": "Advisory not sent. No contacts found for this tech stack."}), 200

            access_token = get_graph_access_token()
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }

            # Construct the email payload
            email_payload = {
                "message": {
                    "subject": advisory_title,
                    "body": {
                        "contentType": "Text",
                        "content": advisory_content
                    },
                    "toRecipients": [{"emailAddress": {"address": email}} for email in recipients]
                },
                "saveToSentItems": "true"
            }

            # Send the email via Graph API
            # NOTE: You'll need to use a mailbox that has permissions to send on behalf of others.
            # This is a common point of configuration. The "me" here usually requires a signed-in user or an admin-configured mailbox.
            send_mail_endpoint = f'{GRAPH_ENDPOINT}/users/YOUR_SENDER_EMAIL/sendMail' 
            
            response = requests.post(send_mail_endpoint, headers=headers, json=email_payload)
            
            if response.status_code == 202:
                return jsonify({"message": f"Advisory dispatched to {len(recipients)} contacts."}), 200
            else:
                return jsonify({"error": f"Failed to send email. Status code: {response.status_code}, Response: {response.text}"}), 500

        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conn.close()