from flask import Flask
from flask_cors import CORS
from app.routes import setup_routes
from app.db import init_db

app = Flask(__name__)  
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"], "allow_headers": "*"}})  

# Database Initialization
init_db()

# Setup API routes
setup_routes(app)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)
