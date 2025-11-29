# Data Pipeline

Python scripts for populating the Supabase database with OpenPowerlifting data.

**⚠️ This directory is NOT deployed to Vercel** - it's only used locally to ingest data.

## Setup

```bash
# From project root
cd data-pipeline

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure Supabase
cp .env.example .env
# Edit .env and add your Supabase credentials:
# SUPABASE_URL=your_project_url
# SUPABASE_KEY=your_anon_key
```

## Usage

### 1. Download and Filter Data

```bash
python download_and_filter_data.py
```

This will:
- Download the latest OpenPowerlifting CSV (~600MB)
- Filter for IPF-affiliated federations
- Keep only data from 2022 onwards
- Save to `../data/openpowerlifting-ipf-filtered.csv`

Expected output:
- Total records: ~1,400,000
- After filtering: ~150,000

### 2. Ingest to Supabase

```bash
python ingest_to_supabase.py
```

This will:
- Upload filtered data to your Supabase database
- Populate `lifter_records` and `lifter_summary` tables
- Takes 15-20 minutes

## Files

- `download_and_filter_data.py` - Download and filter OpenPowerlifting data
- `ingest_to_supabase.py` - Upload data to Supabase
- `config.py` - Configuration (data sources, federations, etc.)
- `requirements.txt` - Python dependencies
- `app/models/database.py` - Supabase client wrapper

## Updating Data

Run monthly or as needed to refresh data:

```bash
cd data-pipeline
source venv/bin/activate
python download_and_filter_data.py
python ingest_to_supabase.py
```

The deployed frontend will automatically use the updated data from Supabase.

## Why is this separate?

Vercel (where the frontend is deployed) doesn't need these Python scripts. They only run locally to populate Supabase. Keeping them in `data-pipeline/` ensures Vercel treats the project as a static frontend.
