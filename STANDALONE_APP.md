# IPF Scout - Standalone Beta Application

Complete powerlifting scouting platform with React frontend and Flask API backend.

## 🎯 What Is This?

IPF Scout is a **standalone web application** for powerlifting scouting and analysis. It's designed to:

1. **Run independently** before PlatformPro integration
2. **Gather user feedback** in live beta
3. **Test and iterate** without affecting PlatformPro users
4. **Demonstrate the full feature set** to stakeholders

## ✨ Features

### For Lifters
- 🔍 **Search any IPF lifter** with autocomplete
- 👤 **View complete profiles** with competition history and PRs
- 📊 **Calculate percentiles** to see how you rank
- 🎯 **Check strength standards** from beginner to world-class

### For Coaches & Scouts
- 🏋️ **Compare lifters** side-by-side with best lifts
- 📈 **Analyze opening attempts** and competition strategies
- 📅 **Track performance trends** over time
- 🔬 **Access 150,000+ meet results** from IPF federations

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Vercel Deployment                  │
│                                                     │
│  ┌──────────────────┐      ┌──────────────────┐  │
│  │  React Frontend  │─────▶│   Flask API      │  │
│  │  (Port 3000)     │      │   (Port 5000)    │  │
│  │                  │      │                  │  │
│  │  - TypeScript    │      │  - Python 3.11   │  │
│  │  - Tailwind CSS  │      │  - Flask         │  │
│  │  - React Router  │      │  - Serverless    │  │
│  └──────────────────┘      └──────────────────┘  │
│           │                          │            │
│           │                          │            │
│           └──────────┬───────────────┘            │
│                      │                             │
└──────────────────────┼─────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │    Supabase     │
              │  (PostgreSQL)   │
              │                 │
              │  150K+ Records  │
              └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 16+
- Supabase account (free)
- ~2GB disk space

### 1. Clone and Setup Backend

```bash
# Clone repository
git clone https://github.com/StrengthAnalytics/IPFDataExtracter.git
cd IPFDataExtracter

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add Supabase credentials
```

### 2. Setup Supabase Database

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to SQL Editor
4. Run SQL from `app/models/schema.py` (3 tables)
5. Copy URL and anon key to `.env`

### 3. Load Data

```bash
# Download and filter OpenPowerlifting data
python scripts/download_and_filter_data.py

# Ingest to Supabase (~15-20 minutes)
python scripts/ingest_to_supabase.py
```

### 4. Setup Frontend

```bash
# In a new terminal
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set: VITE_API_URL=http://localhost:5000/api/v1
```

### 5. Run the App

```bash
# Terminal 1: Start API
python run.py

# Terminal 2: Start Frontend
cd frontend && npm run dev
```

Visit `http://localhost:3000` 🎉

## 📦 What's Included

### Frontend (`/frontend`)
- Modern React 18 + TypeScript
- Tailwind CSS for styling
- React Router for navigation
- Responsive design
- 5 main pages:
  - Home with search
  - Scouting comparison
  - Lifter profiles
  - Percentile calculator
  - Strength standards

### Backend (`/api`, `/app`)
- Flask REST API
- 11 endpoints
- Supabase integration
- CORS enabled
- Rate limiting
- Serverless-ready

### Data Scripts (`/scripts`)
- Download OpenPowerlifting data
- Filter for IPF federations (2022+)
- Ingest to Supabase
- ~150,000 competition records

## 🌐 Deploying for Beta

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for complete deployment guide.

### Quick Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (from project root)
vercel

# Add environment variables in dashboard
# Deploy to production
vercel --prod
```

Your app will be live at `https://your-project.vercel.app`!

## 🧪 Beta Testing

### Share Your Beta

1. Deploy to Vercel (free)
2. Share URL with users
3. Collect feedback via GitHub Issues or form

### Gathering Feedback

Key questions for beta users:
- Is the search fast and accurate?
- Are the comparisons useful for scouting?
- Do the percentiles match expectations?
- What features are missing?
- Any bugs or errors?

### Monitoring

