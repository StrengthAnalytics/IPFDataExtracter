# API Reference

Complete reference for the IPF Scout client-side API service layer.

## Architecture

IPF Scout uses a **direct Supabase client architecture** - no backend REST API server. All database queries are made directly from the React frontend using the Supabase JavaScript client.

**Key Files:**
- `src/services/supabaseApi.ts` - All API methods
- `src/services/api.ts` - API exports
- `src/config/supabase.ts` - Supabase client configuration

## Authentication

Database access is controlled via Supabase Row Level Security (RLS) policies. The application uses the anonymous public key for read-only access.

## Rate Limiting

Rate limiting is handled automatically by Supabase based on your project tier. The free tier provides generous limits for most use cases.

## Response Format

All API methods return Promise-based responses with TypeScript types:

**Success:**
```typescript
const lifters: LifterSearchResult[] = await api.searchLifters('haack');
```

**Error Handling:**
```typescript
try {
  const data = await api.searchLifters('query');
} catch (error) {
  console.error('API Error:', error);
}
```

## API Methods

### Health Check

#### `api.healthCheck()`

Check if the Supabase connection is working.

**Returns:** `Promise<{ status: string; service: string }>`

**Example:**
```typescript
const health = await api.healthCheck();
// { status: 'healthy', service: 'IPF Data Extracter (Supabase)' }
```

---

### Search

#### `api.searchLifters(query, limit?, weightClass?, useFuzzySearch?)`

Search for lifters by name with optional fuzzy matching.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| query | string | Yes | - | Search query (min 2 chars) |
| limit | number | No | 10 | Max results |
| weightClass | string | No | - | Filter by weight class |
| useFuzzySearch | boolean | No | false | Enable typo-tolerant search |

**Returns:** `Promise<{ query: string; results: LifterSearchResult[]; count: number }>`

**Example:**
```typescript
const results = await api.searchLifters('haack', 5, undefined, true);
// Returns lifters matching "haack" with fuzzy tolerance
```

**Response:**
```typescript
{
  query: "haack",
  results: [
    {
      name: "John Haack",
      sex: "M",
      country: "USA",
      weight_classes: ["83", "90"],
      equipment_types: ["Raw"],
      last_competition_date: "2024-10-15",
      total_competitions: 42,
      match_score: 100
    }
  ],
  count: 1
}
```

---

### Lifter Profiles

#### `api.getLifterProfile(name)`

Get complete profile for a lifter including competition history.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Exact lifter name |

**Returns:** `Promise<LifterProfile>`

**Example:**
```typescript
const profile = await api.getLifterProfile('John Haack');
```

**Response:**
```typescript
{
  id: 12345,
  name: "John Haack",
  sex: "M",
  country: "USA",
  total_competitions: 42,
  first_competition_date: "2012-05-15",
  last_competition_date: "2024-10-15",
  weight_classes: ["83", "90"],
  equipment_types: ["Raw"],
  best_squat_kg: 320.5,
  best_squat_date: "2023-08-20",
  best_squat_meet: "2023 USAPL Raw Nationals",
  // ... other best lifts
  competitions: [/* array of Competition objects */]
}
```

---

### Scouting & Comparison

#### `api.compareLifters(lifters, startDate?, endDate?, equipment?, weightClass?, aggregationMode?, rankingMethod?)`

Compare multiple lifters with advanced analytics.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| lifters | string[] | Yes | - | Array of lifter names (max 10) |
| startDate | string | No | - | ISO date string (YYYY-MM-DD) |
| endDate | string | No | - | ISO date string (YYYY-MM-DD) |
| equipment | string | No | - | Filter by equipment type |
| weightClass | string | No | - | Filter by weight class |
| aggregationMode | 'byLift' \| 'byComp' | No | 'byLift' | Data aggregation mode |
| rankingMethod | 'total' \| 'ipfgl' | No | 'total' | Ranking metric |

**Aggregation Modes:**
- `byLift`: Cherry-pick best result for each lift across all competitions
- `byComp`: All lifts from the competition with best total/IPF GL

