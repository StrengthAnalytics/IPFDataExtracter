import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LifterSearch } from '../components/LifterSearch';
import { useToast } from '../components/Toast';
import { ScoutListSkeleton, ScoutTilesSkeleton } from '../components/Skeleton';
import { api } from '../services/api';
import type { LifterSearchResult, BestLifts, PredictionAnalysis, CompetitionHistoryItem, LifterProfile as LifterProfileType, Competition } from '../types';

type SortColumn = 'name' | 'squat' | 'bench' | 'deadlift' | 'total' | 'meets' | 'prediction';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'tiles';
type AggregationMode = 'byLift' | 'byComp';
type RankingMethod = 'total' | 'ipfgl';
type TrendRange = 12 | 18 | 24;

interface VelocityBreakdown {
  vRecent: number;         // kg/month between last two points (raw)
  vRecentClamped: number;  // kg/month after capping (max 1.5x overall)
  vOverall: number;        // kg/month from first to last point
  vWeighted: number;       // 60% recent + 40% overall
  finalVelocity: number;   // After 0.9 friction
}

// Monotonic Filter: Remove strategic underperformances and bad meets
// Keeps only competitions where total >= previous best
function applyMonotonicFilter(
  competitions: CompetitionHistoryItem[]
): CompetitionHistoryItem[] {
  if (competitions.length < 2) return competitions;

  // Sort by date (oldest first)
  const sorted = [...competitions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const cleanHistory: CompetitionHistoryItem[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const lastClean = cleanHistory[cleanHistory.length - 1];

    // Only keep if total is >= last clean total (monotonically increasing)
    if (current.total_kg >= lastClean.total_kg) {
      cleanHistory.push(current);
    }
  }

  // Exception: If filtering leaves < 2 points, revert to original
  // (we need at least 2 points to calculate velocity)
  if (cleanHistory.length < 2) {
    return sorted;
  }

  return cleanHistory;
}

// Dampened Velocity Method for powerlifting predictions
// Respects current momentum with biological friction to prevent unrealistic projections
function calculateDampenedVelocity(
  competitions: CompetitionHistoryItem[]
): VelocityBreakdown | null {
  // Need at least 2 data points
  if (competitions.length < 2) return null;

  // Step 1: Apply Monotonic Filter to remove bad meets/strategic underperformances
  const cleanHistory = applyMonotonicFilter(competitions);

  const DAYS_PER_MONTH = 30.44;

  // Get key data points from cleaned data
  const first = cleanHistory[0];
  const secondToLast = cleanHistory[cleanHistory.length - 2];
  const last = cleanHistory[cleanHistory.length - 1];

  // Calculate time deltas in months
  const monthsBetweenLastTwo =
    (new Date(last.date).getTime() - new Date(secondToLast.date).getTime()) /
    (1000 * 60 * 60 * 24 * DAYS_PER_MONTH);

  const monthsOverall =
    (new Date(last.date).getTime() - new Date(first.date).getTime()) /
    (1000 * 60 * 60 * 24 * DAYS_PER_MONTH);

  // Calculate velocities (kg/month)
  const vRecent = monthsBetweenLastTwo > 0
    ? (last.total_kg - secondToLast.total_kg) / monthsBetweenLastTwo
    : 0;

  const vOverall = monthsOverall > 0
    ? (last.total_kg - first.total_kg) / monthsOverall
    : 0;

  // Velocity Capping: Prevent breakout performances from skewing predictions
  // If V_recent > 1.5 * V_overall, cap it (unless negative, then keep the decline)
  let vRecentClamped = vRecent;
  if (vRecent > 0 && vOverall > 0) {
    const maxAllowedRecent = vOverall * 1.5;
    if (vRecent > maxAllowedRecent) {
      vRecentClamped = maxAllowedRecent;
    }
  }

  // Weighted velocity (60% recent, 40% overall for smoother predictions)
  const vWeighted = (0.6 * vRecentClamped) + (0.4 * vOverall);

  // Apply friction coefficient (biological adaptation)
  const finalVelocity = vWeighted * 0.9;

  return {
    vRecent,
    vRecentClamped,
    vOverall,
    vWeighted,
    finalVelocity
  };
}

// Calculate prediction for a lifter using Dampened Velocity Method
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

  // Calculate velocity breakdown
  const velocity = calculateDampenedVelocity(competitions);

  if (!velocity) {
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

  // Sort competitions by date
  const sorted = [...competitions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const lastComp = sorted[sorted.length - 1];
  const lastTotal = lastComp.total_kg;
  const lastDate = new Date(lastComp.date);
  const targetDateObj = new Date(targetDate);

  // Calculate months to future date
  const DAYS_PER_MONTH = 30.44;
  const monthsToFuture =
    (targetDateObj.getTime() - lastDate.getTime()) /
    (1000 * 60 * 60 * 24 * DAYS_PER_MONTH);

  // Apply the prediction formula
  let predictedTotal = lastTotal + (monthsToFuture * velocity.finalVelocity);

  // Convert rate to kg/year for display
  const ratePerYear = velocity.finalVelocity * 12;

  // Determine trend
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (Math.abs(ratePerYear) > 5) {
    trend = ratePerYear > 0 ? 'improving' : 'declining';
  }

  // Round to nearest 2.5 kg
  predictedTotal = Math.round(predictedTotal / 2.5) * 2.5;

  // Calculate R² based on velocity consistency (approximation)
  // Higher consistency = higher R²
  const velocityRatio = velocity.vOverall !== 0
    ? Math.abs(velocity.vRecent / velocity.vOverall)
    : 1;
  const rSquared = Math.max(0, Math.min(1, 1 - Math.abs(1 - velocityRatio) * 0.5));

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

// URL param keys (short for cleaner URLs)
const URL_PARAMS = {
  LIFTERS: 'lifters',
  WEIGHT_CLASS: 'wc',
  AGGREGATION: 'agg',
  RANKING: 'rank',
  VIEW: 'view',
  SORT: 'sort',
  SORT_DIR: 'dir',
  TARGET_DATE: 'target',
  TREND_RANGE: 'range',
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
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Helper to get default date range
  const getDefaultDates = () => {
    const now = new Date();
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(now.getFullYear() - 3);
    return {
      start: threeYearsAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };
  };

  // Initialize state from URL params, falling back to sessionStorage, then defaults
  const [selectedLifters, setSelectedLifters] = useState<string[]>(() => {
    const urlLifters = searchParams.get(URL_PARAMS.LIFTERS);
    if (urlLifters) return urlLifters.split(',').filter(Boolean);
    return getStorageItem(STORAGE_KEYS.SELECTED_LIFTERS, []);
  });

  const [comparisonData, setComparisonData] = useState<BestLifts[] | null>(null);

  const [startDate, setStartDate] = useState<string>(() =>
    getStorageItem(STORAGE_KEYS.START_DATE, getDefaultDates().start)
  );
  const [endDate, setEndDate] = useState<string>(() =>
    getStorageItem(STORAGE_KEYS.END_DATE, getDefaultDates().end)
  );

  const [weightClass, setWeightClass] = useState<string>(() => {
    const urlWc = searchParams.get(URL_PARAMS.WEIGHT_CLASS);
    if (urlWc) return urlWc;
    return getStorageItem(STORAGE_KEYS.WEIGHT_CLASS, '');
  });

  const [weightClasses, setWeightClasses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    const urlSort = searchParams.get(URL_PARAMS.SORT) as SortColumn | null;
    if (urlSort && ['name', 'squat', 'bench', 'deadlift', 'total', 'meets', 'prediction'].includes(urlSort)) {
      return urlSort;
    }
    return getStorageItem(STORAGE_KEYS.SORT_COLUMN, 'prediction');
  });

  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const urlDir = searchParams.get(URL_PARAMS.SORT_DIR) as SortDirection | null;
    if (urlDir && ['asc', 'desc'].includes(urlDir)) return urlDir;
    return getStorageItem(STORAGE_KEYS.SORT_DIRECTION, 'desc');
  });

  const [useFuzzySearch, setUseFuzzySearch] = useState(false);
  const [showFuzzyInfo, setShowFuzzyInfo] = useState(false);
  const [showComparisonInfo, setShowComparisonInfo] = useState(false);

  const [aggregationMode, setAggregationMode] = useState<AggregationMode>(() => {
    const urlAgg = searchParams.get(URL_PARAMS.AGGREGATION) as AggregationMode | null;
    if (urlAgg && ['byLift', 'byComp'].includes(urlAgg)) return urlAgg;
    return getStorageItem(STORAGE_KEYS.AGGREGATION_MODE, 'byComp');
  });

  const [rankingMethod, setRankingMethod] = useState<RankingMethod>(() => {
    const urlRank = searchParams.get(URL_PARAMS.RANKING) as RankingMethod | null;
    if (urlRank && ['total', 'ipfgl'].includes(urlRank)) return urlRank;
    return getStorageItem(STORAGE_KEYS.RANKING_METHOD, 'total');
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const urlView = searchParams.get(URL_PARAMS.VIEW) as ViewMode | null;
    if (urlView && ['list', 'tiles'].includes(urlView)) return urlView;
    const saved = getStorageItem<ViewMode | null>(STORAGE_KEYS.VIEW_MODE, null);
    if (saved) return saved;
    return window.innerWidth < 768 ? 'tiles' : 'list';
  });

  // Prediction feature state - always enabled
  const [predictionEnabled] = useState(true);

  const [targetDate, setTargetDate] = useState<string>(() => {
    const urlTarget = searchParams.get(URL_PARAMS.TARGET_DATE);
    if (urlTarget) return urlTarget;
    return new Date().toISOString().split('T')[0];
  });

  const [trendRange, setTrendRange] = useState<TrendRange>(() => {
    const urlRange = searchParams.get(URL_PARAMS.TREND_RANGE);
    if (urlRange && ['12', '18', '24'].includes(urlRange)) {
      return parseInt(urlRange) as TrendRange;
    }
    return 18;
  });

  const [predictions, setPredictions] = useState<Map<string, PredictionAnalysis>>(new Map());
  const [isPredicting, setIsPredicting] = useState(false);

  // Expanded lifter profile state (accordion - only one at a time)
  const [expandedLifter, setExpandedLifter] = useState<string | null>(null);
  const [expandedProfile, setExpandedProfile] = useState<LifterProfileType | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showAllCompetitions, setShowAllCompetitions] = useState(false);

  // Update URL params when state changes
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams();

    // Only add params that differ from defaults
    if (selectedLifters.length > 0) {
      params.set(URL_PARAMS.LIFTERS, selectedLifters.join(','));
    }
    if (weightClass) {
      params.set(URL_PARAMS.WEIGHT_CLASS, weightClass);
    }
    if (aggregationMode !== 'byComp') {
      params.set(URL_PARAMS.AGGREGATION, aggregationMode);
    }
    if (rankingMethod !== 'total') {
      params.set(URL_PARAMS.RANKING, rankingMethod);
    }
    if (viewMode !== (window.innerWidth < 768 ? 'tiles' : 'list')) {
      params.set(URL_PARAMS.VIEW, viewMode);
    }
    if (sortColumn !== 'prediction') {
      params.set(URL_PARAMS.SORT, sortColumn);
    }
    if (sortDirection !== 'desc') {
      params.set(URL_PARAMS.SORT_DIR, sortDirection);
    }
    // Only include target date if it's in the future
    const today = new Date().toISOString().split('T')[0];
    if (targetDate !== today) {
      params.set(URL_PARAMS.TARGET_DATE, targetDate);
    }
    if (trendRange !== 18) {
      params.set(URL_PARAMS.TREND_RANGE, String(trendRange));
    }

    setSearchParams(params, { replace: true });
  }, [selectedLifters, weightClass, aggregationMode, rankingMethod, viewMode, sortColumn, sortDirection, targetDate, trendRange, setSearchParams]);

  // Sync URL when state changes
  useEffect(() => {
    updateUrlParams();
  }, [updateUrlParams]);

  // Persist to sessionStorage as backup
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
    if (selectedLifters.length < 1) {
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

  // Fetch expanded lifter's profile
  useEffect(() => {
    if (!expandedLifter) {
      setExpandedProfile(null);
      return;
    }

    setIsLoadingProfile(true);
    api.getLifterProfile(expandedLifter)
      .then(setExpandedProfile)
      .catch((err) => {
        console.error('Error loading expanded profile:', err);
        setExpandedProfile(null);
      })
      .finally(() => setIsLoadingProfile(false));
  }, [expandedLifter]);

  // Toggle expanded lifter (accordion behavior)
  // Relies on CSS overflow-anchor for scroll preservation
  const toggleExpandedLifter = (lifterName: string) => {
    if (expandedLifter === lifterName) {
      setExpandedLifter(null);
      setShowAllCompetitions(false);
    } else {
      setExpandedLifter(lifterName);
      setShowAllCompetitions(false);
    }
  };

  // Filter expanded profile competitions by weight class
  const filteredExpandedCompetitions = useMemo(() => {
    if (!expandedProfile?.competitions) return [];
    if (!weightClass) return expandedProfile.competitions;
    if (weightClass === '__unclassed__') {
      return expandedProfile.competitions.filter(comp => !comp.weight_class_kg);
    }
    return expandedProfile.competitions.filter(comp => comp.weight_class_kg === weightClass);
  }, [expandedProfile?.competitions, weightClass]);

  // Compute best lifts from filtered expanded competitions
  const expandedBestLifts = useMemo(() => {
    if (filteredExpandedCompetitions.length === 0) return null;

    const findBest = (key: 'best3_squat_kg' | 'best3_bench_kg' | 'best3_deadlift_kg' | 'total_kg'): Competition | null => {
      let best: Competition | null = null;
      let maxVal = 0;
      filteredExpandedCompetitions.forEach(comp => {
        const val = comp[key];
        if (val && val > maxVal) {
          maxVal = val;
          best = comp;
        }
      });
      return best;
    };

    return {
      best_squat: findBest('best3_squat_kg'),
      best_bench: findBest('best3_bench_kg'),
      best_deadlift: findBest('best3_deadlift_kg'),
      best_total: findBest('total_kg')
    };
  }, [filteredExpandedCompetitions]);

  // Compute success rates from filtered expanded competitions
  const expandedSuccessRates = useMemo(() => {
    if (filteredExpandedCompetitions.length === 0) return null;

    const calcRates = (a1Key: keyof Competition, a2Key: keyof Competition, a3Key: keyof Competition) => {
      let a1Made = 0, a1Total = 0;
      let a2Made = 0, a2Total = 0;
      let a3Made = 0, a3Total = 0;

      filteredExpandedCompetitions.forEach(comp => {
        const a1 = comp[a1Key] as number | undefined;
        const a2 = comp[a2Key] as number | undefined;
        const a3 = comp[a3Key] as number | undefined;

        if (a1 != null && a1 !== 0) {
          a1Total++;
          if (a1 > 0) a1Made++;
        }
        if (a2 != null && a2 !== 0) {
          a2Total++;
          if (a2 > 0) a2Made++;
        }
        if (a3 != null && a3 !== 0) {
          a3Total++;
          if (a3 > 0) a3Made++;
        }
      });

      return {
        attempt1: a1Total > 0 ? { rate: (a1Made / a1Total) * 100, made: a1Made, total: a1Total } : null,
        attempt2: a2Total > 0 ? { rate: (a2Made / a2Total) * 100, made: a2Made, total: a2Total } : null,
        attempt3: a3Total > 0 ? { rate: (a3Made / a3Total) * 100, made: a3Made, total: a3Total } : null
      };
    };

    return {
      squat: calcRates('squat1_kg', 'squat2_kg', 'squat3_kg'),
      bench: calcRates('bench1_kg', 'bench2_kg', 'bench3_kg'),
      deadlift: calcRates('deadlift1_kg', 'deadlift2_kg', 'deadlift3_kg')
    };
  }, [filteredExpandedCompetitions]);

  // Compute opener tendencies from filtered expanded competitions
  const expandedOpenerTendencies = useMemo(() => {
    if (filteredExpandedCompetitions.length === 0) return null;

    const calcTendency = (a1Key: keyof Competition, bestKey: keyof Competition) => {
      const percentages: number[] = [];
      filteredExpandedCompetitions.forEach(comp => {
        const a1 = comp[a1Key] as number | undefined;
        const best = comp[bestKey] as number | undefined;
        if (!a1 || !best || best <= 0) return;
        const pct = (Math.abs(a1) / best) * 100;
        if (pct >= 50 && pct <= 110) percentages.push(pct);
      });
      if (percentages.length === 0) return null;
      return {
        average: percentages.reduce((a, b) => a + b, 0) / percentages.length,
        min: Math.min(...percentages),
        max: Math.max(...percentages),
        competitions: percentages.length
      };
    };

    return {
      squat: calcTendency('squat1_kg', 'best3_squat_kg'),
      bench: calcTendency('bench1_kg', 'best3_bench_kg'),
      deadlift: calcTendency('deadlift1_kg', 'best3_deadlift_kg')
    };
  }, [filteredExpandedCompetitions]);

  // Compute jump patterns from filtered expanded competitions
  const expandedJumpPatterns = useMemo(() => {
    if (filteredExpandedCompetitions.length === 0) return null;

    const calcJumps = (a1Key: keyof Competition, a2Key: keyof Competition, a3Key: keyof Competition) => {
      const firstJumps: number[] = [];
      const secondJumps: number[] = [];

      filteredExpandedCompetitions.forEach(comp => {
        const a1 = comp[a1Key] as number | undefined;
        const a2 = comp[a2Key] as number | undefined;
        const a3 = comp[a3Key] as number | undefined;

        if (a1 != null && a2 != null) {
          const jump = Math.abs(a2) - Math.abs(a1);
          if (jump >= -20 && jump <= 30) firstJumps.push(jump);
        }
        if (a2 != null && a3 != null) {
          const jump = Math.abs(a3) - Math.abs(a2);
          if (jump >= -20 && jump <= 30) secondJumps.push(jump);
        }
      });

      const calcStats = (jumps: number[]) => {
        if (jumps.length === 0) return null;
        return {
          average: jumps.reduce((a, b) => a + b, 0) / jumps.length,
          min: Math.min(...jumps),
          max: Math.max(...jumps),
          count: jumps.length
        };
      };

      const first = calcStats(firstJumps);
      const second = calcStats(secondJumps);
      if (!first && !second) return null;
      return { firstJump: first, secondJump: second };
    };

    return {
      squat: calcJumps('squat1_kg', 'squat2_kg', 'squat3_kg'),
      bench: calcJumps('bench1_kg', 'bench2_kg', 'bench3_kg'),
      deadlift: calcJumps('deadlift1_kg', 'deadlift2_kg', 'deadlift3_kg')
    };
  }, [filteredExpandedCompetitions]);

  const handleAddLifter = (lifter: LifterSearchResult) => {
    if (selectedLifters.includes(lifter.name)) {
      addToast(`${lifter.name} is already in your comparison`, 'warning');
      return;
    }
    if (selectedLifters.length >= 14) {
      addToast('Maximum of 14 lifters reached', 'warning');
      return;
    }
    setSelectedLifters([...selectedLifters, lifter.name]);
    addToast(`Added ${lifter.name}`, 'success');
  };

  const handleRemoveLifter = (name: string) => {
    setSelectedLifters(selectedLifters.filter(n => n !== name));
    addToast(`Removed ${name}`, 'info');
  };

  const handleClearSelection = () => {
    const count = selectedLifters.length;

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

    // Clear URL params
    setSearchParams(new URLSearchParams(), { replace: true });

    addToast(`Cleared ${count} lifter${count !== 1 ? 's' : ''}`, 'info');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      addToast('Link copied to clipboard', 'success');
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      addToast('Link copied to clipboard', 'success');
    }
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
      <div className="flex gap-1 text-xs">
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

  // Get color class based on success rate
  const getRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-400';
    if (rate >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Chevron icon for expand/collapse
  const ChevronIcon = ({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) => (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className="p-1 hover:bg-gray-700 rounded transition-colors scroll-anchor-auto"
      title={expanded ? 'Collapse profile' : 'Expand profile'}
    >
      <svg
        className={`w-4 h-4 text-gray-400 hover:text-white transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  // Render the expanded lifter profile inline
  const renderExpandedProfile = () => {
    if (!expandedLifter) return null;

    // Loading state
    if (isLoadingProfile) {
      return (
        <tr className="scroll-anchor-none">
          <td colSpan={7} className="py-2 px-2">
            <div className="bg-gray-850 rounded-lg p-4 border border-gray-700" style={{ backgroundColor: '#1e2330' }}>
              <div className="flex items-center gap-2 text-gray-400">
                <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                <span>Loading profile...</span>
              </div>
            </div>
          </td>
        </tr>
      );
    }

    if (!expandedProfile) return null;

    return (
      <tr className="scroll-anchor-none">
        <td colSpan={7} className="py-2 px-2">
          <div className="rounded-lg p-4 border border-gray-700 border-l-4 border-l-primary-500" style={{ backgroundColor: '#1e2330' }}>
            {/* Compact header - just filter info */}
            {(weightClass || filteredExpandedCompetitions.length !== expandedProfile.competitions.length) && (
              <div className="flex items-center justify-between mb-3 text-sm">
                {weightClass && (
                  <span className="text-primary-400">Filtered to {weightClass} kg</span>
                )}
                <span className="text-gray-500 ml-auto">
                  {filteredExpandedCompetitions.length} of {expandedProfile.competitions.length} competitions
                </span>
              </div>
            )}

            {filteredExpandedCompetitions.length === 0 && weightClass && (
              <p className="text-yellow-500 text-sm mb-3">No data in this weight class</p>
            )}

            {filteredExpandedCompetitions.length > 0 && (
              <>
                {/* Personal Bests Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  {/* Squat Card */}
                  <div className="bg-gray-900 rounded-lg p-3">
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500">Best Squat</div>
                        <div className="text-2xl font-bold text-green-400">{formatWeight(expandedBestLifts?.best_squat?.best3_squat_kg)}</div>
                        {expandedBestLifts?.best_squat && renderAttempts(
                          expandedBestLifts.best_squat.squat1_kg,
                          expandedBestLifts.best_squat.squat2_kg,
                          expandedBestLifts.best_squat.squat3_kg,
                          'text-green-400/80'
                        )}
                        <div className="text-xs text-gray-500 mt-1">{formatDate(expandedBestLifts?.best_squat?.date)}</div>
                      </div>
                      {/* Stats */}
                      <div className="flex gap-1">
                        {expandedSuccessRates?.squat && (
                          <div className="flex flex-col gap-0.5 text-center">
                            <div className="text-[9px] text-gray-500">Success</div>
                            {[expandedSuccessRates.squat.attempt1, expandedSuccessRates.squat.attempt2, expandedSuccessRates.squat.attempt3].map((data, idx) => (
                              <div key={idx} className="bg-gray-800 rounded px-1.5 py-0.5">
                                {data ? (
                                  <div className={`text-xs font-bold ${getRateColor(data.rate)}`}>{data.rate.toFixed(0)}%</div>
                                ) : (
                                  <div className="text-gray-700 text-xs">-</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {expandedOpenerTendencies?.squat && (
                          <div className="flex flex-col gap-0.5 text-center">
                            <div className="text-[9px] text-gray-500">Jumps</div>
                            <div className="bg-gray-800 rounded px-1.5 py-0.5">
                              <div className="text-xs font-bold text-green-400">{expandedOpenerTendencies.squat.average.toFixed(0)}%</div>
                            </div>
                            {expandedJumpPatterns?.squat?.firstJump && (
                              <div className="bg-gray-800 rounded px-1.5 py-0.5">
                                <div className="text-xs font-bold text-green-400">+{expandedJumpPatterns.squat.firstJump.average.toFixed(0)}</div>
                              </div>
                            )}
                            {expandedJumpPatterns?.squat?.secondJump && (
                              <div className="bg-gray-800 rounded px-1.5 py-0.5">
                                <div className="text-xs font-bold text-green-400">+{expandedJumpPatterns.squat.secondJump.average.toFixed(0)}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bench Card */}
                  <div className="bg-gray-900 rounded-lg p-3">
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500">Best Bench</div>
                        <div className="text-2xl font-bold text-blue-400">{formatWeight(expandedBestLifts?.best_bench?.best3_bench_kg)}</div>
                        {expandedBestLifts?.best_bench && renderAttempts(
                          expandedBestLifts.best_bench.bench1_kg,
                          expandedBestLifts.best_bench.bench2_kg,
                          expandedBestLifts.best_bench.bench3_kg,
                          'text-blue-400/80'
                        )}
                        <div className="text-xs text-gray-500 mt-1">{formatDate(expandedBestLifts?.best_bench?.date)}</div>
                      </div>
                      <div className="flex gap-1">
                        {expandedSuccessRates?.bench && (
                          <div className="flex flex-col gap-0.5 text-center">
                            <div className="text-[9px] text-gray-500">Success</div>
                            {[expandedSuccessRates.bench.attempt1, expandedSuccessRates.bench.attempt2, expandedSuccessRates.bench.attempt3].map((data, idx) => (
                              <div key={idx} className="bg-gray-800 rounded px-1.5 py-0.5">
                                {data ? (
                                  <div className={`text-xs font-bold ${getRateColor(data.rate)}`}>{data.rate.toFixed(0)}%</div>
                                ) : (
                                  <div className="text-gray-700 text-xs">-</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {expandedOpenerTendencies?.bench && (
                          <div className="flex flex-col gap-0.5 text-center">
                            <div className="text-[9px] text-gray-500">Jumps</div>
                            <div className="bg-gray-800 rounded px-1.5 py-0.5">
                              <div className="text-xs font-bold text-blue-400">{expandedOpenerTendencies.bench.average.toFixed(0)}%</div>
                            </div>
                            {expandedJumpPatterns?.bench?.firstJump && (
                              <div className="bg-gray-800 rounded px-1.5 py-0.5">
                                <div className="text-xs font-bold text-blue-400">+{expandedJumpPatterns.bench.firstJump.average.toFixed(0)}</div>
                              </div>
                            )}
                            {expandedJumpPatterns?.bench?.secondJump && (
                              <div className="bg-gray-800 rounded px-1.5 py-0.5">
                                <div className="text-xs font-bold text-blue-400">+{expandedJumpPatterns.bench.secondJump.average.toFixed(0)}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Deadlift Card */}
                  <div className="bg-gray-900 rounded-lg p-3">
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500">Best Deadlift</div>
                        <div className="text-2xl font-bold text-red-400">{formatWeight(expandedBestLifts?.best_deadlift?.best3_deadlift_kg)}</div>
                        {expandedBestLifts?.best_deadlift && renderAttempts(
                          expandedBestLifts.best_deadlift.deadlift1_kg,
                          expandedBestLifts.best_deadlift.deadlift2_kg,
                          expandedBestLifts.best_deadlift.deadlift3_kg,
                          'text-red-400/80'
                        )}
                        <div className="text-xs text-gray-500 mt-1">{formatDate(expandedBestLifts?.best_deadlift?.date)}</div>
                      </div>
                      <div className="flex gap-1">
                        {expandedSuccessRates?.deadlift && (
                          <div className="flex flex-col gap-0.5 text-center">
                            <div className="text-[9px] text-gray-500">Success</div>
                            {[expandedSuccessRates.deadlift.attempt1, expandedSuccessRates.deadlift.attempt2, expandedSuccessRates.deadlift.attempt3].map((data, idx) => (
                              <div key={idx} className="bg-gray-800 rounded px-1.5 py-0.5">
                                {data ? (
                                  <div className={`text-xs font-bold ${getRateColor(data.rate)}`}>{data.rate.toFixed(0)}%</div>
                                ) : (
                                  <div className="text-gray-700 text-xs">-</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {expandedOpenerTendencies?.deadlift && (
                          <div className="flex flex-col gap-0.5 text-center">
                            <div className="text-[9px] text-gray-500">Jumps</div>
                            <div className="bg-gray-800 rounded px-1.5 py-0.5">
                              <div className="text-xs font-bold text-red-400">{expandedOpenerTendencies.deadlift.average.toFixed(0)}%</div>
                            </div>
                            {expandedJumpPatterns?.deadlift?.firstJump && (
                              <div className="bg-gray-800 rounded px-1.5 py-0.5">
                                <div className="text-xs font-bold text-red-400">+{expandedJumpPatterns.deadlift.firstJump.average.toFixed(0)}</div>
                              </div>
                            )}
                            {expandedJumpPatterns?.deadlift?.secondJump && (
                              <div className="bg-gray-800 rounded px-1.5 py-0.5">
                                <div className="text-xs font-bold text-red-400">+{expandedJumpPatterns.deadlift.secondJump.average.toFixed(0)}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Total Card */}
                  <div className="bg-gray-900 rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500">Best Total</div>
                      <div className="text-2xl font-bold text-purple-400">{formatWeight(expandedBestLifts?.best_total?.total_kg)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {expandedBestLifts?.best_total?.goodlift?.toFixed(2)} IPF GL
                      </div>
                      <div className="text-xs text-gray-500">{formatDate(expandedBestLifts?.best_total?.date)}</div>
                      <div className="text-xs text-gray-600 truncate">{expandedBestLifts?.best_total?.meet_name}</div>
                    </div>
                  </div>
                </div>

                {/* Competitions */}
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">
                    {showAllCompetitions ? 'All' : 'Recent'} Competitions {weightClass && `(${weightClass} kg)`}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-1 px-2 text-gray-500">Date</th>
                          <th className="text-left py-1 px-2 text-gray-500">Meet</th>
                          <th className="text-center py-1 px-2 text-gray-500">SQ</th>
                          <th className="text-center py-1 px-2 text-gray-500">BP</th>
                          <th className="text-center py-1 px-2 text-gray-500">DL</th>
                          <th className="text-center py-1 px-2 text-gray-500">Total</th>
                          <th className="text-center py-1 px-2 text-gray-500">Place</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(showAllCompetitions ? filteredExpandedCompetitions : filteredExpandedCompetitions.slice(0, 5)).map((comp, idx) => (
                          <tr key={idx} className="border-b border-gray-800">
                            <td className="py-1 px-2 text-gray-400">{formatDate(comp.date)}</td>
                            <td className="py-1 px-2 text-gray-300 max-w-[150px] truncate">{comp.meet_name}</td>
                            <td className="py-1 px-2 text-center text-green-400">{comp.best3_squat_kg || '-'}</td>
                            <td className="py-1 px-2 text-center text-blue-400">{comp.best3_bench_kg || '-'}</td>
                            <td className="py-1 px-2 text-center text-red-400">{comp.best3_deadlift_kg || '-'}</td>
                            <td className="py-1 px-2 text-center text-purple-400 font-semibold">{comp.total_kg || '-'}</td>
                            <td className="py-1 px-2 text-center text-gray-400">{comp.place || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredExpandedCompetitions.length > 5 && (
                      <div className="text-center mt-2">
                        <button
                          onClick={() => setShowAllCompetitions(!showAllCompetitions)}
                          className="text-xs text-primary-500 hover:underline"
                        >
                          {showAllCompetitions
                            ? '← Show less'
                            : `Show all ${filteredExpandedCompetitions.length} competitions →`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  // Render expanded profile for tiles view
  const renderExpandedProfileTiles = () => {
    if (!expandedLifter) return null;

    // Loading state
    if (isLoadingProfile) {
      return (
        <div className="col-span-full scroll-anchor-none rounded-lg p-4 border border-gray-700" style={{ backgroundColor: '#1e2330' }}>
          <div className="flex items-center gap-2 text-gray-400">
            <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
            <span>Loading profile...</span>
          </div>
        </div>
      );
    }

    if (!expandedProfile) return null;

    return (
      <div className="col-span-full scroll-anchor-none rounded-lg p-4 border border-gray-700 border-l-4 border-l-primary-500" style={{ backgroundColor: '#1e2330' }}>
        {/* Compact header - just filter info */}
        {(weightClass || filteredExpandedCompetitions.length !== expandedProfile.competitions.length) && (
          <div className="flex items-center justify-between mb-3 text-sm">
            {weightClass && (
              <span className="text-primary-400">Filtered to {weightClass} kg</span>
            )}
            <span className="text-gray-500 ml-auto">
              {filteredExpandedCompetitions.length} of {expandedProfile.competitions.length} competitions
            </span>
          </div>
        )}

        {filteredExpandedCompetitions.length === 0 && weightClass && (
          <p className="text-yellow-500 text-sm mb-3">No data in this weight class</p>
        )}

        {filteredExpandedCompetitions.length > 0 ? (
          <>
            {/* Personal Bests Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {/* Squat */}
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-500">Best Squat</div>
                <div className="text-xl font-bold text-green-400">{formatWeight(expandedBestLifts?.best_squat?.best3_squat_kg)}</div>
                {expandedBestLifts?.best_squat && renderAttempts(
                  expandedBestLifts.best_squat.squat1_kg,
                  expandedBestLifts.best_squat.squat2_kg,
                  expandedBestLifts.best_squat.squat3_kg,
                  'text-green-400/80'
                )}
              </div>
              {/* Bench */}
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-500">Best Bench</div>
                <div className="text-xl font-bold text-blue-400">{formatWeight(expandedBestLifts?.best_bench?.best3_bench_kg)}</div>
                {expandedBestLifts?.best_bench && renderAttempts(
                  expandedBestLifts.best_bench.bench1_kg,
                  expandedBestLifts.best_bench.bench2_kg,
                  expandedBestLifts.best_bench.bench3_kg,
                  'text-blue-400/80'
                )}
              </div>
              {/* Deadlift */}
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-500">Best Deadlift</div>
                <div className="text-xl font-bold text-red-400">{formatWeight(expandedBestLifts?.best_deadlift?.best3_deadlift_kg)}</div>
                {expandedBestLifts?.best_deadlift && renderAttempts(
                  expandedBestLifts.best_deadlift.deadlift1_kg,
                  expandedBestLifts.best_deadlift.deadlift2_kg,
                  expandedBestLifts.best_deadlift.deadlift3_kg,
                  'text-red-400/80'
                )}
              </div>
              {/* Total */}
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-500">Best Total</div>
                <div className="text-xl font-bold text-purple-400">{formatWeight(expandedBestLifts?.best_total?.total_kg)}</div>
                <div className="text-xs text-gray-500">{expandedBestLifts?.best_total?.goodlift?.toFixed(2)} IPF GL</div>
              </div>
            </div>

            {/* Success Rates & Tendencies Summary */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {/* Squat Stats */}
              <div className="bg-gray-900 rounded-lg p-2">
                <div className="text-xs text-gray-500 mb-1">Squat Stats</div>
                <div className="flex gap-2 text-xs">
                  {expandedOpenerTendencies?.squat && (
                    <span className="text-green-400">Open: {expandedOpenerTendencies.squat.average.toFixed(0)}%</span>
                  )}
                  {expandedSuccessRates?.squat?.attempt1 && (
                    <span className={getRateColor(expandedSuccessRates.squat.attempt1.rate)}>
                      1st: {expandedSuccessRates.squat.attempt1.rate.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              {/* Bench Stats */}
              <div className="bg-gray-900 rounded-lg p-2">
                <div className="text-xs text-gray-500 mb-1">Bench Stats</div>
                <div className="flex gap-2 text-xs">
                  {expandedOpenerTendencies?.bench && (
                    <span className="text-blue-400">Open: {expandedOpenerTendencies.bench.average.toFixed(0)}%</span>
                  )}
                  {expandedSuccessRates?.bench?.attempt1 && (
                    <span className={getRateColor(expandedSuccessRates.bench.attempt1.rate)}>
                      1st: {expandedSuccessRates.bench.attempt1.rate.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              {/* Deadlift Stats */}
              <div className="bg-gray-900 rounded-lg p-2">
                <div className="text-xs text-gray-500 mb-1">Deadlift Stats</div>
                <div className="flex gap-2 text-xs">
                  {expandedOpenerTendencies?.deadlift && (
                    <span className="text-red-400">Open: {expandedOpenerTendencies.deadlift.average.toFixed(0)}%</span>
                  )}
                  {expandedSuccessRates?.deadlift?.attempt1 && (
                    <span className={getRateColor(expandedSuccessRates.deadlift.attempt1.rate)}>
                      1st: {expandedSuccessRates.deadlift.attempt1.rate.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Competitions */}
            {filteredExpandedCompetitions.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowAllCompetitions(!showAllCompetitions)}
                  className="text-xs text-primary-500 hover:underline"
                >
                  {showAllCompetitions
                    ? '← Hide competitions'
                    : `Show ${filteredExpandedCompetitions.length} competitions →`}
                </button>
                {showAllCompetitions && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-1 px-2 text-gray-500">Date</th>
                          <th className="text-left py-1 px-2 text-gray-500">Meet</th>
                          <th className="text-center py-1 px-2 text-gray-500">Total</th>
                          <th className="text-center py-1 px-2 text-gray-500">Place</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExpandedCompetitions.map((comp, idx) => (
                          <tr key={idx} className="border-b border-gray-800">
                            <td className="py-1 px-2 text-gray-400">{formatDate(comp.date)}</td>
                            <td className="py-1 px-2 text-gray-300 max-w-[120px] truncate">{comp.meet_name}</td>
                            <td className="py-1 px-2 text-center text-purple-400 font-semibold">{comp.total_kg || '-'}</td>
                            <td className="py-1 px-2 text-center text-gray-400">{comp.place || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Scout Lifters</h1>
        <p className="text-gray-400 text-center">Compare multiple lifters head-to-head</p>
      </div>

      {/* Search and Filters - Centralized */}
      <div className="max-w-2xl mx-auto mb-8">
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
          <p className="text-xs text-gray-500 mt-2">You can add up to 14 lifters</p>

          {/* Filter Criteria */}
          <div className="mt-6 pt-6">
            <h3 className="text-sm font-semibold text-white mb-4">Filter Criteria</h3>

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
            </div>

            {/* Prediction Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target Date */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Target Comp Date</label>
                <input
                  type="date"
                  className="input"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
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
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Predictions use Dampened Velocity Method with biological friction
            </p>
          </div>

          {isPredicting && (
            <div className="mt-4 flex items-center gap-2 text-gray-400 text-sm">
              <div className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
              <span>Calculating predictions...</span>
            </div>
          )}
        </div>
      </div>

      {/* Selected Lifters */}
      {selectedLifters.length > 0 && (
        <div className="card mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">
              Selected Lifters ({selectedLifters.length})
            </h2>
            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                  <span>Updating...</span>
                </div>
              )}
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                title="Copy shareable link"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span className="hidden sm:inline">Copy Link</span>
              </button>
              <button
                onClick={handleClearSelection}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Clear
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
        </div>
      )}

      {/* Comparison Results - Loading Skeleton */}
      {isLoading && selectedLifters.length >= 1 && !comparisonData && (
        <div className="card">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-white">Loading Comparison...</h2>
            </div>
          </div>
          {viewMode === 'list' ? <ScoutListSkeleton /> : <ScoutTilesSkeleton />}
        </div>
      )}

      {/* Comparison Results */}
      {comparisonData && comparisonData.length > 0 && (
        <div className="card">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-white">
                Comparison Results
                {weightClass && (
                  <span className="text-gray-400 text-sm ml-2">• {weightClass} kg class</span>
                )}
              </h2>
              <div className="relative"
                onMouseLeave={() => setShowComparisonInfo(false)}
              >
                <button
                  onMouseEnter={() => setShowComparisonInfo(true)}
                  className="w-5 h-5 rounded-full bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
                >
                  i
                </button>
                {showComparisonInfo && (
                  <>
                    {/* Backdrop for mobile */}
                    <div
                      className="fixed inset-0 z-40 sm:hidden"
                      onClick={() => setShowComparisonInfo(false)}
                    />
                    {/* Centered popover */}
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 max-w-[90vw] bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 text-xs text-gray-300 z-50">
                      <p className="font-semibold text-white mb-3">Comparison Options:</p>

                      <div className="mb-3">
                        <p className="font-semibold text-white mb-1">Data:</p>
                        <p className="mb-1 text-gray-400"><span className="text-white">By Lift:</span> Best result for each lift across all competitions (cherry-picked).</p>
                        <p className="text-gray-400"><span className="text-white">By Comp:</span> All lifts from the competition with the best total.</p>
                      </div>

                      <div className="mb-3">
                        <p className="font-semibold text-white mb-1">Rank by:</p>
                        <p className="mb-1 text-gray-400"><span className="text-white">Total:</span> Sort lifters by raw kilogram total.</p>
                        <p className="text-gray-400"><span className="text-white">IPF GL:</span> Sort by IPF Goodlift points (bodyweight-adjusted).</p>
                      </div>

                      <div>
                        <p className="font-semibold text-white mb-1">View:</p>
                        <p className="mb-1 text-gray-400"><span className="text-white">List:</span> Detailed table view with all attempts.</p>
                        <p className="text-gray-400"><span className="text-white">Tiles:</span> Compact card layout (mobile-friendly).</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Toggle Controls - Responsive Layout */}
            {/* Mobile: Grid Layout */}
            <div className="sm:hidden grid grid-cols-3 gap-2">
              {/* Aggregation Mode Toggle */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-gray-400 text-center">Data</span>
                <div className="inline-flex rounded-lg bg-gray-800 p-1">
                  <button
                    onClick={() => setAggregationMode('byLift')}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors flex-1 ${
                      aggregationMode === 'byLift'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Lift
                  </button>
                  <button
                    onClick={() => setAggregationMode('byComp')}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors flex-1 ${
                      aggregationMode === 'byComp'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Comp
                  </button>
                </div>
              </div>

              {/* Ranking Method Toggle */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-gray-400 text-center">Rank by</span>
                <div className="inline-flex rounded-lg bg-gray-800 p-1">
                  <button
                    onClick={() => setRankingMethod('total')}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors flex-1 ${
                      rankingMethod === 'total'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Total
                  </button>
                  <button
                    onClick={() => setRankingMethod('ipfgl')}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors flex-1 ${
                      rankingMethod === 'ipfgl'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    GL
                  </button>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-gray-400 text-center">View</span>
                <div className="inline-flex rounded-lg bg-gray-800 p-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors flex-1 ${
                      viewMode === 'list'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('tiles')}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors flex-1 ${
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

            {/* Desktop: Inline Layout */}
            <div className="hidden sm:flex sm:flex-wrap gap-3 sm:gap-4 justify-center">
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
                <th className="w-8 py-2 px-1"></th>
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
                  className="text-left py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('prediction')}
                >
                  Pred.<SortIcon column="prediction" />
                </th>
              </tr>
            </thead>
            <tbody>
              {getSortedData().map((lifter) => (
                <React.Fragment key={lifter.name}>
                  <tr className={`border-b border-gray-800 hover:bg-gray-800/50 scroll-anchor-auto ${expandedLifter === lifter.name ? 'bg-gray-800/30' : ''}`}>
                    <td className="py-2 px-1">
                      <ChevronIcon
                        expanded={expandedLifter === lifter.name}
                        onToggle={() => toggleExpandedLifter(lifter.name)}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <a
                        href={`/lifter/${encodeURIComponent(lifter.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-white hover:text-primary-500 transition-colors"
                      >
                        {lifter.name}
                      </a>
                      <div className="text-xs text-gray-500">Meets: {lifter.total_competitions}</div>
                    </td>
                    <td className="py-2 px-2">
                      {lifter.best_squat ? (
                        <div>
                          <div className="font-semibold text-green-400">{lifter.best_squat.best3_squat_kg} kg</div>
                          {renderAttempts(lifter.best_squat.squat1_kg, lifter.best_squat.squat2_kg, lifter.best_squat.squat3_kg, 'text-green-400/80')}
                          <div className="text-xs text-gray-500 mt-0.5">{formatDate(lifter.best_squat.date)}</div>
                          <div className="text-xs text-gray-600 truncate max-w-[150px]">{lifter.best_squat.meet_name}</div>
                        </div>
                      ) : <span className="text-gray-600">-</span>}
                    </td>
                    <td className="py-2 px-2">
                      {lifter.best_bench ? (
                        <div>
                          <div className="font-semibold text-blue-400">{lifter.best_bench.best3_bench_kg} kg</div>
                          {renderAttempts(lifter.best_bench.bench1_kg, lifter.best_bench.bench2_kg, lifter.best_bench.bench3_kg, 'text-blue-400/80')}
                          <div className="text-xs text-gray-500 mt-0.5">{formatDate(lifter.best_bench.date)}</div>
                          <div className="text-xs text-gray-600 truncate max-w-[150px]">{lifter.best_bench.meet_name}</div>
                        </div>
                      ) : <span className="text-gray-600">-</span>}
                    </td>
                    <td className="py-2 px-2">
                      {lifter.best_deadlift ? (
                        <div>
                          <div className="font-semibold text-red-400">{lifter.best_deadlift.best3_deadlift_kg} kg</div>
                          {renderAttempts(lifter.best_deadlift.deadlift1_kg, lifter.best_deadlift.deadlift2_kg, lifter.best_deadlift.deadlift3_kg, 'text-red-400/80')}
                          <div className="text-xs text-gray-500 mt-0.5">{formatDate(lifter.best_deadlift.date)}</div>
                          <div className="text-xs text-gray-600 truncate max-w-[150px]">{lifter.best_deadlift.meet_name}</div>
                        </div>
                      ) : <span className="text-gray-600">-</span>}
                    </td>
                    <td className="py-2 px-2">
                      {lifter.best_total ? (
                        <div>
                          <div className="font-semibold text-purple-400">{lifter.best_total.total_kg} kg</div>
                          <div className="text-xs text-gray-500">{formatIPFGL(lifter.best_total.goodlift)}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatDate(lifter.best_total.date)}
                            {lifter.best_total.weight_class_kg ? (
                              <span className="ml-1 text-gray-400">@ {lifter.best_total.weight_class_kg}</span>
                            ) : lifter.best_total.bodyweight_kg ? (
                              <span className="ml-1 text-gray-400">BW {lifter.best_total.bodyweight_kg}</span>
                            ) : null}
                          </div>
                          <div className="text-xs text-gray-600 truncate max-w-[150px]">{lifter.best_total.meet_name}</div>
                        </div>
                      ) : <span className="text-gray-600">-</span>}
                    </td>
                    {(() => {
                      const prediction = predictions.get(lifter.name);
                      return (
                        <td className="py-2 px-2">
                          {prediction?.hasEnoughData ? (
                            <div>
                              <div className="font-semibold text-yellow-400">{prediction.predictedTotal} kg</div>
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
                  {expandedLifter === lifter.name && renderExpandedProfile()}
                </React.Fragment>
              ))}
            </tbody>
          </table>
            </div>
          )}

          {/* Tiles View */}
          {viewMode === 'tiles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getSortedData().map((lifter) => (
                <React.Fragment key={lifter.name}>
                  <div className={`bg-gray-800 rounded-lg p-4 border transition-colors scroll-anchor-auto ${expandedLifter === lifter.name ? 'border-primary-500' : 'border-gray-700 hover:border-primary-500'}`}>
                    <div className="flex items-start justify-between mb-1">
                      <a
                        href={`/lifter/${encodeURIComponent(lifter.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-bold text-white hover:text-primary-500 transition-colors block"
                      >
                        {lifter.name}
                      </a>
                      <ChevronIcon
                        expanded={expandedLifter === lifter.name}
                        onToggle={() => toggleExpandedLifter(lifter.name)}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mb-3">Meets: {lifter.total_competitions}</div>

                    <div className="space-y-3">
                      {/* S/B/D with attempts */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Squat */}
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Squat</div>
                          {lifter.best_squat ? (
                            <>
                              <div className="font-semibold text-green-400">{lifter.best_squat.best3_squat_kg} kg</div>
                              {renderAttempts(lifter.best_squat.squat1_kg, lifter.best_squat.squat2_kg, lifter.best_squat.squat3_kg, 'text-green-400/80')}
                            </>
                          ) : <span className="text-gray-600">-</span>}
                        </div>

                        {/* Bench */}
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Bench</div>
                          {lifter.best_bench ? (
                            <>
                              <div className="font-semibold text-blue-400">{lifter.best_bench.best3_bench_kg} kg</div>
                              {renderAttempts(lifter.best_bench.bench1_kg, lifter.best_bench.bench2_kg, lifter.best_bench.bench3_kg, 'text-blue-400/80')}
                            </>
                          ) : <span className="text-gray-600">-</span>}
                        </div>

                        {/* Deadlift */}
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Deadlift</div>
                          {lifter.best_deadlift ? (
                            <>
                              <div className="font-semibold text-red-400">{lifter.best_deadlift.best3_deadlift_kg} kg</div>
                              {renderAttempts(lifter.best_deadlift.deadlift1_kg, lifter.best_deadlift.deadlift2_kg, lifter.best_deadlift.deadlift3_kg, 'text-red-400/80')}
                            </>
                          ) : <span className="text-gray-600">-</span>}
                        </div>
                      </div>

                      {/* Total and Prediction - Same Row */}
                      <div className="pt-2 border-t border-gray-700">
                        <div className="grid grid-cols-2 gap-3">
                          {/* Total */}
                          <div>
                            <div className="text-xs text-gray-500 mb-1">{rankingMethod === 'total' ? 'Total' : 'IPF GL'}</div>
                            {lifter.best_total ? (
                              <div>
                                {rankingMethod === 'total' ? (
                                  <>
                                    <div className="font-bold text-purple-400 text-lg">{formatWeight(lifter.best_total.total_kg)}</div>
                                    <div className="text-xs text-gray-500">{formatIPFGL(lifter.best_total.goodlift)}</div>
                                  </>
                                ) : (
                                  <>
                                    <div className="font-bold text-purple-400 text-lg">{formatIPFGL(lifter.best_total.goodlift)}</div>
                                    <div className="text-xs text-gray-500">{formatWeight(lifter.best_total.total_kg)}</div>
                                  </>
                                )}
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatDate(lifter.best_total.date)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {lifter.best_total.weight_class_kg ? (
                                    <span>@ {lifter.best_total.weight_class_kg} kg</span>
                                  ) : lifter.best_total.bodyweight_kg ? (
                                    <span>BW {lifter.best_total.bodyweight_kg} kg</span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-gray-600 line-clamp-2 mt-0.5">{lifter.best_total.meet_name}</div>
                              </div>
                            ) : <span className="text-gray-600">-</span>}
                          </div>

                          {/* Prediction */}
                          {(() => {
                            const prediction = predictions.get(lifter.name);
                            return (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Predicted</div>
                                {prediction?.hasEnoughData ? (
                                  <div>
                                    <div className="font-bold text-yellow-400 text-lg">{formatWeight(prediction.predictedTotal!)}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {prediction.competitionsInRange} {prediction.competitionsInRange === 1 ? 'comp' : 'comps'} over {trendRange}mo
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
                    </div>
                  </div>
                  {expandedLifter === lifter.name && renderExpandedProfileTiles()}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedLifters.length === 0 && (
        <div className="card text-center py-12">
          <h3 className="text-xl font-semibold text-white mb-2">Start Scouting</h3>
          <p className="text-gray-400">Search and add lifters to begin comparing their performances</p>
        </div>
      )}
    </div>
  );
}
