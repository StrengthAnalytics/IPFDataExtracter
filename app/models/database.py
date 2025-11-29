"""Supabase database connection for data ingestion scripts."""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


class SupabaseDB:
    """Wrapper for Supabase client used by data ingestion scripts."""

    def __init__(self):
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_KEY')

        if not url or not key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_KEY must be set in environment variables. "
                "Copy .env.example to .env and add your Supabase credentials."
            )

        self.client: Client = create_client(url, key)

    def get_table(self, table_name: str):
        """Get a table reference for queries.

        Args:
            table_name: Name of the table

        Returns:
            Supabase table reference
        """
        return self.client.table(table_name)


# Global database instance
db = SupabaseDB()
