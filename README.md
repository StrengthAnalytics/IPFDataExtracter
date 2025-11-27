# IPF Data Extracter

A Flask-based REST API service for powerlifting scouting and analysis, designed to integrate with [PlatformPro](https://github.com/StrengthAnalytics/PlatformPro).

**🚀 Optimized for Vercel Serverless Deployment** - Deploy for free in minutes! See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md)

## Features

- 🔍 **Lifter Search**: Fuzzy search with autocomplete for finding powerlifters
- 📊 **Percentile Rankings**: Calculate strength percentiles by weight class, sex, and equipment
- 🏋️ **Scouting Reports**: Compare multiple lifters side-by-side
- 📈 **Competition History**: Track lifter performance over time
- 🎯 **Strength Standards**: Get benchmarks for different skill levels

## Tech Stack

- **Backend**: Python 3.11+ with Flask
- **Deployment**: Vercel Serverless (recommended) or traditional server
- **Database**: Supabase (PostgreSQL)
- **Data Source**: [OpenPowerlifting](https://openpowerlifting.gitlab.io/opl-csv/bulk-csv.html)
- **Data Processing**: Pandas, NumPy
- **Search**: RapidFuzz for fuzzy matching

## Prerequisites

- Python 3.11 or higher
- Supabase account (free tier works fine)
- ~2GB disk space for data

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/StrengthAnalytics/IPFDataExtracter.git
cd IPFDataExtracter
```

### 2. Set Up Python Environment

```bash
# Create virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Supabase

1. Create a free account at [Supabase](https://supabase.com)
2. Create a new project
3. Go to Project Settings → API
4. Copy your project URL and anon key

### 4. Set Up Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Supabase credentials:
# SUPABASE_URL=your_project_url
# SUPABASE_KEY=your_anon_key
```

### 5. Create Database Schema

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the schema from `app/models/schema.py`
4. Run each CREATE TABLE statement

The schema includes:
- `lifter_records` - Individual competition entries
- `lifter_summary` - Aggregated lifter statistics
- `percentile_cache` - Cached percentile calculations

### 6. Download and Import Data

```bash
# Download and filter OpenPowerlifting data (IPF only, 2022+)
python scripts/download_and_filter_data.py

# This will:
# - Download the latest OpenPowerlifting CSV (~600MB)
# - Filter for IPF-affiliated federations
# - Keep only data from 2022 onwards
# - Save filtered data to data/openpowerlifting-ipf-filtered.csv
```

Expected output:
```
Total records: ~1,400,000
Records after date filter: ~400,000
Records after federation filter: ~150,000
```

### 7. Ingest Data into Supabase

```bash
# Upload filtered data to Supabase
python scripts/ingest_to_supabase.py

# This may take 10-20 minutes depending on your connection
# Progress will be shown in the terminal
```

### 8. Run the API Server

```bash
python run.py
```

The API will be available at `http://localhost:5000`

## API Endpoints

### Search

#### `GET /api/v1/search/lifters`
Search for lifters by name with fuzzy matching.

**Query Parameters:**
- `q` (required): Search query (min 2 characters)
- `limit` (optional): Max results (default: 10, max: 50)

**Example:**
```bash
curl "http://localhost:5000/api/v1/search/lifters?q=john&limit=5"
```

**Response:**
```json
{
  "query": "john",
  "results": [
    {
      "name": "John Haack",
      "sex": "M",
      "country": "USA",
      "weight_classes": ["83", "90"],
      "last_competition_date": "2024-10-15",
      "total_competitions": 42,
      "match_score": 95
    }
  ],
  "count": 1
}
```

### Lifter Profile

#### `GET /api/v1/lifter/<name>`
Get complete profile for a lifter.

**Example:**
```bash
curl "http://localhost:5000/api/v1/lifter/John%20Haack"
```

#### `GET /api/v1/lifter/<name>/best-lifts`
Get lifter's best lifts within a timeframe.

**Query Parameters:**
- `years` (optional): Lookback period - 1, 2, or 3 (default: 3)
- `equipment` (optional): Filter by equipment type
- `weight_class` (optional): Filter by weight class

**Example:**
```bash
curl "http://localhost:5000/api/v1/lifter/John%20Haack/best-lifts?years=1&equipment=Raw"
```

**Response:**
```json
{
  "name": "John Haack",
  "timeframe_years": 1,
  "best_squat": {
    "best3_squat_kg": 340,
    "date": "2024-08-12",
    "meet_name": "USAPL Raw Nationals",
    "squat1_kg": 320,
    "squat2_kg": 335,
    "squat3_kg": 340
  },
  "best_bench": {...},
  "best_deadlift": {...},
  "best_total": {...},
  "total_competitions": 8
}
```

#### `GET /api/v1/lifter/<name>/history`
Get competition history.

**Query Parameters:**
- `limit` (optional): Max competitions (default: 20, max: 100)

### Scouting

#### `POST /api/v1/scouting/compare`
Compare multiple lifters for scouting reports.

**Request Body:**
```json
{
  "lifters": ["John Haack", "Taylor Atwood"],
  "years": 3,
  "equipment": "Raw"
}
```

**Response:**
```json
{
  "timeframe_years": 3,
  "lifters": [
    {
      "name": "John Haack",
      "best_squat": {...},
      "best_bench": {...},
      "best_deadlift": {...},
      "best_total": {...}
    },
    {
      "name": "Taylor Atwood",
      ...
    }
  ]
}
```

### Percentiles

#### `POST /api/v1/percentile/calculate`
Calculate percentile for a specific lift.

**Request Body:**
```json
{
  "value": 200.0,
  "sex": "M",
  "equipment": "Raw",
  "weight_class": "93",
  "lift_type": "squat",
  "event": "SBD"
}
```

**Response:**
```json
{
  "percentile": 68.5,
  "value": 200.0,
  "sample_size": 15432,
  "mean": 185.3,
  "median": 187.5,
  "p25": 165.0,
  "p50": 187.5,
  "p75": 210.0,
  "p90": 235.0,
  "p95": 250.0,
  "p99": 275.0
}
```

#### `GET /api/v1/standards/<sex>/<weight_class>`
Get strength standards for a category.

**Query Parameters:**
- `equipment` (optional): Default 'Raw'
- `event` (optional): Default 'SBD'

**Example:**
```bash
curl "http://localhost:5000/api/v1/standards/M/93?equipment=Raw"
```

**Response:**
```json
{
  "sex": "M",
  "weight_class": "93",
  "equipment": "Raw",
  "event": "SBD",
  "standards": {
    "squat": {
      "beginner": 120.5,
      "novice": 155.0,
      "intermediate": 187.5,
      "advanced": 220.0,
      "elite": 255.0,
      "world_class": 285.0,
      "sample_size": 15432
    },
    "bench": {...},
    "deadlift": {...},
    "total": {...}
  }
}
```

### Utility Endpoints

#### `GET /api/v1/equipment-types`
Get list of equipment types.

#### `GET /api/v1/weight-classes`
Get weight classes by sex.

**Query Parameters:**
- `sex` (optional): Filter by 'M' or 'F'

#### `GET /api/v1/stats`
Get database statistics.

**Response:**
```json
{
  "total_records": 147853,
  "unique_lifters": 42156,
  "latest_competition": "2024-11-15"
}
```

#### `GET /health`
Health check endpoint.

## Integration with PlatformPro

This API is designed to be consumed by the [PlatformPro](https://github.com/StrengthAnalytics/PlatformPro) React application.

### CORS Configuration

The API is pre-configured to allow requests from:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Alternative dev port)

To add more origins, update `CORS_ORIGINS` in your `.env` file:

```env
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://your-production-domain.com
```

### Example Frontend Integration

```typescript
// In your React app
const API_BASE = 'http://localhost:5000/api/v1';

// Search for lifters
async function searchLifters(query: string) {
  const response = await fetch(`${API_BASE}/search/lifters?q=${encodeURIComponent(query)}&limit=10`);
  return response.json();
}

// Compare lifters for scouting
async function compareLifters(lifterNames: string[], years: number = 3) {
  const response = await fetch(`${API_BASE}/scouting/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lifters: lifterNames, years })
  });
  return response.json();
}

