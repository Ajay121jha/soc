
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
    








    def get_ancestors_from_db(tech_ids, cursor):
        """
        Helper function to find all parent IDs for a given list of tech_ids
        using a recursive SQL query.
        """
        if not tech_ids:
            return []

        # A format string for the IN clause, e.g., (%s, %s, %s)
        id_placeholders = ','.join(['%s'] * len(tech_ids))

        # This recursive query travels "up" the parent_id chain
        query = f"""
            WITH RECURSIVE tech_hierarchy AS (
                -- Base case: select the starting technologies
                SELECT id, parent_id
                FROM tech_stacks
                WHERE id IN ({id_placeholders})

                UNION ALL

                -- Recursive step: join with the parent
                SELECT ts.id, ts.parent_id
                FROM tech_stacks ts
                INNER JOIN tech_hierarchy th ON ts.id = th.parent_id
            )
            SELECT id FROM tech_hierarchy;
        """
        cursor.execute(query, tuple(tech_ids))
        return [row['id'] for row in cursor.fetchall()]














    
    
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
        subcategory_id = data.get("subcategory_id")
        name = data.get("name")
        

        if not name or not subcategory_id:
            return jsonify({"error": "Name and subcategory_id are required"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO tech_stacks (subcategory_id, name) VALUES (%s, %s)", (subcategory_id, name ))
            conn.commit()
            new_id = cursor.lastrowid
            return jsonify({"id": new_id, "name": name}), 201
            # return jsonify({"message": "Tech stack added successfully"}), 201
        except Exception as e:
            conn.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conn.close()


    @app.route("/api/subcategories", methods=["POST"])
    def add_subcategroy():
        data = request.get_json()
        category_id = data.get("category_id")
        name =data.get("name")

        if not name or not category_id:
            return jsonify({"error": "Name and category_id are required"}),400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO subcategories (name, category_id) VALUES (%s, %s)", (name, category_id))
            conn.commit()
            new_id = cursor.lastrowid
            return jsonify({"id": new_id, "name":name}),201
            # return jsonify({"message": "Subcategory added sucessfully"}),201
        except Exception as e:
            conn.rollback()
            return jsonify({"error": str(e)}),500
        finally:
            cursor.close()
            conn.close()





    
    @app.route("/api/clients/<int:client_id>/tech", methods=["POST"])
    def assign_tech_to_client(client_id):
        data = request.get_json()
        tech_stack_id = data.get("tech_stack_id")
        subcategory_id = data.get("subcategory_id")
        category_id = data.get("category_id")
        version = data.get("version", "*")

        if not any([tech_stack_id, subcategory_id, category_id]):
            return jsonify({"error": "Missing assignment data"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            if tech_stack_id:
                cursor.execute("""
                    INSERT INTO client_tech_map (client_id, tech_stack_id, version)
                    VALUES (%s, %s, %s)
                """, (client_id, tech_stack_id, version))

            elif subcategory_id:
                cursor.execute("""
                    INSERT INTO client_subcategory_map (client_id, subcategory_id)
                    VALUES (%s, %s)
                """, (client_id, subcategory_id))

            elif category_id:
                cursor.execute("""
                    INSERT INTO client_category_map (client_id, category_id)
                    VALUES (%s, %s)
                """, (client_id, category_id))

            conn.commit()
            return jsonify({"message": "Assignment successful"}), 201

        except Exception as e:
            conn.rollback()
            return jsonify({"error": str(e)}), 500

        finally:
            cursor.close()
            conn.close()









    # @app.route("/api/hierarchy", methods=["POST"])
    # def create_hierarchy():
    #     data = request.get_json()
    #     category_name = data.get("category")
    #     subcategory_name = data.get("subcategory")
    #     tech_stack_name = data.get("tech_stack")

    #     if not category_name:
    #         return jsonify({"error": "Category name is required"}), 400

    #     conn = get_db_connection()
    #     cursor = conn.cursor(dictionary=True)

    #     try:
    #         # Insert or get category
    #         cursor.execute("SELECT id FROM categories WHERE name = %s", (category_name,))
    #         category = cursor.fetchone()
    #         if not category:
    #             cursor.execute("INSERT INTO categories (name) VALUES (%s)", (category_name,))
    #             conn.commit()
    #             category_id = cursor.lastrowid
    #         else:
    #             category_id = category["id"]

    #         # Insert or get subcategory
    #         subcategory_id = None
    #         if subcategory_name:
    #             cursor.execute("SELECT id FROM subcategories WHERE name = %s AND category_id = %s", (subcategory_name, category_id))
    #             subcategory = cursor.fetchone()
    #             if not subcategory:
    #                 cursor.execute("INSERT INTO subcategories (category_id, name) VALUES (%s, %s)", (category_id, subcategory_name))
    #                 conn.commit()
    #                 subcategory_id = cursor.lastrowid
    #             else:
    #                 subcategory_id = subcategory["id"]

    #         # Insert tech stack
    #         if tech_stack_name and subcategory_id:
    #             cursor.execute("SELECT id FROM tech_stacks WHERE name = %s AND subcategory_id = %s", (tech_stack_name, subcategory_id))
    #             tech = cursor.fetchone()
    #             if not tech:
    #                 cursor.execute("INSERT INTO tech_stacks (subcategory_id, name) VALUES (%s, %s)", (subcategory_id, tech_stack_name))
    #                 conn.commit()

    #         return jsonify({"message": "Hierarchy created successfully"}), 201

    #     except Exception as e:
    #         conn.rollback()
    #         return jsonify({"error": str(e)}), 500
    #     finally:
    #         cursor.close()
    #         conn.close()







    
    # from flask_cors import CORS
    # CORS(app)

    @app.route('/api/clients/<int:client_id>/escalation-contacts', methods=['POST'])
    def add_escalation_contact(client_id):
        data = request.get_json()
        email = data.get('email')
        level = data.get('level')
        contact_name = data.get('contact_name')
        designation = data.get('designation')
        priority = data.get('priority')

        if not email or not level or not contact_name or not designation or not priority:
            return jsonify({"error": "Missing required fields"}), 400

        # Get client_tech_map_id (assuming one exists for this client)
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id FROM client_tech_map WHERE client_id = %s LIMIT 1
        """, (client_id,))
        result = cursor.fetchone()

        if not result:
            return jsonify({"error": "No tech mapping found for this client"}), 404

        client_tech_map_id = result[0]

        cursor.execute("""
            INSERT INTO client_employee_contacts (client_tech_map_id, email, contact_name, level, priority, designation)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (client_tech_map_id, email, contact_name, level, priority, designation))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Contact added successfully"}), 200






    @app.route("/api/clients/<int:client_id>/escalation-contacts", methods=["GET"])
    def get_escalation_contacts_for_client(client_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            query = """
                SELECT level, priority, email, contact_name, designation
                FROM client_employee_contacts
                WHERE client_tech_map_id IN (
                    SELECT id FROM client_tech_map WHERE client_id = %s
                )
            """
            cursor.execute(query, (client_id,))
            contacts = cursor.fetchall()

            return jsonify(contacts), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500

        finally:
            if conn and conn.is_connected():
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
    

    @app.route('/api/client-tech/<int:map_id>', methods=['DELETE'])
    def delete_client_tech_stack(map_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM client_tech_map WHERE id = %s", (map_id,))
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









    @app.route('/api/rss-feeds', methods=['GET'])
    def get_rss_feeds_by_category():
        category_id = request.args.get('categoryId')
        if not category_id:
            return jsonify({'error': 'Missing categoryId'}), 400

        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            query = "SELECT id, url FROM rss_feeds WHERE category_id = %s"
            cursor.execute(query, (category_id,))

            feeds = cursor.fetchall()
            result = [{'id': row[0], 'url': row[1]} for row in feeds]
            return jsonify(result)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        finally:
            cursor.close()
            conn.close()





    @app.route('/api/rss-feeds', methods=['POST'])
    def add_rss_feed():
        data = request.get_json()
        category_id = data.get('category_id')
        url = data.get('url')

        if not category_id or not url:
            return jsonify({'error': 'Missing category_id or url'}), 400

        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            query = "INSERT INTO rss_feeds (category_id, url) VALUES (%s, %s)"
            cursor.execute(query, (category_id, url))
            conn.commit()
            return jsonify({'message': 'RSS feed added successfully!'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        finally:
            cursor.close()
            conn.close()




    

    @app.route('/api/rss-feeds', methods=['DELETE'])
    def delete_multiple_rss_feeds():
        try:
            data = request.get_json()
            urls = data.get('urls', [])
            if not urls:
                return jsonify({"error": "No feeds provided"}), 400

            conn = get_db_connection()
            cursor = conn.cursor()

            # Create placeholders for each URL
            placeholders = ', '.join(['%s'] * len(urls))
            query = f"DELETE FROM rss_feeds WHERE url IN ({placeholders})"
            cursor.execute(query, urls)

            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "No feeds deleted"}), 400
            return jsonify({"message": f"{cursor.rowcount} feed(s) deleted successfully"}), 200
        except Exception as e:
            conn.rollback()
            return jsonify({'error': str(e)}), 500
        finally:
            cursor.close()
            conn.close()   












    

    @app.route("/api/clients/<int:client_id>/feed-items", methods=["GET"])
    def get_client_feed_items(client_id):
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            # Step 1: Get all relevant category IDs
            category_query = """
            SELECT DISTINCT c.id AS category_id, c.name AS category_name
            FROM categories c
            WHERE c.id IN (
                SELECT category_id FROM client_category_map WHERE client_id = %s
                UNION
                SELECT sc.category_id
                FROM client_subcategory_map csm
                JOIN subcategories sc ON csm.subcategory_id = sc.id
                WHERE csm.client_id = %s
                UNION
                SELECT sc.category_id
                FROM client_tech_map ctm
                JOIN tech_stacks ts ON ctm.tech_stack_id = ts.id
                JOIN subcategories sc ON ts.subcategory_id = sc.id
                WHERE ctm.client_id = %s
            )
            """
            cursor.execute(category_query, (client_id, client_id, client_id))
            categories = cursor.fetchall()

            if not categories:
                return jsonify([])

            category_ids = [cat["category_id"] for cat in categories]
            placeholders = ','.join(['%s'] * len(category_ids))

            # Step 2: Fetch RSS feeds for those categories
            feed_query = f"""
            SELECT DISTINCT rf.url, rf.category_id, cat.name as category_name
            FROM rss_feeds rf
            JOIN categories cat ON rf.category_id = cat.id
            WHERE rf.category_id IN ({placeholders})
            """
            cursor.execute(feed_query, category_ids)
            feeds = cursor.fetchall()

            # Step 3: Parse feeds
            all_items_found = []
            headers = {'User-Agent': 'Mozilla/5.0'}

            for feed in feeds:
                try:
                    response = requests.get(feed['url'], headers=headers, timeout=10, verify=False)
                    parsed_feed = feedparser.parse(response.content)
                    print(f"Parsing feed: {feed['url']} — Entries found: {len(parsed_feed.entries)}")
                    # this is use for the debugging of the rss feed
                    # print(response.content.decode('utf-8'))

                    for entry in parsed_feed.entries:
                        all_items_found.append({
                            "title": entry.get("title", "No Title"),
                            "link": entry.get("link", "#"),
                            "summary": entry.get("summary", "No summary available."),
                            "category_id": feed["category_id"],
                            "category_name": feed["category_name"]
                        })
                except Exception as e:
                    print(f"Error parsing feed {feed['url']}: {e}")
                    # print(response.content.decode('utf-8'))


            return jsonify(all_items_found)

        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            if conn and conn.is_connected():
                cursor.close()
                conn.close()




    @app.route("/api/advisories/bulk", methods=["POST"])
    def create_bulk_advisory():
        data = request.get_json()

        if not any(data.get(key) for key in ["techStackId", "subcategoryId", "categoryId"]) or not data.get("updateType") or not data.get("description"):
         jsonify({"error": "Missing required advisory fields"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # Get client_id and client_name from categories
            client_info = None

            if data.get("techStackId"):
                cursor.execute("""
                    SELECT ctm.client_id, c.name
                    FROM client_tech_map ctm
                    JOIN clients c ON ctm.client_id = c.id
                    WHERE ctm.tech_stack_id = %s
                    LIMIT 1
                """, (data["techStackId"],))
                client_info = cursor.fetchone()

            elif data.get("subcategoryId"):
                cursor.execute("""
                    SELECT csm.client_id, c.name
                    FROM client_subcategory_map csm
                    JOIN clients c ON csm.client_id = c.id
                    WHERE csm.subcategory_id = %s
                    LIMIT 1
                """, (data["subcategoryId"],))
                client_info = cursor.fetchone()

            elif data.get("categoryId"):
                cursor.execute("""
                    SELECT ccm.client_id, c.name
                    FROM client_category_map ccm
                    JOIN clients c ON ccm.client_id = c.id
                    WHERE ccm.category_id = %s
                    LIMIT 1
                """, (data["categoryId"],))
                client_info = cursor.fetchone()
                

            if not client_info:
                return jsonify({"error": "Client not found for the given tech stack"}), 404

            client_id, client_name = client_info

            cursor.execute("""
                INSERT INTO advisories (
                    client_id, client_name, service_or_os, update_type, description,
                    advisory_content, timestamp, status,
                    vulnerability_details, technical_analysis, impact_details,
                    mitigation_strategies, detection_response, recommendations
                ) VALUES (%s, %s, %s, %s, %s, %s, NOW(), %s, %s, %s, %s, %s, %s, %s)
            """, (
                client_id,
                client_name,
                data.get("service_or_os", "Unknown"),
                data["updateType"],
                data["description"],
                data.get("description", ""),  # advisory_content can be same as description
                data.get("status", "Draft"),
                data.get("vulnerability_details", ""),
                data.get("technical_analysis", ""),
                data.get("impact_details", ""),
                data.get("mitigation_strategies", ""),
                data.get("detection_response", ""),
                data.get("recommendations", "")
            ))

            conn.commit()
            return jsonify({"message": "Advisory created successfully"}), 201

        except Exception as e:
            conn.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conn.close()




   

            
    @app.route("/api/clients/<int:client_id>/advisories", methods=["GET"])
    def get_client_advisories(client_id):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("""
                SELECT id, update_type, description, status, timestamp, service_or_os
                FROM advisories
                WHERE client_id = %s
                ORDER BY timestamp DESC
            """, (client_id,))
            advisories = cursor.fetchall()
            return jsonify(advisories)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conn.close()





    @app.route("/api/generate-advisory-from-url", methods=["POST"])
    def generate_advisory_from_url():
        data = request.get_json()
        title = data.get("title", "")
        summary = data.get("summary", "")
        client_techs = data.get("client_techs", [])  # 👈 Receive techs here

        # TODO: Use NLP to match summary/title with client_techs

        return jsonify({
            "summary": summary,
            "update_type": "Vulnerability Alert",
            "vulnerability_details": "",
            "technical_analysis": "",
            "impact_assessment": "",
            "mitigation_strategies": "",
            "detection_and_response": "",
            "recommendations": ""
        })


    

