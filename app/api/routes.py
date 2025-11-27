"""API routes for the IPF Data Extracter service."""
from flask import Blueprint, request, jsonify
from app.services.lifter_service import LifterService
from app.services.percentile_service import PercentileService

api_bp = Blueprint('api', __name__)


@api_bp.route('/search/lifters', methods=['GET'])
def search_lifters():
    """Search for lifters by name.

    Query Parameters:
        q: Search query string (required)
        limit: Maximum results (default: 10)

    Returns:
        JSON array of lifter matches
    """
    query = request.args.get('q', '').strip()
    limit = min(int(request.args.get('limit', 10)), 50)

    if not query or len(query) < 2:
        return jsonify({
            'error': 'Query must be at least 2 characters'
        }), 400

    results = LifterService.search_lifters(query, limit)

    return jsonify({
        'query': query,
        'results': results,
        'count': len(results)
    })


@api_bp.route('/lifter/<path:name>', methods=['GET'])
def get_lifter_profile(name: str):
    """Get complete profile for a lifter.

    Path Parameters:
        name: Lifter name

    Returns:
        JSON object with lifter profile
    """
    profile = LifterService.get_lifter_profile(name)

    if not profile:
        return jsonify({
            'error': 'Lifter not found'
        }), 404

    return jsonify(profile)


@api_bp.route('/lifter/<path:name>/best-lifts', methods=['GET'])
def get_best_lifts(name: str):
    """Get lifter's best lifts within timeframe.

    Path Parameters:
        name: Lifter name

    Query Parameters:
        years: Number of years to look back (1, 2, or 3, default: 3)
        equipment: Optional equipment filter
        weight_class: Optional weight class filter

    Returns:
        JSON object with best lifts
    """
    years = int(request.args.get('years', 3))
    equipment = request.args.get('equipment')
    weight_class = request.args.get('weight_class')

    if years not in [1, 2, 3]:
        return jsonify({
            'error': 'Years must be 1, 2, or 3'
        }), 400

    best_lifts = LifterService.get_lifter_best_lifts(
        name,
        years_back=years,
        equipment=equipment,
        weight_class=weight_class
    )

    if not best_lifts:
        return jsonify({
            'error': 'No data found for lifter'
        }), 404

    return jsonify(best_lifts)


@api_bp.route('/lifter/<path:name>/history', methods=['GET'])
def get_competition_history(name: str):
    """Get lifter's competition history.

    Path Parameters:
        name: Lifter name

    Query Parameters:
        limit: Maximum competitions to return (default: 20)

    Returns:
        JSON array of competitions
    """
    limit = min(int(request.args.get('limit', 20)), 100)

    history = LifterService.get_competition_history(name, limit)

    return jsonify({
        'name': name,
        'competitions': history,
        'count': len(history)
    })


@api_bp.route('/scouting/compare', methods=['POST'])
def compare_lifters():
    """Compare multiple lifters for scouting.

    Request Body:
        {
            "lifters": ["Name 1", "Name 2", ...],
            "years": 3,
            "equipment": "Raw" (optional)
        }

    Returns:
        JSON comparison data
    """
    data = request.get_json()

    if not data or 'lifters' not in data:
        return jsonify({
            'error': 'Missing required field: lifters'
        }), 400

    lifter_names = data['lifters']
    years = data.get('years', 3)
    equipment = data.get('equipment')

    if not isinstance(lifter_names, list) or len(lifter_names) < 1:
        return jsonify({
            'error': 'lifters must be a non-empty array'
        }), 400

    if len(lifter_names) > 10:
        return jsonify({
            'error': 'Maximum 10 lifters can be compared at once'
        }), 400

    comparison = PercentileService.compare_lifters(
        lifter_names,
        timeframe_years=years,
        equipment=equipment
    )

    return jsonify(comparison)


