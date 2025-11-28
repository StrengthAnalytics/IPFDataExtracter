import { useState } from 'react';
import { LifterSearch } from '../components/LifterSearch';
import { api } from '../services/api';
import type { LifterSearchResult, BestLifts } from '../types';

export function Scout() {
  const [selectedLifters, setSelectedLifters] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<BestLifts[] | null>(null);
  const [timeframe, setTimeframe] = useState<number>(3);
  const [isLoading, setIsLoading] = useState(false);

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
      const result = await api.compareLifters(selectedLifters, timeframe);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Scout Lifters</h1>
        <p className="text-gray-400">Compare multiple lifters head-to-head</p>
      </div>

      {/* Search and Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Search for Lifters</h2>
            <LifterSearch onSelectLifter={handleAddLifter} placeholder="Add lifter to comparison..." />
            <p className="text-xs text-gray-500 mt-2">You can add up to 10 lifters</p>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Timeframe</h2>
          <select
            className="input"
            value={timeframe}
            onChange={(e) => setTimeframe(Number(e.target.value))}
          >
            <option value={1}>Last 1 year</option>
            <option value={2}>Last 2 years</option>
            <option value={3}>Last 3 years</option>
          </select>
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
            Comparison Results (Last {timeframe} {timeframe === 1 ? 'year' : 'years'})
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Lifter</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Best Squat</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Best Bench</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Best Deadlift</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Best Total</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Meets</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((lifter) => (
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
