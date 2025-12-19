# IPF Scout

A modern powerlifting scouting and analysis platform built with React, TypeScript, and Supabase. Analyze competition data from 150,000+ IPF meet records to scout lifters and compare performances with advanced analytics.

**🚀 Live Demo**: [Your Vercel URL]

## Features

### 🔍 Lifter Search
Fast, fuzzy search across 40,000+ powerlifters with autocomplete. Search by name with typo tolerance and instantly view competition history, best lifts, and performance trends.

- **Weight Class Filter**: Filter search results by weight class on the homepage
- **Fuzzy Search Toggle**: Enable typo-tolerant search for misspelled names
- **Rich Autocomplete**: Shows country, competition count, and last competition date

### 🏋️ Advanced Scouting & Comparison
Compare up to 10 lifters side-by-side with powerful analytics:

**Expandable Lifter Profiles (NEW in v1.3.0):**
- Click the chevron arrow next to any lifter name to expand their full profile inline
- View best lifts, success rates, opener tendencies, and jump patterns without leaving the page
- Competition history expands inline with "Show all competitions" option
- Accordion behavior - only one lifter expanded at a time
- Perfect for following a competition flight and quickly analyzing each lifter

**Data Aggregation Modes:**
- **By Lift**: Cherry-pick best result for each lift across all competitions
- **By Comp**: View all lifts from the competition with best total or IPF GL score (default)

**Ranking Methods:**
- **Total**: Rank by total weight lifted (default)
- **IPF GL**: Rank by IPF Goodlift points for weight-class normalized comparison

**View Modes:**
- **List View**: Sortable table with detailed attempt breakdowns (default for desktop)
- **Tiles View**: Compact card layout with side-by-side totals and predictions (default for mobile)

**Detailed Analysis:**
- All 3 attempts for each lift displayed in both views
- Failed attempts shown with strikethrough
- Competition date and meet name for context
- Number of meets shown directly under lifter name
- Clickable lifter names that open profile pages in new tabs
- Filter by weight class
- Predictions always enabled by default

### 📊 Performance Prediction (Dampened Velocity Method)
Predict future competition totals using a custom algorithm designed specifically for powerlifting. **Predictions are always enabled** and calculated automatically for all lifters with sufficient competition history.

**The Algorithm:**
Our prediction system uses the **Dampened Velocity Method**, which respects current momentum while applying biological friction to prevent unrealistic projections. Unlike traditional regression models that often overpredict for experienced lifters, this method accounts for the natural plateau effect in strength sports.

**How It Works:**

1. **Data Cleaning (Monotonic Filter)**
   - Removes strategic underperformances and bad meet days
   - Only keeps competitions where total ≥ previous best
   - Captures true strength progression, not competition performance noise
   - Example: Filters out qualifying meets where lifters lift sub-maximal weights

2. **Velocity Calculation**
   - `V_recent`: Rate of gain (kg/month) between last two competitions
   - `V_overall`: Rate of gain (kg/month) from first to last competition
   - Uses cleaned data for accurate velocity measurements

3. **Velocity Capping (Breakout Prevention)**
   - Caps `V_recent` to max 1.5× `V_overall` when positive
   - Prevents single massive PRs from projecting impossible future gains
   - Example: A 32.5kg jump won't predict another 30kg in 4 months
   - Negative velocities (declining) are never capped

4. **Weighted Average**
   - `V_weighted = (0.6 × V_recent_capped) + (0.4 × V_overall)`
   - 60/40 weighting favors recency while smoothing volatility
   - Balances recent momentum with historical consistency

5. **Biological Friction**
   - `Final_velocity = V_weighted × 0.9`
   - 0.9 coefficient accounts for adaptation and diminishing returns
   - Prevents unrealistic linear projections

6. **Final Prediction**
   - `Predicted_total = Last_total + (Months_to_target × Final_velocity)`
   - Rounded to nearest 2.5 kg (standard plate increment)

**Configuration:**
- **Target Comp Date**: Defaults to today, customizable for future planning
- **Trend Analysis Range**: Analyze last 12, 18, or 24 months (default: 18)
- Results automatically sorted by predicted total (highest first)

**Why This Works:**
- **Respects Reality**: Accounts for biological adaptation and plateau effects
- **Handles Outliers**: Capping prevents breakout performances from skewing predictions
- **Clean Data**: Filters bad meets to focus on true strength progression
- **Smooth Predictions**: 60/40 weighting prevents volatile projections
- **Sport-Specific**: Designed for powerlifting's unique performance patterns

