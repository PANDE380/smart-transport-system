import os


class Config:
    SECRET_KEY = os.environ.get(
        'SECRET_KEY') or 'super-secret-key-for-smart-taxi'

    # Use SQLite for MVP
    basedir = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, '..',
                                    'database', 'smart_taxi_db.sqlite')

    SQLALCHEMY_TRACK_MODIFICATIONS = False
