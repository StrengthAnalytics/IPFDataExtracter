# API Reference

Complete reference for all IPF Data Extracter API endpoints.

## Base URL

**Development**: `http://localhost:5000/api/v1`
**Production**: `https://your-domain.com/api/v1`

## Authentication

Currently, the API is open and does not require authentication. Rate limiting is applied per IP address.

## Rate Limiting

- **Development**: 100 requests per hour per IP
- **Production**: 1000 requests per hour per IP

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

## Response Format

All responses are JSON with the following structure:

**Success Response:**
```json
{
  "data": { ... },
  "count": 10
}
```

**Error Response:**
```json
{
  "error": "Error message here"
}
```

## Endpoints

### Health Check

#### `GET /health`

Check if the API is running.

**Response:**
```json
{
  "status": "healthy",
  "service": "IPF Data Extracter"
}
```

---

### Search

#### `GET /api/v1/search/lifters`

Search for lifters by name with fuzzy matching and autocomplete.

**Query Parameters:**

| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| q         | string | Yes      | Search query (min 2 chars)     |
| limit     | number | No       | Max results (default: 10, max: 50) |

**Example Request:**
```bash
curl "http://localhost:5000/api/v1/search/lifters?q=haack&limit=5"
```

**Response:**
```json
{
  "query": "haack",
  "results": [
    {
      "name": "John Haack",
      "sex": "M",
      "country": "USA",
      "weight_classes": ["83", "90"],
      "equipment_types": ["Raw"],
      "last_competition_date": "2024-10-15",
      "total_competitions": 42,
      "match_score": 100
    }
  ],
  "count": 1
}
```

**Use Case:** Implement autocomplete search in your frontend.

---

### Lifter Profile

#### `GET /api/v1/lifter/<name>`

Get complete profile and statistics for a specific lifter.

**Path Parameters:**

| Parameter | Type   | Description                  |
|-----------|--------|------------------------------|
| name      | string | Lifter name (URL encoded)    |

**Example Request:**
```bash
curl "http://localhost:5000/api/v1/lifter/John%20Haack"
```

**Response:**
```json
{
  "id": 12345,
  "name": "John Haack",
  "sex": "M",
  "country": "USA",
  "total_competitions": 42,
  "first_competition_date": "2015-03-14",
  "last_competition_date": "2024-10-15",
  "weight_classes": ["83", "90"],
  "equipment_types": ["Raw"],
  "best_squat_kg": 340.0,
  "best_squat_date": "2024-08-12",
  "best_squat_meet": "USAPL Raw Nationals",
  "best_bench_kg": 227.5,
  "best_bench_date": "2024-08-12",
  "best_bench_meet": "USAPL Raw Nationals",
  "best_deadlift_kg": 352.5,
  "best_deadlift_date": "2024-08-12",
  "best_deadlift_meet": "USAPL Raw Nationals",
  "best_total_kg": 920.0,
  "best_total_date": "2024-08-12",
  "best_total_meet": "USAPL Raw Nationals",
  "competitions": [
    {
      "date": "2024-10-15",
      "meet_name": "IPF World Championships",
      "federation": "IPF",
      "equipment": "Raw",
      "weight_class_kg": "90",
      "bodyweight_kg": 89.5,
      "best3_squat_kg": 335.0,
      "best3_bench_kg": 220.0,
      "best3_deadlift_kg": 345.0,
      "total_kg": 900.0,
      "dots": 634.2,
      "wilks": 598.7,
      "place": "1"
    }
  ]
}
```

---

#### `GET /api/v1/lifter/<name>/best-lifts`

Get lifter's best lifts within a specified timeframe.

**Path Parameters:**

| Parameter | Type   | Description               |
|-----------|--------|---------------------------|
| name      | string | Lifter name (URL encoded) |

**Query Parameters:**

| Parameter    | Type   | Required | Description                          |
|--------------|--------|----------|--------------------------------------|
| years        | number | No       | Lookback period: 1, 2, or 3 (default: 3) |
| equipment    | string | No       | Filter by equipment type             |
| weight_class | string | No       | Filter by weight class               |

