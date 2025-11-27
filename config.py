"""Application configuration."""
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Base configuration."""

    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'

    # Supabase
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')

    # API Rate Limiting
    RATELIMIT_STORAGE_URL = "memory://"
    RATELIMIT_DEFAULT = os.getenv('API_RATE_LIMIT', '100 per hour')

    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(',')

    # Data filtering
    DATA_START_YEAR = int(os.getenv('DATA_START_YEAR', '2022'))
    DATA_START_DATE = datetime(DATA_START_YEAR, 1, 1)

    # IPF Federations to include
    IPF_FEDERATIONS = os.getenv('IPF_FEDERATIONS', 'IPF,EPF,CPU,USAPL,BP').split(',')

    # OpenPowerlifting data URL
    OPL_CSV_URL = 'https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip'

    # Pagination
    DEFAULT_PAGE_SIZE = 50
    MAX_PAGE_SIZE = 200


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    RATELIMIT_DEFAULT = '1000 per hour'


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    DEBUG = True


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
