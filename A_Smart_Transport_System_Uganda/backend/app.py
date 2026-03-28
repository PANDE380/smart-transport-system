import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import NotFound

try:
    from .database import db
    from .routes.user_routes import user_bp
    from .routes.vehicle_routes import vehicle_bp
    from .routes.trip_routes import trip_bp
    from .routes.payment_routes import payment_bp
    from .routes.admin_routes import admin_bp
    from .routes.ussd_routes import ussd_bp
    from .routes.chatbot_routes import chatbot_bp
except ImportError:
    from database import db
    from routes.user_routes import user_bp
    from routes.vehicle_routes import vehicle_bp
    from routes.trip_routes import trip_bp
    from routes.payment_routes import payment_bp
    from routes.admin_routes import admin_bp
    from routes.ussd_routes import ussd_bp
    from routes.chatbot_routes import chatbot_bp


def create_app():
    # Serve frontend files from the sibling 'frontend' directory
    frontend_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), '..', 'frontend')
    )
    views_dir = os.path.join(frontend_dir, 'views')
    profile_upload_dir = os.path.join(frontend_dir, 'uploads', 'profile-photos')
    app = Flask(__name__, static_folder=frontend_dir)
    CORS(app)

    # Configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///smart_taxi.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024
    app.config['PROFILE_PHOTO_UPLOAD_DIR'] = profile_upload_dir

    os.makedirs(profile_upload_dir, exist_ok=True)

    db.init_app(app)

    # Register Blueprints
    app.register_blueprint(user_bp, url_prefix='/api/users')
    app.register_blueprint(vehicle_bp, url_prefix='/api/vehicles')
    app.register_blueprint(trip_bp, url_prefix='/api/trips')
    app.register_blueprint(payment_bp, url_prefix='/api/payments')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(ussd_bp, url_prefix='/api/ussd')
    app.register_blueprint(chatbot_bp, url_prefix='/api/chat')

    # Automatically import all models and seed database
    with app.app_context():
        try:
            from . import models
            from .utils.seeder import seed_db
        except ImportError:
            import models
            from utils.seeder import seed_db

        db.create_all()
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
        return {'status': 'healthy', 'message': 'ASTS Uganda API is running'}

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
    app.run(port=5001)
