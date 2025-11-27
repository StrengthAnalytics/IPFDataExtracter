"""Download and filter OpenPowerlifting data."""
import os
import sys
import zipfile
import requests
import pandas as pd
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import Config


def download_opl_data(url: str, output_dir: str = 'data') -> str:
    """Download OpenPowerlifting CSV data.

    Args:
        url: URL to download the zip file from
        output_dir: Directory to save the downloaded file

    Returns:
        Path to the extracted CSV file
    """
    print(f"Downloading OpenPowerlifting data from {url}...")

    # Create data directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    # Download the zip file
    zip_path = os.path.join(output_dir, 'openpowerlifting-latest.zip')
    response = requests.get(url, stream=True)
    response.raise_for_status()

    total_size = int(response.headers.get('content-length', 0))
    downloaded = 0

    with open(zip_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            downloaded += len(chunk)
            f.write(chunk)
            if total_size > 0:
                percent = (downloaded / total_size) * 100
                print(f"\rDownloading: {percent:.1f}%", end='', flush=True)

    print(f"\n✓ Downloaded to {zip_path}")

    # Extract the zip file
    print("Extracting CSV file...")
    csv_path = None
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        # Find the main CSV file
        for name in zip_ref.namelist():
            if name.endswith('.csv') and 'openpowerlifting' in name.lower():
                csv_path = os.path.join(output_dir, 'openpowerlifting-full.csv')
                with zip_ref.open(name) as source, open(csv_path, 'wb') as target:
                    target.write(source.read())
                break

    if not csv_path:
        raise FileNotFoundError("Could not find CSV file in the zip archive")

    print(f"✓ Extracted to {csv_path}")
    return csv_path


def filter_ipf_data(csv_path: str, output_path: str = None) -> pd.DataFrame:
    """Filter data for IPF federations and recent years.

    Args:
        csv_path: Path to the full CSV file
        output_path: Optional path to save filtered CSV

    Returns:
        Filtered DataFrame
    """
    print(f"\nReading CSV file (this may take a moment)...")
    df = pd.read_csv(csv_path, low_memory=False)

    print(f"Total records: {len(df):,}")

    # Convert date column to datetime
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')

    # Filter for data from 2022 onwards
    start_date = Config.DATA_START_DATE
    print(f"\nFiltering for dates >= {start_date.date()}...")
    df_filtered = df[df['Date'] >= start_date].copy()
    print(f"Records after date filter: {len(df_filtered):,}")

    # Filter for IPF-affiliated federations
    ipf_federations = Config.IPF_FEDERATIONS
    print(f"\nFiltering for IPF federations: {', '.join(ipf_federations)}...")

    # Check ParentFederation for IPF or Federation contains IPF affiliates
    df_filtered = df_filtered[
        (df_filtered['ParentFederation'] == 'IPF') |
        (df_filtered['Federation'].isin(ipf_federations))
    ].copy()

    print(f"Records after federation filter: {len(df_filtered):,}")

    # Display some statistics
    print("\n=== Filtered Data Statistics ===")
    print(f"Date range: {df_filtered['Date'].min().date()} to {df_filtered['Date'].max().date()}")
    print(f"Unique lifters: {df_filtered['Name'].nunique():,}")
    print(f"Unique meets: {df_filtered['MeetName'].nunique():,}")
    print(f"\nFederations:")
    print(df_filtered['Federation'].value_counts().head(10))

    # Save filtered data if output path provided
    if output_path:
        print(f"\nSaving filtered data to {output_path}...")
        df_filtered.to_csv(output_path, index=False)
        print(f"✓ Saved {len(df_filtered):,} records")

    return df_filtered


def main():
    """Main execution function."""
    try:
        # Download data
        csv_path = download_opl_data(Config.OPL_CSV_URL)

        # Filter data
        output_path = 'data/openpowerlifting-ipf-filtered.csv'
        df_filtered = filter_ipf_data(csv_path, output_path)

        print("\n✅ Data download and filtering complete!")
        print(f"Filtered dataset: {output_path}")
        print(f"Total records: {len(df_filtered):,}")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
