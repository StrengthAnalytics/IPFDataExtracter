"""Database connection and queries using Supabase."""
from supabase import create_client, Client
from config import Config


class Database:
    """Supabase database connection manager."""

    _instance = None
    _client: Client = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize Supabase client."""
        if self._client is None:
            if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
                raise ValueError("Supabase credentials not configured")
            self._client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)

    @property
    def client(self) -> Client:
        """Get Supabase client."""
        return self._client

    def get_table(self, table_name: str):
        """Get a table reference."""
        return self._client.table(table_name)


# Singleton instance
db = Database()
