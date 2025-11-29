"""Ingest filtered OpenPowerlifting data into Supabase."""
import os
import sys
import pandas as pd
from pathlib import Path
from datetime import datetime

# Import database module from same directory
from app.models.database import db


def prepare_record(row: pd.Series) -> dict:
    """Convert a DataFrame row to a database record.

    Args:
        row: Pandas Series representing one record

    Returns:
        Dictionary formatted for Supabase insertion
    """
    # Helper to convert NaN to None
    def clean_value(val):
        if pd.isna(val):
            return None
        return val

    # Convert date to string format
    date_val = clean_value(row.get('Date'))
    if date_val and isinstance(date_val, pd.Timestamp):
        date_val = date_val.strftime('%Y-%m-%d')

    record = {
        'name': clean_value(row.get('Name')),
        'sex': clean_value(row.get('Sex')),
        'event': clean_value(row.get('Event')),
        'equipment': clean_value(row.get('Equipment')),
        'age': clean_value(row.get('Age')),
        'age_class': clean_value(row.get('AgeClass')),
        'birth_year_class': clean_value(row.get('BirthYearClass')),
        'division': clean_value(row.get('Division')),
        'bodyweight_kg': clean_value(row.get('BodyweightKg')),
        'weight_class_kg': clean_value(row.get('WeightClassKg')),

        # Squat attempts
        'squat1_kg': clean_value(row.get('Squat1Kg')),
        'squat2_kg': clean_value(row.get('Squat2Kg')),
        'squat3_kg': clean_value(row.get('Squat3Kg')),
        'squat4_kg': clean_value(row.get('Squat4Kg')),
        'best3_squat_kg': clean_value(row.get('Best3SquatKg')),

        # Bench attempts
        'bench1_kg': clean_value(row.get('Bench1Kg')),
        'bench2_kg': clean_value(row.get('Bench2Kg')),
        'bench3_kg': clean_value(row.get('Bench3Kg')),
        'bench4_kg': clean_value(row.get('Bench4Kg')),
        'best3_bench_kg': clean_value(row.get('Best3BenchKg')),

        # Deadlift attempts
        'deadlift1_kg': clean_value(row.get('Deadlift1Kg')),
        'deadlift2_kg': clean_value(row.get('Deadlift2Kg')),
        'deadlift3_kg': clean_value(row.get('Deadlift3Kg')),
        'deadlift4_kg': clean_value(row.get('Deadlift4Kg')),
        'best3_deadlift_kg': clean_value(row.get('Best3DeadliftKg')),

        # Total and place
        'total_kg': clean_value(row.get('TotalKg')),
        'place': clean_value(row.get('Place')),

        # Scoring
        'dots': clean_value(row.get('Dots')),
        'wilks': clean_value(row.get('Wilks')),
        'glossbrenner': clean_value(row.get('Glossbrenner')),
        'goodlift': clean_value(row.get('Goodlift')),

        # Additional info
        'tested': clean_value(row.get('Tested')) == 'Yes',
        'country': clean_value(row.get('Country')),
        'state': clean_value(row.get('State')),

        # Federation and meet info
        'federation': clean_value(row.get('Federation')),
        'parent_federation': clean_value(row.get('ParentFederation')),
        'date': date_val,
        'meet_country': clean_value(row.get('MeetCountry')),
        'meet_state': clean_value(row.get('MeetState')),
        'meet_name': clean_value(row.get('MeetName')),
        'sanctioned': clean_value(row.get('Sanctioned')) != 'No',
    }

    return record


def batch_insert(records: list, batch_size: int = 1000):
    """Insert records in batches.

    Args:
        records: List of records to insert
        batch_size: Number of records per batch
    """
    total = len(records)
    print(f"\nInserting {total:,} records in batches of {batch_size}...")

    for i in range(0, total, batch_size):
        batch = records[i:i + batch_size]
        try:
            result = db.get_table('lifter_records').insert(batch).execute()
            progress = min(i + batch_size, total)
            percent = (progress / total) * 100
            print(f"\rProgress: {progress:,}/{total:,} ({percent:.1f}%)", end='', flush=True)
        except Exception as e:
            print(f"\n❌ Error inserting batch {i}-{i+batch_size}: {e}")
            raise

    print("\n✓ All records inserted successfully")


