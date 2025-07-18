import os
import io
from flask import request, Flask, jsonify, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from app.auth import authenticate_user
from app.db import get_db_connection
from datetime import datetime, timedelta
import bcrypt
import mysql.connector
import pandas as pd
from app.token_utils import generate_token
from app.token_utils import validate_token as verify_token
from datetime import datetime

def setup_routes(app):
    @app.route("/")
    def home():
        return jsonify({"message": "API is running!"})
    



UPLOAD_FOLDER = os.path.join('knowledgebase1')
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'csv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def setup_routes(app):
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)






    
    
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
        # Dynamically fetch column names from the table
            cursor.execute("SHOW COLUMNS FROM knowledge_base")
            columns = [row['Field'] for row in cursor.fetchall()]

            if not query:
                cursor.execute(f"SELECT {', '.join(columns)} FROM knowledge_base")
                results = cursor.fetchall()
                return jsonify(results)

            words = query.split()
            conditions = []
            params = []

            for word in words:
                word_conditions = []
                for col in columns:
                    word_conditions.append(f"CAST({col} AS CHAR) LIKE %s")
                    params.append(f"%{word}%")
                conditions.append("(" + " OR ".join(word_conditions) + ")")

            where_clause = " AND ".join(conditions)
            sql = f"SELECT {', '.join(columns)} FROM knowledge_base WHERE {where_clause}"
            cursor.execute(sql, params)
            results = cursor.fetchall()
            return jsonify(results)

        finally:
            cursor.close()
            conn.close()




    
    @app.route('/api/upload_solution/<int:entry_id>', methods=['POST'])
    def upload_solution_file(entry_id):
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in the request'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            saved_filename = f"{entry_id}_{filename}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_filename)
            file.save(file_path)

            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                update_query = """
                    UPDATE knowledge_base
                    SET SolutionFileName = %s
                    WHERE ID = %s
                """
                cursor.execute(update_query, (saved_filename, entry_id))
                conn.commit()
                return jsonify({'message': f'File {filename} uploaded successfully for entry ID {entry_id}'}), 200
            except Exception as err:
                return jsonify({'error': str(err)}), 500
            finally:
                cursor.close()
                conn.close()
        else:
            return jsonify({'error': 'Unsupported file type'}), 400

    
    @app.route('/files/<path:filename>', methods=['GET'])
    def view_solution_file(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)










    
    
    @app.route('/api/kb_table-add', methods=['POST'])
    def add_kb_entry():
        try:
            data = request.get_json()

            required_fields = [
                'ID', 'Title', 'Entity', 'Status', 'Priority', 'Category',
                'Opening_Date', 'Resolution_Date', 'Last_Updated', 'Last_Edit_By',
                'Assigned_To_Technician', 'Followups_Description', 'Description', 'Solution'
            ]

        # Check for missing fields
            if not all(field in data and data[field] for field in required_fields):
                return jsonify({"message": "All fields are required."}), 400

            conn = get_db_connection()
            cursor = conn.cursor()

            insert_query = """
                INSERT INTO knowledge_base (
                    ID, Title, Entity, Status, Priority, Category,
                    Opening_Date, Resolution_Date, Last_Updated, Last_Edit_By,
                    Assigned_To_Technician, Followups_Description, Description, Solution
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                'ID', 'Title', 'Entity', 'Status', 'Priority', 'Category',
                'Opening_Date', 'Resolution_Date', 'Last_Updated', 'Last_Edit_By',
                'Assigned_To_Technician', 'Followups_Description', 'Description', 'Solution'
            ]

            if not all(col in df.columns for col in required_columns):
                return jsonify({
                    "message": f"Missing required columns. Expected: {', '.join(required_columns)}"
                }), 400

            conn = get_db_connection()
            cursor = conn.cursor()

            insert_query = """
                INSERT INTO knowledge_base (
                    ID, Title, Entity, Status, Priority, Category,
                    Opening_Date, Resolution_Date, Last_Updated, Last_Edit_By,
                    Assigned_To_Technician, Followups_Description, Description, Solution
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            for index, row in df.iterrows():
                try:
                    values = (
                        row['ID'],
                        row['Title'],
                        row['Entity'],
                        row['Status'],
                        row['Priority'],
                        row['Category'],
                        row['Opening_Date'],
                        row['Resolution_Date'],
                        row['Last_Updated'],
                        row['Last_Edit_By'],
                        row['Assigned_To_Technician'],
                        row['Followups_Description'],
                        row['Description'],
                        row['Solution']
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
        cursor = conn.cursor()

        if request.method == "GET":
            client_id = request.args.get("client")
            cursor.execute("SELECT * FROM escalation_matrix WHERE client_id = %s", (client_id,))
            escalation = cursor.fetchall()
            conn.close()
            return jsonify(escalation)

        if request.method == "POST":
            data = request.get_json()
            client_id = data.get("client_id")
            level = data.get("level")
            engineer_name = data.get("contact_name")
            email = data.get("contact_email")
            phone = data.get("contact_number")
            sla_response = data.get("sla_response_hours")
            sla_resolution = data.get("sla_resolution_hours")

            cursor.execute(
                """
                INSERT INTO escalation_matrix 
                (client_id, level, contact_name, contact_email, contact_number, sla_response_hours, sla_resolution_hours)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (client_id, level, engineer_name, email, phone, sla_response, sla_resolution)
            )
            conn.commit()
            conn.close()
            return jsonify({"message": "Escalation matrix entry added successfully"}), 201
        
    



