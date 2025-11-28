# Deploying IPF Scout (Full Stack)

Complete guide for deploying both the frontend and backend as a standalone application.

## Deployment Options

### Option 1: Monorepo on Vercel (Recommended)

Deploy both frontend and API to Vercel as a single project.

### Option 2: Separate Deployments

Deploy frontend and API as separate Vercel projects.

---

## Option 1: Monorepo Deployment (Recommended)

This deploys everything to one Vercel project with the frontend at the root and API at `/api/v1`.

### Step 1: Update Root vercel.json

Replace the root `vercel.json` with this configuration:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "frontend/dist"
      }
    },
    {
      "src": "api/index.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/health",
      "dest": "/api/index.py"
    },
    {
      "src": "/api/v1/(.*)",
      "dest": "/api/index.py"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/$1"
    }
  ],
  "env": {
    "FLASK_ENV": "production"
  },
  "functions": {
    "api/index.py": {
      "maxDuration": 10
    }
  },
  "installCommand": "cd frontend && npm install",
  "buildCommand": "cd frontend && npm run build"
}
```

### Step 2: Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variables in dashboard:
# - SUPABASE_URL
# - SUPABASE_KEY
# - SECRET_KEY
# - FLASK_ENV=production

# Deploy to production
vercel --prod
```

Your app will be live at:
- Frontend: `https://your-project.vercel.app/`
- API: `https://your-project.vercel.app/api/v1/`

---

## Option 2: Separate Deployments

### A. Deploy API

1. Create a new Vercel project for the API
2. Use the existing `vercel.json` at the root
3. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `SECRET_KEY`
   - `FLASK_ENV=production`
4. Deploy

You'll get: `https://ipf-api.vercel.app`

### B. Deploy Frontend

1. Create a new Vercel project
2. Set root directory to `frontend`
3. Framework: Vite
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add environment variable:
   - `VITE_API_URL=https://ipf-api.vercel.app/api/v1`
7. Deploy

You'll get: `https://ipf-scout.vercel.app`

---

## Local Development

### Backend (API)

```bash
# In project root
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env and add Supabase credentials

# Run API server
python run.py
```

API runs at `http://localhost:5000`

### Frontend

```bash
# In frontend directory
cd frontend
npm install

# Create .env file
cp .env.example .env
# Edit: VITE_API_URL=http://localhost:5000/api/v1

# Run dev server
npm run dev
```

Frontend runs at `http://localhost:3000`

---

## Environment Variables

### Backend (.env)

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...
SECRET_KEY=random-secret-key-here
FLASK_ENV=development
FLASK_DEBUG=True
CORS_ORIGINS=http://localhost:3000,https://your-frontend.vercel.app
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:5000/api/v1
# For production: https://your-api.vercel.app/api/v1
```

---

## Pre-Deployment Checklist

### 1. Populate Supabase Database

**You must do this locally BEFORE deploying to Vercel!**

```bash
# Download and filter data
python scripts/download_and_filter_data.py

# Ingest to Supabase
python scripts/ingest_to_supabase.py
```

This populates your Supabase database with ~150,000 competition records. This only needs to be done once (or when you want to update data).

### 2. Set Up Supabase

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Run SQL schema from `app/models/schema.py` in SQL Editor
4. Get your project URL and anon key from Settings → API

### 3. Test Locally

```bash
# Terminal 1: Run API
python run.py

# Terminal 2: Run Frontend
cd frontend && npm run dev
```

Visit `http://localhost:3000` and test all features.

---

## Vercel Dashboard Configuration

### For Monorepo Deployment

**Root Directory:** Leave as `/` (root)

**Environment Variables:**
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase anon key
- `SECRET_KEY`: Random string (generate with `openssl rand -hex 32`)
- `FLASK_ENV`: `production`

**Build Settings:**
- Build Command: `cd frontend && npm run build`
- Output Directory: `frontend/dist`
- Install Command: `cd frontend && npm install`