def generate_lifter_summaries():
    """Generate lifter summary records for quick lookups."""
    print("\nGenerating lifter summaries...")

    # This query aggregates data for each lifter
    query = """
    INSERT INTO lifter_summary (
        name, sex, country,
        total_competitions,
        first_competition_date,
        last_competition_date,
        weight_classes,
        equipment_types,
        best_squat_kg, best_squat_date, best_squat_meet,
        best_bench_kg, best_bench_date, best_bench_meet,
        best_deadlift_kg, best_deadlift_date, best_deadlift_meet,
        best_total_kg, best_total_date, best_total_meet
    )
    SELECT
        name,
        MAX(sex) as sex,
        MAX(country) as country,
        COUNT(*) as total_competitions,
        MIN(date) as first_competition_date,
        MAX(date) as last_competition_date,
        jsonb_agg(DISTINCT weight_class_kg) FILTER (WHERE weight_class_kg IS NOT NULL) as weight_classes,
        jsonb_agg(DISTINCT equipment) FILTER (WHERE equipment IS NOT NULL) as equipment_types,

        -- Best squat
        (SELECT best3_squat_kg FROM lifter_records lr2
         WHERE lr2.name = lr.name AND lr2.best3_squat_kg IS NOT NULL
         ORDER BY lr2.best3_squat_kg DESC LIMIT 1) as best_squat_kg,
        (SELECT date FROM lifter_records lr2
         WHERE lr2.name = lr.name AND lr2.best3_squat_kg IS NOT NULL
         ORDER BY lr2.best3_squat_kg DESC LIMIT 1) as best_squat_date,
        (SELECT meet_name FROM lifter_records lr2
         WHERE lr2.name = lr.name AND lr2.best3_squat_kg IS NOT NULL
         ORDER BY lr2.best3_squat_kg DESC LIMIT 1) as best_squat_meet,

        -- Best bench
        (SELECT best3_bench_kg FROM lifter_records lr2
         WHERE lr2.name = lr.name AND lr2.best3_bench_kg IS NOT NULL
         ORDER BY lr2.best3_bench_kg DESC LIMIT 1) as best_bench_kg,
        (SELECT date FROM lifter_records lr2
         WHERE lr2.name = lr.name AND lr2.best3_bench_kg IS NOT NULL
         ORDER BY lr2.best3_bench_kg DESC LIMIT 1) as best_bench_date,
        (SELECT meet_name FROM lifter_records lr2
         WHERE lr2.name = lr.name AND lr2.best3_bench_kg IS NOT NULL
         ORDER BY lr2.best3_bench_kg DESC LIMIT 1) as best_bench_meet,

        -- Best deadlift
        (SELECT best3_deadlift_kg FROM lifter_records lr2
         WHERE lr2.name = lr.name AND lr2.best3_deadlift_kg IS NOT NULL
         ORDER BY lr2.best3_deadlift_kg DESC LIMIT 1) as best_deadlift_kg,
        (SELECT date FROM lifter_records lr2
         WHERE lr2.name = lr.name AND lr2.best3_deadlift_kg IS NOT NULL
         ORDER BY lr2.best3_deadlift_kg DESC LIMIT 1) as best_deadlift_date,
        (SELECT meet_name FROM lifter_records lr2
         WHERE lr2.name = lr.name AND lr2.best3_deadlift_kg IS NOT NULL
         ORDER BY lr2.best3_deadlift_kg DESC LIMIT 1) as best_deadlift_meet,

        -- Best total
        (SELECT total_kg FROM lifter_records lr2
         WHERE lr2.name = lr.name AND lr2.total_kg IS NOT NULL
         ORDER BY lr2.total_kg DESC LIMIT 1) as best_total_kg,
        (SELECT date FROM lifter_records lr2
         WHERE lr2.name = lr.name AND lr2.total_kg IS NOT NULL
         ORDER BY lr2.total_kg DESC LIMIT 1) as best_total_date,
        (SELECT meet_name FROM lifter_records lr2
         WHERE lr2.name = lr.name AND lr2.total_kg IS NOT NULL
         ORDER BY lr2.total_kg DESC LIMIT 1) as best_total_meet

    FROM lifter_records lr
    GROUP BY name
    ON CONFLICT (name) DO UPDATE SET
        total_competitions = EXCLUDED.total_competitions,
        last_competition_date = EXCLUDED.last_competition_date,
        weight_classes = EXCLUDED.weight_classes,
        equipment_types = EXCLUDED.equipment_types,
        best_squat_kg = EXCLUDED.best_squat_kg,
        best_squat_date = EXCLUDED.best_squat_date,
        best_squat_meet = EXCLUDED.best_squat_meet,
        best_bench_kg = EXCLUDED.best_bench_kg,
        best_bench_date = EXCLUDED.best_bench_date,
        best_bench_meet = EXCLUDED.best_bench_meet,
        best_deadlift_kg = EXCLUDED.best_deadlift_kg,
        best_deadlift_date = EXCLUDED.best_deadlift_date,
        best_deadlift_meet = EXCLUDED.best_deadlift_meet,
        best_total_kg = EXCLUDED.best_total_kg,
        best_total_date = EXCLUDED.best_total_date,
        best_total_meet = EXCLUDED.best_total_meet,
        updated_at = NOW();
    """

    try:
        result = db.client.rpc('execute_sql', {'query': query}).execute()
        print("✓ Lifter summaries generated successfully")
    except Exception as e:
        print(f"⚠ Could not generate summaries via RPC. You may need to run this SQL manually:")
        print(query)
        print(f"\nError: {e}")


def ingest_data(csv_path: str, batch_size: int = 1000):
    """Ingest data from CSV to Supabase.

    Args:
        csv_path: Path to the filtered CSV file
        batch_size: Number of records to insert per batch
    """
    print(f"Reading data from {csv_path}...")
    df = pd.read_csv(csv_path)

    print(f"Total records to ingest: {len(df):,}")

    # Convert DataFrame to list of records
    print("Preparing records...")
    records = []
    for idx, row in df.iterrows():
        try:
            record = prepare_record(row)
            records.append(record)

            if (idx + 1) % 10000 == 0:
                print(f"\rPrepared {idx + 1:,} records...", end='', flush=True)
        except Exception as e:
            print(f"\n⚠ Error preparing record at index {idx}: {e}")
            continue

    print(f"\n✓ Prepared {len(records):,} records")

    # Insert in batches
    batch_insert(records, batch_size)

    # Generate summaries
    generate_lifter_summaries()

    print("\n✅ Data ingestion complete!")


def main():
    """Main execution function."""
    csv_path = 'data/openpowerlifting-ipf-filtered.csv'

    if not os.path.exists(csv_path):
        print(f"❌ Filtered CSV not found at {csv_path}")
        print("Please run download_and_filter_data.py first")
        sys.exit(1)

    try:
        ingest_data(csv_path)
    except Exception as e:
        print(f"\n❌ Error during ingestion: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
