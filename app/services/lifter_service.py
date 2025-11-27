"""Service layer for lifter-related operations."""
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from rapidfuzz import fuzz, process
from app.models.database import db


class LifterService:
    """Service for lifter search and profile operations."""

    @staticmethod
    def search_lifters(query: str, limit: int = 10) -> List[Dict]:
        """Search for lifters by name with fuzzy matching.

        Args:
            query: Search query string
            limit: Maximum number of results to return

        Returns:
            List of lifter matches with metadata
        """
        if not query or len(query) < 2:
            return []

        # Use full-text search for initial filtering
        try:
            # PostgreSQL full-text search
            result = db.get_table('lifter_summary').select(
                'name',
                'sex',
                'country',
                'weight_classes',
                'equipment_types',
                'last_competition_date',
                'total_competitions'
            ).ilike('name', f'%{query}%').limit(limit * 2).execute()

            lifters = result.data

            # If we have results, apply fuzzy matching for ranking
            if lifters:
                # Calculate fuzzy match scores
                scored_lifters = []
                for lifter in lifters:
                    score = fuzz.ratio(query.lower(), lifter['name'].lower())
                    lifter['match_score'] = score
                    scored_lifters.append(lifter)

                # Sort by score and return top results
                scored_lifters.sort(key=lambda x: x['match_score'], reverse=True)
                return scored_lifters[:limit]

            return []

        except Exception as e:
            print(f"Error searching lifters: {e}")
            return []

    @staticmethod
    def get_lifter_profile(name: str) -> Optional[Dict]:
        """Get complete profile for a lifter.

        Args:
            name: Lifter name

        Returns:
            Lifter profile data or None if not found
        """
        try:
            # Get summary data
            result = db.get_table('lifter_summary').select('*').eq('name', name).execute()

            if not result.data:
                return None

            profile = result.data[0]

            # Get competition history
            competitions = db.get_table('lifter_records').select(
                'date',
                'meet_name',
                'federation',
                'equipment',
                'weight_class_kg',
                'bodyweight_kg',
                'best3_squat_kg',
                'best3_bench_kg',
                'best3_deadlift_kg',
                'total_kg',
                'dots',
                'wilks',
                'place'
            ).eq('name', name).order('date', desc=True).execute()

            profile['competitions'] = competitions.data

            return profile

        except Exception as e:
            print(f"Error getting lifter profile: {e}")
            return None

    @staticmethod
    def get_lifter_best_lifts(
        name: str,
        years_back: int = 3,
        equipment: Optional[str] = None,
        weight_class: Optional[str] = None
    ) -> Dict:
        """Get lifter's best lifts within specified timeframe.

        Args:
            name: Lifter name
            years_back: Number of years to look back (1, 2, or 3)
            equipment: Optional equipment filter
            weight_class: Optional weight class filter

        Returns:
            Dictionary with best lifts and meet information
        """
        try:
            # Calculate date cutoff
            cutoff_date = (datetime.now() - timedelta(days=365 * years_back)).date()

            # Build query
            query = db.get_table('lifter_records').select(
                'date',
                'meet_name',
                'federation',
                'equipment',
                'weight_class_kg',
                'bodyweight_kg',
                'best3_squat_kg',
                'squat1_kg',
                'squat2_kg',
                'squat3_kg',
                'best3_bench_kg',
                'bench1_kg',
                'bench2_kg',
                'bench3_kg',
                'best3_deadlift_kg',
                'deadlift1_kg',
                'deadlift2_kg',
                'deadlift3_kg',
                'total_kg',
                'place'
            ).eq('name', name).gte('date', cutoff_date.isoformat())

            # Apply optional filters
            if equipment:
                query = query.eq('equipment', equipment)
            if weight_class:
                query = query.eq('weight_class_kg', weight_class)

            result = query.execute()

            if not result.data:
                return {
                    'name': name,
                    'best_squat': None,
                    'best_bench': None,
                    'best_deadlift': None,
                    'best_total': None
                }

            # Find best lifts
            competitions = result.data

            best_squat = max(
                (c for c in competitions if c.get('best3_squat_kg')),
                key=lambda x: x['best3_squat_kg'],
                default=None
            )

            best_bench = max(
                (c for c in competitions if c.get('best3_bench_kg')),
                key=lambda x: x['best3_bench_kg'],
                default=None
            )

            best_deadlift = max(
                (c for c in competitions if c.get('best3_deadlift_kg')),
                key=lambda x: x['best3_deadlift_kg'],
                default=None
            )

            best_total = max(
                (c for c in competitions if c.get('total_kg')),
                key=lambda x: x['total_kg'],
                default=None
            )

            return {
                'name': name,
                'timeframe_years': years_back,
                'best_squat': best_squat,
                'best_bench': best_bench,
                'best_deadlift': best_deadlift,
                'best_total': best_total,
                'total_competitions': len(competitions)
            }

        except Exception as e:
            print(f"Error getting best lifts: {e}")
            return None

    @staticmethod
    def get_competition_history(
        name: str,
        limit: int = 20
    ) -> List[Dict]:
        """Get lifter's competition history.

        Args:
            name: Lifter name
            limit: Maximum number of competitions to return

        Returns:
            List of competitions
        """
        try:
            result = db.get_table('lifter_records').select(
                'date',
                'meet_name',
                'meet_country',
                'federation',
                'equipment',
                'weight_class_kg',
                'bodyweight_kg',
                'best3_squat_kg',
                'best3_bench_kg',
                'best3_deadlift_kg',
                'total_kg',
                'dots',
                'wilks',
                'place',
                'division'
            ).eq('name', name).order('date', desc=True).limit(limit).execute()

            return result.data

        except Exception as e:
            print(f"Error getting competition history: {e}")
            return []