**Example Request:**
```bash
curl "http://localhost:5000/api/v1/lifter/John%20Haack/best-lifts?years=1&equipment=Raw"
```

**Response:**
```json
{
  "name": "John Haack",
  "timeframe_years": 1,
  "total_competitions": 8,
  "best_squat": {
    "date": "2024-08-12",
    "meet_name": "USAPL Raw Nationals",
    "federation": "USAPL",
    "equipment": "Raw",
    "weight_class_kg": "90",
    "bodyweight_kg": 89.5,
    "best3_squat_kg": 340.0,
    "squat1_kg": 320.0,
    "squat2_kg": 335.0,
    "squat3_kg": 340.0,
    "place": "1"
  },
  "best_bench": { ... },
  "best_deadlift": { ... },
  "best_total": { ... }
}
```

**Use Case:** Display lifter's recent best performances with attempt patterns.

---

#### `GET /api/v1/lifter/<name>/history`

Get lifter's competition history.

**Path Parameters:**

| Parameter | Type   | Description               |
|-----------|--------|---------------------------|
| name      | string | Lifter name (URL encoded) |

**Query Parameters:**

| Parameter | Type   | Required | Description                                |
|-----------|--------|----------|--------------------------------------------|
| limit     | number | No       | Max competitions (default: 20, max: 100)   |

**Example Request:**
```bash
curl "http://localhost:5000/api/v1/lifter/John%20Haack/history?limit=10"
```

**Response:**
```json
{
  "name": "John Haack",
  "competitions": [
    {
      "date": "2024-10-15",
      "meet_name": "IPF World Championships",
      "meet_country": "USA",
      "federation": "IPF",
      "equipment": "Raw",
      "weight_class_kg": "90",
      "bodyweight_kg": 89.5,
      "best3_squat_kg": 335.0,
      "best3_bench_kg": 220.0,
      "best3_deadlift_kg": 345.0,
      "total_kg": 900.0,
      "dots": 634.2,
      "wilks": 598.7,
      "place": "1",
      "division": "Open"
    }
  ],
  "count": 10
}
```

---

### Scouting

#### `POST /api/v1/scouting/compare`

Compare multiple lifters side-by-side for scouting reports.

**Request Body:**

| Field     | Type     | Required | Description                           |
|-----------|----------|----------|---------------------------------------|
| lifters   | string[] | Yes      | Array of lifter names (max 10)        |
| years     | number   | No       | Lookback period: 1, 2, or 3 (default: 3) |
| equipment | string   | No       | Filter by equipment type              |

**Example Request:**
```bash
curl -X POST "http://localhost:5000/api/v1/scouting/compare" \
  -H "Content-Type: application/json" \
  -d '{
    "lifters": ["John Haack", "Taylor Atwood"],
    "years": 3,
    "equipment": "Raw"
  }'
```

**Response:**
```json
{
  "timeframe_years": 3,
  "lifters": [
    {
      "name": "John Haack",
      "timeframe_years": 3,
      "total_competitions": 15,
      "best_squat": {
        "date": "2024-08-12",
        "meet_name": "USAPL Raw Nationals",
        "best3_squat_kg": 340.0,
        "squat1_kg": 320.0,
        "squat2_kg": 335.0,
        "squat3_kg": 340.0
      },
      "best_bench": { ... },
      "best_deadlift": { ... },
      "best_total": { ... }
    },
    {
      "name": "Taylor Atwood",
      "timeframe_years": 3,
      "total_competitions": 12,
      "best_squat": { ... },
      "best_bench": { ... },
      "best_deadlift": { ... },
      "best_total": { ... }
    }
  ]
}
```

**Use Case:** Generate head-to-head comparison tables for upcoming competitions.

---

### Percentiles

#### `POST /api/v1/percentile/calculate`

Calculate percentile ranking for a specific lift value.

**Request Body:**

| Field        | Type   | Required | Description                                    |
|--------------|--------|----------|------------------------------------------------|
| value        | number | Yes      | Lift value in kg                               |
| sex          | string | Yes      | 'M', 'F', or 'Mx'                             |
| equipment    | string | Yes      | Equipment type (e.g., 'Raw', 'Wraps')         |
| weight_class | string | Yes      | Weight class (e.g., '93', '84')               |
| lift_type    | string | Yes      | 'squat', 'bench', 'deadlift', or 'total'      |
| event        | string | No       | Event type (default: 'SBD')                    |

