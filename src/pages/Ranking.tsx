import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { RankingRecord } from '../types';

export function Ranking() {
  const [sortBy, setSortBy] = useState<'goodlift' | 'best3_squat_kg' | 'best3_bench_kg' | 'best3_deadlift_kg' | 'total_kg'>('goodlift');
  const [federation, setFederation] = useState('');
  const [equipment, setEquipment] = useState('');
  const [sex, setSex] = useState('M');
  const [weightClass, setWeightClass] = useState('');
  const [ageClass, setAgeClass] = useState('Open');
  const [year, setYear] = useState('2024');
  const [eventType, setEventType] = useState('SBD');

  const [results, setResults] = useState<RankingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [federations, setFederations] = useState<string[]>([]);
  const [weightClasses, setWeightClasses] = useState<{ M: string[]; F: string[] } | null>(null);

  // Load federations and weight classes on mount
  useEffect(() => {
    Promise.all([
      api.getFederations(),
      api.getWeightClasses()
    ]).then(([fedData, wcData]) => {
      setFederations(fedData.federations);
      if (wcData.M && wcData.F) {
        setWeightClasses(wcData as { M: string[]; F: string[] });
      }
    });
  }, []);

  // Update weight class when sex changes
  useEffect(() => {
    if (weightClasses) {
      setWeightClass('');
    }
  }, [sex, weightClasses]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await api.getTopRankings({
        sortBy,
        federation: federation || undefined,
        equipment: equipment || undefined,
        sex,
        weightClass: weightClass || undefined,
        ageClass: ageClass === 'Open' ? undefined : ageClass,
        year,
        eventType,
        limit: 10
      });
      setResults(data);
    } catch (error) {
      console.error('Ranking search error:', error);
      alert('Error fetching rankings. Please try different filters.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getSortLabel = () => {
    const labels: Record<string, string> = {
      goodlift: 'GL Points',
      best3_squat_kg: 'Squat',
      best3_bench_kg: 'Bench',
      best3_deadlift_kg: 'Deadlift',
      total_kg: 'Total'
    };
    return labels[sortBy] || sortBy;
  };

  const getSortValue = (record: RankingRecord) => {
    switch (sortBy) {
      case 'goodlift':
        return record.goodlift?.toFixed(2) || 'N/A';
      case 'best3_squat_kg':
        return record.best3_squat_kg ? `${record.best3_squat_kg} kg` : 'N/A';
      case 'best3_bench_kg':
        return record.best3_bench_kg ? `${record.best3_bench_kg} kg` : 'N/A';
      case 'best3_deadlift_kg':
        return record.best3_deadlift_kg ? `${record.best3_deadlift_kg} kg` : 'N/A';
      case 'total_kg':
        return record.total_kg ? `${record.total_kg} kg` : 'N/A';
      default:
        return 'N/A';
    }
  };

  const getEquipmentDisplay = (equip: string) => {
    if (equip === 'Raw') return 'Classic';
    if (equip === 'Single-ply' || equip === 'Multi-ply') return 'Equipped';
    return equip;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Top Rankings</h1>
        <p className="text-gray-400">Find the top 10 lifters for any combination of filters</p>
      </div>

      {/* Filter Form */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold text-white mb-6">Filters</h2>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Sort By</label>
              <select
                className="input"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="goodlift">GL Points</option>
                <option value="best3_squat_kg">Squat</option>
                <option value="best3_bench_kg">Bench</option>
                <option value="best3_deadlift_kg">Deadlift</option>
                <option value="total_kg">Total</option>
              </select>
            </div>

            {/* Federation */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Federation</label>
              <select
                className="input"
                value={federation}
                onChange={(e) => setFederation(e.target.value)}
              >
                <option value="">All Federations</option>
                {federations.map((fed) => (
                  <option key={fed} value={fed}>
                    {fed}
                  </option>
                ))}
              </select>
            </div>

            {/* Equipment */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Equipment</label>
              <select
                className="input"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              >
                <option value="">All Equipment</option>
                <option value="Raw">Classic (Raw)</option>
                <option value="Single-ply">Equipped (Single-ply)</option>
                <option value="Multi-ply">Equipped (Multi-ply)</option>
                <option value="Wraps">Wraps</option>
              </select>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Gender</label>
              <select className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>

            {/* Weight Class */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Weight Class</label>
              <select
                className="input"
                value={weightClass}
                onChange={(e) => setWeightClass(e.target.value)}
              >
                <option value="">All Weight Classes</option>
                {weightClasses &&
                  weightClasses[sex as 'M' | 'F'].map((wc) => (
                    <option key={wc} value={wc}>
                      {wc} kg
                    </option>
                  ))}
              </select>
            </div>

            {/* Age Class */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Age Class</label>
              <select
                className="input"
                value={ageClass}
                onChange={(e) => setAgeClass(e.target.value)}
              >
                <option value="Open">Open (All)</option>
                <option value="Sub-Junior">Sub-Junior</option>
                <option value="Junior">Junior</option>
                <option value="Senior">Senior</option>
                <option value="Master 1">Master 1</option>
                <option value="Master 2">Master 2</option>
                <option value="Master 3">Master 3</option>
                <option value="Master 4">Master 4</option>
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Year</label>
              <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">All Years</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
              </select>
            </div>

            {/* Competition Type */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Competition Type</label>
              <select
                className="input"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                <option value="ALL">All Events</option>
                <option value="SBD">Full Power (SBD)</option>
                <option value="B">Bench Only</option>
                <option value="D">Deadlift Only</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
            {isLoading ? 'Searching...' : 'Get Top 10 Rankings'}
          </button>
        </form>
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-6">
            Top 10 - {getSortLabel()}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Rank</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Name</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">{getSortLabel()}</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Weight Class</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Equipment</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Date</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Meet</th>
                </tr>
              </thead>
              <tbody>
                {results.map((record, index) => (
                  <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-3 px-2">
                      <span className="text-white font-semibold">{index + 1}</span>
                    </td>
                    <td className="py-3 px-2">
                      <a
                        href={`/lifter/${encodeURIComponent(record.name)}`}
                        className="text-primary-400 hover:text-primary-300"
                      >
                        {record.name}
                      </a>
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-white font-semibold">{getSortValue(record)}</span>
                    </td>
                    <td className="py-3 px-2 text-gray-300">
                      {record.weight_class_kg} kg
                    </td>
                    <td className="py-3 px-2 text-gray-300">
                      {getEquipmentDisplay(record.equipment)}
                    </td>
                    <td className="py-3 px-2 text-gray-300">
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2 text-gray-300 max-w-xs truncate">
                      {record.meet_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !isLoading && (
          <div className="card text-center py-16">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-xl font-semibold text-white mb-2">Ready to Search</h3>
            <p className="text-gray-400">
              Select your filters and click "Get Top 10 Rankings" to see the best lifters
            </p>
          </div>
        )
      )}

      {isLoading && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">⏳</div>
          <h3 className="text-xl font-semibold text-white mb-2">Searching...</h3>
          <p className="text-gray-400">Finding the top lifters based on your filters</p>
        </div>
      )}
    </div>
  );
}
