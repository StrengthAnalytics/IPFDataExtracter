/**
 * Supabase-based API service
 * Replaces REST API calls with direct Supabase queries
 */
import { supabase } from '../config/supabase';
import type {
  LifterSearchResult,
  LifterProfile,
  BestLifts,
  Competition,
  PercentileData,
  StrengthStandards,
  ComparisonData,
  LiftAttempts
} from '../types';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export const api = {
  /**
   * Search for lifters by name with fuzzy matching
   */
  async searchLifters(query: string, limit = 10): Promise<{ query: string; results: LifterSearchResult[]; count: number }> {
    if (query.length < 2) {
      return { query, results: [], count: 0 };
    }

    // Use ILIKE for case-insensitive pattern matching
    // Supabase supports PostgreSQL's full-text search, but ILIKE is simpler for names
    const { data, error } = await supabase
      .from('lifter_summary')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(limit);

    if (error) throw new APIError(500, error.message);

    // Transform to match expected format
    const results: LifterSearchResult[] = (data || []).map((lifter: any) => ({
      name: lifter.name,
      sex: lifter.sex,
      country: lifter.country || 'Unknown',
      weight_classes: lifter.weight_classes || [],
      equipment_types: lifter.equipment_types || [],
      last_competition_date: lifter.last_competition_date,
      total_competitions: lifter.total_competitions || 0,
      match_score: calculateMatchScore(lifter.name, query)
    }));

    // Sort by match score
    results.sort((a, b) => b.match_score - a.match_score);

    return {
      query,
      results,
      count: results.length
    };
  },

  /**
   * Get complete lifter profile
   */
  async getLifterProfile(name: string): Promise<LifterProfile> {
    // Get summary data
    const { data: summaryData, error: summaryError } = await supabase
      .from('lifter_summary')
      .select('*')
      .eq('name', name)
      .single();

    if (summaryError) throw new APIError(404, 'Lifter not found');

    // Get competition history
    const { data: competitions, error: compError } = await supabase
      .from('lifter_records')
      .select('*')
      .eq('name', name)
      .order('date', { ascending: false })
      .limit(20);

    if (compError) throw new APIError(500, compError.message);

    return {
      id: summaryData.id,
      name: summaryData.name,
      sex: summaryData.sex,
      country: summaryData.country || 'Unknown',
      total_competitions: summaryData.total_competitions || 0,
      first_competition_date: summaryData.first_competition_date,
      last_competition_date: summaryData.last_competition_date,
      weight_classes: summaryData.weight_classes || [],
      equipment_types: summaryData.equipment_types || [],
      best_squat_kg: summaryData.best_squat_kg,
      best_squat_date: summaryData.best_squat_date,
      best_squat_meet: summaryData.best_squat_meet,
      best_bench_kg: summaryData.best_bench_kg,
      best_bench_date: summaryData.best_bench_date,
      best_bench_meet: summaryData.best_bench_meet,
      best_deadlift_kg: summaryData.best_deadlift_kg,
      best_deadlift_date: summaryData.best_deadlift_date,
      best_deadlift_meet: summaryData.best_deadlift_meet,
      best_total_kg: summaryData.best_total_kg,
      best_total_date: summaryData.best_total_date,
      best_total_meet: summaryData.best_total_meet,
      competitions: (competitions || []).map(formatCompetition)
    };
  },

  /**
   * Get best lifts within a timeframe
   */
  async getBestLifts(name: string, years = 3, equipment?: string, weightClass?: string): Promise<BestLifts> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
    const cutoffString = cutoffDate.toISOString().split('T')[0];

    let query = supabase
      .from('lifter_records')
      .select('*')
      .eq('name', name)
      .gte('date', cutoffString);

    if (equipment) {
      query = query.eq('equipment', equipment);
    }
    if (weightClass) {
      query = query.eq('weight_class_kg', weightClass);
    }

    const { data, error } = await query;
    if (error) throw new APIError(500, error.message);

    const records = data || [];

    // Find best lifts
    const bestSquat = findBestLift(records, 'best3_squat_kg');
    const bestBench = findBestLift(records, 'best3_bench_kg');
    const bestDeadlift = findBestLift(records, 'best3_deadlift_kg');
    const bestTotal = findBestLift(records, 'total_kg');

    return {
      name,
      timeframe_years: years,
      total_competitions: records.length,
      best_squat: bestSquat ? formatLiftAttempts(bestSquat) : undefined,
      best_bench: bestBench ? formatLiftAttempts(bestBench) : undefined,
      best_deadlift: bestDeadlift ? formatLiftAttempts(bestDeadlift) : undefined,
      best_total: bestTotal ? formatLiftAttempts(bestTotal) : undefined
    };
  },

  /**
   * Get competition history
   */
  async getCompetitionHistory(name: string, limit = 20): Promise<{ name: string; competitions: Competition[]; count: number }> {
    const { data, error } = await supabase
      .from('lifter_records')
      .select('*')
      .eq('name', name)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw new APIError(500, error.message);

    const competitions = (data || []).map(formatCompetition);

    return {
      name,
      competitions,
      count: competitions.length
    };
  },

  /**
   * Compare multiple lifters for scouting
   */
  async compareLifters(lifters: string[], years = 3, equipment?: string): Promise<ComparisonData> {
    const lifterData = await Promise.all(
      lifters.map(name => this.getBestLifts(name, years, equipment))
    );

    return {
      timeframe_years: years,
      lifters: lifterData
    };
  },

  /**
   * Calculate percentile for a lift value
   * Uses client-side calculation - fetches all relevant data and computes percentile
   */
  async calculatePercentile(params: {
    value: number;
    sex: string;
    equipment: string;
    weight_class: string;
    lift_type: string;
    event?: string;
  }): Promise<PercentileData> {
    const { value, sex, equipment, weight_class, lift_type, event = 'SBD' } = params;

    // Map lift_type to column name
    const columnMap: Record<string, string> = {
      squat: 'best3_squat_kg',
      bench: 'best3_bench_kg',
      deadlift: 'best3_deadlift_kg',
      total: 'total_kg'
    };

    const column = columnMap[lift_type.toLowerCase()];
    if (!column) {
      throw new APIError(400, `Invalid lift type: ${lift_type}`);
    }

    // Fetch all values for this category
    const { data, error } = await supabase
      .from('lifter_records')
      .select(column)
      .eq('sex', sex)
      .eq('equipment', equipment)
      .eq('weight_class_kg', weight_class)
      .ilike('event', `%${event}%`)
      .not(column, 'is', null)
      .gt(column, 0);

    if (error) throw new APIError(500, error.message);

    const values = (data || []).map((r: any) => parseFloat(r[column])).filter(v => !isNaN(v));

    if (values.length === 0) {
      throw new APIError(404, 'No data found for this category');
    }

    // Calculate statistics
    values.sort((a, b) => a - b);
    const percentile = calculatePercentileValue(value, values);
    const stats = calculateStats(values);

    return {
      percentile,
      value,
      sample_size: values.length,
      ...stats,
      criteria: {
        sex,
        equipment,
        weight_class,
        lift_type,
        event
      }
    };
  },

  /**
   * Get strength standards for a category
   * Only uses 2024 data for current standards
   */
  async getStrengthStandards(
    sex: string,
    weightClass: string,
    equipment = 'Raw',
    event = 'SBD',
    ageClass = 'Open'
  ): Promise<StrengthStandards> {
    const liftTypes = ['squat', 'bench', 'deadlift', 'total'];
    const standards: any = {};

    for (const liftType of liftTypes) {
      const columnMap: Record<string, string> = {
        squat: 'best3_squat_kg',
        bench: 'best3_bench_kg',
        deadlift: 'best3_deadlift_kg',
        total: 'total_kg'
      };

      // Map each lift type to the events that include that lift
      const eventMap: Record<string, string[]> = {
        squat: ['SBD', 'S', 'SB'],
        bench: ['SBD', 'B', 'SB', 'BD'],
        deadlift: ['SBD', 'D', 'BD'],
        total: ['SBD']
      };

      const column = columnMap[liftType];
      const validEvents = eventMap[liftType];

      // Build query - select name, lift column, and age_class to filter client-side
      // Note: Using a high limit to ensure we get all records (Supabase default is 1000)
      const { data, error } = await supabase
        .from('lifter_records')
        .select(`name, ${column}, age_class`)
        .eq('sex', sex)
        .eq('equipment', equipment)
        .eq('weight_class_kg', weightClass)
        .in('event', validEvents)  // Include all events that have this lift
        .gte('date', '2024-01-01')  // Only 2024 data
        .lte('date', '2024-12-31')
        .not(column, 'is', null)
        .gt(column, 0)
        .limit(100000);  // Remove default limit to get all records

      if (error) {
        console.error('Query error:', error);
        continue;
      }

      // Filter by age class client-side for more control
      let filteredData = data || [];

      if (ageClass === 'Open') {
        // Open includes all adult non-masters categories: 18-39 years old plus unspecified
        const openAgeClasses = [null, '18-19', '20-23', '24-34', '35-39'];
        filteredData = filteredData.filter((record: any) =>
          openAgeClasses.includes(record.age_class)
        );
      } else if (ageClass === 'Sub-Junior') {
        const subJuniorAgeClasses = ['5-12', '13-15', '16-17', '18-19'];
        filteredData = filteredData.filter((record: any) =>
          subJuniorAgeClasses.includes(record.age_class)
        );
      } else if (ageClass === 'Junior') {
        const juniorAgeClasses = ['18-19', '20-23'];
        filteredData = filteredData.filter((record: any) =>
          juniorAgeClasses.includes(record.age_class)
        );
      } else if (ageClass === 'Master 1') {
        filteredData = filteredData.filter((record: any) => record.age_class === '40-44');
      } else if (ageClass === 'Master 2') {
        filteredData = filteredData.filter((record: any) => record.age_class === '45-49');
      } else if (ageClass === 'Master 3') {
        const master3AgeClasses = ['50-54', '55-59'];
        filteredData = filteredData.filter((record: any) =>
          master3AgeClasses.includes(record.age_class)
        );
      } else if (ageClass === 'Master 4') {
        const master4AgeClasses = ['60-64', '65-69', '70-74', '75-79'];
        filteredData = filteredData.filter((record: any) =>
          master4AgeClasses.includes(record.age_class)
        );
      }

      // Group by lifter name and get their best lift
      const lifterBestLifts = new Map<string, number>();
      filteredData.forEach((record: any) => {
        const name = record.name;
        const value = parseFloat(record[column]);
        if (!isNaN(value)) {
          const currentBest = lifterBestLifts.get(name) || 0;
          if (value > currentBest) {
            lifterBestLifts.set(name, value);
          }
        }
      });

      // Get array of best lifts (one per lifter)
      const values = Array.from(lifterBestLifts.values());

      if (values.length === 0) continue;

      values.sort((a, b) => a - b);

      standards[liftType] = {
        average: percentileAtRank(values, 50),
        good: percentileAtRank(values, 75),
        strong: percentileAtRank(values, 90),
        elite: percentileAtRank(values, 95),
        world_class: percentileAtRank(values, 99),
        sample_size: values.length,
        max_recorded: Math.max(...values)
      };
    }

    return {
      sex,
      weight_class: weightClass,
      equipment,
      event,
      standards
    };
  },

  /**
   * Get database statistics
   */
  async getStats(): Promise<{ total_records: number; unique_lifters: number; latest_competition: string }> {
    const [recordsCount, liftersCount, latestComp] = await Promise.all([
      supabase.from('lifter_records').select('*', { count: 'exact', head: true }),
      supabase.from('lifter_summary').select('*', { count: 'exact', head: true }),
      supabase.from('lifter_records').select('date').order('date', { ascending: false }).limit(1)
    ]);

    return {
      total_records: recordsCount.count || 0,
      unique_lifters: liftersCount.count || 0,
      latest_competition: latestComp.data?.[0]?.date || 'Unknown'
    };
  },

  /**
   * Get weight classes by sex
   */
  async getWeightClasses(sex?: string): Promise<{ M?: string[]; F?: string[]; sex?: string; weight_classes?: string[] }> {
    if (sex) {
      const { data, error } = await supabase
        .from('lifter_records')
        .select('weight_class_kg')
        .eq('sex', sex)
        .not('weight_class_kg', 'is', null);

      if (error) throw new APIError(500, error.message);

      const weightClasses = [...new Set((data || []).map((r: any) => r.weight_class_kg))].sort();

      return { sex, weight_classes: weightClasses };
    } else {
      // Get for both sexes
      const [maleData, femaleData] = await Promise.all([
        this.getWeightClasses('M'),
        this.getWeightClasses('F')
      ]);

      return {
        M: maleData.weight_classes,
        F: femaleData.weight_classes
      };
    }
  },

  /**
   * Get equipment types
   */
  async getEquipmentTypes(): Promise<{ equipment_types: string[] }> {
    const { data, error } = await supabase
      .from('lifter_records')
      .select('equipment')
      .not('equipment', 'is', null);

    if (error) throw new APIError(500, error.message);

    const equipmentTypes = [...new Set((data || []).map((r: any) => r.equipment))].sort();

    return { equipment_types: equipmentTypes };
  },

  /**
   * Health check - verify Supabase connection
   */
  async healthCheck(): Promise<{ status: string; service: string }> {
    try {
      const { error } = await supabase.from('lifter_records').select('*', { count: 'exact', head: true }).limit(1);
      if (error) throw error;
      return { status: 'healthy', service: 'IPF Data Extracter (Supabase)' };
    } catch (error) {
      throw new APIError(500, 'Database connection failed');
    }
  }
};

