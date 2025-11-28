# IPF Scout - Frontend

React + TypeScript + Vite frontend for the IPF powerlifting scouting platform.

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
# Build
npm run build

# Preview build
npm run preview
```

## Features

- **Lifter Search**: Autocomplete search with fuzzy matching
- **Scouting Reports**: Compare multiple lifters side-by-side
- **Lifter Profiles**: Detailed competition history and personal bests
- **Percentile Calculator**: See how lifts rank against IPF database
- **Strength Standards**: Benchmarks from beginner to world-class

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Zustand (state management)

## Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

For production, set to your deployed API URL.

## Project Structure

```
src/
├── components/     # Reusable components
├── pages/          # Page components
├── services/       # API integration
├── types/          # TypeScript types
├── App.tsx         # Main app component
└── main.tsx        # Entry point
```

## Deployment

See [DEPLOYMENT.md](../DEPLOYMENT.md) for Vercel deployment instructions.

## API Integration

The app connects to the Flask API backend. Make sure the API is running:

```bash
# In the project root
python run.py
```

Or configure `VITE_API_URL` to point to your deployed API.