### For Separate API Deployment

**Root Directory:** `/` (root)

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SECRET_KEY`
- `FLASK_ENV=production`
- `CORS_ORIGINS`: Your frontend URL

### For Separate Frontend Deployment

**Root Directory:** `frontend`

**Environment Variables:**
- `VITE_API_URL`: Your API URL (e.g., `https://ipf-api.vercel.app/api/v1`)

**Build Settings:**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

---

## Updating Data

Data ingestion cannot run on Vercel (serverless 10-second limit). Update data locally:

```bash
# On your local machine
python scripts/download_and_filter_data.py
python scripts/ingest_to_supabase.py
```

The deployed app will automatically use the updated data from Supabase.

### Automated Updates (Optional)

Set up GitHub Actions to update data monthly:

Create `.github/workflows/update-data.yml`:

```yaml
name: Update IPF Data

on:
  schedule:
    - cron: '0 0 1 * *'  # First day of month
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: python scripts/download_and_filter_data.py
      - run: python scripts/ingest_to_supabase.py
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
```

---

## Troubleshooting

### Frontend can't reach API

**Problem:** CORS errors or 404s

**Solution:**
- Monorepo: Check `vercel.json` routes are correct
- Separate: Update `VITE_API_URL` to correct API domain
- Check `CORS_ORIGINS` includes your frontend URL

### API functions timing out

**Problem:** Requests taking > 10 seconds

**Solution:**
- Add database indexes (should be in schema already)
- Upgrade to Vercel Pro for 60-second timeout
- Optimize slow queries in Supabase

### Build failures

**Problem:** Deployment fails during build

**Solution:**
- Check all dependencies in `package.json` and `requirements.txt`
- Ensure Node.js version compatibility (16+)
- Check build logs in Vercel dashboard

### Database connection issues

**Problem:** Can't connect to Supabase

**Solution:**
- Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Check Supabase project is active
- Verify row-level security policies allow read access

---

## Production URLs

After deployment, your app will be available at:

**Monorepo:**
- App: `https://ipf-scout.vercel.app`
- API: `https://ipf-scout.vercel.app/api/v1`

**Separate:**
- Frontend: `https://ipf-scout-frontend.vercel.app`
- API: `https://ipf-scout-api.vercel.app/api/v1`

---

## Custom Domain (Optional)

1. Purchase domain (e.g., `ipfscout.com`)
2. In Vercel dashboard → Domains → Add
3. Follow DNS configuration instructions
4. Update `CORS_ORIGINS` to include custom domain

---

## Costs

**Free Tier Includes:**
- Unlimited deployments
- Automatic SSL
- 100 GB bandwidth/month
- Serverless functions (with limits)

**When to upgrade:**
- Need more than 100 GB bandwidth
- Need functions > 10 seconds
- Want priority support

Supabase free tier includes:
- 500 MB database
- 50,000 monthly active users
- 2 GB file storage

Both are more than enough for this app.

---

## Getting Beta Feedback

### Share Your Beta

1. Deploy to production
2. Share URL: `https://your-app.vercel.app`
3. Create feedback form or use GitHub Issues

### Monitoring

Use Vercel Analytics (free):
1. Enable in Vercel dashboard
2. See page views, performance, errors
3. Track which features users use most

### Collecting Feedback

Add a feedback link in the app:

```tsx
// In Navigation.tsx
<a
  href="https://github.com/your-username/IPFDataExtracter/issues"
  className="text-primary-500 hover:underline"
  target="_blank"
>
  Report Issue
</a>
```

---

## Next Steps After Deployment

1. ✅ Deploy to Vercel
2. ✅ Test all features in production
3. ✅ Share with beta users
4. ✅ Collect feedback
5. ✅ Iterate and improve
6. ✅ Consider PlatformPro integration

Once you're happy with the standalone app, you can extract the components and API client for PlatformPro integration.

---

## Support

- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- GitHub Issues: https://github.com/your-username/IPFDataExtracter/issues
