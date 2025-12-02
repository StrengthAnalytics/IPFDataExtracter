import { useState, useEffect } from 'react';
import { LifterSearch } from '../components/LifterSearch';
import { api } from '../services/api';
import type { LifterSearchResult, BestLifts } from '../types';

type SortColumn = 'name' | 'squat' | 'bench' | 'deadlift' | 'total' | 'meets';
type SortDirection = 'asc' | 'desc';

export function Scout() {
  const [selectedLifters, setSelectedLifters] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<BestLifts[] | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [weightClass, setWeightClass] = useState<string>('');
  const [weightClasses, setWeightClasses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Initialize date defaults (last 3 years to current)
  useEffect(() => {
    const now = new Date();
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(now.getFullYear() - 3);

    setEndDate(now.toISOString().split('T')[0]);
    setStartDate(threeYearsAgo.toISOString().split('T')[0]);
  }, []);

  // Load weight classes
  useEffect(() => {
    api.getWeightClasses().then((data) => {
      const allClasses = [
        ...(data.M || []),
        ...(data.F || [])
      ].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => parseFloat(a) - parseFloat(b));
      setWeightClasses(allClasses);
    }).catch(err => console.error('Error loading weight classes:', err));
  }, []);

  const handleAddLifter = (lifter: LifterSearchResult) => {
    if (!selectedLifters.includes(lifter.name) && selectedLifters.length < 10) {
      setSelectedLifters([...selectedLifters, lifter.name]);
    }
  };

  const handleRemoveLifter = (name: string) => {
    setSelectedLifters(selectedLifters.filter(n => n !== name));
    if (selectedLifters.length === 1) {
      setComparisonData(null);
    }
  };

  const handleCompare = async () => {
    if (selectedLifters.length < 2) return;

    setIsLoading(true);
    try {
      const result = await api.compareLifters(
        selectedLifters,
        startDate || undefined,
        endDate || undefined,
        undefined,
        weightClass || undefined
      );
      setComparisonData(result.lifters);
    } catch (error) {
      console.error('Comparison error:', error);
      alert('Error comparing lifters. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatWeight = (kg?: number) => kg ? `${kg} kg` : '-';
  const formatDate = (date?: string) => date ? new Date(date).toLocaleDateString() : '-';

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to descending for new column (highest first)
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortedData = () => {
    if (!comparisonData) return [];

    const sorted = [...comparisonData].sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortColumn) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'squat':
          aValue = a.best_squat?.best3_squat_kg || 0;
          bValue = b.best_squat?.best3_squat_kg || 0;
          break;
        case 'bench':
          aValue = a.best_bench?.best3_bench_kg || 0;
          bValue = b.best_bench?.best3_bench_kg || 0;
          break;
        case 'deadlift':
          aValue = a.best_deadlift?.best3_deadlift_kg || 0;
          bValue = b.best_deadlift?.best3_deadlift_kg || 0;
          break;
        case 'total':
          aValue = a.best_total?.total_kg || 0;
          bValue = b.best_total?.total_kg || 0;
          break;
        case 'meets':
          aValue = a.total_competitions;
          bValue = b.total_competitions;
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return sorted;
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <span className="text-gray-600 ml-1">⇅</span>;
    }
    return <span className="text-primary-500 ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Scout Lifters</h1>
        <p className="text-gray-400">Compare multiple lifters head-to-head</p>
      </div>

      {/* Search and Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Search for Lifters</h2>
          <LifterSearch
            onSelectLifter={handleAddLifter}
            placeholder="Add lifter to comparison..."
            weightClass={weightClass || undefined}
          />
          <p className="text-xs text-gray-500 mt-2">You can add up to 10 lifters</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Filters</h2>

          {/* Weight Class Filter */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Weight Class (optional)</label>
            <select
              className="input"
              value={weightClass}
              onChange={(e) => setWeightClass(e.target.value)}
            >
              <option value="">All weight classes</option>
              {weightClasses.map((wc) => (
                <option key={wc} value={wc}>{wc} kg</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Filter search results and comparisons by weight class
            </p>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Start Date</label>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">End Date</label>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Only show results from competitions within this date range
          </p>
        </div>
      </div>

      {/* Selected Lifters */}
      {selectedLifters.length > 0 && (
        <div className="card mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">
              Selected Lifters ({selectedLifters.length})
            </h2>
            <button
              onClick={handleCompare}
              disabled={selectedLifters.length < 2 || isLoading}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Comparing...' : 'Compare Lifters'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedLifters.map((name) => (
              <div key={name} className="bg-gray-700 px-3 py-2 rounded-lg flex items-center space-x-2">
                <span className="text-white">{name}</span>
                <button
                  onClick={() => handleRemoveLifter(name)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Table */}
      {comparisonData && comparisonData.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="text-lg font-semibold text-white mb-4">
            Comparison Results
            {startDate && endDate && (
              <span className="text-gray-400 text-sm ml-2">
                ({new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()})
              </span>
            )}
            {weightClass && (
              <span className="text-gray-400 text-sm ml-2">• {weightClass} kg class</span>
            )}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th
                  className="text-left py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('name')}
                >
                  Lifter<SortIcon column="name" />
                </th>
                <th
                  className="text-left py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('squat')}
                >
                  Best Squat<SortIcon column="squat" />
                </th>
                <th
                  className="text-left py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('bench')}
                >
                  Best Bench<SortIcon column="bench" />
                </th>
                <th
                  className="text-left py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('deadlift')}
                >
                  Best Deadlift<SortIcon column="deadlift" />
                </th>
                <th
                  className="text-left py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('total')}
                >
                  Best Total<SortIcon column="total" />
                </th>
                <th
                  className="text-center py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('meets')}
                >
                  Meets<SortIcon column="meets" />
                </th>
              </tr>
            </thead>
            <tbody>
              {getSortedData().map((lifter) => (
                <tr key={lifter.name} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{lifter.name}</div>
                  </td>
                  <td className="py-3 px-4">
                    {lifter.best_squat ? (
                      <div>
                        <div className="font-semibold text-green-400">{formatWeight(lifter.best_squat.best3_squat_kg)}</div>
                        <div className="text-xs text-gray-500">{formatDate(lifter.best_squat.date)}</div>
                        <div className="text-xs text-gray-600">{lifter.best_squat.meet_name}</div>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="py-3 px-4">
                    {lifter.best_bench ? (
                      <div>
                        <div className="font-semibold text-blue-400">{formatWeight(lifter.best_bench.best3_bench_kg)}</div>
                        <div className="text-xs text-gray-500">{formatDate(lifter.best_bench.date)}</div>
                        <div className="text-xs text-gray-600">{lifter.best_bench.meet_name}</div>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="py-3 px-4">
                    {lifter.best_deadlift ? (
                      <div>
                        <div className="font-semibold text-red-400">{formatWeight(lifter.best_deadlift.best3_deadlift_kg)}</div>
                        <div className="text-xs text-gray-500">{formatDate(lifter.best_deadlift.date)}</div>
                        <div className="text-xs text-gray-600">{lifter.best_deadlift.meet_name}</div>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="py-3 px-4">
                    {lifter.best_total ? (
                      <div>
                        <div className="font-semibold text-purple-400">{formatWeight(lifter.best_total.total_kg)}</div>
                        <div className="text-xs text-gray-500">{formatDate(lifter.best_total.date)}</div>
                        <div className="text-xs text-gray-600">{lifter.best_total.meet_name}</div>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-gray-400">{lifter.total_competitions}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLifters.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-white mb-2">Start Scouting</h3>
          <p className="text-gray-400">Search and add lifters to begin comparing their performances</p>
        </div>
      )}
    </div>
  );
}
