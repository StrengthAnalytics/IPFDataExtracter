# Database Migrations

This directory contains SQL migration scripts for the IPF Data Extracter database.

## Running Migrations

These migrations need to be run manually in your Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the SQL from the migration files
4. Execute the SQL

## Migration Files

### 001_enable_pg_trgm.sql

Enables PostgreSQL's pg_trgm extension for fuzzy text search on lifter names. This improves search quality and performance by:

- Creating trigram-based similarity indexes on the `name` column in both `lifter_summary` and `lifter_records` tables
- Allowing fuzzy matching for misspelled names
- Supporting similarity scoring for better search result ranking

**Required for:** Improved lifter name search functionality

**Impact:** Better search results, especially for names with typos or partial matches
