import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { LifterProfileSkeleton } from '../components/Skeleton';
import type { LifterProfile as LifterProfileType, Competition, BestLifts } from '../types';

interface OpenerTendency {
  average: number;
  min: number;
  max: number;
  competitions: number;
}

interface OpenerTendencies {
  squat: OpenerTendency | null;
  bench: OpenerTendency | null;
  deadlift: OpenerTendency | null;
}

interface JumpStats {
  average: number;
  min: number;
  max: number;
  count: number;
}

interface LiftJumps {
  firstJump: JumpStats | null;
  secondJump: JumpStats | null;
}

interface JumpPatterns {
  squat: LiftJumps | null;
  bench: LiftJumps | null;
  deadlift: LiftJumps | null;
}

interface AttemptRate {
  rate: number;
  made: number;
  total: number;
}

interface LiftSuccessRates {
  attempt1: AttemptRate | null;
  attempt2: AttemptRate | null;
  attempt3: AttemptRate | null;
}

interface SuccessRates {
  squat: LiftSuccessRates | null;
  bench: LiftSuccessRates | null;
  deadlift: LiftSuccessRates | null;
}

type CompSortColumn = 'date' | 'meet' | 'federation' | 'squat' | 'bench' | 'deadlift' | 'total' | 'ipfgl' | 'place';
type SortDirection = 'asc' | 'desc';