// Helper functions

function calculateMatchScore(name: string, query: string): number {
  const nameLower = name.toLowerCase();
  const queryLower = query.toLowerCase();

  if (nameLower === queryLower) return 100;
  if (nameLower.startsWith(queryLower)) return 90;
  if (nameLower.includes(queryLower)) return 70;

  // Simple character overlap score
  let matches = 0;
  for (const char of queryLower) {
    if (nameLower.includes(char)) matches++;
  }

  return Math.floor((matches / queryLower.length) * 60);
}

function formatCompetition(record: any): Competition {
  return {
    date: record.date,
    meet_name: record.meet_name,
    meet_country: record.meet_country,
    federation: record.federation,
    equipment: record.equipment,
    weight_class_kg: record.weight_class_kg,
    bodyweight_kg: record.bodyweight_kg,
    best3_squat_kg: record.best3_squat_kg,
    best3_bench_kg: record.best3_bench_kg,
    best3_deadlift_kg: record.best3_deadlift_kg,
    total_kg: record.total_kg,
    dots: record.dots,
    wilks: record.wilks,
    place: record.place,
    division: record.division
  };
}

function formatLiftAttempts(record: any): LiftAttempts {
  return {
    date: record.date,
    meet_name: record.meet_name,
    federation: record.federation,
    equipment: record.equipment,
    weight_class_kg: record.weight_class_kg,
    bodyweight_kg: record.bodyweight_kg,
    best3_squat_kg: record.best3_squat_kg,
    squat1_kg: record.squat1_kg,
    squat2_kg: record.squat2_kg,
    squat3_kg: record.squat3_kg,
    best3_bench_kg: record.best3_bench_kg,
    bench1_kg: record.bench1_kg,
    bench2_kg: record.bench2_kg,
    bench3_kg: record.bench3_kg,
    best3_deadlift_kg: record.best3_deadlift_kg,
    deadlift1_kg: record.deadlift1_kg,
    deadlift2_kg: record.deadlift2_kg,
    deadlift3_kg: record.deadlift3_kg,
    total_kg: record.total_kg,
    place: record.place
  };
}

