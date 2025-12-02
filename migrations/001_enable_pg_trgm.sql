-- Enable pg_trgm extension for fuzzy text search
-- Run this in your Supabase SQL Editor

-- Enable the pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index on lifter_summary.name for fast similarity searches
CREATE INDEX IF NOT EXISTS idx_lifter_summary_name_trgm ON lifter_summary USING GIN (name gin_trgm_ops);

-- Optional: Also index the lifter_records table if needed
CREATE INDEX IF NOT EXISTS idx_lifter_records_name_trgm ON lifter_records USING GIN (name gin_trgm_ops);

-- Test the similarity function (optional - you can run this to verify it works)
-- SELECT name, similarity(name, 'john haack') as score
-- FROM lifter_summary
-- WHERE similarity(name, 'john haack') > 0.1
-- ORDER BY score DESC
-- LIMIT 10;
