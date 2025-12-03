# IPF Scout

A modern powerlifting scouting and analysis platform built with React, TypeScript, and Supabase. Analyze competition data from 150,000+ IPF meet records to scout lifters and compare performances with advanced analytics.

**🚀 Live Demo**: [Your Vercel URL]

## Features

### 🔍 Lifter Search
Fast, fuzzy search across 40,000+ powerlifters with autocomplete. Search by name with typo tolerance and instantly view competition history, best lifts, and performance trends.

### 🏋️ Advanced Scouting & Comparison
Compare up to 10 lifters side-by-side with powerful analytics:

**Data Aggregation Modes:**
- **By Lift**: Cherry-pick best result for each lift across all competitions (default)
- **By Comp**: View all lifts from the competition with best total or IPF GL score

**Ranking Methods:**
- **Total**: Rank by total weight lifted
- **IPF GL**: Rank by IPF Goodlift points for weight-class normalized comparison

**View Modes:**
- **List View**: Sortable table (default for desktop)
- **Tiles View**: Card-based grid layout (default for mobile)

**Detailed Analysis:**
- All 3 attempts for each lift displayed
- Failed attempts shown with strikethrough
- Competition date and meet name for context
- Customizable date ranges
- Filter by equipment type and weight class

### 🎯 Strength Standards
Discover benchmarks for your weight class:
- Standards from beginner to world-class
- Equipment-specific (Raw, Single-ply, Multi-ply)
- Based on actual competition data
- View maximum recorded lifts

### 👤 Lifter Profiles
Complete athlete profiles including:
- Competition history with placement and federation
- Career best lifts with dates and meet names
- Weight class progression
- Equipment types competed in
- Country and biographical data

## Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Router (navigation)
- Deployed on Vercel (static site)

**Backend:**
- Supabase (PostgreSQL database)
- Direct client-side queries (no API middleware)
- Row Level Security for data protection
- Automatic connection pooling

**Data Source:**
- OpenPowerlifting dataset
- IPF-affiliated federations only
- Competitions from 2022-present
- ~150,000 competition records
- ~40,000 unique lifters

## Architecture

```
┌─────────────────────────────────────┐
│   React Frontend (Vercel Static)   │
│   - TypeScript + Tailwind CSS      │
│   - Direct Supabase Queries        │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│      Supabase (PostgreSQL)           │
│   - lifter_records table             │
│   - lifter_summary table             │
│   - Row Level Security enabled       │
└──────────────────────────────────────┘
```

**Key Benefits:**
- ✅ No backend server needed - Supabase handles everything
- ✅ Fast performance - direct database queries
- ✅ Simple deployment - static site on Vercel
- ✅ Scalable - Supabase auto-scales with usage

## Quick Start

### Prerequisites

- Node.js 16+ (for frontend development)
- Supabase account (free tier works great)
- Vercel account (optional, for deployment)

### 1. Clone Repository

```bash
git clone https://github.com/StrengthAnalytics/IPFDataExtracter.git
cd IPFDataExtracter
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Supabase

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these from: Supabase Dashboard → Project Settings → API

### 4. Set Up Database

Run this SQL in your Supabase SQL Editor to create the schema:

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

-- Allow public read access
CREATE POLICY "Allow public read access" ON lifter_records FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON lifter_summary FOR SELECT TO anon USING (true);
```

### 5. Populate Database (Optional)

**Note:** If you're using this for production, you'll need to populate the database with OpenPowerlifting data. The data pipeline scripts are available but run locally, not in the deployed application.

For development, you can use a sample dataset or contact the maintainers for access to a populated database.

### 6. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` to see the app running locally.

## Deployment

### Deploy to Vercel (Recommended)

1. **Push code to GitHub**

2. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel auto-detects Vite configuration

3. **Add Environment Variables** in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add `VITE_SUPABASE_URL`
   - Add `VITE_SUPABASE_ANON_KEY`

4. **Deploy Settings** (should auto-detect):
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

5. **Deploy!**
   - Vercel will build and deploy automatically
   - Your app will be live at `https://your-project.vercel.app`

### Alternative Platforms

This is a standard Vite static site and can be deployed to:
- **Netlify**: Drag & drop the `dist/` folder
- **Cloudflare Pages**: Connect GitHub repo
- **AWS S3 + CloudFront**: Upload `dist/` folder
- **Any static host**: Just upload the `dist/` folder after running `npm run build`

## Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Lint code
npm run lint
```

### Project Structure

```
IPFDataExtracter/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ConfigCheck.tsx   # Environment config validation
│   │   ├── LifterSearch.tsx  # Autocomplete search component
│   │   └── Navigation.tsx    # Main navigation
│   ├── pages/                # Page components (routes)
│   │   ├── Home.tsx          # Landing page with search
│   │   ├── Scout.tsx         # Advanced lifter comparison tool
│   │   ├── LifterProfile.tsx # Individual lifter profiles
│   │   └── Standards.tsx     # Strength standards
│   ├── services/             # API layer
│   │   ├── api.ts            # API exports
│   │   └── supabaseApi.ts    # Supabase query functions
│   ├── config/               # Configuration
│   │   └── supabase.ts       # Supabase client setup
│   ├── types/                # TypeScript type definitions
│   │   └── index.ts
│   ├── App.tsx               # Root application component
│   ├── main.tsx              # Application entry point
│   └── index.css             # Global styles (Tailwind)
├── public/                   # Static assets
├── dist/                     # Production build output
├── index.html                # HTML template
├── package.json              # Dependencies and scripts
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