function findBestLift(records: any[], column: string): any | null {
  if (records.length === 0) return null;

  return records.reduce((best, current) => {
    if (!current[column]) return best;
    if (!best || current[column] > best[column]) return current;
    return best;
  }, null);
}

function calculatePercentileValue(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;

  let count = 0;
  for (const v of sortedValues) {
    if (v < value) count++;
  }

  return Math.round((count / sortedValues.length) * 100 * 10) / 10;
}

function calculateStats(sortedValues: number[]) {
  const n = sortedValues.length;

  const sum = sortedValues.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  const squaredDiffs = sortedValues.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
  const std_dev = Math.sqrt(variance);

  return {
    mean: Math.round(mean * 10) / 10,
    median: percentileAtRank(sortedValues, 50),
    std_dev: Math.round(std_dev * 10) / 10,
    min: sortedValues[0],
    max: sortedValues[n - 1],
    p25: percentileAtRank(sortedValues, 25),
    p50: percentileAtRank(sortedValues, 50),
    p75: percentileAtRank(sortedValues, 75),
    p90: percentileAtRank(sortedValues, 90),
    p95: percentileAtRank(sortedValues, 95),
    p99: percentileAtRank(sortedValues, 99)
  };
}

function percentileAtRank(sortedValues: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return Math.round(sortedValues[Math.max(0, index)] * 10) / 10;
}