**Example Request:**
```bash
curl -X POST "http://localhost:5000/api/v1/percentile/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 200.0,
    "sex": "M",
    "equipment": "Raw",
    "weight_class": "93",
    "lift_type": "squat",
    "event": "SBD"
  }'
```

**Response:**
```json
{
  "percentile": 68.5,
  "value": 200.0,
  "sample_size": 15432,
  "mean": 185.3,
  "median": 187.5,
  "std_dev": 28.4,
  "min": 100.0,
  "max": 340.0,
  "p25": 165.0,
  "p50": 187.5,
  "p75": 210.0,
  "p90": 235.0,
  "p95": 250.0,
  "p99": 275.0,
  "criteria": {
    "sex": "M",
    "equipment": "Raw",
    "weight_class": "93",
    "lift_type": "squat",
    "event": "SBD"
  }
}
```

**Use Case:** Show users how they rank compared to other lifters.

---

#### `GET /api/v1/standards/<sex>/<weight_class>`

Get strength standards (percentile breakdowns) for a category.

**Path Parameters:**

| Parameter    | Type   | Description                  |
|--------------|--------|------------------------------|
| sex          | string | 'M', 'F', or 'Mx'           |
| weight_class | string | Weight class (e.g., '93')    |

**Query Parameters:**

| Parameter | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| equipment | string | No       | Equipment type (default: 'Raw')      |
| event     | string | No       | Event type (default: 'SBD')          |

**Example Request:**
```bash
curl "http://localhost:5000/api/v1/standards/M/93?equipment=Raw&event=SBD"
```

**Response:**
```json
{
  "sex": "M",
  "weight_class": "93",
  "equipment": "Raw",
  "event": "SBD",
  "standards": {
    "squat": {
      "beginner": 120.5,
      "novice": 155.0,
      "intermediate": 187.5,
      "advanced": 220.0,
      "elite": 255.0,
      "world_class": 285.0,
      "sample_size": 15432,
      "max_recorded": 340.0
    },
    "bench": {
      "beginner": 82.5,
      "novice": 105.0,
      "intermediate": 127.5,
      "advanced": 150.0,
      "elite": 175.0,
      "world_class": 195.0,
      "sample_size": 15432,
      "max_recorded": 227.5
    },
    "deadlift": {
      "beginner": 145.0,
      "novice": 180.0,
      "intermediate": 215.0,
      "advanced": 250.0,
      "elite": 285.0,
      "world_class": 315.0,
      "sample_size": 15432,
      "max_recorded": 352.5
    },
    "total": {
      "beginner": 350.0,
      "novice": 445.0,
      "intermediate": 532.5,
      "advanced": 622.5,
      "elite": 717.5,
      "world_class": 795.0,
      "sample_size": 15432,
      "max_recorded": 920.0
    }
  }
}
```

**Strength Level Definitions:**
- **Beginner**: 10th percentile
- **Novice**: 25th percentile
- **Intermediate**: 50th percentile (median)
- **Advanced**: 75th percentile
- **Elite**: 90th percentile
- **World Class**: 95th percentile

**Use Case:** Display strength standards charts or "what percentile am I?" calculators.

---

### Utility Endpoints

#### `GET /api/v1/equipment-types`

Get list of all equipment types.

**Response:**
```json
{
  "equipment_types": [
    "Raw",
    "Wraps",
    "Single-ply",
    "Multi-ply",
    "Unlimited",
    "Straps"
  ]
}
```

---

#### `GET /api/v1/weight-classes`

Get weight classes by sex.

**Query Parameters:**

| Parameter | Type   | Required | Description            |
|-----------|--------|----------|------------------------|
| sex       | string | No       | Filter by 'M' or 'F'   |

**Example Request:**
```bash
curl "http://localhost:5000/api/v1/weight-classes?sex=M"
```

**Response:**
```json
{
  "sex": "M",
  "weight_classes": ["59", "66", "74", "83", "93", "105", "120", "120+"]
}
```