**Ranking Methods:**
- `total`: Rank by total weight lifted
- `ipfgl`: Rank by IPF Goodlift points (weight-class normalized)

**Returns:** `Promise<ComparisonData>`

**Example:**
```typescript
const comparison = await api.compareLifters(
  ['John Haack', 'Taylor Atwood'],
  '2022-01-01',
  '2024-12-31',
  undefined,
  undefined,
  'byLift',
  'ipfgl'
);
```

**Response:**
```typescript
{
  timeframe_years: 0,
  lifters: [
    {
      name: "John Haack",
      timeframe_years: 0,
      total_competitions: 15,
      best_squat: {
        date: "2023-08-20",
        meet_name: "2023 USAPL Raw Nationals",
        best3_squat_kg: 320.5,
        squat1_kg: 305,
        squat2_kg: 315,
        squat3_kg: 320.5,
        // ... other lift details
        goodlift: 652.3
      },
      best_bench: { /* LiftAttempts */ },
      best_deadlift: { /* LiftAttempts */ },
      best_total: {
        date: "2024-10-15",
        meet_name: "2024 IPF World Championships",
        total_kg: 900.0,
        goodlift: 712.5,
        // ... all lifts from this comp if byComp mode
      }
    }
  ]
}
```

---

#### `api.getBestLiftsInDateRange(name, startDate?, endDate?, equipment?, weightClass?, aggregationMode?, rankingMethod?)`

Get best lifts for a single lifter within a date range.

**Parameters:** Same as `compareLifters` but for a single lifter name (string).

**Returns:** `Promise<BestLifts>`

---

#### `api.getBestLifts(name, years?, equipment?, weightClass?)`

Get best lifts for a lifter within the last N years.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| name | string | Yes | - | Lifter name |
| years | number | No | 3 | Lookback period (1, 2, or 3) |
| equipment | string | No | - | Filter by equipment |
| weightClass | string | No | - | Filter by weight class |

**Returns:** `Promise<BestLifts>`

---

#### `api.getCompetitionHistory(name, limit?)`

Get competition history for a lifter.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| name | string | Yes | - | Lifter name |
| limit | number | No | 20 | Max competitions to return |

**Returns:** `Promise<{ name: string; competitions: Competition[]; count: number }>`

---

### Strength Standards

#### `api.getStrengthStandards(sex, weightClass, equipment?, event?, ageClass?)`

Get strength standards for a category.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| sex | string | Yes | - | 'M' or 'F' |
| weightClass | string | Yes | - | Weight class (e.g., '83', '84+') |
| equipment | string | No | 'Raw' | Equipment type |
| event | string | No | 'SBD' | Event type |
| ageClass | string | No | 'Open' | Age class |

**Returns:** `Promise<StrengthStandards>`

**Example:**
```typescript
const standards = await api.getStrengthStandards('M', '83', 'Raw', 'SBD', 'Open');
```

**Response:**
```typescript
{
  sex: "M",
  weight_class: "83",
  equipment: "Raw",
  event: "SBD",
  standards: {
    squat: {
      average: 192.5,
      good: 217.5,
      strong: 240,
      elite: 252.5,
      world_class: 280,
      sample_size: 50000,
      max_recorded: 336
    },
    // ... bench, deadlift, total
  }
}
```

---

### Utility Methods

#### `api.getStats()`

Get database statistics.

**Returns:** `Promise<{ total_records: number; unique_lifters: number; latest_competition: string }>`

---

#### `api.getWeightClasses(sex?)`

Get available weight classes.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sex | string | No | 'M' or 'F' (omit for both) |

**Returns:** `Promise<{ M?: string[]; F?: string[]; sex?: string; weight_classes?: string[] }>`

---

#### `api.getEquipmentTypes()`

Get available equipment types.

**Returns:** `Promise<{ equipment_types: string[] }>`

---

### Lifter Analytics (v1.2.0)