export function LifterProfile() {
  const { name } = useParams<{ name: string }>();
  const [profile, setProfile] = useState<LifterProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<CompSortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [weightClass, setWeightClass] = useState<string>('');
  const [weightClasses, setWeightClasses] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [bestLifts, setBestLifts] = useState<BestLifts | null>(null);
  const [openerTendencies, setOpenerTendencies] = useState<OpenerTendencies | null>(null);
  const [jumpPatterns, setJumpPatterns] = useState<JumpPatterns | null>(null);
  const [successRates, setSuccessRates] = useState<SuccessRates | null>(null);

  // Load lifter profile
  useEffect(() => {
    if (!name) return;

    setIsLoading(true);
    setError(null);

    api.getLifterProfile(decodeURIComponent(name))
      .then(setProfile)
      .catch((err) => {
        console.error('Error loading profile:', err);
        setError(err.message || 'Failed to load lifter profile');
      })
      .finally(() => setIsLoading(false));
  }, [name]);

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

  // Load best lifts with attempts
  useEffect(() => {
    if (!name) return;
    api.getBestLifts(decodeURIComponent(name), 10) // 10 years to get career bests
      .then(setBestLifts)
      .catch(err => console.error('Error loading best lifts:', err));
  }, [name]);

  // Load opener tendencies
  useEffect(() => {
    if (!name) return;
    api.getOpenerTendencies(decodeURIComponent(name))
      .then(setOpenerTendencies)
      .catch(err => console.error('Error loading opener tendencies:', err));
  }, [name]);

  // Load jump patterns
  useEffect(() => {
    if (!name) return;
    api.getJumpPatterns(decodeURIComponent(name))
      .then(setJumpPatterns)
      .catch(err => console.error('Error loading jump patterns:', err));
  }, [name]);

  // Load attempt success rates
  useEffect(() => {
    if (!name) return;
    api.getAttemptSuccessRates(decodeURIComponent(name))
      .then(setSuccessRates)
      .catch(err => console.error('Error loading success rates:', err));
  }, [name]);

  if (isLoading) {
    return <LifterProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Lifter Not Found</h2>
        <p className="text-gray-400 mb-6">{error || 'Could not find this lifter'}</p>
        <Link to="/" className="btn btn-primary">Back to Home</Link>
      </div>
    );
  }

  const formatWeight = (kg?: number) => kg ? `${kg} kg` : 'N/A';
  const formatDate = (date?: string) => date ? new Date(date).toLocaleDateString() : 'N/A';

  const handleSort = (column: CompSortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to descending for new column (most recent/highest first)
      setSortColumn(column);
      setSortDirection(column === 'date' ? 'desc' : 'desc');
    }
  };

  const getFilteredAndSortedCompetitions = (competitions: Competition[]) => {
    // First filter by weight class and date range
    let filtered = competitions;

    if (weightClass) {
      filtered = filtered.filter(comp => comp.weight_class_kg === weightClass);
    }

    if (startDate) {
      filtered = filtered.filter(comp => comp.date >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(comp => comp.date <= endDate);
    }

    // Then sort
    return [...filtered].sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortColumn) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'meet':
          aValue = a.meet_name;
          bValue = b.meet_name;
          break;
        case 'federation':
          aValue = a.federation;
          bValue = b.federation;
          break;
        case 'squat':
          aValue = a.best3_squat_kg || 0;
          bValue = b.best3_squat_kg || 0;
          break;
        case 'bench':
          aValue = a.best3_bench_kg || 0;
          bValue = b.best3_bench_kg || 0;
          break;
        case 'deadlift':
          aValue = a.best3_deadlift_kg || 0;
          bValue = b.best3_deadlift_kg || 0;
          break;
        case 'total':
          aValue = a.total_kg || 0;
          bValue = b.total_kg || 0;
          break;
        case 'ipfgl':
          aValue = a.goodlift || 0;
          bValue = b.goodlift || 0;
          break;
        case 'place':
          // Handle place sorting - convert to number if possible, otherwise treat as string
          const aPlace = a.place || '';
          const bPlace = b.place || '';
          const aNum = parseInt(aPlace);
          const bNum = parseInt(bPlace);

          if (!isNaN(aNum) && !isNaN(bNum)) {
            aValue = aNum;
            bValue = bNum;
          } else {
            aValue = aPlace;
            bValue = bPlace;
          }
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
  };

  const SortIcon = ({ column }: { column: CompSortColumn }) => {
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
      <div className="flex gap-2 text-sm mt-1">
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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link to="/" className="text-primary-500 hover:underline mb-4 inline-block">← Back to Search</Link>
        <h1 className="text-4xl font-bold text-white mb-2">{profile.name}</h1>
        <div className="flex flex-wrap gap-4 text-gray-400">
          <span>{profile.sex} • {profile.country || 'Unknown'}</span>
          <span>•</span>
          <span>{profile.total_competitions} competitions</span>
          <span>•</span>
          <span>
            {formatDate(profile.first_competition_date)} - {formatDate(profile.last_competition_date)}
          </span>
        </div>
      </div>

      {/* Personal Bests */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {/* Squat Card */}
        <div className="card p-4">
          <div className="flex gap-3">
            {/* Main lift info */}
            <div className="flex-1 min-w-0">
              <div className="text-base text-gray-400">Best Squat</div>
              <div className="text-4xl font-bold text-green-400 leading-tight">{formatWeight(profile.best_squat_kg)}</div>
              {bestLifts?.best_squat && renderAttempts(
                bestLifts.best_squat.squat1_kg,
                bestLifts.best_squat.squat2_kg,
                bestLifts.best_squat.squat3_kg,
                'text-green-400/80'
              )}
              <div className="text-base text-gray-500 mt-1">{formatDate(profile.best_squat_date)}</div>
              <div className="text-base text-gray-600 truncate">{profile.best_squat_meet || '-'}</div>
            </div>
            {/* Stats columns */}
            <div className="flex gap-1.5">
              {/* Make rates */}
              {successRates?.squat && (
                <div className="flex flex-col gap-1 text-center">
                  <div className="text-[10px] text-gray-500 font-medium">Success</div>
                  {[
                    { label: '1st', data: successRates.squat.attempt1 },
                    { label: '2nd', data: successRates.squat.attempt2 },
                    { label: '3rd', data: successRates.squat.attempt3 },
                  ].map(({ label, data }) => (
                    <div key={label} className="bg-gray-900 rounded px-2 py-1">
                      <div className="text-[10px] text-gray-500">{label}</div>
                      {data ? (
                        <div className={`text-sm font-bold ${getRateColor(data.rate)}`}>{data.rate.toFixed(0)}%</div>
                      ) : (
                        <div className="text-gray-700 text-sm">-</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* Opener & Jumps */}
              {(openerTendencies?.squat || jumpPatterns?.squat) && (
                <div className="flex flex-col gap-1 text-center">
                  <div className="text-[10px] text-gray-500 font-medium">Jumps</div>
                  {openerTendencies?.squat && (
                    <div className="bg-gray-900 rounded px-2 py-1">
                      <div className="text-[10px] text-gray-500">Open</div>
                      <div className="text-sm font-bold text-green-400">{openerTendencies.squat.average.toFixed(0)}%</div>
                    </div>
                  )}
                  {jumpPatterns?.squat?.firstJump && (
                    <div className="bg-gray-900 rounded px-2 py-1">
                      <div className="text-[10px] text-gray-500">1→2</div>
                      <div className="text-sm font-bold text-green-400">+{jumpPatterns.squat.firstJump.average.toFixed(0)}</div>
                    </div>
                  )}
                  {jumpPatterns?.squat?.secondJump && (
                    <div className="bg-gray-900 rounded px-2 py-1">
                      <div className="text-[10px] text-gray-500">2→3</div>
                      <div className="text-sm font-bold text-green-400">+{jumpPatterns.squat.secondJump.average.toFixed(0)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bench Card */}
        <div className="card p-4">
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-base text-gray-400">Best Bench</div>
              <div className="text-4xl font-bold text-blue-400 leading-tight">{formatWeight(profile.best_bench_kg)}</div>
              {bestLifts?.best_bench && renderAttempts(
                bestLifts.best_bench.bench1_kg,
                bestLifts.best_bench.bench2_kg,
                bestLifts.best_bench.bench3_kg,
                'text-blue-400/80'
              )}
              <div className="text-base text-gray-500 mt-1">{formatDate(profile.best_bench_date)}</div>
              <div className="text-base text-gray-600 truncate">{profile.best_bench_meet || '-'}</div>
            </div>
            <div className="flex gap-1.5">
              {successRates?.bench && (
                <div className="flex flex-col gap-1 text-center">
                  <div className="text-[10px] text-gray-500 font-medium">Success</div>
                  {[
                    { label: '1st', data: successRates.bench.attempt1 },
                    { label: '2nd', data: successRates.bench.attempt2 },
                    { label: '3rd', data: successRates.bench.attempt3 },
                  ].map(({ label, data }) => (
                    <div key={label} className="bg-gray-900 rounded px-2 py-1">
                      <div className="text-[10px] text-gray-500">{label}</div>
                      {data ? (
                        <div className={`text-sm font-bold ${getRateColor(data.rate)}`}>{data.rate.toFixed(0)}%</div>
                      ) : (
                        <div className="text-gray-700 text-sm">-</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {(openerTendencies?.bench || jumpPatterns?.bench) && (
                <div className="flex flex-col gap-1 text-center">
                  <div className="text-[10px] text-gray-500 font-medium">Jumps</div>
                  {openerTendencies?.bench && (
                    <div className="bg-gray-900 rounded px-2 py-1">
                      <div className="text-[10px] text-gray-500">Open</div>
                      <div className="text-sm font-bold text-blue-400">{openerTendencies.bench.average.toFixed(0)}%</div>
                    </div>
                  )}
                  {jumpPatterns?.bench?.firstJump && (
                    <div className="bg-gray-900 rounded px-2 py-1">
                      <div className="text-[10px] text-gray-500">1→2</div>
                      <div className="text-sm font-bold text-blue-400">+{jumpPatterns.bench.firstJump.average.toFixed(0)}</div>
                    </div>
                  )}
                  {jumpPatterns?.bench?.secondJump && (
                    <div className="bg-gray-900 rounded px-2 py-1">
                      <div className="text-[10px] text-gray-500">2→3</div>
                      <div className="text-sm font-bold text-blue-400">+{jumpPatterns.bench.secondJump.average.toFixed(0)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deadlift Card */}
        <div className="card p-4">
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-base text-gray-400">Best Deadlift</div>
              <div className="text-4xl font-bold text-red-400 leading-tight">{formatWeight(profile.best_deadlift_kg)}</div>
              {bestLifts?.best_deadlift && renderAttempts(
                bestLifts.best_deadlift.deadlift1_kg,
                bestLifts.best_deadlift.deadlift2_kg,
                bestLifts.best_deadlift.deadlift3_kg,
                'text-red-400/80'
              )}
              <div className="text-base text-gray-500 mt-1">{formatDate(profile.best_deadlift_date)}</div>
              <div className="text-base text-gray-600 truncate">{profile.best_deadlift_meet || '-'}</div>
            </div>
            <div className="flex gap-1.5">
              {successRates?.deadlift && (
                <div className="flex flex-col gap-1 text-center">
                  <div className="text-[10px] text-gray-500 font-medium">Success</div>
                  {[
                    { label: '1st', data: successRates.deadlift.attempt1 },
                    { label: '2nd', data: successRates.deadlift.attempt2 },
                    { label: '3rd', data: successRates.deadlift.attempt3 },
                  ].map(({ label, data }) => (
                    <div key={label} className="bg-gray-900 rounded px-2 py-1">
                      <div className="text-[10px] text-gray-500">{label}</div>
                      {data ? (
                        <div className={`text-sm font-bold ${getRateColor(data.rate)}`}>{data.rate.toFixed(0)}%</div>
                      ) : (
                        <div className="text-gray-700 text-sm">-</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {(openerTendencies?.deadlift || jumpPatterns?.deadlift) && (
                <div className="flex flex-col gap-1 text-center">
                  <div className="text-[10px] text-gray-500 font-medium">Jumps</div>
                  {openerTendencies?.deadlift && (
                    <div className="bg-gray-900 rounded px-2 py-1">
                      <div className="text-[10px] text-gray-500">Open</div>
                      <div className="text-sm font-bold text-red-400">{openerTendencies.deadlift.average.toFixed(0)}%</div>
                    </div>
                  )}
                  {jumpPatterns?.deadlift?.firstJump && (
                    <div className="bg-gray-900 rounded px-2 py-1">
                      <div className="text-[10px] text-gray-500">1→2</div>
                      <div className="text-sm font-bold text-red-400">+{jumpPatterns.deadlift.firstJump.average.toFixed(0)}</div>
                    </div>
                  )}
                  {jumpPatterns?.deadlift?.secondJump && (
                    <div className="bg-gray-900 rounded px-2 py-1">
                      <div className="text-[10px] text-gray-500">2→3</div>
                      <div className="text-sm font-bold text-red-400">+{jumpPatterns.deadlift.secondJump.average.toFixed(0)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Total Card */}
        <div className="card p-4">
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-base text-gray-400">Best Total</div>
              <div className="text-4xl font-bold text-purple-400 leading-tight">{formatWeight(profile.best_total_kg)}</div>
              <div className="text-base text-gray-500 mt-1">{formatDate(profile.best_total_date)}</div>
              <div className="text-base text-gray-600 truncate">{profile.best_total_meet || '-'}</div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div>
                <div className="text-[10px] text-gray-500 font-medium mb-1">Classes</div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {profile.weight_classes && profile.weight_classes.length > 0 ? (
                    profile.weight_classes.slice(0, 3).map((wc: string, idx: number) => (
                      <span key={idx} className="bg-gray-900 px-2 py-0.5 rounded text-sm text-purple-400">{wc}</span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-600">-</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 font-medium mb-1">Equipment</div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {profile.equipment_types && profile.equipment_types.length > 0 ? (
                    profile.equipment_types.map((eq: string, idx: number) => (
                      <span key={idx} className="bg-gray-900 px-2 py-0.5 rounded text-sm text-purple-400">{eq}</span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-600">-</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Filter Competition History</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Weight Class</label>
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
        {(weightClass || startDate || endDate) && (
          <div className="mt-3 text-xs text-gray-400">
            Showing {getFilteredAndSortedCompetitions(profile.competitions).length} of {profile.competitions.length} competitions
          </div>
        )}
      </div>

      {/* Competition History */}
      <div className="card">
        <h3 className="text-xl font-semibold text-white mb-4">Competition History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th
                  className="text-left py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('date')}
                >
                  Date<SortIcon column="date" />
                </th>
                <th
                  className="text-left py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('meet')}
                >
                  Meet<SortIcon column="meet" />
                </th>
                <th
                  className="text-left py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('federation')}
                >
                  Federation<SortIcon column="federation" />
                </th>
                <th
                  className="text-center py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('squat')}
                >
                  Squat<SortIcon column="squat" />
                </th>
                <th
                  className="text-center py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('bench')}
                >
                  Bench<SortIcon column="bench" />
                </th>
                <th
                  className="text-center py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('deadlift')}
                >
                  Deadlift<SortIcon column="deadlift" />
                </th>
                <th
                  className="text-center py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('total')}
                >
                  Total<SortIcon column="total" />
                </th>
                <th
                  className="text-center py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('ipfgl')}
                >
                  IPFGL<SortIcon column="ipfgl" />
                </th>
                <th
                  className="text-center py-3 px-4 text-gray-400 font-medium cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort('place')}
                >
                  Place<SortIcon column="place" />
                </th>
              </tr>
            </thead>
            <tbody>
              {profile.competitions && profile.competitions.length > 0 ? (
                getFilteredAndSortedCompetitions(profile.competitions).length > 0 ? (
                  getFilteredAndSortedCompetitions(profile.competitions).map((comp, idx) => (
                    <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-3 px-4 text-gray-300">
                        {new Date(comp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white">{comp.meet_name}</div>
                        <div className="text-xs text-gray-500">
                          {comp.equipment} • {comp.weight_class_kg} kg ({comp.bodyweight_kg} kg)
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400">{comp.federation}</td>
                      <td className="py-3 px-4 text-center text-green-400">{formatWeight(comp.best3_squat_kg)}</td>
                      <td className="py-3 px-4 text-center text-blue-400">{formatWeight(comp.best3_bench_kg)}</td>
                      <td className="py-3 px-4 text-center text-red-400">{formatWeight(comp.best3_deadlift_kg)}</td>
                      <td className="py-3 px-4 text-center text-purple-400 font-semibold">{formatWeight(comp.total_kg)}</td>
                      <td className="py-3 px-4 text-center text-yellow-400">{comp.goodlift?.toFixed(2) || '-'}</td>
                      <td className="py-3 px-4 text-center text-gray-300">{comp.place || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      No competitions match the selected filters
                    </td>
                  </tr>
                )
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
                    No competition data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
