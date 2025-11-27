# Step-by-Step Setup Guide for Beginners

This guide assumes you have **no prior experience** with Flask or Supabase. Follow each step carefully!

## Part 1: Install Python

### Windows
1. Download Python 3.11+ from https://www.python.org/downloads/
2. Run the installer
3. ✅ **IMPORTANT**: Check "Add Python to PATH" during installation
4. Click "Install Now"

### Mac
```bash
# Using Homebrew (recommended)
brew install python@3.11
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip
```

### Verify Installation
Open your terminal/command prompt and run:
```bash
python --version
# Should show Python 3.11.x or higher
```

## Part 2: Set Up Supabase (The Database)

Supabase is like having your own PostgreSQL database in the cloud, but super easy!

### Step 1: Create Account
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub (easiest) or email
4. Verify your email if needed

### Step 2: Create a New Project
1. Click "New Project"
2. Choose/create an organization (can be your personal one)
3. Fill in project details:
   - **Name**: `ipf-powerlifting-data` (or whatever you like)
   - **Database Password**: Generate a strong password and **save it somewhere safe**
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free (totally fine for this project)
4. Click "Create new project"
5. Wait 2-3 minutes while Supabase sets up your database

### Step 3: Get Your API Credentials
1. In your Supabase project dashboard, click the ⚙️ Settings icon (bottom left)
2. Click "API" in the sidebar
3. You'll see two important things:
   - **Project URL**: Looks like `https://abcdefgh.supabase.co`
   - **anon public key**: Long string starting with `eyJ...`
4. **Keep this tab open** - you'll need these values soon!

### Step 4: Create Database Tables
1. In Supabase dashboard, click the "SQL Editor" icon (looks like </> in sidebar)
2. Click "New query"
3. Open the file `app/models/schema.py` in this project
4. Copy the SQL code from `LIFTER_RECORDS_TABLE` section
5. Paste it into the Supabase SQL editor
6. Click "Run" (or press Ctrl+Enter)
7. You should see "Success. No rows returned"
8. Repeat for `PERCENTILE_CACHE_TABLE` and `LIFTER_SUMMARY_TABLE`
9. Optionally run the `RLS_POLICIES` section for security

You should now have 3 tables created! You can verify by clicking "Table Editor" in the sidebar.

## Part 3: Set Up the Project

### Step 1: Download the Project
```bash
# Open terminal/command prompt and navigate to where you want the project
cd ~/Desktop  # or wherever you like

# Clone the repository
git clone https://github.com/StrengthAnalytics/IPFDataExtracter.git
cd IPFDataExtracter
```

### Step 2: Create a Virtual Environment
This keeps the project's dependencies separate from your system Python.

```bash
# Create the virtual environment
python -m venv venv

# Activate it:
# On Windows (Command Prompt):
venv\Scripts\activate

# On Windows (PowerShell):
venv\Scripts\Activate.ps1

# On Mac/Linux:
source venv/bin/activate

# You should see (venv) at the start of your command line now
```

### Step 3: Install Dependencies
```bash
# Make sure your venv is activated (you should see (venv) in your terminal)
pip install -r requirements.txt

# This will take 2-5 minutes
# You'll see a lot of text - that's normal!
```

### Step 4: Configure Environment Variables
```bash
# Copy the example environment file
cp .env.example .env

# Now edit .env with your favorite text editor:
# - On Windows: notepad .env
# - On Mac: open -e .env
# - Or use VS Code, Notepad++, etc.
```

Edit the `.env` file to add your Supabase credentials:
```env
# Replace these with your actual values from Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-anon-key-here

# These can stay as-is for development
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=dev-secret-key-change-in-production

# Leave these as default
API_RATE_LIMIT=100 per hour
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
DATA_START_YEAR=2022
IPF_FEDERATIONS=IPF,EPF,CPU,USAPL,BP
```

**Save the file!**

## Part 4: Download and Import Data

This is the fun part - we're going to download 1.4 million powerlifting records and filter them!

### Step 1: Download Data
```bash
# Make sure your venv is still activated
python scripts/download_and_filter_data.py
```

