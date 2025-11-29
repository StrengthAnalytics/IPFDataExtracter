"""Configuration for data ingestion scripts."""
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Configuration settings for data scripts."""

    # OpenPowerlifting data source
    OPL_CSV_URL = 'https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip'

    # Data filtering
    DATA_START_DATE = datetime(2022, 1, 1)

    # IPF-affiliated federations
    IPF_FEDERATIONS = [
        'IPF',
        'USAPL',
        'CPU',
        'EPF',
        'BP',
        'APF',
        'USPA',
        'IrishPF',
        'ScottishPL',
        'WelshPA',
        'EnglishPF',
        'NIPF',
        'GPC',
        'IPL',
        'WPC',
        'AusPL',
        'PA',
        'NZPF',
        'AsianPF',
        'CommonwealthPF',
        'NordicPF',
        'OceaniaPF',
        'PolishPF',
        'RussianPF',
        'SlovakPF',
        'BulgarianPF',
        'SouthAfricanPL',
        'JapanPF',
        'KNKFSP',
        'UkrainePF',
        'BelarusPF'
    ]

    # Supabase
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')
