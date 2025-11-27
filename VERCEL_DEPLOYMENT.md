# Deploying to Vercel

This guide covers deploying the IPF Data Extracter API to Vercel as serverless functions.

## Important Limitations

⚠️ **Serverless Limitations on Vercel:**

1. **10-second timeout**: Vercel serverless functions have a 10-second execution limit on the free tier (60s on Pro)
2. **No long-running processes**: Data ingestion scripts must be run locally or on a different platform
3. **Cold starts**: First request may be slower as the function warms up
4. **No background jobs**: Each request is isolated

**What this means:**
- ✅ All API endpoints will work perfectly
- ✅ Searching, comparisons, and percentile calculations work great
- ❌ You CANNOT run the data ingestion scripts on Vercel
- ❌ You must populate Supabase from your local machine or another server

## Prerequisites

1. Vercel account (free tier works)
2. Supabase database already set up and populated with data
3. GitHub repository with your code

## Step 1: Prepare Your Supabase Database

Since you can't run the data ingestion on Vercel, you need to populate Supabase locally first:

```bash
# On your local machine:
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Configure .env with your Supabase credentials
cp .env.example .env
# Edit .env and add SUPABASE_URL and SUPABASE_KEY

# Download and filter data
python scripts/download_and_filter_data.py

# Ingest to Supabase (this populates your cloud database)
python scripts/ingest_to_supabase.py
```

This is a one-time setup. Once your Supabase database is populated, Vercel will just read from it.

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the Python project
5. Add environment variables:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Your Supabase anon key
   - `SECRET_KEY`: A random secret key for Flask
   - `FLASK_ENV`: `production`
6. Click "Deploy"

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (first time)
vercel

# Follow prompts to link project

# Add environment variables
vercel env add SUPABASE_URL
vercel env add SUPABASE_KEY
vercel env add SECRET_KEY
vercel env add FLASK_ENV

# Deploy to production
vercel --prod
```

## Step 3: Configure Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

| Variable      | Value                                    | Description                    |
|---------------|------------------------------------------|--------------------------------|
| SUPABASE_URL  | `https://xxx.supabase.co`               | Your Supabase project URL      |
| SUPABASE_KEY  | `eyJ...`                                | Your Supabase anon key         |
| SECRET_KEY    | Random string (generate with `openssl rand -hex 32`) | Flask secret key |
| FLASK_ENV     | `production`                            | Environment                    |
| CORS_ORIGINS  | `https://your-frontend.vercel.app`      | Your frontend URL (optional)   |

## Step 4: Test Your Deployment

Once deployed, Vercel will give you a URL like `https://your-project.vercel.app`

Test it:

```bash
# Health check
curl https://your-project.vercel.app/health

# Search lifters
curl "https://your-project.vercel.app/api/v1/search/lifters?q=haack"

# Get stats
curl "https://your-project.vercel.app/api/v1/stats"
```

## Project Structure for Vercel

```
IPFDataExtracter/
├── api/
│   └── index.py              # Vercel serverless entry point
├── app/
│   ├── __init__.py
│   ├── api/routes.py
│   ├── services/
│   └── models/
├── vercel.json               # Vercel configuration
├── .vercelignore             # Files to exclude from deployment
└── requirements-vercel.txt   # Streamlined dependencies
```

## Vercel Configuration Explained

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.py",     // Entry point for serverless function
      "use": "@vercel/python"     // Use Python runtime
    }
  ],
  "routes": [
    {
      "src": "/health",
      "dest": "api/index.py"      // Route health check to our function
    },
    {
      "src": "/api/v1/(.*)",      // Route all API calls to our function
      "dest": "api/index.py"
    }
  ],
  "functions": {
    "api/index.py": {
      "maxDuration": 10          // 10 second timeout (free tier)
    }
  }
}
```

## Connecting PlatformPro to Vercel Deployment

Update your frontend to use the production URL:

```typescript
// src/config/api.ts
const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://your-project.vercel.app/api/v1'
  : 'http://localhost:5000/api/v1';

export const ipfApi = {
  async searchLifters(query: string) {
    const res = await fetch(`${API_BASE}/search/lifters?q=${query}`);
    return res.json();
  }
};
```

## Updating Data

Since you can't run data ingestion on Vercel, you have two options for updates:

### Option 1: Local Updates (Simple)
```bash
# On your local machine
python scripts/download_and_filter_data.py
python scripts/ingest_to_supabase.py
```

The data is stored in Supabase (not Vercel), so Vercel will automatically serve the updated data.

### Option 2: Separate Data Pipeline (Advanced)
- Set up a cron job on a VPS or GitHub Actions
- Run data ingestion scripts on a schedule
- Updates Supabase automatically

## Monitoring and Logs

View function logs in Vercel Dashboard:
1. Go to your project
2. Click "Deployments"
3. Click on a deployment
4. Click "Functions" tab
5. View real-time logs

## Troubleshooting

### "Module not found" errors
- Make sure all dependencies are in `requirements-vercel.txt`
- Check that the build succeeded in Vercel dashboard

### CORS errors
- Add your frontend domain to `CORS_ORIGINS` environment variable
- Format: `https://app1.vercel.app,https://app2.vercel.app`

### Cold start latency
- First request after inactivity may take 2-3 seconds
- Subsequent requests are fast
- Consider Vercel Pro for better performance

### Timeout errors
- Complex queries might hit the 10-second limit
- Upgrade to Vercel Pro for 60-second timeout
- Or optimize slow queries in Supabase

### Database connection issues
- Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Check Supabase dashboard for connection limits
- Supabase free tier has connection pooling built-in

## Cost

**Vercel Free Tier Includes:**
- 100 GB bandwidth
- Serverless function execution
- Automatic SSL
- Unlimited API requests (within bandwidth limits)

**When to upgrade:**
- Need more than 10-second function timeout
- Need more bandwidth
- Want better performance (faster cold starts)

## Performance Optimization

1. **Use Supabase Indexes**: Ensure all indexed are created from `schema.py`
2. **Cache Results**: The API includes percentile caching
3. **Limit Result Sets**: Use pagination parameters
4. **Connection Pooling**: Supabase handles this automatically

## Alternative: Hybrid Approach

For best of both worlds:

1. **Vercel**: Hosts the API (fast, serverless, auto-scaling)
2. **Supabase**: Hosts the database (always-on, fast queries)
3. **GitHub Actions or VPS**: Runs data ingestion monthly

This gives you:
- Free hosting for API
- Free database hosting
- Automated data updates
- Excellent performance

## Example GitHub Actions for Data Updates

Create `.github/workflows/update-data.yml`:

```yaml
name: Update IPF Data

on:
  schedule:
    - cron: '0 0 1 * *'  # First day of every month
  workflow_dispatch:      # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt

      - name: Download and filter data
        run: python scripts/download_and_filter_data.py

      - name: Ingest to Supabase
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: python scripts/ingest_to_supabase.py
```

## Summary

✅ **Vercel is great for this API because:**
- Serverless architecture scales automatically
- Free tier is generous
- Easy deployment from GitHub
- Automatic HTTPS and CDN
- Works perfectly with Supabase

⚠️ **Just remember:**
- Data ingestion must happen outside Vercel (locally or via GitHub Actions)
- Supabase stores all the data (not Vercel)
- Vercel just runs the API endpoints

## Next Steps

1. Populate Supabase from your local machine
2. Deploy to Vercel
3. Test API endpoints
4. Connect PlatformPro to production URL
5. Set up automated data updates (optional)

Need help? Check the main README.md or open an issue on GitHub.
