"""Service layer for percentile calculations and strength standards."""
from typing import Dict, Optional, List
import numpy as np
from app.models.database import db
from datetime import datetime


class PercentileService:
    """Service for calculating percentiles and strength standards."""

    @staticmethod
    def calculate_percentile(
        value: float,
        sex: str,
        equipment: str,
        weight_class: str,
        lift_type: str,
        event: str = 'SBD'
    ) -> Optional[Dict]:
        """Calculate percentile for a given lift.

        Args:
            value: The lift value in kg
            sex: 'M' or 'F'
            equipment: Equipment type (Raw, Wraps, etc.)
            weight_class: Weight class in kg
            lift_type: 'squat', 'bench', 'deadlift', or 'total'
            event: Competition event type

        Returns:
            Dictionary with percentile and additional stats
        """
        try:
            # Build query for similar lifters
            query = db.get_table('lifter_records').select(
                f'best3_{lift_type}_kg' if lift_type != 'total' else 'total_kg'
            ).eq('sex', sex).eq('equipment', equipment).eq('weight_class_kg', weight_class).eq('event', event)

            # Get the appropriate column
            column = f'best3_{lift_type}_kg' if lift_type != 'total' else 'total_kg'

            # Filter out null values
            if lift_type != 'total':
                query = query.not_.is_(f'best3_{lift_type}_kg', 'null')
            else:
                query = query.not_.is_('total_kg', 'null')

            result = query.execute()

            if not result.data:
                return None

            # Extract values
            values = [r[column] for r in result.data if r[column] is not None]

            if not values:
                return None

            # Calculate percentile
            percentile = (np.searchsorted(sorted(values), value) / len(values)) * 100

            # Calculate statistics
            stats = {
                'percentile': round(percentile, 1),
                'value': value,
                'sample_size': len(values),
                'mean': round(np.mean(values), 2),
                'median': round(np.median(values), 2),
                'std_dev': round(np.std(values), 2),
                'min': round(min(values), 2),
                'max': round(max(values), 2),
                'p25': round(np.percentile(values, 25), 2),
                'p50': round(np.percentile(values, 50), 2),
                'p75': round(np.percentile(values, 75), 2),
                'p90': round(np.percentile(values, 90), 2),
                'p95': round(np.percentile(values, 95), 2),
                'p99': round(np.percentile(values, 99), 2),
                'criteria': {
                    'sex': sex,
                    'equipment': equipment,
                    'weight_class': weight_class,
                    'lift_type': lift_type,
                    'event': event
                }
            }

            return stats

        except Exception as e:
            print(f"Error calculating percentile: {e}")
            return None

    @staticmethod
    def get_strength_standards(
        sex: str,
        weight_class: str,
        equipment: str = 'Raw',
        event: str = 'SBD'
    ) -> Optional[Dict]:
        """Get strength standards for a given category.

        Args:
            sex: 'M' or 'F'
            weight_class: Weight class in kg
            equipment: Equipment type
            event: Competition event type

        Returns:
            Dictionary with percentile breakdowns for each lift
        """
        try:
            standards = {}

            for lift_type in ['squat', 'bench', 'deadlift', 'total']:
                # Get all values for this lift type
                column = f'best3_{lift_type}_kg' if lift_type != 'total' else 'total_kg'

                query = db.get_table('lifter_records').select(column).eq(
                    'sex', sex
                ).eq('equipment', equipment).eq('weight_class_kg', weight_class).eq('event', event)

                if lift_type != 'total':
                    query = query.not_.is_(f'best3_{lift_type}_kg', 'null')
                else:
                    query = query.not_.is_('total_kg', 'null')

                result = query.execute()

                if not result.data:
                    continue

                values = [r[column] for r in result.data if r[column] is not None]

                if not values:
                    continue

                # Calculate percentile thresholds
                standards[lift_type] = {
                    'beginner': round(np.percentile(values, 10), 2),
                    'novice': round(np.percentile(values, 25), 2),
                    'intermediate': round(np.percentile(values, 50), 2),
                    'advanced': round(np.percentile(values, 75), 2),
                    'elite': round(np.percentile(values, 90), 2),
                    'world_class': round(np.percentile(values, 95), 2),
                    'sample_size': len(values),
                    'max_recorded': round(max(values), 2)
                }

            return {
                'sex': sex,
                'weight_class': weight_class,
                'equipment': equipment,
                'event': event,
                'standards': standards
            }

        except Exception as e:
            print(f"Error getting strength standards: {e}")
            return None

    @staticmethod
    def compare_lifters(
        lifter_names: List[str],
        timeframe_years: int = 3,
        equipment: Optional[str] = None
    ) -> Dict:
        """Compare multiple lifters side by side.

        Args:
            lifter_names: List of lifter names to compare
            timeframe_years: Number of years to look back
            equipment: Optional equipment filter

        Returns:
            Comparison data for all lifters
        """
        from app.services.lifter_service import LifterService

        comparison = {
            'lifters': [],
            'timeframe_years': timeframe_years
        }

        for name in lifter_names:
            lifter_data = LifterService.get_lifter_best_lifts(
                name,
                years_back=timeframe_years,
                equipment=equipment
            )

            if lifter_data:
                comparison['lifters'].append(lifter_data)

        return comparison

    @staticmethod
    def get_cached_percentiles(
        sex: str,
        equipment: str,
        weight_class: str,
        event: str,
        lift_type: str
    ) -> Optional[Dict]:
        """Get cached percentile data if available.

        Args:
            sex: 'M' or 'F'
            equipment: Equipment type
            weight_class: Weight class
            event: Event type
            lift_type: Lift type

        Returns:
            Cached percentile data or None
        """
        try:
            result = db.get_table('percentile_cache').select('*').eq(
                'sex', sex
            ).eq('equipment', equipment).eq('weight_class_kg', weight_class).eq(
                'event', event
            ).eq('lift_type', lift_type).execute()

            if result.data:
                cache_entry = result.data[0]
                # Check if cache is fresh (less than 7 days old)
                last_updated = datetime.fromisoformat(cache_entry['last_updated'].replace('Z', '+00:00'))
                age_days = (datetime.now() - last_updated).days

                if age_days < 7:
                    return cache_entry['percentile_data']

            return None

        except Exception as e:
            print(f"Error getting cached percentiles: {e}")
            return None

    @staticmethod
    def cache_percentiles(
        sex: str,
        equipment: str,
        weight_class: str,
        event: str,
        lift_type: str,
        percentile_data: Dict,
        sample_size: int
    ):
        """Cache percentile data for faster lookups.

        Args:
            sex: 'M' or 'F'
            equipment: Equipment type
            weight_class: Weight class
            event: Event type
            lift_type: Lift type
            percentile_data: The percentile data to cache
            sample_size: Number of samples used
        """
        try:
            # Upsert cache entry
            db.get_table('percentile_cache').upsert({
                'sex': sex,
                'equipment': equipment,
                'weight_class_kg': weight_class,
                'event': event,
                'lift_type': lift_type,
                'percentile_data': percentile_data,
                'sample_size': sample_size,
                'last_updated': datetime.now().isoformat()
            }).execute()

        except Exception as e:
            print(f"Error caching percentiles: {e}")