#### `api.getOpenerTendencies(name)`

Get opener tendencies (average opener percentage) for a lifter.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Lifter name |

**Returns:** `Promise<OpenerTendencies>`

**Example:**
```typescript
const tendencies = await api.getOpenerTendencies('John Haack');
```

**Response:**
```typescript
{
  squat: { average: 92.1, min: 89.5, max: 95.0, competitions: 8 },
  bench: { average: 94.3, min: 91.0, max: 97.5, competitions: 8 },
  deadlift: { average: 88.7, min: 85.0, max: 92.0, competitions: 8 }
}
```

**Calculation:**
- `opener_percentage = (Math.abs(attempt1) / best3_lift) × 100`
- Only includes competitions where lifter completed the lift (best3 > 0)
- Filters out unreasonable percentages (<50% or >110%)

---

#### `api.getJumpPatterns(name)`

Get jump pattern statistics (weight increases between attempts) for a lifter.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Lifter name |

**Returns:** `Promise<JumpPatterns>`

**Example:**
```typescript
const jumps = await api.getJumpPatterns('John Haack');
```

**Response:**
```typescript
{
  squat: {
    firstJump: { average: 7.5, min: 5, max: 10, count: 8 },
    secondJump: { average: 5.0, min: 2.5, max: 7.5, count: 7 }
  },
  bench: {
    firstJump: { average: 5.0, min: 2.5, max: 7.5, count: 8 },
    secondJump: { average: 2.5, min: 0, max: 5, count: 6 }
  },
  deadlift: {
    firstJump: { average: 10.0, min: 7.5, max: 15, count: 8 },
    secondJump: { average: 7.5, min: 5, max: 10, count: 7 }
  }
}
```

**Calculation:**
- `first_jump = Math.abs(attempt2) - Math.abs(attempt1)`
- `second_jump = Math.abs(attempt3) - Math.abs(attempt2)`
- Only includes jumps where both attempts exist
- Filters out unreasonable jumps (<-20kg or >30kg)

---

#### `api.getAttemptSuccessRates(name)`

Get make/miss rates for each attempt number (1st, 2nd, 3rd) per lift.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Lifter name |

**Returns:** `Promise<SuccessRates>`

**Example:**
```typescript
const rates = await api.getAttemptSuccessRates('John Haack');
```

**Response:**
```typescript
{
  squat: {
    attempt1: { rate: 96, made: 24, total: 25 },
    attempt2: { rate: 84, made: 21, total: 25 },
    attempt3: { rate: 52, made: 13, total: 25 }
  },
  bench: {
    attempt1: { rate: 100, made: 25, total: 25 },
    attempt2: { rate: 88, made: 22, total: 25 },
    attempt3: { rate: 64, made: 16, total: 25 }
  },
  deadlift: {
    attempt1: { rate: 92, made: 23, total: 25 },
    attempt2: { rate: 80, made: 20, total: 25 },
    attempt3: { rate: 48, made: 12, total: 25 }
  }
}
```

**Calculation:**
- `attempts_taken = count where value is not null and not 0`
- `successful = count where value > 0`
- `success_rate = (successful / attempts_taken) × 100`
- Positive numbers = successful lift, negative = failed lift

---

## TypeScript Types

All types are defined in `src/types/index.ts`:

### LifterSearchResult
```typescript
interface LifterSearchResult {
  name: string;
  sex: string;
  country: string;
  weight_classes: string[];
  equipment_types: string[];
  last_competition_date: string;
  total_competitions: number;
  match_score: number;
}
```

### LiftAttempts
```typescript
interface LiftAttempts {
  date: string;
  meet_name: string;
  federation: string;
  equipment: string;
  weight_class_kg: string;
  bodyweight_kg: number;
  best3_squat_kg?: number;
  squat1_kg?: number;  // Negative values indicate failed attempts
  squat2_kg?: number;
  squat3_kg?: number;
  best3_bench_kg?: number;
  bench1_kg?: number;
  bench2_kg?: number;
  bench3_kg?: number;
  best3_deadlift_kg?: number;
  deadlift1_kg?: number;
  deadlift2_kg?: number;
  deadlift3_kg?: number;
  total_kg?: number;
  goodlift?: number;  // IPF GL points
  place: string;
}
```