**Example Use Cases:**
- Plan for upcoming competitions 3-12 months out
- Set realistic training goals based on historical progression
- Compare multiple lifters' projected performance at the same date
- Scout upcoming competitors at specific competition dates

### 🎯 Strength Standards
Discover benchmarks for your weight class:
- Standards from beginner to world-class
- Equipment-specific (Raw, Single-ply, Multi-ply)
- Based on actual competition data
- View maximum recorded lifts

### 👤 Lifter Profiles
Complete athlete profiles with advanced analytics:

**Career Bests:**
- Best squat, bench, deadlift, and total with dates and meet names
- **Attempt Breakdown**: All 3 attempts from best performance day with failed lifts marked (strikethrough)

**Competition Analytics:**
- **Opener Tendencies**: Average opener percentage for each lift with min/max range
  - Example: "Opener: 92% (89-95%)" - shows consistency in attempt selection
- **Jump Patterns**: Average weight increase between attempts
  - 1st→2nd jump and 2nd→3rd jump statistics with ranges
- **Make/Miss Rates**: Success rate for each attempt number (1st, 2nd, 3rd)
  - Color-coded: green (≥80%), yellow (60-79%), red (<60%)
  - Shows made/total count (e.g., "24/25")

**Additional Info:**
- Competition history with placement and federation
- Weight class progression
- Equipment types competed in
- Sortable/filterable competition table

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

**Latest Features (December 2024):**

**Scout Page - Expandable Profiles (v1.3.0):**
- ✅ **Inline Profile Expansion** - Click chevron to view full lifter profile without leaving Scout page
- ✅ **Accordion Behavior** - Only one lifter expanded at a time for clean UX
- ✅ **Inline Competition History** - "Show all competitions" expands inline instead of new page
- ✅ **Dynamic Weight Classes** - Weight class data computed from actual records (fixes stale data)
- ⚠️ **Known Issue** - Scroll preservation when collapsing not working (page jumps to top)

**Lifter Profile Analytics (v1.2.0):**
- ✅ **Attempt Breakdown** - Shows all 3 attempts from best performance with failed lifts struck through
- ✅ **Opener Tendencies** - Average opener % for each lift with consistency range (min-max)
- ✅ **Jump Patterns** - Average weight jumps between attempts (1st→2nd, 2nd→3rd)
- ✅ **Make/Miss Rates** - Success rate per attempt number with color-coded display (green/yellow/red)

**Search & Navigation:**
- ✅ **Weight Class Filter** - Filter lifter search by weight class on homepage
- ✅ **Scout UI Cleanup** - Removed separator between search and filter sections

**Previous Features:**
- ✅ **Scout UI Cleanup** - Streamlined comparison interface with centralized controls
- ✅ **Always-On Predictions** - Automatic performance forecasting for all comparisons
- ✅ **Enhanced Tiles View** - Side-by-side total and prediction display with full attempt data
- ✅ **Responsive Toggle Controls** - Grid layout on mobile, centered inline on desktop
- ✅ **Clickable Lifter Names** - Direct links to profile pages that open in new tabs
- ✅ **Vercel SPA Routing** - Fixed 404 errors with proper client-side routing configuration
- ✅ **Centered UI Layout** - Improved visual hierarchy with max-width constraints
- ✅ **Dampened Velocity Method** - Performance predictions with biological friction
- ✅ **Monotonic Filter** - Removes bad meets and strategic underperformances
- ✅ **Velocity Capping** - Prevents breakout performances from skewing predictions
- ✅ IPF GL (Goodlift Points) ranking system
- ✅ Dual aggregation modes (By Lift / By Comp, defaults to By Comp)
- ✅ Responsive view modes (List / Tiles)
- ✅ Complete attempt details with success/fail indicators in both views
- ✅ Advanced sorting with prediction-first default ordering
- ✅ Fuzzy search with typo tolerance
- ✅ Mobile-optimized interface with responsive controls

## Roadmap

Future features under consideration:
- [ ] Advanced filtering (by federation, age class, division)
- [ ] Wilks/DOTS score comparisons
- [ ] Individual lift predictions (squat, bench, deadlift separately)
- [ ] Export comparisons and predictions to CSV/PDF
- [ ] User accounts and saved lifter lists
- [ ] Custom scouting reports
- [ ] Meet-specific analytics
- [ ] Confidence intervals for predictions

---

**Built with ❤️ for the powerlifting community**
