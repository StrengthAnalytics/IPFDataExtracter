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
  StrengthStandards,
  ComparisonData,
  LiftAttempts,
  CompetitionHistoryItem
} from '../types';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export const api = {
  /**
   * Search for lifters by name with optional fuzzy matching using pg_trgm
   */
  async searchLifters(query: string, limit = 10, weightClass?: string, useFuzzySearch = false): Promise<{ query: string; results: LifterSearchResult[]; count: number }> {
    if (query.length < 2) {
      return { query, results: [], count: 0 };
    }

    let data: any[];
    let error: any;

    if (useFuzzySearch) {
      // Use pg_trgm similarity search for fuzzy matching with typo tolerance
      // This requires:
      // 1. pg_trgm extension enabled (migrations/001_enable_pg_trgm.sql)
      // 2. search_lifters_by_similarity function (migrations/002_add_fuzzy_search_function.sql)
      const response = await supabase.rpc('search_lifters_by_similarity', {
        search_query: query.toLowerCase(),
        similarity_threshold: 0.1, // Lower = more fuzzy (0.1 is quite permissive)
        result_limit: limit * 3 // Get extra results for weight class filtering
      });
      data = response.data || [];
      error = response.error;
    } else {
      // Use exact substring matching (faster, no typo tolerance)
      const response = await supabase
        .from('lifter_summary')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(limit * 2);
      data = response.data || [];
      error = response.error;
    }

    if (error) throw new APIError(500, error.message);

    let results: LifterSearchResult[] = data.map((lifter: any) => ({
      name: lifter.name,
      sex: lifter.sex,
      country: lifter.country || 'Unknown',
      weight_classes: lifter.weight_classes || [],
      equipment_types: lifter.equipment_types || [],
      last_competition_date: lifter.last_competition_date,
      total_competitions: lifter.total_competitions || 0,
      match_score: useFuzzySearch ? lifter.similarity_score : this.calculateMatchScore(lifter.name, query)
    }));

    // Filter by weight class if specified
    if (weightClass) {
      results = results.filter(lifter =>
        lifter.weight_classes && lifter.weight_classes.includes(weightClass)
      );
    }

    // Sort by match score if not using fuzzy search (fuzzy already sorted)
    if (!useFuzzySearch) {
      results.sort((a, b) => b.match_score - a.match_score);
    }

    // Limit results after filtering
    results = results.slice(0, limit);

    return {
      query,
      results,
      count: results.length
    };
  },

  /**
   * Calculate match score for exact search (non-fuzzy)
   */
  calculateMatchScore(name: string, query: string): number {
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
  async compareLifters(
    lifters: string[],
    startDate?: string,
    endDate?: string,
    equipment?: string,
    weightClass?: string,
    aggregationMode: 'byLift' | 'byComp' = 'byLift',
    rankingMethod: 'total' | 'ipfgl' = 'total'
  ): Promise<ComparisonData> {
    const lifterData = await Promise.all(
      lifters.map(name => this.getBestLiftsInDateRange(name, startDate, endDate, equipment, weightClass, aggregationMode, rankingMethod))
    );

    return {
      timeframe_years: 0, // Not used when date range is specified
      lifters: lifterData
    };
  },

  /**
   * Get best lifts within a date range
   */
  async getBestLiftsInDateRange(
    name: string,
    startDate?: string,
    endDate?: string,
    equipment?: string,
    weightClass?: string,
    aggregationMode: 'byLift' | 'byComp' = 'byLift',
    rankingMethod: 'total' | 'ipfgl' = 'total'
  ): Promise<BestLifts> {
    let query = supabase
      .from('lifter_records')
      .select('*')
      .eq('name', name);

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }
    if (equipment) {
      query = query.eq('equipment', equipment);
    }
    if (weightClass) {
      query = query.eq('weight_class_kg', weightClass);
    }

    const { data, error } = await query;
    if (error) throw new APIError(500, error.message);

    const records = data || [];

    if (aggregationMode === 'byComp') {
      // Find the competition with the best total or IPF GL based on ranking method
      const searchColumn = rankingMethod === 'ipfgl' ? 'goodlift' : 'total_kg';

      // Filter records to only include those with valid values for the search column
      const validRecords = records.filter(r => r[searchColumn] && r[searchColumn] > 0);
      const bestComp = findBestLift(validRecords, searchColumn);

      return {
        name,
        timeframe_years: 0,
        total_competitions: records.length,
        best_squat: bestComp ? formatLiftAttempts(bestComp) : undefined,
        best_bench: bestComp ? formatLiftAttempts(bestComp) : undefined,
        best_deadlift: bestComp ? formatLiftAttempts(bestComp) : undefined,
        best_total: bestComp ? formatLiftAttempts(bestComp) : undefined
      };
    } else {
      // By Lift: Find best for each lift individually (cherry-picked)
      const bestSquat = findBestLift(records, 'best3_squat_kg');
      const bestBench = findBestLift(records, 'best3_bench_kg');
      const bestDeadlift = findBestLift(records, 'best3_deadlift_kg');

      // For the total column, use the ranking method to determine which competition to show
      const totalColumn = rankingMethod === 'ipfgl' ? 'goodlift' : 'total_kg';
      const validTotalRecords = records.filter(r => r[totalColumn] && r[totalColumn] > 0);
      const bestTotal = findBestLift(validTotalRecords, totalColumn);

      return {
        name,
        timeframe_years: 0, // Not applicable for date range
        total_competitions: records.length,
        best_squat: bestSquat ? formatLiftAttempts(bestSquat) : undefined,
        best_bench: bestBench ? formatLiftAttempts(bestBench) : undefined,
        best_deadlift: bestDeadlift ? formatLiftAttempts(bestDeadlift) : undefined,
        best_total: bestTotal ? formatLiftAttempts(bestTotal) : undefined
      };
    }
  },

  /**
   * Get strength standards for a category
   * Hardcoded data from OpenPowerlifting dataset (Classic/Raw only)
   * Percentiles: [50th, 75th, 90th, 95th, 99th]
   */
  async getStrengthStandards(
    sex: string,
    weightClass: string,
    equipment = 'Raw',
    event = 'SBD',
    ageClass = 'Open'
  ): Promise<StrengthStandards> {
    // Hardcoded strength standards from OpenPowerlifting
    const strengthStandards: any = {
      M: {
        open: {
          '59': { total: [420, 470, 512.5, 540, 585], squat: [147.5, 167.5, 182.5, 192.5, 212.5], bench: [90, 107.5, 120, 127.5, 145], deadlift: [180, 200, 220, 230, 260] },
          '66': { total: [462.5, 517.5, 570, 600, 652.5], squat: [165, 185, 205, 217.5, 237.5], bench: [102.5, 117.5, 130, 140, 160], deadlift: [197.5, 220, 240, 252.5, 282.5] },
          '74': { total: [500, 555, 610, 642.5, 707.5], squat: [180, 200, 222.5, 235, 260], bench: [112.5, 127.5, 142.5, 152.5, 172.5], deadlift: [210, 232.5, 255, 270, 297.5] },
          '83': { total: [537.5, 600, 655, 690, 752.5], squat: [192.5, 217.5, 240, 252.5, 280], bench: [122.5, 140, 155, 165, 185], deadlift: [222.5, 250, 270, 285, 310] },
          '93': { total: [572.5, 637.5, 692.5, 725, 795], squat: [207.5, 232.5, 255, 267.5, 295], bench: [130, 150, 165, 175, 195], deadlift: [235, 260, 282.5, 300, 325] },
          '105': { total: [610, 680, 740, 775, 832.5], squat: [220, 250, 275, 290, 315], bench: [140, 160, 177.5, 187.5, 210], deadlift: [250, 275, 300, 310, 340] },
          '120': { total: [640, 712.5, 780, 817.5, 897.5], squat: [235, 265, 295, 310, 340], bench: [150, 170, 190, 200, 222.5], deadlift: [255, 282.5, 310, 325, 355] },
          '120+': { total: [660, 742.5, 830, 885, 960], squat: [245, 280, 317.5, 345, 380], bench: [157.5, 185, 205, 225, 245], deadlift: [257.5, 285, 315, 335, 362.5] }
        },
        masters: {
          '59': { total: [335, 412.5, 457.5, 482.5, 625], squat: [117.5, 142.5, 165, 175, 225], bench: [75, 100, 112.5, 125, 155], deadlift: [145, 180, 195, 215, 245] },
          '66': { total: [410, 477.5, 517.5, 540, 642.5], squat: [142.5, 170, 185, 195, 232.5], bench: [92.5, 110, 122.5, 130, 147.5], deadlift: [175, 202.5, 220, 232.5, 252.5] },
          '74': { total: [442.5, 500, 557.5, 580, 642.5], squat: [155, 180, 200, 210, 245], bench: [102.5, 117.5, 132.5, 140, 155], deadlift: [182.5, 210, 232.5, 247.5, 270] },
          '83': { total: [492.5, 547.5, 602.5, 635, 712.5], squat: [170, 200, 220, 237.5, 260], bench: [115, 130, 145, 150, 177.5], deadlift: [205, 225, 250, 265, 295] },
          '93': { total: [515, 575, 642.5, 670, 735], squat: [182.5, 207.5, 230, 247.5, 272.5], bench: [122.5, 140, 155, 165, 180], deadlift: [210, 240, 260, 275, 295] },
          '105': { total: [557.5, 625, 680, 717.5, 802.5], squat: [200, 225, 252.5, 265, 300], bench: [135, 152.5, 167.5, 177.5, 202.5], deadlift: [225, 252.5, 275, 290, 322.5] },
          '120': { total: [595, 657.5, 705, 730, 820], squat: [215, 240, 260, 272.5, 310], bench: [145, 165, 177.5, 195, 220], deadlift: [235, 260, 277.5, 285, 312.5] },
          '120+': { total: [627.5, 710, 780, 842.5, 950], squat: [225, 260, 290, 317.5, 380], bench: [155, 175, 200, 215, 240], deadlift: [250, 280, 300, 315, 350] }
        },
        junior: {
          '59': { total: [417.5, 465, 505, 525, 567.5], squat: [147.5, 167.5, 182.5, 190, 200], bench: [90, 105, 115, 122.5, 135], deadlift: [180, 200, 215, 227.5, 255] },
          '66': { total: [457.5, 510, 552.5, 580, 627.5], squat: [162.5, 182.5, 200, 210, 230], bench: [100, 115, 127.5, 135, 152.5], deadlift: [195, 215, 235, 245, 270] },
          '74': { total: [497.5, 547.5, 597.5, 630, 685], squat: [180, 200, 217.5, 230, 250], bench: [110, 125, 140, 150, 165], deadlift: [210, 230, 250, 265, 287.5] },
          '83': { total: [532.5, 587.5, 640, 672.5, 735], squat: [190, 212.5, 235, 247.5, 272.5], bench: [120, 135, 150, 160, 177.5], deadlift: [220, 245, 265, 280, 302.5] },
          '93': { total: [567.5, 627.5, 675, 710, 770], squat: [205, 230, 250, 260, 285], bench: [127.5, 145, 160, 170, 187.5], deadlift: [235, 260, 280, 290, 315] },
          '105': { total: [600, 665, 725, 762.5, 810], squat: [220, 247.5, 270, 282.5, 305], bench: [135, 155, 172.5, 182.5, 200], deadlift: [245, 272.5, 295, 307.5, 330] },
          '120': { total: [627.5, 697.5, 760, 800, 872.5], squat: [235, 262.5, 287.5, 300, 330], bench: [145, 162.5, 182.5, 195, 215], deadlift: [250, 280, 305, 320, 350] },
          '120+': { total: [635, 722.5, 800, 852.5, 930], squat: [242.5, 275, 310, 340, 375], bench: [150, 172.5, 197.5, 210, 237.5], deadlift: [245, 280, 310, 327.5, 350] }
        }
      },
      F: {
        open: {
          '47': { total: [262.5, 307.5, 337.5, 352.5, 395], squat: [95, 110, 125, 130, 145], bench: [50, 62.5, 70, 75, 85], deadlift: [117.5, 135, 150, 155, 172.5] },
          '52': { total: [285, 325, 362.5, 380, 427.5], squat: [102.5, 120, 135, 142.5, 160], bench: [55, 67.5, 75, 82.5, 97.5], deadlift: [127.5, 142.5, 157.5, 165, 182.5] },
          '57': { total: [302.5, 342.5, 377.5, 405, 447.5], squat: [110, 125, 140, 150, 167.5], bench: [60, 70, 80, 87.5, 102.5], deadlift: [132.5, 150, 165, 175, 192.5] },
          '63': { total: [320, 360, 400, 422.5, 470], squat: [117.5, 132.5, 147.5, 157.5, 175], bench: [62.5, 72.5, 85, 92.5, 107.5], deadlift: [140, 155, 172.5, 180, 205] },
          '69': { total: [332.5, 377.5, 417.5, 440, 497.5], squat: [122.5, 140, 157.5, 165, 187.5], bench: [65, 77.5, 90, 95, 112.5], deadlift: [145, 160, 180, 187.5, 212.5] },
          '76': { total: [345, 392.5, 437.5, 467.5, 530], squat: [127.5, 147.5, 165, 177.5, 197.5], bench: [67.5, 82.5, 92.5, 102.5, 117.5], deadlift: [150, 170, 185, 200, 222.5] },
          '84': { total: [357.5, 407.5, 452.5, 485, 542.5], squat: [132.5, 152.5, 172.5, 182.5, 205], bench: [70, 82.5, 95, 102.5, 125], deadlift: [152.5, 175, 192.5, 202.5, 225] },
          '84+': { total: [365, 417.5, 470, 502.5, 615], squat: [137.5, 160, 185, 200, 240], bench: [72.5, 85, 100, 107.5, 132.5], deadlift: [152.5, 175, 195, 205, 242.5] }
        },
        masters: {
          '47': { total: [255, 287.5, 330, 345, 350], squat: [87.5, 102.5, 120, 125, 130], bench: [50, 60, 70, 75, 75], deadlift: [112.5, 135, 147.5, 147.5, 147.5] },
          '52': { total: [267.5, 295, 330, 367.5, 410], squat: [92.5, 107.5, 120, 130, 147.5], bench: [52.5, 60, 70, 72.5, 82.5], deadlift: [120, 135, 152.5, 162.5, 182.5] },
          '57': { total: [287.5, 325, 355, 370, 397.5], squat: [102.5, 115, 127.5, 140, 145], bench: [57.5, 65, 75, 77.5, 92.5], deadlift: [130, 145, 157.5, 160, 182.5] },
          '63': { total: [292.5, 335, 377.5, 405, 455], squat: [105, 120, 137.5, 150, 175], bench: [57.5, 70, 80, 85, 100], deadlift: [132.5, 147.5, 165, 175, 200] },
          '69': { total: [305, 345, 387.5, 422.5, 472.5], squat: [110, 125, 142.5, 157.5, 182.5], bench: [62.5, 72.5, 82.5, 90, 102.5], deadlift: [132.5, 150, 165, 180, 202.5] },
          '76': { total: [317.5, 362.5, 407.5, 442.5, 500], squat: [115, 132.5, 150, 160, 185], bench: [62.5, 75, 85, 95, 110], deadlift: [137.5, 157.5, 177.5, 187.5, 212.5] },
          '84': { total: [330, 385, 430, 450, 512.5], squat: [120, 140, 162.5, 172.5, 187.5], bench: [67.5, 80, 90, 97.5, 112.5], deadlift: [147.5, 167.5, 182.5, 192.5, 217.5] },
          '84+': { total: [340, 390, 442.5, 482.5, 547.5], squat: [125, 145, 170, 187.5, 215], bench: [70, 80, 95, 105, 132.5], deadlift: [145, 167.5, 185, 200, 222.5] }
        },
        junior: {
          '47': { total: [252.5, 287.5, 317.5, 345, 432.5], squat: [90, 102.5, 117.5, 127.5, 150], bench: [47.5, 55, 65, 70, 97.5], deadlift: [115, 130, 145, 155, 172.5] },
          '52': { total: [280, 317.5, 342.5, 367.5, 395], squat: [100, 117.5, 127.5, 135, 147.5], bench: [55, 65, 70, 75, 92.5], deadlift: [125, 140, 152.5, 157.5, 170] },
          '57': { total: [295, 335, 370, 392.5, 432.5], squat: [110, 122.5, 137.5, 147.5, 160], bench: [60, 67.5, 77.5, 82.5, 100], deadlift: [130, 147.5, 160, 167.5, 182.5] },
          '63': { total: [320, 357.5, 392.5, 410, 457.5], squat: [117.5, 132.5, 145, 155, 170], bench: [62.5, 72.5, 82.5, 90, 102.5], deadlift: [140, 155, 170, 175, 197.5] },
          '69': { total: [335, 372.5, 407.5, 432.5, 482.5], squat: [122.5, 140, 155, 162.5, 177.5], bench: [67.5, 77.5, 87.5, 95, 112.5], deadlift: [145, 160, 175, 182.5, 205] },
          '76': { total: [345, 392.5, 430, 455, 497.5], squat: [130, 147.5, 165, 172.5, 195], bench: [70, 80, 90, 97.5, 115], deadlift: [150, 167.5, 185, 192.5, 212.5] },
          '84': { total: [360, 397.5, 440, 470, 527.5], squat: [135, 152.5, 170, 182.5, 205], bench: [70, 82.5, 92.5, 97.5, 122.5], deadlift: [155, 170, 187.5, 197.5, 222.5] },
          '84+': { total: [367.5, 420, 475, 497.5, 577.5], squat: [142.5, 165, 192.5, 205, 240], bench: [70, 85, 100, 107.5, 125], deadlift: [155, 175, 190, 205, 227.5] }
        }
      }
    };

    const ageClassLower = ageClass.toLowerCase();
    const data = strengthStandards[sex]?.[ageClassLower]?.[weightClass];

    if (!data) {
      return {
        sex,
        weight_class: weightClass,
        equipment,
        event,
        standards: {}
      };
    }

    // Convert arrays [50th, 75th, 90th, 95th, 99th] to named percentiles
    const standards: any = {};
    const liftTypes = ['squat', 'bench', 'deadlift', 'total'];

    liftTypes.forEach((lift) => {
      if (data[lift]) {
        const [p50, p75, p90, p95, p99] = data[lift];
        standards[lift] = {
          average: p50,
          good: p75,
          strong: p90,
          elite: p95,
          world_class: p99,
          sample_size: 50000, // Approximate - based on OpenPowerlifting dataset
          max_recorded: p99 * 1.2 // Approximate max
        };
      }
    });

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
   * Get competition history for a lifter
   * Used for prediction analysis
   */
  async getLifterHistory(
    name: string,
    monthsBack: number,
    weightClass?: string,
    equipment?: string
  ): Promise<CompetitionHistoryItem[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    let query = supabase
      .from('lifter_records')
      .select('date, total_kg, meet_name, equipment, weight_class_kg')
      .eq('name', name)
      .not('total_kg', 'is', null)
      .gt('total_kg', 0)
      .gte('date', startDateStr)
      .order('date', { ascending: true });

    if (weightClass) {
      query = query.eq('weight_class_kg', weightClass);
    }

    if (equipment) {
      query = query.eq('equipment', equipment);
    }

    const { data, error } = await query;

    if (error) throw new APIError(500, error.message);

    return (data || []).map((record: any) => ({
      date: record.date,
      total_kg: record.total_kg,
      meet_name: record.meet_name,
      equipment: record.equipment,
      weight_class_kg: record.weight_class_kg
    }));
  },

  /**
   * Get opener tendencies for a lifter
   * Calculates average opener percentages for squat, bench, deadlift
   */
  async getOpenerTendencies(name: string): Promise<{
    squat: { average: number; min: number; max: number; competitions: number } | null;
    bench: { average: number; min: number; max: number; competitions: number } | null;
    deadlift: { average: number; min: number; max: number; competitions: number } | null;
  }> {
    const { data, error } = await supabase
      .from('lifter_records')
      .select('squat1_kg, best3_squat_kg, bench1_kg, best3_bench_kg, deadlift1_kg, best3_deadlift_kg, total_kg')
      .eq('name', name)
      .not('total_kg', 'is', null);

    if (error) throw new APIError(500, error.message);

    const records = data || [];

    const calculateTendency = (
      attempt1Key: 'squat1_kg' | 'bench1_kg' | 'deadlift1_kg',
      best3Key: 'best3_squat_kg' | 'best3_bench_kg' | 'best3_deadlift_kg'
    ) => {
      const percentages: number[] = [];

      records.forEach((record: any) => {
        const attempt1 = record[attempt1Key];
        const best3 = record[best3Key];

        // Skip if no data or bombed lift (best3 is null/zero)
        if (!attempt1 || !best3 || best3 <= 0) return;

        const percentage = (Math.abs(attempt1) / best3) * 100;
        // Only include reasonable percentages (50-110%)
        if (percentage >= 50 && percentage <= 110) {
          percentages.push(percentage);
        }
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
      squat: calculateTendency('squat1_kg', 'best3_squat_kg'),
      bench: calculateTendency('bench1_kg', 'best3_bench_kg'),
      deadlift: calculateTendency('deadlift1_kg', 'best3_deadlift_kg')
    };
  },

  /**
   * Get jump patterns for a lifter
   * Calculates average weight jumps between attempts for each lift
   */
  async getJumpPatterns(name: string): Promise<{
    squat: { firstJump: { average: number; min: number; max: number; count: number } | null; secondJump: { average: number; min: number; max: number; count: number } | null } | null;
    bench: { firstJump: { average: number; min: number; max: number; count: number } | null; secondJump: { average: number; min: number; max: number; count: number } | null } | null;
    deadlift: { firstJump: { average: number; min: number; max: number; count: number } | null; secondJump: { average: number; min: number; max: number; count: number } | null } | null;
  }> {
    const { data, error } = await supabase
      .from('lifter_records')
      .select('date, squat1_kg, squat2_kg, squat3_kg, bench1_kg, bench2_kg, bench3_kg, deadlift1_kg, deadlift2_kg, deadlift3_kg')
      .eq('name', name)
      .order('date', { ascending: false });

    if (error) throw new APIError(500, error.message);

    const records = data || [];

    const calculateJumps = (
      attempt1Key: string,
      attempt2Key: string,
      attempt3Key: string
    ) => {
      const firstJumps: number[] = [];
      const secondJumps: number[] = [];

      records.forEach((record: any) => {
        const a1 = record[attempt1Key];
        const a2 = record[attempt2Key];
        const a3 = record[attempt3Key];

        // Calculate first jump (1st→2nd) if both attempts exist
        if (a1 != null && a2 != null) {
          const jump = Math.abs(a2) - Math.abs(a1);
          // Only include reasonable jumps (-20 to 30 kg)
          if (jump >= -20 && jump <= 30) {
            firstJumps.push(jump);
          }
        }

        // Calculate second jump (2nd→3rd) if both attempts exist
        if (a2 != null && a3 != null) {
          const jump = Math.abs(a3) - Math.abs(a2);
          // Only include reasonable jumps (-20 to 30 kg)
          if (jump >= -20 && jump <= 30) {
            secondJumps.push(jump);
          }
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

      return {
        firstJump: first,
        secondJump: second
      };
    };

    return {
      squat: calculateJumps('squat1_kg', 'squat2_kg', 'squat3_kg'),
      bench: calculateJumps('bench1_kg', 'bench2_kg', 'bench3_kg'),
      deadlift: calculateJumps('deadlift1_kg', 'deadlift2_kg', 'deadlift3_kg')
    };
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
    goodlift: record.goodlift,
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
    goodlift: record.goodlift,
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