### Code Organization

**Components** (`src/components/`):
- Self-contained, reusable UI elements
- Props-based configuration
- TypeScript for type safety

**Pages** (`src/pages/`):
- Full page views mapped to routes
- Compose multiple components
- Handle page-level state and data fetching

**Services** (`src/services/`):
- `supabaseApi.ts`: All database query logic
- Abstracts Supabase client from components
- Provides consistent error handling

**Types** (`src/types/`):
- TypeScript interfaces for data models
- Ensures type safety across the application

## Data Coverage

- **Federations**: IPF, USAPL, CPU, EPF, BP, and other IPF affiliates
- **Date Range**: 2022 - Present
- **Total Records**: ~150,000 competition entries
- **Unique Lifters**: ~40,000+
- **Update Frequency**: Data can be refreshed as needed
- **Data Source**: [OpenPowerlifting](https://www.openpowerlifting.org/)

## Performance

- **Initial Load**: < 2s on fast connections
- **Search Results**: < 500ms for most queries with fuzzy matching
- **Lifter Profile Load**: < 300ms
- **Scouting Comparison**: < 1s for 2-10 lifters with full attempt details
- **View Switching**: Instant (client-side rendering)

Performance is optimized through:
- Database indexing on key columns (name, date, sex, equipment, weight class)
- Supabase connection pooling and automatic scaling
- Efficient filtering of valid records (null/zero handling)
- Client-side sorting and view rendering
- Vite's optimized production builds with code splitting

## Configuration

### Environment Variables

**Required:**
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous/public key

**How to get these:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy "Project URL" → `VITE_SUPABASE_URL`
5. Copy "Project API keys" → anon/public → `VITE_SUPABASE_ANON_KEY`

### Supabase Setup

**Row Level Security (RLS):**
- Must be enabled on both tables for security
- Policies allow public read access via anon key
- No write access from client (data is read-only)

**Connection Pooling:**
- Handled automatically by Supabase
- No configuration needed

**Indexes:**
- Created during schema setup
- Optimize common query patterns
- Keep queries fast even with 150K+ records

## Troubleshooting

### "Configuration Required" Warning

**Problem:** Yellow warning box shows on deployed site.

**Solution:** Environment variables not set in Vercel.
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Redeploy the application

### No Search Results

**Problem:** Searches return empty results.

**Solution 1:** Check Supabase RLS policies:
```sql
-- Verify policies exist
SELECT * FROM pg_policies WHERE tablename IN ('lifter_records', 'lifter_summary');

-- If missing, create them
CREATE POLICY "Allow public read access" ON lifter_records FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON lifter_summary FOR SELECT TO anon USING (true);
```

**Solution 2:** Check if data exists in tables:
```sql
SELECT COUNT(*) FROM lifter_records;
SELECT COUNT(*) FROM lifter_summary;
```

### Build Errors

**Problem:** `npm run build` fails.

**Common causes:**
- TypeScript errors: Run `npm run lint` to find issues
- Missing dependencies: Delete `node_modules` and run `npm install`
- Node version: Ensure Node.js 16+ is installed

### Vercel Deployment Fails

**Problem:** Vercel shows build errors.

**Check:**
1. Build Command is set to `npm run build` (NOT `cd frontend && npm run build`)
2. Output Directory is `dist` (NOT `frontend/dist`)
3. Framework Preset is "Vite" or "Other"
4. Environment variables are set

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Use TypeScript for type safety
- Follow existing code style (use ESLint)
- Write meaningful commit messages
- Test changes locally before submitting PR
- Update documentation for new features

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Credits

- **Data**: [OpenPowerlifting](https://www.openpowerlifting.org/)
- **Database**: [Supabase](https://supabase.com)
- **Hosting**: [Vercel](https://vercel.com)
- **Framework**: [Vite](https://vitejs.dev) + [React](https://react.dev)

## Support

For issues, questions, or feature requests:
- **GitHub Issues**: [Open an issue](https://github.com/StrengthAnalytics/IPFDataExtracter/issues)
- **Email**: support@strengthanalytics.com
- **Documentation**: See docs in this repository

## Recent Updates

**Latest Features (2025):**
- ✅ IPF GL (Goodlift Points) ranking system
- ✅ Dual aggregation modes (By Lift / By Comp)
- ✅ Responsive view modes (List / Tiles)
- ✅ Complete attempt details with success/fail indicators
- ✅ Advanced sorting with ranking method awareness
- ✅ Fuzzy search with typo tolerance
- ✅ Mobile-optimized interface

## Roadmap

Future features under consideration:
- [ ] Advanced filtering (by federation, age class, division)
- [ ] Wilks/DOTS score comparisons
- [ ] Historical performance graphs and trends
- [ ] Export comparisons to CSV/PDF
- [ ] User accounts and saved lifter lists
- [ ] Custom scouting reports
- [ ] Meet-specific analytics
- [ ] Competition predictions based on historical data

---

**Built with ❤️ for the powerlifting community**