What this does:
1. Downloads the latest OpenPowerlifting database (~600MB zip file)
2. Extracts the CSV
3. Filters for IPF-affiliated federations only
4. Keeps only data from 2022 onwards
5. Saves the filtered data (~150,000 records)

This takes about **5-10 minutes** depending on your internet speed.

Expected output:
```
Downloading OpenPowerlifting data...
Downloading: 100.0%
✓ Downloaded to data/openpowerlifting-latest.zip
Extracting CSV file...
✓ Extracted to data/openpowerlifting-full.csv

Reading CSV file (this may take a moment)...
Total records: 1,439,827

Filtering for dates >= 2022-01-01...
Records after date filter: 387,456

Filtering for IPF federations: IPF, EPF, CPU, USAPL, BP...
Records after federation filter: 147,853

✅ Data download and filtering complete!
```

### Step 2: Upload to Supabase
```bash
python scripts/ingest_to_supabase.py
```

This uploads the filtered data to your Supabase database.

**This takes 10-20 minutes** depending on your internet connection.

You'll see progress like:
```
Reading data from data/openpowerlifting-ipf-filtered.csv...
Total records to ingest: 147,853
Preparing records...
Progress: 147,853/147,853 (100.0%)
✓ All records inserted successfully
✓ Lifter summaries generated successfully
✅ Data ingestion complete!
```

## Part 5: Run the API Server

### Start the Server
```bash
python run.py
```

You should see:
```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║         IPF Data Extracter API Server                   ║
║                                                          ║
║  Environment: development                                ║
║  Port: 5000                                              ║
║  Debug: True                                             ║
║                                                          ║
║  API Documentation: http://localhost:5000/api/v1         ║
║  Health Check: http://localhost:5000/health              ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

 * Running on http://0.0.0.0:5000
```

### Test It Out!

Open your browser and go to:
- http://localhost:5000/health

You should see:
```json
{
  "status": "healthy",
  "service": "IPF Data Extracter"
}
```

Try searching for a lifter:
- http://localhost:5000/api/v1/search/lifters?q=john

Get database stats:
- http://localhost:5000/api/v1/stats

## Part 6: Integration with PlatformPro

Once your API is running, you can connect it to PlatformPro!

In your PlatformPro project, create a new file `src/services/ipfApi.ts`:

```typescript
const API_BASE = 'http://localhost:5000/api/v1';

export const ipfApi = {
  searchLifters: async (query: string, limit = 10) => {
    const response = await fetch(
      `${API_BASE}/search/lifters?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return response.json();
  },

  getLifterProfile: async (name: string) => {
    const response = await fetch(
      `${API_BASE}/lifter/${encodeURIComponent(name)}`
    );
    return response.json();
  },

  compareLifters: async (lifters: string[], years = 3) => {
    const response = await fetch(`${API_BASE}/scouting/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lifters, years })
    });
    return response.json();
  },

  calculatePercentile: async (lift: {
    value: number;
    sex: string;
    equipment: string;
    weight_class: string;
    lift_type: string;
  }) => {
    const response = await fetch(`${API_BASE}/percentile/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lift)
    });
    return response.json();
  }
};
```

## Troubleshooting

### "Module not found" errors
Make sure your virtual environment is activated:
```bash
# You should see (venv) at the start of your terminal
# If not, activate it again:
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate     # Windows
```

### "Supabase credentials not configured"
Check that your `.env` file has the correct values and is in the root directory.

### Data ingestion is very slow
This is normal! Uploading 150,000 records takes time. Leave it running and grab a coffee ☕

### Port 5000 already in use
Change the port in your `.env`:
```env
PORT=5001
```

### CORS errors when calling from PlatformPro
Make sure your frontend's URL is in `CORS_ORIGINS` in `.env`:
```env
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Next Steps

1. Read the main README.md for API documentation
2. Build your scouting features in PlatformPro
3. Check out the example frontend integration code
4. Deploy to production when ready!

## Getting Help

- Check the main README.md for detailed API docs
- Open an issue on GitHub
- Email: support@strengthanalytics.com

## Congratulations! 🎉

You now have a fully functional powerlifting data API running on your machine!
