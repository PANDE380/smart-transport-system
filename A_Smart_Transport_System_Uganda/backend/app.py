import os
import socket
from datetime import datetime, timezone
from flask import Flask, send_from_directory, make_response, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from werkzeug.exceptions import NotFound, HTTPException, InternalServerError
from sqlalchemy import inspect, text
from dotenv import load_dotenv

try:
    from .database import db, bcrypt
    from .routes.user_routes import user_bp
    from .routes.vehicle_routes import vehicle_bp
    from .routes.trip_routes import trip_bp
    from .routes.payment_routes import payment_bp
    from .routes.admin_routes import admin_bp
    from .routes.ussd_routes import ussd_bp
    from .routes.chatbot_routes import chatbot_bp
    from .routes.services_routes import services_bp
except ImportError:
    from database import db, bcrypt
    from routes.user_routes import user_bp
    from routes.vehicle_routes import vehicle_bp
    from routes.trip_routes import trip_bp
    from routes.payment_routes import payment_bp
    from routes.admin_routes import admin_bp
    from routes.ussd_routes import ussd_bp
    from routes.chatbot_routes import chatbot_bp
    from routes.services_routes import services_bp


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))
load_dotenv(os.path.join(os.path.dirname(BASE_DIR), '.env'))


def create_app():
    frontend_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), '..', 'frontend')
    )
    views_dir = os.path.join(frontend_dir, 'views')
    profile_upload_dir = os.path.join(frontend_dir, 'uploads', 'profile-photos')

    app = Flask(__name__, static_folder=frontend_dir)
    CORS(app)

    @app.after_request
    def add_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        return response

    # Database config
    instance_dir = os.path.abspath(
        os.path.join(os.path.dirname(BASE_DIR), 'instance')
    )
    os.makedirs(instance_dir, exist_ok=True)

    default_db_path = os.path.join(instance_dir, 'smart_taxi.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
        'DATABASE_URL',
        f'sqlite:///{default_db_path}'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024
    app.config['PROFILE_PHOTO_UPLOAD_DIR'] = profile_upload_dir

    os.makedirs(profile_upload_dir, exist_ok=True)

    db.init_app(app)
    bcrypt.init_app(app)

    # Enable WAL mode for SQLite to support multi-threading/concurrency
    with app.app_context():
        @db.event.listens_for(db.engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            if "sqlite" in app.config['SQLALCHEMY_DATABASE_URI']:
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA synchronous=NORMAL")
                cursor.close()

    #   MIGRATIONS FUNCTION
    def run_startup_migrations():
        inspector = inspect(db.engine)

        if 'trips' not in inspector.get_table_names():
            return

        trip_columns = {column['name'] for column in inspector.get_columns('trips')}

        with db.engine.begin() as connection:
            if 'scheduled_at' not in trip_columns:
                connection.execute(
                    text('ALTER TABLE trips ADD COLUMN scheduled_at DATETIME')
                )

            if 'sos_evidence_url' not in trip_columns:
                connection.execute(
                    text('ALTER TABLE trips ADD COLUMN sos_evidence_url TEXT')
                )

            if 'sos_description' not in trip_columns:
                connection.execute(
                    text('ALTER TABLE trips ADD COLUMN sos_description TEXT')
                )

        if 'users' in inspector.get_table_names():
            user_columns = {column['name'] for column in inspector.get_columns('users')}
            with db.engine.begin() as connection:
                if 'preferred_language' not in user_columns:
                    connection.execute(
                        text("ALTER TABLE users ADD COLUMN preferred_language VARCHAR(10) DEFAULT 'en' NOT NULL")
                    )

                if 'created_at' not in user_columns:
                    connection.execute(
                        text("ALTER TABLE users ADD COLUMN created_at DATETIME")
                    )

                # Always attempt to backfill NULL created_at values to fix legacy data
                now = datetime.now(timezone.utc).isoformat()
                connection.execute(
                    text(f"UPDATE users SET created_at = '{now}' WHERE created_at IS NULL")
                )

    # Register Blueprints
    app.register_blueprint(user_bp, url_prefix='/api/users')
    app.register_blueprint(vehicle_bp, url_prefix='/api/vehicles')
    app.register_blueprint(trip_bp, url_prefix='/api/trips')
    app.register_blueprint(payment_bp, url_prefix='/api/payments')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(ussd_bp, url_prefix='/api/ussd')
    app.register_blueprint(chatbot_bp, url_prefix='/api/chat')
    app.register_blueprint(services_bp, url_prefix='/api/services')

    # Initialize DB
    with app.app_context():
        try:
            from . import models
            from .utils.seeder import seed_db
        except ImportError:
            import models
            from utils.seeder import seed_db

        db.create_all()
        run_startup_migrations()
        seed_db()

        active_profile_paths = {
            profile_image.storage_path
            for profile_image in models.ProfileImage.query.all()
        }

        for entry in os.listdir(profile_upload_dir):
            storage_path = os.path.join(
                'uploads', 'profile-photos', entry
            )
            file_path = os.path.join(profile_upload_dir, entry)

            if (os.path.isfile(file_path) and
                    storage_path not in active_profile_paths):
                try:
                    os.remove(file_path)
                except PermissionError:
                    pass

    @app.route('/api/health')
    def health_check():
        return {'status': 'healthy', 'message': 'STS Uganda API is running'}

    def get_local_ip():
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            # doesn't even have to be reachable
            s.connect(('10.255.255.255', 1))
            IP = s.getsockname()[0]
        except Exception:
            IP = '127.0.0.1'
        finally:
            s.close()
        return IP

    @app.route('/api/system-info')
    def system_info():
        return {
            'local_ip': get_local_ip(),
            'port': int(os.getenv('PORT', 5001)),
            'server_time': datetime.now(timezone.utc).isoformat()
        }

    @app.errorhandler(Exception)
    def handle_global_exception(e):
        if isinstance(e, HTTPException):
            return jsonify({
                'status': 'error',
                'error': e.name,
                'message': e.description,
                'code': e.code
            }), e.code

        app.logger.error(f'Unhandled Exception: {str(e)}', exc_info=True)
        return jsonify({
            'status': 'error',
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred on the server.',
            'code': 500
        }), 500

    @app.route('/', defaults={'path': 'views/index.html'})
    @app.route('/<path:path>')
    def serve_frontend(path):
        try:
            return send_from_directory(frontend_dir, path)
        except NotFound:
            return send_from_directory(views_dir, path)

    return app


if __name__ == '__main__':
    app = create_app()
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5001))
    
    print(f"\n STS Uganda Backend is starting...")
    print(f" API Endpoint: http://{host}:{port}/api")
    print(f" Health Check: http://{host}:{port}/api/health")
    print(f" To connect from Android Emulator, use: http://10.0.2.2:{port}/api\n")
    
    # Explicitly enable threading for real-time SSE stream support
    app.run(host=host, port=port, threaded=True)
