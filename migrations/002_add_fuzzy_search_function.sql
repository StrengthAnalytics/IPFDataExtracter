-- Create a PostgreSQL function for fuzzy name search using pg_trgm
-- This function returns lifters whose names match the search query with a similarity score
-- Run this in your Supabase SQL Editor after running 001_enable_pg_trgm.sql

CREATE OR REPLACE FUNCTION search_lifters_by_similarity(
  search_query TEXT,
  similarity_threshold FLOAT DEFAULT 0.1,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id BIGINT,
  name TEXT,
  sex TEXT,
  country TEXT,
  total_competitions INTEGER,
  first_competition_date DATE,
  last_competition_date DATE,
  weight_classes TEXT[],
  equipment_types TEXT[],
  best_squat_kg NUMERIC,
  best_squat_date DATE,
  best_squat_meet TEXT,
  best_bench_kg NUMERIC,
  best_bench_date DATE,
  best_bench_meet TEXT,
  best_deadlift_kg NUMERIC,
  best_deadlift_date DATE,
  best_deadlift_meet TEXT,
  best_total_kg NUMERIC,
  best_total_date DATE,
  best_total_meet TEXT,
  updated_at TIMESTAMP,
  similarity_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ls.id,
    ls.name,
    ls.sex,
    ls.country,
    ls.total_competitions,
    ls.first_competition_date,
    ls.last_competition_date,
    ls.weight_classes,
    ls.equipment_types,
    ls.best_squat_kg,
    ls.best_squat_date,
    ls.best_squat_meet,
    ls.best_bench_kg,
    ls.best_bench_date,
    ls.best_bench_meet,
    ls.best_deadlift_kg,
    ls.best_deadlift_date,
    ls.best_deadlift_meet,
    ls.best_total_kg,
    ls.best_total_date,
    ls.best_total_meet,
    ls.updated_at,
    similarity(ls.name, search_query) as similarity_score
  FROM lifter_summary ls
  WHERE similarity(ls.name, search_query) > similarity_threshold
  ORDER BY similarity_score DESC
  LIMIT result_limit;
END;
$$;

-- Grant execute permission to anon users
GRANT EXECUTE ON FUNCTION search_lifters_by_similarity TO anon;

-- Test the function (optional - you can run this to verify it works)
-- SELECT * FROM search_lifters_by_similarity('john haack', 0.1, 10);
