from flask import Flask
from flask_cors import CORS
from app.routes import setup_routes
from app.db import init_db

def create_app():
    app = Flask(__name__)
    CORS(app)
    init_db()
    setup_routes(app)
    return app