@api_bp.route('/percentile/calculate', methods=['POST'])
def calculate_percentile():
    """Calculate percentile for a lift.

    Request Body:
        {
            "value": 200.0,
            "sex": "M",
            "equipment": "Raw",
            "weight_class": "93",
            "lift_type": "squat",
            "event": "SBD"
        }

    Returns:
        JSON percentile data
    """
    data = request.get_json()

    required_fields = ['value', 'sex', 'equipment', 'weight_class', 'lift_type']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'error': f'Missing required field: {field}'
            }), 400

    percentile = PercentileService.calculate_percentile(
        value=float(data['value']),
        sex=data['sex'],
        equipment=data['equipment'],
        weight_class=data['weight_class'],
        lift_type=data['lift_type'],
        event=data.get('event', 'SBD')
    )

    if not percentile:
        return jsonify({
            'error': 'Could not calculate percentile (no data available for criteria)'
        }), 404

    return jsonify(percentile)


@api_bp.route('/standards/<sex>/<weight_class>', methods=['GET'])
def get_strength_standards(sex: str, weight_class: str):
    """Get strength standards for a category.

    Path Parameters:
        sex: 'M' or 'F'
        weight_class: Weight class in kg (e.g., '93', '84')

    Query Parameters:
        equipment: Equipment type (default: 'Raw')
        event: Event type (default: 'SBD')

    Returns:
        JSON strength standards
    """
    equipment = request.args.get('equipment', 'Raw')
    event = request.args.get('event', 'SBD')

    if sex not in ['M', 'F', 'Mx']:
        return jsonify({
            'error': 'Sex must be M, F, or Mx'
        }), 400

    standards = PercentileService.get_strength_standards(
        sex=sex,
        weight_class=weight_class,
        equipment=equipment,
        event=event
    )

    if not standards:
        return jsonify({
            'error': 'No data available for the specified criteria'
        }), 404

    return jsonify(standards)


@api_bp.route('/equipment-types', methods=['GET'])
def get_equipment_types():
    """Get list of equipment types.

    Returns:
        JSON array of equipment types
    """
    return jsonify({
        'equipment_types': [
            'Raw',
            'Wraps',
            'Single-ply',
            'Multi-ply',
            'Unlimited',
            'Straps'
        ]
    })


@api_bp.route('/weight-classes', methods=['GET'])
def get_weight_classes():
    """Get list of common weight classes.

    Query Parameters:
        sex: Filter by sex ('M' or 'F')

    Returns:
        JSON object with weight classes by sex
    """
    sex_filter = request.args.get('sex')

    weight_classes = {
        'M': ['59', '66', '74', '83', '93', '105', '120', '120+'],
        'F': ['47', '52', '57', '63', '69', '76', '84', '84+']
    }

    if sex_filter:
        if sex_filter not in weight_classes:
            return jsonify({'error': 'Invalid sex parameter'}), 400
        return jsonify({
            'sex': sex_filter,
            'weight_classes': weight_classes[sex_filter]
        })

    return jsonify(weight_classes)


@api_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get database statistics.

    Returns:
        JSON object with database stats
    """
    from app.models.database import db

    try:
        # Count total records
        records_result = db.get_table('lifter_records').select(
            'id', count='exact'
        ).limit(1).execute()

        # Count unique lifters
        lifters_result = db.get_table('lifter_summary').select(
            'id', count='exact'
        ).limit(1).execute()

        # Get latest competition date
        latest_result = db.get_table('lifter_records').select(
            'date'
        ).order('date', desc=True).limit(1).execute()

        latest_date = latest_result.data[0]['date'] if latest_result.data else None

        return jsonify({
            'total_records': records_result.count,
            'unique_lifters': lifters_result.count,
            'latest_competition': latest_date
        })

    except Exception as e:
        return jsonify({
            'error': f'Could not retrieve stats: {str(e)}'
        }), 500


# Error handlers
@api_bp.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({'error': 'Resource not found'}), 404


@api_bp.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({'error': 'Internal server error'}), 500
