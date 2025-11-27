"""Database schema definitions for Supabase tables."""

# SQL Schema for Supabase
# Run these commands in your Supabase SQL editor

LIFTER_RECORDS_TABLE = """
-- Lifter records table (individual competition entries)
CREATE TABLE IF NOT EXISTS lifter_records (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sex TEXT,
    event TEXT,
    equipment TEXT,
    age NUMERIC,
    age_class TEXT,
    birth_year_class TEXT,
    division TEXT,
    bodyweight_kg NUMERIC,
    weight_class_kg TEXT,

    -- Squat attempts
    squat1_kg NUMERIC,
    squat2_kg NUMERIC,
    squat3_kg NUMERIC,
    squat4_kg NUMERIC,
    best3_squat_kg NUMERIC,

    -- Bench attempts
    bench1_kg NUMERIC,
    bench2_kg NUMERIC,
    bench3_kg NUMERIC,
    bench4_kg NUMERIC,
    best3_bench_kg NUMERIC,

    -- Deadlift attempts
    deadlift1_kg NUMERIC,
    deadlift2_kg NUMERIC,
    deadlift3_kg NUMERIC,
    deadlift4_kg NUMERIC,
    best3_deadlift_kg NUMERIC,

    -- Total and place
    total_kg NUMERIC,
    place TEXT,

    -- Scoring
    dots NUMERIC,
    wilks NUMERIC,
    glossbrenner NUMERIC,
    goodlift NUMERIC,

    -- Additional info
    tested BOOLEAN DEFAULT false,
    country TEXT,
    state TEXT,

    -- Federation and meet info
    federation TEXT,
    parent_federation TEXT,
    date DATE NOT NULL,
    meet_country TEXT,
    meet_state TEXT,
    meet_name TEXT,
    sanctioned BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_lifter_name ON lifter_records(name);
CREATE INDEX IF NOT EXISTS idx_date ON lifter_records(date);
CREATE INDEX IF NOT EXISTS idx_federation ON lifter_records(federation);
CREATE INDEX IF NOT EXISTS idx_parent_federation ON lifter_records(parent_federation);
CREATE INDEX IF NOT EXISTS idx_weight_class ON lifter_records(weight_class_kg);
CREATE INDEX IF NOT EXISTS idx_sex ON lifter_records(sex);
CREATE INDEX IF NOT EXISTS idx_equipment ON lifter_records(equipment);
CREATE INDEX IF NOT EXISTS idx_name_date ON lifter_records(name, date DESC);

-- Full text search index for names
CREATE INDEX IF NOT EXISTS idx_lifter_name_fts ON lifter_records USING gin(to_tsvector('english', name));

-- Composite index for percentile calculations
CREATE INDEX IF NOT EXISTS idx_percentile_lookup ON lifter_records(
    sex,
    equipment,
    weight_class_kg,
    event
) WHERE total_kg IS NOT NULL;
"""

PERCENTILE_CACHE_TABLE = """
-- Percentile cache table for faster lookups
CREATE TABLE IF NOT EXISTS percentile_cache (
    id BIGSERIAL PRIMARY KEY,
    sex TEXT NOT NULL,
    equipment TEXT NOT NULL,
    weight_class_kg TEXT NOT NULL,
    event TEXT NOT NULL,
    age_class TEXT,
    lift_type TEXT NOT NULL, -- 'squat', 'bench', 'deadlift', 'total'

    -- Percentile data (stored as JSONB for flexibility)
    percentile_data JSONB NOT NULL,

    -- Metadata
    sample_size INTEGER,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint
    UNIQUE(sex, equipment, weight_class_kg, event, age_class, lift_type)
);

CREATE INDEX IF NOT EXISTS idx_percentile_lookup ON percentile_cache(
    sex, equipment, weight_class_kg, event, lift_type
);
"""

LIFTER_SUMMARY_TABLE = """
-- Lifter summary table for quick profile lookups
CREATE TABLE IF NOT EXISTS lifter_summary (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sex TEXT,
    country TEXT,

    -- Competition stats
    total_competitions INTEGER DEFAULT 0,
    first_competition_date DATE,
    last_competition_date DATE,

    -- Weight classes competed in (JSONB array)
    weight_classes JSONB,

    -- Equipment types used (JSONB array)
    equipment_types JSONB,

    -- Best lifts across all competitions
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

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lifter_summary_name ON lifter_summary(name);
CREATE INDEX IF NOT EXISTS idx_lifter_summary_name_fts ON lifter_summary USING gin(to_tsvector('english', name));
"""

# Row Level Security (RLS) - Optional but recommended
RLS_POLICIES = """
-- Enable RLS
ALTER TABLE lifter_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE percentile_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifter_summary ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (adjust based on your needs)
CREATE POLICY "Allow public read access" ON lifter_records FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON percentile_cache FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON lifter_summary FOR SELECT USING (true);

-- Service role bypass (for your backend to write)
CREATE POLICY "Allow service role all access" ON lifter_records FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role all access" ON percentile_cache FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role all access" ON lifter_summary FOR ALL USING (auth.role() = 'service_role');
"""