// Calculate percentile
async function calculatePercentile(lift: {
  value: number;
  sex: string;
  equipment: string;
  weight_class: string;
  lift_type: string;
}) {
  const response = await fetch(`${API_BASE}/percentile/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lift)
  });
  return response.json();
}
```

## Data Updates

The OpenPowerlifting database is updated regularly. To refresh your data:

```bash
# Re-download and filter data
python scripts/download_and_filter_data.py

# Clear existing data from Supabase (in SQL Editor):
# TRUNCATE lifter_records, lifter_summary, percentile_cache;

# Re-ingest
python scripts/ingest_to_supabase.py
```

## Project Structure

```
IPFDataExtracter/
├── api/
│   └── index.py              # Vercel serverless entry point
├── app/
│   ├── __init__.py           # Flask app factory
│   ├── api/
│   │   └── routes.py         # API endpoints
│   ├── models/
│   │   ├── database.py       # Supabase connection
│   │   └── schema.py         # Database schema
│   └── services/
│       ├── lifter_service.py    # Lifter operations
│       └── percentile_service.py # Percentile calculations
├── scripts/
│   ├── download_and_filter_data.py  # Data download
│   └── ingest_to_supabase.py        # Data ingestion
├── data/                     # Data files (gitignored)
├── config.py                 # Configuration
├── run.py                    # Local dev entry point
├── vercel.json               # Vercel configuration
├── requirements.txt          # Python dependencies (local dev)
├── requirements-vercel.txt   # Streamlined deps (production)
├── .env.example              # Environment template
├── README.md                 # This file
├── VERCEL_DEPLOYMENT.md      # Vercel deployment guide
└── SETUP_GUIDE.md            # Beginner setup guide
```

## Development

### Running Tests

```bash
pytest tests/
```

### Code Formatting

```bash
# Format code
black app/ scripts/

# Check linting
flake8 app/ scripts/
```

## Deployment

### Recommended: Deploy to Vercel (Serverless)

**✨ Vercel is the recommended deployment platform** - it's free, fast, and optimized for this API!

See **[VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md)** for complete step-by-step guide.

**Quick Vercel Deploy:**
1. Push code to GitHub
2. Import project on [vercel.com](https://vercel.com)
3. Add environment variables (SUPABASE_URL, SUPABASE_KEY, SECRET_KEY)
4. Deploy!

**Important**: Data ingestion runs locally, not on Vercel (see VERCEL_DEPLOYMENT.md for details).

### Environment Variables for Production

```env
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=your-secure-random-key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
CORS_ORIGINS=https://your-frontend-domain.com
API_RATE_LIMIT=1000 per hour
```

### Alternative Deployment Options

1. **Vercel** (recommended - see VERCEL_DEPLOYMENT.md)
   - Serverless functions
   - Free tier with generous limits
   - Auto-scaling and CDN
   - Perfect for this API

2. **Railway** (good for traditional server)
   - Connect your GitHub repo
   - Add environment variables
   - Deploy automatically
   - Can run data ingestion on the server

3. **Heroku**
   - Add a `Procfile`: `web: gunicorn run:app`
   - Add `gunicorn` to requirements.txt
   - Deploy via Git

4. **Docker**
   ```dockerfile
   FROM python:3.11-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   COPY . .
   CMD ["gunicorn", "-b", "0.0.0.0:5000", "run:app"]
   ```

## License

MIT License - see LICENSE file for details

## Credits

- Data provided by [OpenPowerlifting](https://www.openpowerlifting.org/)
- Created for [PlatformPro](https://github.com/StrengthAnalytics/PlatformPro)

## Support

For issues or questions:
- Open an issue on GitHub
- Email: support@strengthanalytics.com