**Without sex parameter:**
```json
{
  "M": ["59", "66", "74", "83", "93", "105", "120", "120+"],
  "F": ["47", "52", "57", "63", "69", "76", "84", "84+"]
}
```

---

#### `GET /api/v1/stats`

Get database statistics.

**Response:**
```json
{
  "total_records": 147853,
  "unique_lifters": 42156,
  "latest_competition": "2024-11-15"
}
```

---

## Error Codes

| Status Code | Description                                          |
|-------------|------------------------------------------------------|
| 200         | Success                                              |
| 400         | Bad Request (missing/invalid parameters)             |
| 404         | Not Found (lifter or data not found)                 |
| 429         | Too Many Requests (rate limit exceeded)              |
| 500         | Internal Server Error                                |

## Common Error Responses

**Missing Required Parameter:**
```json
{
  "error": "Missing required field: lifters"
}
```

**Lifter Not Found:**
```json
{
  "error": "Lifter not found"
}
```

**Rate Limit Exceeded:**
```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

## Data Freshness

The database is updated manually by running the data ingestion scripts. To check the latest competition date in the database:

```bash
curl "http://localhost:5000/api/v1/stats"
```

The `latest_competition` field shows the most recent competition in the database.

## Pagination

Currently, pagination is handled via the `limit` parameter on list endpoints. Future versions may include cursor-based pagination for better performance.

## Caching

Percentile calculations are cached for 7 days to improve performance. Cache is automatically invalidated when new data is ingested.

## SDK Examples

### JavaScript/TypeScript

```typescript
class IPFDataAPI {
  private baseURL = 'http://localhost:5000/api/v1';

  async searchLifters(query: string, limit = 10) {
    const response = await fetch(
      `${this.baseURL}/search/lifters?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return response.json();
  }

  async getLifterProfile(name: string) {
    const response = await fetch(
      `${this.baseURL}/lifter/${encodeURIComponent(name)}`
    );
    return response.json();
  }

  async compareLifters(lifters: string[], years = 3, equipment?: string) {
    const response = await fetch(`${this.baseURL}/scouting/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lifters, years, equipment })
    });
    return response.json();
  }

  async calculatePercentile(params: {
    value: number;
    sex: string;
    equipment: string;
    weight_class: string;
    lift_type: string;
    event?: string;
  }) {
    const response = await fetch(`${this.baseURL}/percentile/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return response.json();
  }

  async getStrengthStandards(
    sex: string,
    weightClass: string,
    equipment = 'Raw',
    event = 'SBD'
  ) {
    const response = await fetch(
      `${this.baseURL}/standards/${sex}/${weightClass}?equipment=${equipment}&event=${event}`
    );
    return response.json();
  }
}

export const ipfApi = new IPFDataAPI();
```

### Python

```python
import requests

class IPFDataAPI:
    def __init__(self, base_url='http://localhost:5000/api/v1'):
        self.base_url = base_url

    def search_lifters(self, query, limit=10):
        response = requests.get(
            f'{self.base_url}/search/lifters',
            params={'q': query, 'limit': limit}
        )
        return response.json()

    def get_lifter_profile(self, name):
        response = requests.get(
            f'{self.base_url}/lifter/{name}'
        )
        return response.json()

    def compare_lifters(self, lifters, years=3, equipment=None):
        data = {'lifters': lifters, 'years': years}
        if equipment:
            data['equipment'] = equipment

        response = requests.post(
            f'{self.base_url}/scouting/compare',
            json=data
        )
        return response.json()

    def calculate_percentile(self, value, sex, equipment, weight_class, lift_type, event='SBD'):
        response = requests.post(
            f'{self.base_url}/percentile/calculate',
            json={
                'value': value,
                'sex': sex,
                'equipment': equipment,
                'weight_class': weight_class,
                'lift_type': lift_type,
                'event': event
            }
        )
        return response.json()

api = IPFDataAPI()
```

## Support

For questions or issues:
- GitHub: https://github.com/StrengthAnalytics/IPFDataExtracter/issues
- Email: support@strengthanalytics.com