### BestLifts
```typescript
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

### ComparisonData
```typescript
interface ComparisonData {
  timeframe_years: number;
  lifters: BestLifts[];
}
```

### Competition
```typescript
interface Competition {
  date: string;
  meet_name: string;
  meet_country?: string;
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
  goodlift?: number;
  place: string;
  division?: string;
}
```

### OpenerTendencies (v1.2.0)
```typescript
interface OpenerTendency {
  average: number;  // Average opener percentage
  min: number;      // Minimum opener percentage
  max: number;      // Maximum opener percentage
  competitions: number;  // Number of competitions analyzed
}

interface OpenerTendencies {
  squat: OpenerTendency | null;
  bench: OpenerTendency | null;
  deadlift: OpenerTendency | null;
}
```

### JumpPatterns (v1.2.0)
```typescript
interface JumpStats {
  average: number;  // Average jump in kg
  min: number;      // Minimum jump
  max: number;      // Maximum jump
  count: number;    // Number of jumps analyzed
}

interface LiftJumps {
  firstJump: JumpStats | null;   // 1st→2nd attempt jump
  secondJump: JumpStats | null;  // 2nd→3rd attempt jump
}

interface JumpPatterns {
  squat: LiftJumps | null;
  bench: LiftJumps | null;
  deadlift: LiftJumps | null;
}
```

### SuccessRates (v1.2.0)
```typescript
interface AttemptRate {
  rate: number;   // Success rate percentage (0-100)
  made: number;   // Number of successful attempts
  total: number;  // Total attempts taken
}

interface LiftSuccessRates {
  attempt1: AttemptRate | null;
  attempt2: AttemptRate | null;
  attempt3: AttemptRate | null;
}

interface SuccessRates {
  squat: LiftSuccessRates | null;
  bench: LiftSuccessRates | null;
  deadlift: LiftSuccessRates | null;
}
```

## Error Handling

All API methods throw `APIError` on failure:

```typescript
class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}
```

**Common Status Codes:**
- `404`: Resource not found (lifter, data, etc.)
- `500`: Database/Supabase error

**Example Error Handling:**
```typescript
try {
  const profile = await api.getLifterProfile('Unknown Lifter');
} catch (error) {
  if (error instanceof APIError) {
    if (error.status === 404) {
      console.log('Lifter not found');
    } else {
      console.error('Database error:', error.message);
    }
  }
}
```

## Performance Tips

1. **Use Fuzzy Search Sparingly**: Fuzzy search is slower than exact matching. Only enable when needed for typo tolerance.

2. **Limit Date Ranges**: Smaller date ranges return faster. The default 3-year lookback is optimized for most use cases.

3. **Filter Early**: Use `weightClass` and `equipment` filters to reduce data transfer.

4. **Cache Results**: The data is static (read-only), so feel free to cache results client-side.

5. **Batch Comparisons**: Use `compareLifters` with multiple names instead of calling `getBestLifts` multiple times.

## Database Schema

The API queries two main tables in Supabase:

### `lifter_records`
Individual competition records with all lift attempts and scores.

**Key Indexes:**
- `idx_lifter_records_name` on `name`
- `idx_lifter_records_date` on `date`
- `idx_lifter_records_sex_equipment_weightclass` on `(sex, equipment, weight_class_kg)`

### `lifter_summary`
Aggregated lifter statistics and career bests.

**Key Indexes:**
- `idx_lifter_summary_name` on `name`

Both tables use Row Level Security (RLS) with public read access via the anonymous key.

## Support

For API issues or questions:
- **GitHub Issues**: [Report an issue](https://github.com/StrengthAnalytics/IPFDataExtracter/issues)
- **Documentation**: See README.md and ARCHITECTURE.md
