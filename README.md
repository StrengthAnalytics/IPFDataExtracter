# IPF Data Extracter

A modern React-based powerlifting scouting and analysis platform powered by Supabase.

**🚀 Deploy to Vercel in minutes!** Static frontend + Supabase backend = zero configuration deployment.

## Features

- 🔍 **Lifter Search**: Fast search with autocomplete for finding powerlifters
- 📊 **Percentile Rankings**: Calculate strength percentiles by weight class, sex, and equipment
- 🏋️ **Scouting Reports**: Compare multiple lifters side-by-side
- 📈 **Competition History**: Track lifter performance over time
- 🎯 **Strength Standards**: Get benchmarks from beginner to world-class

## Architecture

```
┌─────────────────────────────────────┐
│      React Frontend (Vercel)        │
│   - TypeScript + Tailwind CSS       │
│   - Supabase JS Client              │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│      Supabase (PostgreSQL)           │
│   - lifter_records (150K+ records)   │
│   - lifter_summary (aggregates)      │
│   - Direct queries from frontend     │
└──────────────────────────────────────┘
```

**Key Benefits:**
- ✅ No backend server needed - Supabase handles everything
- ✅ Deploy frontend as static site on Vercel
- ✅ Faster performance (no API middleware)
- ✅ Simpler architecture and maintenance

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (static site)
- **Data Source**: [OpenPowerlifting](https://openpowerlifting.gitlab.io/opl-csv/bulk-csv.html)
- **Data Ingestion**: Python scripts (run locally in `data-pipeline/`)

## Quick Start

### 1. Prerequisites

- Node.js 16+ (for frontend)
- Python 3.11+ (for data ingestion only)
- Supabase account (free tier works great)
- ~2GB disk space for data download

### 2. Clone Repository

```bash
git clone https://github.com/StrengthAnalytics/IPFDataExtracter.git
cd IPFDataExtracter
```

### 3. Set Up Supabase Database

1. Create account at [Supabase](https://supabase.com)
2. Create new project
3. Go to SQL Editor in Supabase dashboard
4. Run the schema creation script (see `Database Schema` section below)
5. Copy your Project URL and anon key from Settings → API

### 4. Populate Database (One-Time Setup)

```bash
# Navigate to data pipeline
cd data-pipeline

# Set up Python environment for data ingestion
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Configure Supabase credentials
cp .env.example .env
# Edit .env and add:
# SUPABASE_URL=your_supabase_url
# SUPABASE_KEY=your_supabase_anon_key

# Download and filter OpenPowerlifting data
python download_and_filter_data.py

# Ingest data to Supabase (takes 15-20 minutes)
python ingest_to_supabase.py

# Return to project root
cd ..
```

Expected output:
- Total records downloaded: ~1,400,000
- After filtering (IPF federations, 2022+): ~150,000
- Ingested to Supabase: ~150,000 records

### 5. Set Up Frontend

```bash
# Install dependencies
npm install

# Configure Supabase connection
cp .env.example .env
# Edit .env and add:
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Run development server
npm run dev
```

Visit `http://localhost:5173` 🎉

## Database Schema

Run this SQL in your Supabase SQL Editor:

```sql
-- Individual competition records
CREATE TABLE lifter_records (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sex TEXT,
  event TEXT,
  equipment TEXT,
  age NUMERIC,
  age_class TEXT,
  birth_year_class TEXT,
  division TEXT,
  bodyweight_kg NUMERIC,
  weight_class_kg TEXT,
  squat1_kg NUMERIC,
  squat2_kg NUMERIC,
  squat3_kg NUMERIC,
  squat4_kg NUMERIC,
  best3_squat_kg NUMERIC,
  bench1_kg NUMERIC,
  bench2_kg NUMERIC,
  bench3_kg NUMERIC,
  bench4_kg NUMERIC,
  best3_bench_kg NUMERIC,
  deadlift1_kg NUMERIC,
  deadlift2_kg NUMERIC,
  deadlift3_kg NUMERIC,
  deadlift4_kg NUMERIC,
  best3_deadlift_kg NUMERIC,
  total_kg NUMERIC,
  place TEXT,
  dots NUMERIC,
  wilks NUMERIC,
  glossbrenner NUMERIC,
  goodlift NUMERIC,
  tested TEXT,
  country TEXT,
  state TEXT,
  federation TEXT,
  parent_federation TEXT,
  date DATE,
  meet_country TEXT,
  meet_state TEXT,
  meet_name TEXT,
  sanctioned TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Aggregated lifter statistics
CREATE TABLE lifter_summary (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  sex TEXT,
  country TEXT,
  total_competitions INTEGER,
  first_competition_date DATE,
  last_competition_date DATE,
  weight_classes TEXT[],
  equipment_types TEXT[],
  best_squat_kg NUMERIC,
  best_squat_date DATE,
  best_squat_meet TEXT,
  best_bench_kg NUMERIC,
  best_bench_date DATE,
  best_bench_meet TEXT,
  best_deadlift_kg NUMERIC,
  best_deadlift_date DATE,
  best_deadlift_meet TEXT,
  best_total_kg NUMERIC,
  best_total_date DATE,
  best_total_meet TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_lifter_records_name ON lifter_records(name);
CREATE INDEX idx_lifter_records_date ON lifter_records(date);
CREATE INDEX idx_lifter_records_sex_equipment_weightclass ON lifter_records(sex, equipment, weight_class_kg);
CREATE INDEX idx_lifter_summary_name ON lifter_summary(name);

-- Enable Row Level Security
ALTER TABLE lifter_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifter_summary ENABLE ROW LEVEL SECURITY;

-- Policy to allow read access to all
CREATE POLICY "Allow public read access" ON lifter_records FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON lifter_summary FOR SELECT TO anon USING (true);
```

## Deployment

### Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel auto-detects Vite configuration

3. **Add Environment Variables** in Vercel dashboard:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

4. **Deploy!**
   - Vercel builds and deploys automatically
   - Your app will be live at `https://your-project.vercel.app`

### Updating Data

Data is stored in Supabase, not Vercel. To update:

```bash
# On your local machine
cd data-pipeline
source venv/bin/activate
python download_and_filter_data.py
python ingest_to_supabase.py
```

The deployed app automatically uses the updated Supabase data.

## Project Structure

```
IPFDataExtracter/
├── src/                       # React application source
│   ├── components/            # Reusable UI components
│   ├── pages/                 # Page components
│   ├── services/              # Supabase API service
│   │   ├── api.ts             # API exports
│   │   └── supabaseApi.ts     # Direct Supabase queries
│   ├── config/                # Supabase client config
│   │   └── supabase.ts        # Supabase client setup
│   └── types/                 # TypeScript types
├── data-pipeline/             # Data ingestion (Python, local only)
│   ├── download_and_filter_data.py
│   ├── ingest_to_supabase.py
│   ├── config.py              # Data pipeline configuration
│   ├── requirements.txt       # Python dependencies
│   └── app/
│       └── models/
│           └── database.py    # Supabase client for ingestion
├── package.json               # Frontend dependencies
├── vite.config.ts             # Vite configuration
├── vercel.json                # Vercel deployment config
└── README.md                  # This file
```

## Data Coverage

- **Federations**: IPF, USAPL, CPU, EPF, BP, and other IPF affiliates
- **Date Range**: 2022 - Present
- **Records**: ~150,000 competition entries
- **Unique Lifters**: ~40,000+
- **Data Source**: [OpenPowerlifting](https://www.openpowerlifting.org/)

## Development

### Frontend Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Data Pipeline

```bash
# Navigate to data pipeline
cd data-pipeline

# Activate Python environment
source venv/bin/activate

# Download fresh data
python download_and_filter_data.py

# Ingest to Supabase
python ingest_to_supabase.py
```

See [data-pipeline/README.md](data-pipeline/README.md) for detailed instructions.

## Integration with PlatformPro

This app is designed for standalone use or integration with [PlatformPro](https://github.com/StrengthAnalytics/PlatformPro).

### To integrate:

```typescript
// Import components
import { LifterSearch } from '@/components/LifterSearch';
import { api } from '@/services/api';

// Use in your app
const MyComponent = () => {
  const handleSearch = async (query: string) => {
    const results = await api.searchLifters(query);
    // ...
  };
};
```

## Troubleshooting

### Frontend can't connect to Supabase

**Check:**
1. Environment variables are set correctly in `.env`
2. Supabase URL and anon key are correct
3. Row Level Security policies allow public read access
4. Tables exist and have data

### Data ingestion fails

**Common issues:**
1. Python environment not activated
2. `.env` file missing or incorrect Supabase credentials (in `data-pipeline/`)
3. Tables not created in Supabase
4. Network timeout (data ingestion takes 15-20 minutes)

### Build errors in Vercel

**Check:**
1. Environment variables are set in Vercel dashboard
2. `vercel.json` is in root directory
3. `package.json` has all dependencies

## Performance

- **Search**: < 500ms for most queries
- **Lifter Profile**: < 300ms
- **Percentile Calculation**: < 2s (client-side calculation)
- **Scouting Comparison**: < 1s for 2-3 lifters

Supabase handles database queries efficiently with proper indexing.

## Costs

**Completely free for moderate usage:**
- Vercel: Free tier (100GB bandwidth/month)
- Supabase: Free tier (500MB database, 50K monthly active users)

Perfect for personal use, beta testing, or small-scale production.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Credits

- Data provided by [OpenPowerlifting](https://www.openpowerlifting.org/)
- Created for [PlatformPro](https://github.com/StrengthAnalytics/PlatformPro)
- Built with [Supabase](https://supabase.com) and [Vercel](https://vercel.com)

## Support

For issues or questions:
- Open an issue on GitHub
- Check existing documentation
- Email: support@strengthanalytics.com

---

**Ready to deploy?** Push to GitHub and import to Vercel! 🚀
