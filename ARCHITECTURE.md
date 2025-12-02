# IPF Data Extracter - Technical Architecture

> **Purpose**: This document provides deep technical details for understanding, maintaining, and porting this application. Designed for AI assistants (Claude) and developers.

## Table of Contents
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Component Structure](#component-structure)
- [API Layer](#api-layer)
- [Database Schema](#database-schema)
- [Key Patterns](#key-patterns)
- [State Management](#state-management)
- [Performance Optimizations](#performance-optimizations)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Client)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  React Application (TypeScript + Vite)                 │ │
│  │                                                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │ │
│  │  │   Pages      │  │  Components  │  │   Types     │ │ │
│  │  │ - Scout      │  │ - LifterSrch │  │ - Lifter    │ │ │
│  │  │ - Profile    │  │              │  │ - Comp      │ │ │
│  │  └──────┬───────┘  └──────────────┘  └─────────────┘ │ │
│  │         │                                             │ │
│  │         ▼                                             │ │
│  │  ┌────────────────────────────┐                      │ │
│  │  │   Services Layer           │                      │ │
│  │  │   (supabaseApi.ts)         │                      │ │
│  │  └──────────┬─────────────────┘                      │ │
│  │             │                                         │ │
│  └─────────────┼─────────────────────────────────────────┘ │
│                │                                           │
│                │ Supabase Client (@supabase/supabase-js)  │
│                │                                           │
└────────────────┼───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│             Supabase Backend (Cloud)                       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  PostgreSQL Database                                 │ │
│  │  - lifter_records (150K+ rows)                       │ │
│  │  - lifter_summary (40K+ rows)                        │ │
│  │  - pg_trgm extension (fuzzy search)                  │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  PostgREST API (Auto-generated)                      │ │
│  │  - RESTful endpoints for all tables                  │ │
│  │  - Row Level Security enforcement                    │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### Technology Layers

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Build Tool** | Vite 5 | Fast dev server, optimized production builds |
| **Framework** | React 18 | UI rendering, component composition |
| **Language** | TypeScript 5 | Type safety, developer experience |
| **Routing** | React Router 6 | Client-side navigation |
| **Styling** | Tailwind CSS 3 | Utility-first styling |
| **Backend** | Supabase | BaaS, PostgreSQL, auth-ready |
| **Database** | PostgreSQL 15 | Relational database with pg_trgm |

---

## Data Flow

### 1. Lifter Search Flow

```
User types in search box (300ms debounce)
         ↓
LifterSearch component (src/components/LifterSearch.tsx)
         ↓
api.searchLifters(query, limit, weightClass?)
         ↓
Supabase query: lifter_summary table
  - Filter: name ILIKE '%query%'
  - Optional: weight_class filter
  - Limit: 10 results
         ↓
Client-side: Calculate match scores
         ↓
Client-side: Sort by match score DESC
         ↓
Display autocomplete dropdown with results
         ↓
User selects lifter → onSelectLifter callback
```

**Key Files:**
- `src/components/LifterSearch.tsx:40-53` - Debounced search logic
- `src/services/supabaseApi.ts:28-74` - Search API implementation
- `src/services/supabaseApi.ts:459-474` - Match score calculation

### 2. Scout Page (Multi-Lifter Comparison) Flow

```
User adds lifters + adjusts filters (weightClass, startDate, endDate)
         ↓
useEffect hook triggers (Scout.tsx:42-67)
  Dependencies: [selectedLifters, startDate, endDate, weightClass]
         ↓
api.compareLifters(lifters[], startDate, endDate, equipment?, weightClass?)
         ↓
Promise.all() - Parallel queries for each lifter
  api.getBestLiftsInDateRange(name, startDate, endDate, equipment, weightClass)
         ↓
Supabase query: lifter_records table FOR EACH LIFTER
  - Filter: name = lifter
  - Filter: date >= startDate (if provided)
  - Filter: date <= endDate (if provided)
  - Filter: weight_class_kg = weightClass (if provided)
         ↓
Server-side: Find best lifts for each type (squat, bench, deadlift, total)
         ↓
Return BestLifts[] array
         ↓
Client-side: Sort by selected column (default: total DESC)
         ↓
Render comparison table with sortable columns
```

**Key Files:**
- `src/pages/Scout.tsx:42-67` - Auto-update useEffect
- `src/pages/Scout.tsx:93-146` - Sorting logic
- `src/services/supabaseApi.ts:182-247` - Comparison API

### 3. Lifter Profile Page Flow

```
URL: /lifter/:name → useParams() extracts name
         ↓
useEffect triggers on mount (LifterProfile.tsx:22-35)
         ↓
api.getLifterProfile(decodeURIComponent(name))
         ↓
Parallel Supabase queries:
  1. lifter_summary: Get aggregated stats
  2. lifter_records: Get last 20 competitions (ordered by date DESC)
         ↓
Merge data into LifterProfile object
         ↓
Store in component state
         ↓
User adjusts filters (weightClass, startDate, endDate)
         ↓
Client-side filtering: getFilteredAndSortedCompetitions()
  - Filter by weight_class_kg
  - Filter by date range
  - Sort by selected column
         ↓
Re-render table with filtered/sorted results (instant)
```

**Key Files:**
- `src/pages/LifterProfile.tsx:22-35` - Data fetching
- `src/pages/LifterProfile.tsx:61-142` - Filtering and sorting
- `src/services/supabaseApi.ts:68-112` - Profile API

---

## Component Structure

### Component Hierarchy

```
App.tsx (Root)
├── Router
    ├── Home (/)
    ├── Scout (/scout)
    │   ├── LifterSearch (reusable)
    │   └── Comparison Table
    ├── LifterProfile (/lifter/:name)
    │   └── Competition History Table
    ├── Percentile (/percentile)
    └── Standards (/standards)
```

### Key Components

#### 1. LifterSearch Component
**Location:** `src/components/LifterSearch.tsx`

**Props:**
```typescript
interface LifterSearchProps {
  onSelectLifter: (lifter: LifterSearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  weightClass?: string; // Optional filter
}
```

**State:**
- `query: string` - Search input value
- `results: LifterSearchResult[]` - Search results
- `isLoading: boolean` - Loading state
- `showResults: boolean` - Dropdown visibility

**Key Features:**
- 300ms debounce on input
- Click-outside detection to close dropdown
- Weight class filtering support
- Match score ranking

**Usage Example:**
```typescript
<LifterSearch
  onSelectLifter={(lifter) => setSelectedLifters([...selected, lifter.name])}
  placeholder="Search for lifters..."
  weightClass={selectedWeightClass} // Optional
/>
```

#### 2. Scout Page
**Location:** `src/pages/Scout.tsx`

**State:**
```typescript
selectedLifters: string[]          // Array of lifter names
comparisonData: BestLifts[] | null // Comparison results
startDate: string                  // ISO date string
endDate: string                    // ISO date string
weightClass: string                // Weight class filter
sortColumn: SortColumn             // Current sort column
sortDirection: SortDirection       // 'asc' | 'desc'
isLoading: boolean                 // Loading state
```

**Key Features:**
- Auto-updates on filter/lifter changes (useEffect with dependencies)
- Supports up to 10 lifters
- Sortable columns (click headers)
- Dynamic date range filtering
- Weight class filtering

**useEffect Dependencies:**
```typescript
useEffect(() => {
  // Fetch comparison data
}, [selectedLifters, startDate, endDate, weightClass]);
// Auto-triggers when ANY dependency changes
```

#### 3. LifterProfile Page
**Location:** `src/pages/LifterProfile.tsx`

**State:**
```typescript
profile: LifterProfileType | null  // Full profile data
sortColumn: CompSortColumn         // Current sort column
sortDirection: SortDirection       // 'asc' | 'desc'
weightClass: string                // Filter
startDate: string                  // Filter
endDate: string                    // Filter
```

**Key Features:**
- Client-side filtering (instant feedback)
- Sortable competition table
- Shows filtered count vs total count
- IPFGL points column

**Filtering Pattern:**
```typescript
const getFilteredAndSortedCompetitions = (competitions: Competition[]) => {
  let filtered = competitions;
  if (weightClass) filtered = filtered.filter(comp => comp.weight_class_kg === weightClass);
  if (startDate) filtered = filtered.filter(comp => comp.date >= startDate);
  if (endDate) filtered = filtered.filter(comp => comp.date <= endDate);
  return filtered.sort(sortFunction);
};
```

---

## API Layer

### Service Architecture

**File:** `src/services/supabaseApi.ts`

```typescript
export const api = {
  // Search
  searchLifters(query, limit, weightClass?): Promise<SearchResults>

  // Lifter Data
  getLifterProfile(name): Promise<LifterProfile>
  getCompetitionHistory(name, limit): Promise<CompHistory>

  // Comparison
  compareLifters(lifters[], startDate?, endDate?, equipment?, weightClass?): Promise<ComparisonData>
  getBestLiftsInDateRange(name, startDate?, endDate?, equipment?, weightClass?): Promise<BestLifts>

  // Legacy (still used)
  getBestLifts(name, years, equipment?, weightClass?): Promise<BestLifts>

  // Stats
  getWeightClasses(sex?): Promise<WeightClasses>
  getEquipmentTypes(): Promise<EquipmentTypes>
  getStats(): Promise<DBStats>

  // Analytics
  calculatePercentile(params): Promise<PercentileData>
  getStrengthStandards(sex, weightClass, equipment, event, ageClass): Promise<StrengthStandards>

  // Health
  healthCheck(): Promise<HealthStatus>
};
```

### Query Examples

#### Search Lifters with Weight Class Filter
```typescript
// src/services/supabaseApi.ts:28-74
async searchLifters(query: string, limit = 10, weightClass?: string) {
  // 1. Query database with ILIKE
  const { data } = await supabase
    .from('lifter_summary')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(limit * 2); // Over-fetch for filtering

  // 2. Transform to SearchResults
  let results = data.map(lifter => ({
    name: lifter.name,
    weight_classes: lifter.weight_classes,
    match_score: calculateMatchScore(lifter.name, query)
  }));

  // 3. Filter by weight class (client-side)
  if (weightClass) {
    results = results.filter(l => l.weight_classes.includes(weightClass));
  }

  // 4. Sort by match score
  results.sort((a, b) => b.match_score - a.match_score);

  return results.slice(0, limit);
}
```

#### Get Best Lifts in Date Range
```typescript
// src/services/supabaseApi.ts:202-247
async getBestLiftsInDateRange(name, startDate?, endDate?, equipment?, weightClass?) {
  // Build query with optional filters
  let query = supabase
    .from('lifter_records')
    .select('*')
    .eq('name', name);

  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);
  if (weightClass) query = query.eq('weight_class_kg', weightClass);

  const { data } = await query;

  // Find best lifts from filtered records
  return {
    name,
    best_squat: findBestLift(data, 'best3_squat_kg'),
    best_bench: findBestLift(data, 'best3_bench_kg'),
    best_deadlift: findBestLift(data, 'best3_deadlift_kg'),
    best_total: findBestLift(data, 'total_kg'),
    total_competitions: data.length
  };
}
```

---

## Database Schema

### Table: `lifter_summary`
**Purpose:** Aggregated athlete statistics (one row per lifter)

```sql
CREATE TABLE lifter_summary (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,              -- Unique athlete name
  sex TEXT,                                -- 'M' or 'F'
  country TEXT,                            -- Country code
  total_competitions INTEGER,              -- Total meets competed
  first_competition_date DATE,             -- Career start
  last_competition_date DATE,              -- Most recent meet
  weight_classes TEXT[],                   -- Array of weight classes (e.g., ['74', '83'])
  equipment_types TEXT[],                  -- Array of equipment (e.g., ['Raw', 'Wraps'])

  -- Best Squat
  best_squat_kg NUMERIC,
  best_squat_date DATE,
  best_squat_meet TEXT,

  -- Best Bench
  best_bench_kg NUMERIC,
  best_bench_date DATE,
  best_bench_meet TEXT,

  -- Best Deadlift
  best_deadlift_kg NUMERIC,
  best_deadlift_date DATE,
  best_deadlift_meet TEXT,

  -- Best Total
  best_total_kg NUMERIC,
  best_total_date DATE,
  best_total_meet TEXT,

  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_lifter_summary_name ON lifter_summary(name);
CREATE INDEX idx_lifter_summary_name_trgm ON lifter_summary USING GIN (name gin_trgm_ops);
```

**Rows:** ~40,000 unique lifters

### Table: `lifter_records`
**Purpose:** Individual competition results (one row per meet entry)

```sql
CREATE TABLE lifter_records (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,                      -- Athlete name (not unique)
  sex TEXT,                                -- 'M' or 'F'
  date DATE,                               -- Competition date

  -- Meet Info
  meet_name TEXT,
  meet_country TEXT,
  federation TEXT,                         -- e.g., 'USAPL', 'CPU'

  -- Competition Details
  equipment TEXT,                          -- 'Raw', 'Wraps', 'Single-ply', 'Multi-ply'
  weight_class_kg TEXT,                    -- e.g., '74', '83', '93'
  bodyweight_kg NUMERIC,                   -- Actual bodyweight
  division TEXT,                           -- e.g., 'Open', 'M-O'
  event TEXT,                              -- 'SBD', 'B', 'D'

  -- Lift Attempts (kg)
  squat1_kg NUMERIC,
  squat2_kg NUMERIC,
  squat3_kg NUMERIC,
  squat4_kg NUMERIC,                       -- Optional 4th attempt
  best3_squat_kg NUMERIC,                  -- Best of 3 attempts

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

  total_kg NUMERIC,                        -- Sum of best lifts

  -- Scores
  dots NUMERIC,                            -- DOTS score
  wilks NUMERIC,                           -- Wilks score
  glossbrenner NUMERIC,                    -- Glossbrenner score
  goodlift NUMERIC,                        -- IPFGL points

  -- Results
  place TEXT,                              -- '1', '2', 'DQ', 'G' (guest)
  tested TEXT,                             -- Drug testing status

  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_lifter_records_name ON lifter_records(name);
CREATE INDEX idx_lifter_records_date ON lifter_records(date);
CREATE INDEX idx_lifter_records_sex_equipment_weightclass
  ON lifter_records(sex, equipment, weight_class_kg);
CREATE INDEX idx_lifter_records_name_trgm ON lifter_records USING GIN (name gin_trgm_ops);
```

**Rows:** ~150,000 competition entries

### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE lifter_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifter_summary ENABLE ROW LEVEL SECURITY;

-- Allow public read-only access
CREATE POLICY "Allow public read access" ON lifter_records
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public read access" ON lifter_summary
  FOR SELECT TO anon USING (true);
```

**Security Model:**
- Anonymous users can SELECT (read) all data
- No INSERT, UPDATE, or DELETE allowed from client
- Data is effectively read-only

---

## Key Patterns

### 1. Dynamic Filtering with useEffect

**Pattern:** Auto-update results when filters change

```typescript
// Dependencies array triggers effect when values change
useEffect(() => {
  if (selectedLifters.length >= 2) {
    fetchComparisonData();
  }
}, [selectedLifters, startDate, endDate, weightClass]);
```

**Use Cases:**
- Scout page: Auto-fetch comparison when filters change
- Any real-time filtering requirement

### 2. Client-Side Filtering (Instant Feedback)

**Pattern:** Filter data already in memory

```typescript
const getFiltered = (items: Item[]) => {
  let filtered = items;
  if (filter1) filtered = filtered.filter(item => item.field === filter1);
  if (filter2) filtered = filtered.filter(item => item.date >= filter2);
  return filtered.sort(sortFunction);
};
```

**Use Cases:**
- Lifter profile page: Filter competitions instantly
- When data is already loaded and filtering is simple

### 3. Sortable Columns

**Pattern:** Click header to sort, click again to reverse

```typescript
const handleSort = (column: SortColumn) => {
  if (sortColumn === column) {
    // Same column: toggle direction
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  } else {
    // New column: default to descending (highest first)
    setSortColumn(column);
    setSortDirection('desc');
  }
};

// Render with click handler
<th onClick={() => handleSort('total')}>
  Total<SortIcon column="total" />
</th>
```

**Features:**
- Visual indicators (↑/↓)
- Multi-type sorting (numbers, strings, dates)
- Configurable default direction

### 4. Debounced Search

**Pattern:** Wait for user to stop typing before searching

```typescript
useEffect(() => {
  if (debounceTimer.current) {
    clearTimeout(debounceTimer.current);
  }

  debounceTimer.current = setTimeout(async () => {
    // Perform search after 300ms of no typing
    const results = await api.searchLifters(query);
    setResults(results);
  }, 300);

  return () => clearTimeout(debounceTimer.current);
}, [query]);
```

**Benefits:**
- Reduces API calls (better performance, lower costs)
- Improves UX (fewer intermediate results)

### 5. Reusable Components with Optional Props

**Pattern:** Components that work standalone or with filters

```typescript
interface Props {
  onSelect: (item: Item) => void;
  filter?: string; // Optional filter
}

export function Component({ onSelect, filter }: Props) {
  // If filter provided, use it; otherwise show all
  useEffect(() => {
    fetchData(filter);
  }, [filter]);
}
```

**Use Cases:**
- LifterSearch component (works with/without weight class filter)
- Any component that needs optional filtering

---

## State Management

### No Global State Library

**Approach:** Component-level state with React hooks

**Rationale:**
- Simple application with limited shared state
- Data fetched per-page (not shared across routes)
- No need for Redux/Zustand complexity

### State Patterns

#### 1. Local Component State
```typescript
const [data, setData] = useState<Data | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

#### 2. URL Parameters for State
```typescript
// Lifter profile uses URL param
const { name } = useParams<{ name: string }>();
// Allows bookmarking, sharing links
```

#### 3. Derived State (Computed Values)
```typescript
// Don't store in state - compute on render
const filteredData = useMemo(() => {
  return data.filter(applyFilters);
}, [data, filters]);
```

---

## Performance Optimizations

### Current Optimizations

1. **Database Indexes** - Fast queries even with 150K+ rows
2. **Debounced Search** - Reduces API calls
3. **Client-Side Filtering** - Instant feedback on LifterProfile page
4. **Limited Result Sets** - Only fetch what's needed
5. **Vite Build Optimizations** - Code splitting, tree shaking

### Metrics

- Search: < 500ms
- Profile Load: < 300ms
- Comparison: < 1s (for 2-3 lifters)
- Client Filtering: < 10ms (instant)

### Future Optimizations (Next.js)

1. **Server-Side Rendering (SSR)** - Faster initial page load
2. **Static Site Generation (SSG)** - Pre-render popular lifter pages
3. **API Route Caching** - Cache comparison results
4. **React Server Components** - Reduce client bundle
5. **Edge Functions** - Global CDN deployment

---

## TypeScript Types

### Core Types

```typescript
// Lifter search result
interface LifterSearchResult {
  name: string;
  sex: string;
  country: string;
  weight_classes: string[];
  equipment_types: string[];
  last_competition_date: string;
  total_competitions: number;
  match_score: number; // Client-calculated
}

// Competition entry
interface Competition {
  date: string;
  meet_name: string;
  federation: string;
  equipment: string;
  weight_class_kg: string;
  bodyweight_kg: number;
  best3_squat_kg?: number;
  best3_bench_kg?: number;
  best3_deadlift_kg?: number;
  total_kg?: number;
  dots?: number;
  wilks?: number;
  goodlift?: number; // IPFGL points
  place: string;
}

// Full lifter profile
interface LifterProfile {
  id: number;
  name: string;
  sex: string;
  country: string;
  total_competitions: number;
  best_squat_kg?: number;
  best_squat_date?: string;
  best_squat_meet?: string;
  // ... similar for bench, deadlift, total
  competitions: Competition[]; // Last 20
}

// Best lifts with full attempt details
interface BestLifts {
  name: string;
  timeframe_years: number;
  total_competitions: number;
  best_squat?: LiftAttempts;
  best_bench?: LiftAttempts;
  best_deadlift?: LiftAttempts;
  best_total?: LiftAttempts;
}
```

**Location:** `src/types/index.ts`

---

## Error Handling

### API Error Class

```typescript
class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}
```

### Error Handling Pattern

```typescript
try {
  const data = await api.searchLifters(query);
  setResults(data.results);
} catch (error) {
  console.error('Search error:', error);
  // Optionally show user-friendly message
  setError('Failed to search lifters');
}
```

---

## Next Steps

For migrating to Next.js, see **[NEXTJS_MIGRATION.md](./NEXTJS_MIGRATION.md)**

For feature history, see **[CHANGELOG.md](./CHANGELOG.md)**