Enable Vercel Analytics (free):
- See page views and performance
- Track user engagement
- Monitor errors

## 📊 Data Coverage

- **Federations**: IPF, USAPL, CPU, EPF, BP
- **Date Range**: 2022 - Present
- **Records**: ~150,000 competition entries
- **Unique Lifters**: ~40,000+
- **Data Source**: [OpenPowerlifting](https://www.openpowerlifting.org/)

## 🔄 Updating Data

Run locally (monthly or as needed):

```bash
python scripts/download_and_filter_data.py
python scripts/ingest_to_supabase.py
```

The deployed app automatically uses updated data from Supabase.

## 🎨 Customization

### Branding

Edit in `frontend/src/components/Navigation.tsx`:
```tsx
<div className="text-xl font-bold text-white">Your Brand</div>
```

### Colors

Edit `frontend/tailwind.config.js`:
```js
colors: {
  primary: {
    // Your brand colors
  }
}
```

### Features

All features are modular. Remove pages you don't need from:
- `frontend/src/App.tsx` (routes)
- `frontend/src/components/Navigation.tsx` (nav links)

## 🔗 PlatformPro Integration

Once beta testing is complete:

### 1. Export Components

```bash
# Copy reusable components
cp -r frontend/src/components /path/to/PlatformPro/src/
```

### 2. Export API Client

```bash
# Copy API service
cp frontend/src/services/api.ts /path/to/PlatformPro/src/services/ipfApi.ts
```

### 3. Import in PlatformPro

```tsx
import { LifterSearch } from './components/LifterSearch';
import { api as ipfApi } from './services/ipfApi';
```

The standalone app serves as a full working reference for integration.

## 📝 Project Structure

```
IPFDataExtracter/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API integration
│   │   └── types/            # TypeScript types
│   └── package.json
├── api/                      # Vercel serverless functions
│   └── index.py
├── app/                      # Flask application
│   ├── api/routes.py         # API endpoints
│   ├── services/             # Business logic
│   └── models/               # Database models
├── scripts/                  # Data ingestion
│   ├── download_and_filter_data.py
│   └── ingest_to_supabase.py
├── config.py                 # Configuration
├── run.py                    # Local dev server
└── DEPLOYMENT.md             # Deployment guide
```

## 🐛 Troubleshooting

### Frontend can't connect to API

**Check:**
1. API is running on port 5000
2. `VITE_API_URL` in frontend `.env` is correct
3. CORS is enabled in API config

### Slow searches

**Solutions:**
1. Ensure database indexes are created
2. Check Supabase connection
3. Test locally vs production

### Data ingestion fails

**Common issues:**
1. Supabase credentials incorrect
2. Tables not created
3. Network timeout (use batching)

See full troubleshooting in [DEPLOYMENT.md](DEPLOYMENT.md).

## 💰 Costs

**Completely free for beta:**
- Vercel: Free tier (100GB bandwidth/month)
- Supabase: Free tier (500MB database)
- Domain (optional): ~$12/year

Perfect for beta testing with hundreds of users.

## 📈 Metrics to Track

- Daily active users
- Most searched lifters
- Feature usage (scouting vs percentile)
- Average session duration
- Conversion to PlatformPro signups

## 🎯 Success Criteria for Beta

Before integrating with PlatformPro:
- [ ] 50+ beta users tested the app
- [ ] Search works smoothly for all users
- [ ] No critical bugs reported
- [ ] Performance is acceptable (< 2s page loads)
- [ ] Users find value in scouting features
- [ ] Positive feedback on UI/UX

## 📧 Support

- **GitHub Issues**: Report bugs and request features
- **Email**: support@strengthanalytics.com
- **Discord**: (Add your community link)

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## Next Steps

1. ✅ **Deploy** the standalone app
2. ✅ **Test** thoroughly
3. ✅ **Share** with beta users
4. ✅ **Iterate** based on feedback
5. ✅ **Integrate** with PlatformPro when ready

**This is your sandbox to experiment, test, and perfect the features before they go into PlatformPro!**

Good luck with your beta! 🚀
