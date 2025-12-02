# Database Migrations

This directory contains SQL migration scripts for the IPF Data Extracter database.

## Running Migrations

These migrations need to be run manually in your Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the SQL from the migration files
4. Execute the SQL

## Migration Files

### 001_enable_pg_trgm.sql ✅

Enables PostgreSQL's pg_trgm extension for fuzzy text search on lifter names. This improves search quality and performance by:

- Creating trigram-based similarity indexes on the `name` column in both `lifter_summary` and `lifter_records` tables
- Allowing fuzzy matching for misspelled names
- Supporting similarity scoring for better search result ranking

**Required for:** Improved lifter name search functionality

**Impact:** Better search results, especially for names with typos or partial matches

**Test Query:**
```sql
SELECT name, similarity(name, 'john haack') as score
FROM lifter_summary
WHERE similarity(name, 'john haack') > 0.1
ORDER BY score DESC
LIMIT 10;
```

---

### 002_add_fuzzy_search_function.sql ⏳

Creates a PostgreSQL function that leverages pg_trgm for fuzzy lifter name search. This function:

- Accepts a search query and similarity threshold
- Returns lifters ranked by similarity score
- Handles typos and misspellings automatically
- Grants execute permission to anonymous users

**Required for:** Application code to use fuzzy search (requires 001 to be run first)

**Impact:** Enables true typo-tolerant search in the application

**Important:** After running this migration, you must also deploy the updated application code that calls this function via `.rpc('search_lifters_by_similarity', ...)`. See `src/services/supabaseApi.ts:37`.

**Test Query:**
```sql
-- Test with correct spelling
SELECT name, similarity_score
FROM search_lifters_by_similarity('john haack', 0.1, 10);

-- Test with typos (should still work!)
SELECT name, similarity_score
FROM search_lifters_by_similarity('jon haak', 0.1, 10);
```

**Expected Result:** Both queries should return "John Haack" with high similarity scores.

---

## Deployment Checklist

When deploying fuzzy search:

- [x] Run `001_enable_pg_trgm.sql` in Supabase SQL Editor
- [ ] Run `002_add_fuzzy_search_function.sql` in Supabase SQL Editor
- [ ] Test the function with the test queries above
- [ ] Deploy updated application code to Vercel/production
- [ ] Test search with typos in the deployed app

---

## Troubleshooting

### "function search_lifters_by_similarity does not exist"
You need to run migration `002_add_fuzzy_search_function.sql`.

### Search still returns exact matches only
1. Verify both migrations are applied (run test queries above)
2. Ensure updated code is deployed (check git commit SHA)
3. Clear browser cache and hard refresh (Ctrl+Shift+R)

### How to verify migrations are working:

**Check pg_trgm extension:**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
```

**Check function exists:**
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'search_lifters_by_similarity';
```

**Check indexes exist:**
```sql
SELECT indexname
FROM pg_indexes
WHERE tablename IN ('lifter_summary', 'lifter_records')
AND indexname LIKE '%trgm%';
```
