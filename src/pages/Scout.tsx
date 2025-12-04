import { useState, useEffect } from 'react';
import { LifterSearch } from '../components/LifterSearch';
import { api } from '../services/api';
import type { LifterSearchResult, BestLifts } from '../types';

type SortColumn = 'name' | 'squat' | 'bench' | 'deadlift' | 'total' | 'meets';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'tiles';
type AggregationMode = 'byLift' | 'byComp';
type RankingMethod = 'total' | 'ipfgl';

// SessionStorage keys
const STORAGE_KEYS = {
  SELECTED_LIFTERS: 'scout_selected_lifters',
  START_DATE: 'scout_start_date',
  END_DATE: 'scout_end_date',
  WEIGHT_CLASS: 'scout_weight_class',
  AGGREGATION_MODE: 'scout_aggregation_mode',
  RANKING_METHOD: 'scout_ranking_method',
  VIEW_MODE: 'scout_view_mode',
  SORT_COLUMN: 'scout_sort_column',
  SORT_DIRECTION: 'scout_sort_direction',
};

// Helper functions for sessionStorage
const getStorageItem = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setStorageItem = <T,>(key: string, value: T): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to sessionStorage:', error);
  }
};

export function Scout() {
  // Load persisted state from sessionStorage
  const [selectedLifters, setSelectedLifters] = useState<string[]>(() =>
    getStorageItem(STORAGE_KEYS.SELECTED_LIFTERS, [])
  );
  const [comparisonData, setComparisonData] = useState<BestLifts[] | null>(null);
  const [startDate, setStartDate] = useState<string>(() =>
    getStorageItem(STORAGE_KEYS.START_DATE, '')
  );
  const [endDate, setEndDate] = useState<string>(() =>
    getStorageItem(STORAGE_KEYS.END_DATE, '')
  );
  const [weightClass, setWeightClass] = useState<string>(() =>
    getStorageItem(STORAGE_KEYS.WEIGHT_CLASS, '')
  );
  const [weightClasses, setWeightClasses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>(() =>
    getStorageItem(STORAGE_KEYS.SORT_COLUMN, 'total')
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(() =>
    getStorageItem(STORAGE_KEYS.SORT_DIRECTION, 'desc')
  );
  const [useFuzzySearch, setUseFuzzySearch] = useState(false);
  const [showFuzzyInfo, setShowFuzzyInfo] = useState(false);
  const [aggregationMode, setAggregationMode] = useState<AggregationMode>(() =>
    getStorageItem(STORAGE_KEYS.AGGREGATION_MODE, 'byLift')
  );
  const [rankingMethod, setRankingMethod] = useState<RankingMethod>(() =>
    getStorageItem(STORAGE_KEYS.RANKING_METHOD, 'total')
  );

  // Set responsive default: tiles for mobile, list for desktop (with persistence)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = getStorageItem<ViewMode | null>(STORAGE_KEYS.VIEW_MODE, null);
    if (saved) return saved;
    return window.innerWidth < 768 ? 'tiles' : 'list';
  });

  // Initialize date defaults (last 3 years to current) - only if not already set
  useEffect(() => {
    if (!startDate || !endDate) {
      const now = new Date();
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(now.getFullYear() - 3);

      if (!endDate) setEndDate(now.toISOString().split('T')[0]);
      if (!startDate) setStartDate(threeYearsAgo.toISOString().split('T')[0]);
    }
  }, []);

  // Persist state to sessionStorage
  useEffect(() => {
    setStorageItem(STORAGE_KEYS.SELECTED_LIFTERS, selectedLifters);
  }, [selectedLifters]);

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.START_DATE, startDate);
  }, [startDate]);

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.END_DATE, endDate);
  }, [endDate]);

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.WEIGHT_CLASS, weightClass);
  }, [weightClass]);

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.AGGREGATION_MODE, aggregationMode);
  }, [aggregationMode]);

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.RANKING_METHOD, rankingMethod);
  }, [rankingMethod]);

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.VIEW_MODE, viewMode);
  }, [viewMode]);

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.SORT_COLUMN, sortColumn);
  }, [sortColumn]);

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.SORT_DIRECTION, sortDirection);
  }, [sortDirection]);

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

  // Auto-update comparison when filters or lifters change
  useEffect(() => {
    if (selectedLifters.length < 2) {
      setComparisonData(null);
      return;
    }

    const fetchComparison = async () => {
      setIsLoading(true);
      try {
        const result = await api.compareLifters(
          selectedLifters,
          startDate || undefined,
          endDate || undefined,
          undefined,
          weightClass || undefined,
          aggregationMode,
          rankingMethod
        );
        setComparisonData(result.lifters);
      } catch (error) {
        console.error('Comparison error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparison();
  }, [selectedLifters, startDate, endDate, weightClass, aggregationMode, rankingMethod]);

  const handleAddLifter = (lifter: LifterSearchResult) => {
    if (!selectedLifters.includes(lifter.name) && selectedLifters.length < 10) {
      setSelectedLifters([...selectedLifters, lifter.name]);
    }
  };

  const handleRemoveLifter = (name: string) => {
    setSelectedLifters(selectedLifters.filter(n => n !== name));
  };

  const handleClearSelection = () => {
    // Clear state
    setSelectedLifters([]);
    setComparisonData(null);

    // Clear sessionStorage for selection and filters
    sessionStorage.removeItem(STORAGE_KEYS.SELECTED_LIFTERS);
    sessionStorage.removeItem(STORAGE_KEYS.WEIGHT_CLASS);
    sessionStorage.removeItem(STORAGE_KEYS.START_DATE);
    sessionStorage.removeItem(STORAGE_KEYS.END_DATE);

    // Reset filters to defaults
    setWeightClass('');
    const now = new Date();
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(now.getFullYear() - 3);
    setEndDate(now.toISOString().split('T')[0]);
    setStartDate(threeYearsAgo.toISOString().split('T')[0]);
  };

  const formatWeight = (kg?: number) => kg ? `${kg} kg` : '-';
  const formatDate = (date?: string) => date ? new Date(date).toLocaleDateString() : '-';
  const formatIPFGL = (points?: number) => points ? `${points.toFixed(2)} pts` : '-';

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
          if (rankingMethod === 'ipfgl') {
            aValue = a.best_total?.goodlift || 0;
            bValue = b.best_total?.goodlift || 0;
          } else {
            aValue = a.best_total?.total_kg || 0;
            bValue = b.best_total?.total_kg || 0;
          }
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

  // Format attempts - negative values indicate failed attempts
  const formatAttempt = (weight?: number) => {
    if (!weight || weight === 0) return null;
    const absWeight = Math.abs(weight);
    const failed = weight < 0;
    return { weight: absWeight, failed };
  };

  const renderAttempts = (attempt1?: number, attempt2?: number, attempt3?: number, color: string = 'text-gray-300') => {
    const attempts = [formatAttempt(attempt1), formatAttempt(attempt2), formatAttempt(attempt3)];

    return (
      <div className="flex gap-1.5 text-xs">
        {attempts.map((attempt, idx) => {
          if (!attempt) return <span key={idx} className="text-gray-700">-</span>;
          return (
            <span
              key={idx}
              className={`${attempt.failed ? 'line-through text-red-500/70' : color}`}
            >
              {attempt.weight}
            </span>
          );
        })}
      </div>
    );
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Search for Lifters</h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <span>Fuzzy Search</span>
                <input
                  type="checkbox"
                  checked={useFuzzySearch}
                  onChange={(e) => setUseFuzzySearch(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-gray-900"
                />
              </label>
              <div className="relative">
                <button
                  onMouseEnter={() => setShowFuzzyInfo(true)}
                  onMouseLeave={() => setShowFuzzyInfo(false)}
                  className="w-5 h-5 rounded-full bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
                >
                  i
                </button>
                {showFuzzyInfo && (
                  <div className="absolute right-0 top-6 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 text-xs text-gray-300 z-50">
                    <p className="font-semibold text-white mb-2">What is Fuzzy Search?</p>
                    <p className="mb-2">Fuzzy search finds lifters even with typos or misspellings:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-400">
                      <li>"jon haak" → finds "John Haack"</li>
                      <li>"jhon hack" → finds "John Haack"</li>
                      <li>"haack" → finds "John Haack"</li>
                    </ul>
                    <p className="mt-2 text-gray-500">Turn off for exact matches only (faster).</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <LifterSearch
            onSelectLifter={handleAddLifter}
            placeholder="Add lifter to comparison..."
            weightClass={weightClass || undefined}
            useFuzzySearch={useFuzzySearch}
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
            <div className="flex items-center gap-3">
              {isLoading && (
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                  <span>Updating...</span>
                </div>
              )}
              <button
                onClick={handleClearSelection}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Clear Selection
              </button>
            </div>
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
          {selectedLifters.length === 1 && (
            <div className="mt-3 text-sm text-gray-400">
              Add at least one more lifter to see comparison
            </div>
          )}
        </div>
      )}

      {/* Comparison Results */}
      {comparisonData && comparisonData.length > 0 && (
        <div className="card">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white mb-3">
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

            {/* Toggle Controls */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* Aggregation Mode Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Data:</span>
                <div className="inline-flex rounded-lg bg-gray-800 p-1">
                  <button
                    onClick={() => setAggregationMode('byLift')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      aggregationMode === 'byLift'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    By Lift
                  </button>
                  <button
                    onClick={() => setAggregationMode('byComp')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      aggregationMode === 'byComp'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    By Comp
                  </button>
                </div>
                <div className="relative group">
                  <button className="w-5 h-5 rounded-full bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center text-xs font-bold transition-colors">
                    i
                  </button>
                  <div className="absolute left-0 top-6 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 text-xs text-gray-300 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <p className="font-semibold text-white mb-1">By Lift:</p>
                    <p className="mb-2 text-gray-400">Best result for each lift across all competitions (cherry-picked).</p>
                    <p className="font-semibold text-white mb-1">By Comp:</p>
                    <p className="text-gray-400">All lifts from the competition with the best total.</p>
                  </div>
                </div>
              </div>

              {/* Ranking Method Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Rank by:</span>
                <div className="inline-flex rounded-lg bg-gray-800 p-1">
                  <button
                    onClick={() => setRankingMethod('total')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      rankingMethod === 'total'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Total
                  </button>
                  <button
                    onClick={() => setRankingMethod('ipfgl')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      rankingMethod === 'ipfgl'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    IPF GL
                  </button>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">View:</span>
                <div className="inline-flex rounded-lg bg-gray-800 p-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'list'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('tiles')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'tiles'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Tiles
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* List View */}
          {viewMode === 'list' && (
            <div className="overflow-x-auto">
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
                  {rankingMethod === 'total' ? 'Best Total' : 'IPF GL Score'}<SortIcon column="total" />
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
                        {renderAttempts(lifter.best_squat.squat1_kg, lifter.best_squat.squat2_kg, lifter.best_squat.squat3_kg, 'text-green-400/80')}
                        <div className="text-xs text-gray-500 mt-1">{formatDate(lifter.best_squat.date)}</div>
                        <div className="text-xs text-gray-600 truncate max-w-[200px]">{lifter.best_squat.meet_name}</div>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="py-3 px-4">
                    {lifter.best_bench ? (
                      <div>
                        <div className="font-semibold text-blue-400">{formatWeight(lifter.best_bench.best3_bench_kg)}</div>
                        {renderAttempts(lifter.best_bench.bench1_kg, lifter.best_bench.bench2_kg, lifter.best_bench.bench3_kg, 'text-blue-400/80')}
                        <div className="text-xs text-gray-500 mt-1">{formatDate(lifter.best_bench.date)}</div>
                        <div className="text-xs text-gray-600 truncate max-w-[200px]">{lifter.best_bench.meet_name}</div>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="py-3 px-4">
                    {lifter.best_deadlift ? (
                      <div>
                        <div className="font-semibold text-red-400">{formatWeight(lifter.best_deadlift.best3_deadlift_kg)}</div>
                        {renderAttempts(lifter.best_deadlift.deadlift1_kg, lifter.best_deadlift.deadlift2_kg, lifter.best_deadlift.deadlift3_kg, 'text-red-400/80')}
                        <div className="text-xs text-gray-500 mt-1">{formatDate(lifter.best_deadlift.date)}</div>
                        <div className="text-xs text-gray-600 truncate max-w-[200px]">{lifter.best_deadlift.meet_name}</div>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="py-3 px-4">
                    {lifter.best_total ? (
                      <div>
                        {rankingMethod === 'total' ? (
                          <>
                            <div className="font-semibold text-purple-400">{formatWeight(lifter.best_total.total_kg)}</div>
                            <div className="text-xs text-gray-500">{formatIPFGL(lifter.best_total.goodlift)}</div>
                          </>
                        ) : (
                          <>
                            <div className="font-semibold text-purple-400">{formatIPFGL(lifter.best_total.goodlift)}</div>
                            <div className="text-xs text-gray-500">{formatWeight(lifter.best_total.total_kg)}</div>
                          </>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(lifter.best_total.date)}
                          {lifter.best_total.weight_class_kg && (
                            <span className="ml-1 text-gray-400">@ {lifter.best_total.weight_class_kg} kg</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 truncate max-w-[200px]">{lifter.best_total.meet_name}</div>
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

          {/* Tiles View */}
          {viewMode === 'tiles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getSortedData().map((lifter) => (
                <div key={lifter.name} className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-primary-500 transition-colors">
                  <h3 className="text-lg font-bold text-white mb-3">{lifter.name}</h3>

                  <div className="space-y-3">
                    {/* Squat */}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Squat</div>
                      {lifter.best_squat ? (
                        <div>
                          <div className="font-semibold text-green-400 text-lg">{formatWeight(lifter.best_squat.best3_squat_kg)}</div>
                          {renderAttempts(lifter.best_squat.squat1_kg, lifter.best_squat.squat2_kg, lifter.best_squat.squat3_kg, 'text-green-400/80')}
                          <div className="text-xs text-gray-500 mt-1">{formatDate(lifter.best_squat.date)}</div>
                          <div className="text-xs text-gray-600 truncate">{lifter.best_squat.meet_name}</div>
                        </div>
                      ) : <span className="text-gray-600">-</span>}
                    </div>

                    {/* Bench */}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Bench</div>
                      {lifter.best_bench ? (
                        <div>
                          <div className="font-semibold text-blue-400 text-lg">{formatWeight(lifter.best_bench.best3_bench_kg)}</div>
                          {renderAttempts(lifter.best_bench.bench1_kg, lifter.best_bench.bench2_kg, lifter.best_bench.bench3_kg, 'text-blue-400/80')}
                          <div className="text-xs text-gray-500 mt-1">{formatDate(lifter.best_bench.date)}</div>
                          <div className="text-xs text-gray-600 truncate">{lifter.best_bench.meet_name}</div>
                        </div>
                      ) : <span className="text-gray-600">-</span>}
                    </div>

                    {/* Deadlift */}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Deadlift</div>
                      {lifter.best_deadlift ? (
                        <div>
                          <div className="font-semibold text-red-400 text-lg">{formatWeight(lifter.best_deadlift.best3_deadlift_kg)}</div>
                          {renderAttempts(lifter.best_deadlift.deadlift1_kg, lifter.best_deadlift.deadlift2_kg, lifter.best_deadlift.deadlift3_kg, 'text-red-400/80')}
                          <div className="text-xs text-gray-500 mt-1">{formatDate(lifter.best_deadlift.date)}</div>
                          <div className="text-xs text-gray-600 truncate">{lifter.best_deadlift.meet_name}</div>
                        </div>
                      ) : <span className="text-gray-600">-</span>}
                    </div>

                    {/* Total */}
                    <div className="pt-2 border-t border-gray-700">
                      <div className="text-xs text-gray-500 mb-1">{rankingMethod === 'total' ? 'Total' : 'IPF GL Score'}</div>
                      {lifter.best_total ? (
                        <div>
                          {rankingMethod === 'total' ? (
                            <>
                              <div className="font-bold text-purple-400 text-xl">{formatWeight(lifter.best_total.total_kg)}</div>
                              <div className="text-xs text-gray-500">{formatIPFGL(lifter.best_total.goodlift)}</div>
                            </>
                          ) : (
                            <>
                              <div className="font-bold text-purple-400 text-xl">{formatIPFGL(lifter.best_total.goodlift)}</div>
                              <div className="text-xs text-gray-500">{formatWeight(lifter.best_total.total_kg)}</div>
                            </>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(lifter.best_total.date)}
                            {lifter.best_total.weight_class_kg && (
                              <span className="ml-1 text-gray-400">@ {lifter.best_total.weight_class_kg} kg</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 truncate">{lifter.best_total.meet_name}</div>
                        </div>
                      ) : <span className="text-gray-600">-</span>}
                    </div>

                    {/* Meets */}
                    <div className="text-xs text-gray-500">
                      {lifter.total_competitions} {lifter.total_competitions === 1 ? 'meet' : 'meets'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
