import { useState, useEffect } from 'react';
import { LifterSearch } from '../components/LifterSearch';
import { api } from '../services/api';
import type { LifterSearchResult, BestLifts, PredictionAnalysis, CompetitionHistoryItem } from '../types';

type SortColumn = 'name' | 'squat' | 'bench' | 'deadlift' | 'total' | 'meets' | 'prediction';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'tiles';
type AggregationMode = 'byLift' | 'byComp';
type RankingMethod = 'total' | 'ipfgl';
type TrendRange = 12 | 18 | 24;

// Linear regression calculation
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number; rSquared: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R²
  const meanY = sumY / n;
  const ssTotal = points.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0);
  const ssResidual = points.reduce((s, p) => s + Math.pow(p.y - (intercept + slope * p.x), 2), 0);
  const rSquared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);

  return { slope, intercept, rSquared };
}

// Calculate prediction for a lifter
function calculatePrediction(
  competitions: CompetitionHistoryItem[],
  targetDate: string
): PredictionAnalysis {
  const hasEnoughData = competitions.length >= 2;

  if (!hasEnoughData) {
    return {
      predictedTotal: null,
      targetDate,
      ratePerYear: 0,
      trend: 'stable',
      competitionsInRange: competitions.length,
      rSquared: 0,
      hasEnoughData: false,
      competitions
    };
  }

  // Convert dates to days since first competition
  const firstDate = new Date(competitions[0].date);
  const points = competitions.map(comp => ({
    x: Math.floor((new Date(comp.date).getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)),
    y: comp.total_kg
  }));

  const { slope, intercept, rSquared } = linearRegression(points);
  const ratePerYear = slope * 365;

  // Determine trend
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (Math.abs(ratePerYear) > 5) {
    trend = ratePerYear > 0 ? 'improving' : 'declining';
  }

  // Calculate predicted value
  const targetDateObj = new Date(targetDate);
  const daysSinceFirst = Math.floor((targetDateObj.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  let predictedTotal = intercept + slope * daysSinceFirst;

  // If negative trend, use most recent competition
  if (slope < 0) {
    predictedTotal = competitions[competitions.length - 1].total_kg;
  }

  // Round to nearest 2.5 kg
  predictedTotal = Math.round(predictedTotal / 2.5) * 2.5;

  return {
    predictedTotal,
    targetDate,
    ratePerYear,
    trend,
    competitionsInRange: competitions.length,
    rSquared,
    hasEnoughData: true,
    competitions
  };
}

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

  // Prediction feature state
  const [predictionEnabled, setPredictionEnabled] = useState(false);
  const [targetDate, setTargetDate] = useState<string>(() => {
    // Default to 6 months from now
    const sixMonthsOut = new Date();
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);
    return sixMonthsOut.toISOString().split('T')[0];
  });
  const [trendRange, setTrendRange] = useState<TrendRange>(18);
  const [predictions, setPredictions] = useState<Map<string, PredictionAnalysis>>(new Map());
  const [isPredicting, setIsPredicting] = useState(false);

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

  // Fetch predictions when enabled or parameters change
  useEffect(() => {
    if (!predictionEnabled || selectedLifters.length === 0) {
      setPredictions(new Map());
      return;
    }

    const fetchPredictions = async () => {
      setIsPredicting(true);
      const newPredictions = new Map<string, PredictionAnalysis>();

      try {
        await Promise.all(
          selectedLifters.map(async (lifterName) => {
            try {
              const history = await api.getLifterHistory(
                lifterName,
                trendRange,
                weightClass || undefined,
                undefined // equipment - could add later
              );
              const prediction = calculatePrediction(history, targetDate);
              newPredictions.set(lifterName, prediction);
            } catch (error) {
              console.error(`Error fetching prediction for ${lifterName}:`, error);
            }
          })
        );

        setPredictions(newPredictions);
      } finally {
        setIsPredicting(false);
      }
    };

    fetchPredictions();
  }, [predictionEnabled, selectedLifters, targetDate, trendRange, weightClass]);

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
        case 'prediction':
          aValue = predictions.get(a.name)?.predictedTotal || 0;
          bValue = predictions.get(b.name)?.predictedTotal || 0;
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

      {/* Prediction Controls */}
      {selectedLifters.length > 0 && (
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Performance Prediction</h2>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <span>Enable Predictions</span>
              <input
                type="checkbox"
                checked={predictionEnabled}
                onChange={(e) => setPredictionEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-gray-900"
              />
            </label>
          </div>

          {predictionEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target Date */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Target Competition Date</label>
                <input
                  type="date"
                  className="input"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Predict performance at this future date
                </p>
              </div>

              {/* Trend Range */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Trend Analysis Range</label>
                <select
                  className="input"
                  value={trendRange}
                  onChange={(e) => setTrendRange(Number(e.target.value) as TrendRange)}
                >
                  <option value={12}>Last 12 months</option>
                  <option value={18}>Last 18 months</option>
                  <option value={24}>Last 24 months</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Use competitions from this period for prediction
                </p>
              </div>
            </div>
          )}

          {predictionEnabled && isPredicting && (
            <div className="mt-4 flex items-center gap-2 text-gray-400 text-sm">
              <div className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
              <span>Calculating predictions...</span>
            </div>
          )}
        </div>
      )}

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
                  className="text-left py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('name')}
                >
                  Lifter<SortIcon column="name" />
                </th>
                <th
                  className="text-left py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('squat')}
                >
                  Squat<SortIcon column="squat" />
                </th>
                <th
                  className="text-left py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('bench')}
                >
                  Bench<SortIcon column="bench" />
                </th>
                <th
                  className="text-left py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('deadlift')}
                >
                  Deadlift<SortIcon column="deadlift" />
                </th>
                <th
                  className="text-left py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('total')}
                >
                  Total<SortIcon column="total" />
                </th>
                <th
                  className="text-center py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('meets')}
                >
                  Meets<SortIcon column="meets" />
                </th>
                {predictionEnabled && (
                  <th
                    className="text-left py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                    onClick={() => handleSort('prediction')}
                  >
                    Pred.<SortIcon column="prediction" />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {getSortedData().map((lifter) => (
                <tr key={lifter.name} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-2 px-2">
                    <div className="font-semibold text-white">{lifter.name}</div>
                  </td>
                  <td className="py-2 px-2">
                    {lifter.best_squat ? (
                      <div>
                        <div className="font-semibold text-green-400">{lifter.best_squat.best3_squat_kg}</div>
                        <div className="text-xs text-gray-500">{formatDate(lifter.best_squat.date)}</div>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="py-2 px-2">
                    {lifter.best_bench ? (
                      <div>
                        <div className="font-semibold text-blue-400">{lifter.best_bench.best3_bench_kg}</div>
                        <div className="text-xs text-gray-500">{formatDate(lifter.best_bench.date)}</div>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="py-2 px-2">
                    {lifter.best_deadlift ? (
                      <div>
                        <div className="font-semibold text-red-400">{lifter.best_deadlift.best3_deadlift_kg}</div>
                        <div className="text-xs text-gray-500">{formatDate(lifter.best_deadlift.date)}</div>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="py-2 px-2">
                    {lifter.best_total ? (
                      <div>
                        <div className="font-semibold text-purple-400">{lifter.best_total.total_kg}</div>
                        <div className="text-xs text-gray-500">
                          {formatDate(lifter.best_total.date)}
                          {lifter.best_total.weight_class_kg ? (
                            <span className="ml-1 text-gray-400">@ {lifter.best_total.weight_class_kg}</span>
                          ) : lifter.best_total.bodyweight_kg ? (
                            <span className="ml-1 text-gray-400">BW {lifter.best_total.bodyweight_kg}</span>
                          ) : null}
                        </div>
                      </div>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="text-gray-400">{lifter.total_competitions}</span>
                  </td>
                  {predictionEnabled && (() => {
                    const prediction = predictions.get(lifter.name);
                    return (
                      <td className="py-2 px-2">
                        {prediction?.hasEnoughData ? (
                          <div>
                            <div className="font-semibold text-yellow-400">{prediction.predictedTotal}</div>
                            <div className="text-xs text-gray-500">
                              {prediction.competitionsInRange} over {trendRange}mo
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">N/A</div>
                        )}
                      </td>
                    );
                  })()}
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
                    {/* S/B/D Compact Row */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* Squat */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">S</div>
                        {lifter.best_squat ? (
                          <div className="font-semibold text-green-400">{lifter.best_squat.best3_squat_kg}</div>
                        ) : <span className="text-gray-600">-</span>}
                      </div>

                      {/* Bench */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">B</div>
                        {lifter.best_bench ? (
                          <div className="font-semibold text-blue-400">{lifter.best_bench.best3_bench_kg}</div>
                        ) : <span className="text-gray-600">-</span>}
                      </div>

                      {/* Deadlift */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">D</div>
                        {lifter.best_deadlift ? (
                          <div className="font-semibold text-red-400">{lifter.best_deadlift.best3_deadlift_kg}</div>
                        ) : <span className="text-gray-600">-</span>}
                      </div>
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
                            {lifter.best_total.weight_class_kg ? (
                              <span className="ml-1 text-gray-400">@ {lifter.best_total.weight_class_kg} kg</span>
                            ) : lifter.best_total.bodyweight_kg ? (
                              <span className="ml-1 text-gray-400">BW {lifter.best_total.bodyweight_kg} kg</span>
                            ) : null}
                          </div>
                          <div className="text-xs text-gray-600 truncate">{lifter.best_total.meet_name}</div>
                        </div>
                      ) : <span className="text-gray-600">-</span>}
                    </div>

                    {/* Meets */}
                    <div className="text-xs text-gray-500">
                      {lifter.total_competitions} {lifter.total_competitions === 1 ? 'meet' : 'meets'}
                    </div>

                    {/* Prediction */}
                    {predictionEnabled && (() => {
                      const prediction = predictions.get(lifter.name);
                      return (
                        <div className="pt-2 border-t border-gray-700">
                          <div className="text-xs text-gray-500 mb-1">Predicted Total</div>
                          {prediction?.hasEnoughData ? (
                            <div>
                              <div className="font-bold text-yellow-400 text-xl">{formatWeight(prediction.predictedTotal!)}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                Based on {prediction.competitionsInRange} {prediction.competitionsInRange === 1 ? 'comp' : 'comps'} over {trendRange} months
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">Not enough data</div>
                          )}
                        </div>
                      );
                    })()}
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
