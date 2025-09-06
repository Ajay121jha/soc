
from flask import request, Flask, jsonify
from flask_cors import CORS
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
from io import BytesIO
import zipfile
import json # Added for AI generation

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

    # --- NEW ADVISORY SYSTEM ROUTES ---

    @app.route("/api/clients/<int:client_id>/escalation-matrix", methods=["GET"])
    def get_escalation_matrix_for_client(client_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            query = "SELECT id, client_email as email, level FROM escalation_matrix WHERE client_id = %s"
            cursor.execute(query, (client_id,))
            contacts = cursor.fetchall()

            matrix = {"L1": [], "L2": [], "L3": []}
            for contact in contacts:
                if contact['level'] in matrix:
                    matrix[contact['level']].append(contact)

            return jsonify(matrix)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            if conn and conn.is_connected():
                cursor.close()
                conn.close()

    # FIX: Add route to create a new escalation contact
    @app.route("/api/clients/<int:client_id>/escalation-contacts", methods=["POST"])
    def add_escalation_contact_for_client(client_id):
        data = request.get_json()
        email = data.get("email")
        level = data.get("level")

        if not email or not level:
            return jsonify({"error": "Email and level are required"}), 400

        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            # Assuming your table has columns: client_id, client_email, level
            # And other columns like client_name, gtb_name etc. can be NULL or have defaults
            query = """
                INSERT INTO escalation_matrix (client_id, client_email, level, client_name, gtb_name) 
                VALUES (%s, %s, %s, %s, %s)
            """
            # Providing placeholder names, adjust as needed
            client_name_placeholder = email.split('@')[0]
            gtb_name_placeholder = "GTB Contact"
            
            cursor.execute(query, (client_id, email, level, client_name_placeholder, gtb_name_placeholder))
            conn.commit()
            return jsonify({"message": "Contact added successfully"}), 201
        except mysql.connector.Error as err:
            conn.rollback()
            if err.errno == 1062: # Duplicate entry
                 return jsonify({"error": f"Contact '{email}' already exists for this client."}), 409
            return jsonify({"error": str(err)}), 500
        finally:
            if conn and conn.is_connected():
                cursor.close()
                conn.close()

    # FIX: Add route to delete an escalation contact
    @app.route("/api/escalation-contacts/<int:contact_id>", methods=["DELETE"])
    def delete_escalation_contact(contact_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            query = "DELETE FROM escalation_matrix WHERE id = %s"
            cursor.execute(query, (contact_id,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "Contact not found"}), 404
            return jsonify({"message": "Contact deleted successfully"}), 200
        except Exception as e:
            conn.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            if conn and conn.is_connected():
                cursor.close()
                conn.close()

    # FIX: Add route to get recipients for an advisory email
    @app.route("/api/advisories/<int:advisory_id>/recipients", methods=["GET"])
    def get_advisory_recipients(advisory_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            # First, find the client_id from the advisory
            cursor.execute("SELECT client_id FROM advisories WHERE id = %s", (advisory_id,))
            advisory = cursor.fetchone()
            if not advisory:
                return jsonify({"error": "Advisory not found"}), 404

            client_id = advisory['client_id']

            # Now, get all escalation contacts for that client
            cursor.execute("SELECT client_email FROM escalation_matrix WHERE client_id = %s", (client_id,))
            recipients = [row['client_email'] for row in cursor.fetchall()]

            return jsonify(recipients)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            if conn and conn.is_connected():
                cursor.close()
                conn.close()


    @app.route("/api/generate-advisory-from-url", methods=["POST"])
    def generate_advisory_from_url():
        data = request.get_json()
        if not data or 'title' not in data or 'summary' not in data:
            return jsonify({"error": "Missing title or summary in request"}), 400

        rss_title = data['title']
        rss_summary = data['summary']

        schema = {
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "vulnerability_details": {"type": "STRING"},
                "technical_analysis": {"type": "STRING"},
                "impact_assessment": {"type": "STRING"},
                "mitigation_strategies": {"type": "STRING"},
                "detection_and_response": {"type": "STRING"},
                "recommendations": {"type": "STRING"},
                "update_type": {"type": "STRING", "enum": ["Security Patch", "Vulnerability Alert", "Informational"]},
            },
            "required": ["summary", "vulnerability_details", "impact_assessment", "mitigation_strategies"]
        }

        prompt = f"""
            Act as a senior cybersecurity analyst. Based on the following RSS feed item, generate a detailed security advisory.
            The content is from a trusted source. Extract and structure the information into the required JSON format.
            If a specific detail isn't present, use your expertise to infer likely scenarios or state "Details not available in the provided summary."
            Ensure each section is detailed and written as a list of points separated by newlines (\\n).

            RSS Item Title: "{rss_title}"
            RSS Item Summary: "{rss_summary}"

            Generate the advisory content.
        """

        try:
            api_key = ""  # The environment will provide this
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={api_key}"

            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseSchema": schema,
                },
            }

            response = requests.post(api_url, json=payload)
            response.raise_for_status()

            result = response.json()

            if result.get("candidates"):
                generated_text = result["candidates"][0]["content"]["parts"][0]["text"]
                generated_data = json.loads(generated_text)
                return jsonify(generated_data)
            else:
                return jsonify({"error": "No content generated by AI."}), 500

        except requests.exceptions.RequestException as e:
            return jsonify({"error": f"API request failed: {e}"}), 500
        except Exception as e:
            return jsonify({"error": f"An unexpected error occurred: {e}"}), 500

    # --- EXISTING ROUTES ---
    
    @app.route('/api/shifts/<int:shift_id>/notes', methods=['GET'])
    def get_shift_notes(shift_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
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
            
            fields = [
                'location', 'family', 'class', 'manufacturer', 'model',
                'serial_number', 'host_name', 'ip_address', 'criticality',
                'eos', 'eol', 'latest_firmware_release_date', 'asset_owner',
                'current_firmware_version', 'latest_firmware_version',
                'end_of_support', 'integration_with_pim_tacacs', 'rac_no',
                'rac_qr_code', 'device_position', 'device_qr', 'status'
            ]


            if not query:
                cursor.execute(f"SELECT id, {', '.join(fields)} FROM knowledge_base")
                results = cursor.fetchall()
                return jsonify(results)

            words = query.split()
            conditions = []
            params = []

            for word in words:
                condition = "(" + " OR ".join([f"{field} LIKE %s" for field in fields]) + ")"
                conditions.append(condition)
                params.extend([f"%{word}%"] * len(fields))

            where_clause = " AND ".join(conditions)
            sql = f"""
                SELECT id, {', '.join(fields)}
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
        conn = None
        cursor = None
        try:
            data = request.get_json()

            required_fields = [
                'location', 'family', 'class', 'manufacturer', 'model',
                'serial_number', 'host_name', 'ip_address', 'criticality',
                'eos', 'eol', 'latest_firmware_release_date', 'asset_owner',
                'current_firmware_version', 'latest_firmware_version',
                'end_of_support', 'integration_with_pim_tacacs', 'rack_no',
                'rack_qr_code', 'device_position', 'device_qr', 'status'
            ]

            if not all(field in data and data[field] for field in required_fields):
                return jsonify({"message": "All fields are required."}), 400

            conn = get_db_connection()
            cursor = conn.cursor()

            insert_query = f"""
                INSERT INTO knowledge_base (
                    {', '.join(required_fields)}
                ) VALUES ({', '.join(['%s'] * len(required_fields))})
            """

            values = tuple(data[field] for field in required_fields)
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
        conn = None
        cursor = None
        try:
            data = request.get_json()
            ids = data.get('ids', [])
            if not ids:
                return jsonify({"message": "No IDs provided"}), 400

            conn = get_db_connection()
            cursor = conn.cursor()
            format_strings = ','.join(['%s'] * len(ids))
            query = f"DELETE FROM knowledge_base WHERE id IN ({format_strings})"
            cursor.execute(query, tuple(ids))
            conn.commit()

            return jsonify({"message": "Entries deleted successfully!"}), 200

        except Exception as e:
            print("Error deleting entries:", str(e))
            return jsonify({"message": str(e)}), 500

        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()


        
    

    @app.route('/api/kb_table-import', methods=['POST'])
    def import_data():
        if 'file' not in request.files:
            return jsonify({"message": "No file part in the request"}), 400

        file = request.files['file']
        if file.filename == "":
            return jsonify({"message": "No file selected"}), 400

        conn = None
        cursor = None

        try:
            filename = file.filename.lower()
            if filename.endswith('.csv'):
                df = pd.read_csv(file)
            elif filename.endswith('.xlsx'):
                df = pd.read_excel(file, engine='openpyxl')
            elif filename.endswith('.xls'):
                df = pd.read_excel(file, engine='xlrd')
            else:
                return jsonify({"message": "Unsupported file type"}), 400

            # Normalize column headers
            df.columns = (
                df.columns.str.strip()
                .str.lower()
                .str.replace(' ', '_')
                .str.replace('/', '_')
            )

            # Manual corrections for known mismatches
            df.columns = df.columns.str.replace('rack_no', 'rac_no')
            df.columns = df.columns.str.replace('rack_qr_code', 'rac_qr_code')

            # Replace invalid values with None
            df.replace(['Not yet declared', 'NA', 'na', 'N/A', '', ' '], None, inplace=True)

            required_columns = [
                'location', 'family', 'class', 'manufacturer', 'model',
                'serial_number', 'host_name', 'ip_address', 'criticality',
                'eos', 'eol', 'latest_firmware_release_date', 'asset_owner',
                'current_firmware_version', 'latest_firmware_version',
                'end_of_support', 'integration_with_pim_tacacs', 'rac_no',
                'rac_qr_code', 'device_position', 'device_qr', 'status'
            ]

            # Fuzzy match uploaded columns to required columns
            import difflib
            uploaded_columns = df.columns.tolist()
            column_mapping = {}
            for required in required_columns:
                match = difflib.get_close_matches(required, uploaded_columns, n=1, cutoff=0.6)
                column_mapping[required] = match[0] if match else None

            missing_mappings = [col for col, mapped in column_mapping.items() if mapped is None]
            if missing_mappings:
                return jsonify({
                    "message": f"Missing required columns or unable to match: {', '.join(missing_mappings)}"
                }), 400

            df = df.rename(columns={v: k for k, v in column_mapping.items() if v})

            # Convert datetime columns to MySQL-compatible date format
            date_columns = ['eos', 'eol', 'latest_firmware_release_date', 'end_of_support']
            for col in date_columns:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce').dt.strftime('%Y-%m-%d')
                    df[col] = df[col].where(pd.notnull(df[col]), None)

            # Drop extra columns not in required_columns
            df = df[[col for col in required_columns if col in df.columns]]

            conn = get_db_connection()
            cursor = conn.cursor()

            insert_query = f"""
                INSERT INTO knowledge_base (
                    {', '.join(required_columns)}
                ) VALUES ({', '.join(['%s'] * len(required_columns))})
            """

            for index, row in df.iterrows():
                try:
                    values = tuple(row.get(col, None) for col in required_columns)
                    cursor.execute(insert_query, values)
                    print(f"Inserted row {index}: {values}")
                except Exception as insert_error:
                    print(f"Error inserting row {index}: {insert_error}")
                    conn.rollback()
                    return jsonify({"message": f"Error inserting row {index}: {str(insert_error)}"}), 500

            conn.commit()
            return jsonify({"message": "Import successful!"}), 200

        except Exception as e:
            if conn:
                conn.rollback()
            print(f"Error: {str(e)}")
            return jsonify({"message": str(e)}), 500

        finally:
            if cursor:
                cursor.close()
            if conn:
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


    @app.route("/api/categories", methods=["GET", "POST"])
    def categories():
        """Fetches all top-level categories or adds a new one."""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if request.method == "GET":
            cursor.execute("SELECT id, name FROM categories ORDER BY name")
            categories = cursor.fetchall()
            conn.close()
            return jsonify(categories)

        if request.method == "POST":
            data = request.get_json()
            name = data.get("name")
            if not name:
                conn.close()
                return jsonify({"error": "Category name is required"}), 400

            try:
                cursor.execute("INSERT INTO categories (name) VALUES (%s)", (name,))
                conn.commit()
                new_id = cursor.lastrowid
                conn.close()
                return jsonify({"id": new_id, "name": name}), 201
            except mysql.connector.Error as err:
                conn.close()
                if err.errno == 1062:
                    return jsonify({"error": f"Category '{name}' already exists."}), 409
                return jsonify({"error": str(err)}), 500
            

    




    @app.route("/api/subcategories", methods=["GET", "POST"])
    def subcategories():
        """Fetches all subcategories or adds a new one linked to a category."""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if request.method == "GET":
            cursor.execute("SELECT id, category_id, name FROM subcategories ORDER BY name")
            subcategories = cursor.fetchall()
            conn.close()
            return jsonify(subcategories)

        if request.method == "POST":
            data = request.get_json()
            category_id = data.get("category_id")
            name = data.get("name")
            if not category_id or not name:
                conn.close()
                return jsonify({"error": "Both category_id and name are required"}), 400

            try:
                cursor.execute("INSERT INTO subcategories (category_id, name) VALUES (%s, %s)", (category_id, name))
                conn.commit()
                new_id = cursor.lastrowid
                conn.close()
                return jsonify({"id": new_id, "category_id": category_id, "name": name}), 201
            except mysql.connector.Error as err:
                conn.close()
                if err.errno == 1062:
                    return jsonify({"error": f"Subcategory '{name}' already exists for this category."}), 409
                return jsonify({"error": str(err)}), 500













    @app.route("/api/categories", methods=["GET"])
    def get_categories():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name FROM categories ORDER BY name")
        categories = cursor.fetchall()
        conn.close()
        return jsonify(categories)
    




    
    @app.route("/api/subcategories/<int:category_id>", methods=["GET"])
    def get_subcategories(category_id):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name FROM subcategories WHERE category_id = %s", (category_id,))
        subcategories = cursor.fetchall()
        conn.close()
        return jsonify(subcategories)



    @app.route("/api/tech-stacks/<int:subcategory_id>", methods=["GET"])
    def get_tech_stacks_by_subcategory(subcategory_id):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name FROM tech_stacks WHERE subcategory_id = %s", (subcategory_id,))
        stacks = cursor.fetchall()
        conn.close()
        return jsonify(stacks)







    @app.route("/api/tech-stacks", methods=["POST"])
    def add_tech_stack():
        data = request.get_json()
        name = data.get("name")
        subcategory_id = data.get("subcategory_id")

        if not name or not subcategory_id:
            return jsonify({"error": "Name and subcategory_id are required"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO tech_stacks (name, subcategory_id) VALUES (%s, %s)", (name, subcategory_id))
            conn.commit()
            return jsonify({"message": "Tech stack added successfully"}), 201
        except Exception as e:
            conn.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conn.close()













    @app.route("/api/clients/<int:client_id>/categories", methods=["GET", "POST"])
    def client_categories(client_id):
        """Assign categories to a client or fetch assigned categories."""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if request.method == "GET":
            cursor.execute("""
                SELECT c.id, c.name
                FROM categories c
                JOIN client_category_map ccm ON c.id = ccm.category_id
                WHERE ccm.client_id = %s
                ORDER BY c.name
            """, (client_id,))
            categories = cursor.fetchall()
            conn.close()
            return jsonify(categories)

        if request.method == "POST":
            data = request.get_json()
            category_id = data.get("category_id")
            if not category_id:
                conn.close()
                return jsonify({"error": "category_id is required"}), 400

            try:
                cursor.execute("""
                    INSERT INTO client_category_map (client_id, category_id)
                    VALUES (%s, %s)
                """, (client_id, category_id))
                conn.commit()
                conn.close()
                return jsonify({"message": "Category assigned successfully"}), 201
            except mysql.connector.Error as err:
                conn.close()
                return jsonify({"error": str(err)}), 500

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







            
    
    
    @app.route("/api/clients/<int:client_id>/feed-items", methods=["GET"])
    def get_client_feed_items(client_id):
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            # Fetch RSS feeds based on categories assigned to the client
            query = """
                SELECT DISTINCT rf.url, rf.category_id, cat.name as category_name
                FROM rss_feeds rf
                JOIN client_category_map ccm ON rf.category_id = ccm.category_id
                JOIN categories cat ON rf.category_id = cat.id
                WHERE ccm.client_id = %s
            """
            cursor.execute(query, (client_id,))
            feeds = cursor.fetchall()

            all_items_found = []

            for feed in feeds:
                try:
                    parsed_feed = feedparser.parse(feed['url'])
                    for entry in parsed_feed.entries:
                        feed_item_data = {
                            "title": entry.get("title", "No Title"),
                            "link": entry.get("link", "#"),
                            "summary": entry.get("summary", "No summary available."),
                            "category_id": feed['category_id'],
                            "category_name": feed['category_name']
                        }
                        all_items_found.append(feed_item_data)
                except Exception as e:
                    print(f"Error fetching or parsing feed {feed['url']}: {e}")

            if all_items_found:
                items_by_category = {}
                for item in all_items_found:
                    cat_id = item['category_id']
                    if cat_id not in items_by_category:
                        items_by_category[cat_id] = []
                    items_by_category[cat_id].append(item)

                cursor.execute("SELECT name FROM clients WHERE id = %s", (client_id,))
                client_result = cursor.fetchone()
                client_name = client_result['name'] if client_result else 'Unknown Client'

                for cat_id, items_list in items_by_category.items():
                    category_name = items_list[0]['category_name']

                    findings_block = f"Latest feed contents from {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}:\n\n"
                    for item in items_list:
                        findings_block += f"--- \nTitle: {item['title']}\nSource: {item['link']}\n\n"

                    cursor.execute(
                        """
                        SELECT id FROM advisories
                        WHERE client_id = %s
                        AND service_or_os = %s
                        AND update_type = 'Automated Feed Snapshot'
                        AND status = 'Draft'
                        AND DATE(timestamp) = CURDATE()
                        LIMIT 1
                        """,
                        (client_id, category_name)
                    )
                    existing_draft = cursor.fetchone()

                    if existing_draft:
                        update_query = """
                            UPDATE advisories
                            SET technical_analysis = %s, timestamp = NOW()
                            WHERE id = %s
                        """
                        cursor.execute(update_query, (findings_block, existing_draft['id']))
                    else:
                        description = f"Automated feed snapshot for {category_name}. Contains all current items from assigned feeds."
                        insert_query = """
                            INSERT INTO advisories (client_id, client_name, service_or_os, update_type, description, technical_analysis, status, timestamp)
                            VALUES (%s, %s, %s, %s, %s, %s, 'Draft', NOW())
                        """
                        cursor.execute(insert_query, (client_id, client_name, category_name, "Automated Feed Snapshot", description, findings_block))

                conn.commit()

            return jsonify(all_items_found)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500
        finally:
            if conn and conn.is_connected():
                cursor.close()
                conn.close()





    # In app/routes.py

    @app.route("/api/clients/<int:client_id>/tech", methods=["POST"])
    def assign_client_tech(client_id):
        data = request.get_json()
        tech_stack_id = data.get("tech_stack_id")
        subcategory_id = data.get("subcategory_id")
        category_name = data.get("category_name")
        version = data.get("version", "*")

        if not tech_stack_id and not subcategory_id and not category_name:
            return jsonify({"error": "Missing tech_stack_id, subcategory_id, or category_name"}), 400

        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            if tech_stack_id:
                cursor.execute(
                    "INSERT INTO client_tech_map (client_id, tech_stack_id, version) VALUES (%s, %s, %s)",
                    (client_id, tech_stack_id, version)
                )
            elif subcategory_id:
                cursor.execute(
                    "INSERT INTO client_subcategory_map (client_id, subcategory_id) VALUES (%s, %s)",
                    (client_id, subcategory_id)
                )
            elif category_name:
                cursor.execute(
                    "INSERT INTO client_category_map (client_id, category_id) SELECT %s, id FROM categories WHERE name = %s",
                    (client_id, category_name)
                )

            conn.commit()
            return jsonify({"message": "Assignment successful"}), 201

        except Exception as e:
            conn.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conn.close()


















    @app.route("/api/clients/<int:client_id>/tech", methods=["GET"])
    def get_client_tech_assignments(client_id):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            assignments = []

            # Tech stacks
            cursor.execute("""
                SELECT ctm.id, 'tech_stack' AS type, ts.name AS name
                FROM client_tech_map ctm
                JOIN tech_stacks ts ON ctm.tech_stack_id = ts.id
                WHERE ctm.client_id = %s
            """, (client_id,))
            assignments.extend(cursor.fetchall())

            # Subcategories
            cursor.execute("""
                SELECT csm.id, 'subcategory' AS type, sc.name AS name
                FROM client_subcategory_map csm
                JOIN subcategories sc ON csm.subcategory_id = sc.id
                WHERE csm.client_id = %s
            """, (client_id,))
            assignments.extend(cursor.fetchall())

            # Categories
            cursor.execute("""
                SELECT ccm.id, 'category' AS type, c.name AS name
                FROM client_category_map ccm
                JOIN categories c ON ccm.category_id = c.id
                WHERE ccm.client_id = %s
            """, (client_id,))
            assignments.extend(cursor.fetchall())

            return jsonify(assignments)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conn.close()














    
    @app.route("/api/advisories/bulk", methods=['POST'])
    def create_bulk_advisory():
        data = request.get_json()
        tech_stack_id = data.get("techStackId")
        version_pattern = data.get("version", "").replace('*', '%')
        
        update_type = data.get("updateType")
        description = data.get("description")
        vulnerability_details = data.get("vulnerability_details")
        technical_analysis = data.get("technical_analysis")
        impact_details = data.get("impact_details")
        mitigation_strategies = data.get("mitigation_strategies")
        detection_response = data.get("detection_response")
        recommendations = data.get("recommendations")

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
            insert_query = """
                INSERT INTO advisories (
                    client_id, client_name, service_or_os, update_type, description,
                    vulnerability_details, technical_analysis, impact_details,
                    mitigation_strategies, detection_response, recommendations,
                    status, timestamp
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """
            cursor.execute(insert_query, (
                client['client_id'], client['client_name'], client['tech_stack_name'],
                update_type, description, vulnerability_details, technical_analysis,
                impact_details, mitigation_strategies, detection_response, recommendations, 'Sent'
            ))

        conn.commit()
        conn.close()
        
        return jsonify({"message": f"Advisory has been dispatched and recorded for {len(affected_clients)} clients."}), 201

    @app.route('/api/advisories', methods=['GET'])
    def get_advisories():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                id, client_id, client_name, service_or_os, update_type, description,
                vulnerability_details, technical_analysis, impact_details,
                mitigation_strategies, detection_response, recommendations,
                status, timestamp
            FROM advisories
            ORDER BY timestamp DESC
        """)
        data = cursor.fetchall()
        conn.close()
        return jsonify(data)


    @app.route('/api/advisories/<int:advisory_id>', methods=['PUT'])
    def update_advisory(advisory_id):
        data = request.get_json()
        
        update_fields = [
            'description', 'vulnerability_details', 'technical_analysis',
            'impact_details', 'mitigation_strategies', 'detection_response',
            'recommendations', 'status'
        ]
        
        fields_to_update_sql = []
        params = []
        
        for field in update_fields:
            if field in data:
                fields_to_update_sql.append(f"{field} = %s")
                params.append(data[field])

        if not fields_to_update_sql:
            return jsonify({'error': 'No fields provided for update'}), 400

        params.append(advisory_id)
        query = f"UPDATE advisories SET {', '.join(fields_to_update_sql)}, timestamp = NOW() WHERE id = %s"
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(query, tuple(params))
        conn.commit()
        conn.close()

        return jsonify({'message': 'Advisory updated successfully'}), 200

    @app.route('/api/rss-feeds', methods=['GET', 'POST', 'DELETE'])
    def manage_rss_feeds():
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True if request.method == 'GET' else False)

        if request.method == 'GET':
            category_id = request.args.get('categoryId')
            if not category_id:
                conn.close()
                return jsonify({'error': 'Missing categoryId'}), 400
            cursor.execute("SELECT url FROM rss_feeds WHERE category_id = %s", (category_id,))
            feeds = cursor.fetchall()
            conn.close()
            return jsonify(feeds)

        elif request.method == 'POST':
            data = request.get_json()
            category_id = data.get('category_id')
            url = data.get('url')
            if not category_id or not url:
                conn.close()
                return jsonify({'error': 'Missing category_id or url'}), 400
            try:
                cursor.execute("INSERT INTO rss_feeds (category_id, url) VALUES (%s, %s)", (category_id, url))
                conn.commit()
                return jsonify({'message': 'RSS feed added successfully'})
            except mysql.connector.Error as err:
                if err.errno == 1062:
                    return jsonify({"error": "This RSS feed URL already exists for this category."}), 409
                return jsonify({"error": str(err)}), 500
            finally:
                conn.close()

        elif request.method == 'DELETE':
            data = request.get_json()
            category_id = data.get('category_id')
            urls_to_delete = data.get('urls')

            if not category_id or not urls_to_delete or not isinstance(urls_to_delete, list):
                conn.close()
                return jsonify({'error': 'A category_id and a list of urls are required.'}), 400
            
            try:
                placeholders = ', '.join(['%s'] * len(urls_to_delete))
                query = f"DELETE FROM rss_feeds WHERE category_id = %s AND url IN ({placeholders})"
                params = (category_id,) + tuple(urls_to_delete)
                
                cursor.execute(query, params)
                conn.commit()
                
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








    @app.route('/api/client-subcategory/<int:map_id>', methods=['DELETE'])
    def delete_client_subcategory(map_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM client_subcategory_map WHERE id = %s", (map_id,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "No subcategory assignment found with that ID."}), 404
            return jsonify({"message": "Subcategory assignment deleted successfully"}), 200
        except Exception as e:
            conn.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conn.close()









    @app.route('/api/client-category/<int:map_id>', methods=['DELETE'])
    def delete_client_category(map_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM client_category_map WHERE id = %s", (map_id,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "No category assignment found with that ID."}), 404
            return jsonify({"message": "Category assignment deleted successfully"}), 200
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

            query = """
                SELECT 
                    id, client_id, client_name, service_or_os, update_type, description,
                    vulnerability_details, technical_analysis, impact_details,
                    mitigation_strategies, detection_response, recommendations,
                    status, timestamp
                FROM advisories
                WHERE client_id = %s
                ORDER BY timestamp DESC
            """
            cursor.execute(query, (client_id,))
            advisories = cursor.fetchall()

            cursor.close()
            conn.close()

            return jsonify(advisories), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

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




    @app.route("/api/clients/<int:client_id>/subcategories", methods=["POST"])
    def assign_subcategory_to_client(client_id):
        data = request.get_json()
        subcategory_id = data.get("subcategory_id")
        if not subcategory_id:
            return jsonify({"error": "subcategory_id is required"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO client_subcategory_map (client_id, subcategory_id) VALUES (%s, %s)",
                (client_id, subcategory_id)
            )
            conn.commit()
            return jsonify({"message": "Subcategory assigned successfully"}), 201
        except Exception as e:
            conn.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conn.close()





    # In app/routes.py

# Add this new route anywhere inside the setup_routes(app) function

    # @app.route('/api/tech-hierarchy', methods=['GET'])
    # def get_tech_hierarchy():
    #     """
    #     Fetches the structured list of categories and their sub-categories.
    #     """
    #     conn = None
    #     try:
    #         conn = get_db_connection()
    #         cursor = conn.cursor(dictionary=True)

    #         # Fetch all categories that are parents (not sub-categories themselves)
    #         cursor.execute("SELECT id, name FROM categories")
    #         categories = cursor.fetchall()
            
    #         # Fetch all sub-categories and group them by their parent category_id
    #         cursor.execute("SELECT category_id, name FROM subcategories ORDER BY name")
    #         subcategories = cursor.fetchall()

    #         # Create a dictionary to easily look up sub-categories
    #         sub_map = {}
    #         for sub in subcategories:
    #             parent_id = sub['category_id']
    #             if parent_id not in sub_map:
    #                 sub_map[parent_id] = []
    #             sub_map[parent_id].append(sub['name'])

    #         # Build the final hierarchy structure
    #         hierarchy = []
    #         for cat in categories:
    #             hierarchy.append({
    #                 "name": cat['name'],
    #                 "subcategories": sub_map.get(cat['id'], []) # Get sub-categories or an empty list
    #             })

    #         return jsonify(hierarchy)
            
    #     except Exception as e:
    #         return jsonify({"error": str(e)}), 500
    #     finally:
    #         if conn and conn.is_connected():
    #             cursor.close()
    #             conn.close()
