export interface LifterSearchResult {
  name: string;
  sex: string;
  country: string;
  weight_classes: string[];
  equipment_types: string[];
  last_competition_date: string;
  total_competitions: number;
  match_score: number;
}

export interface Competition {
  date: string;
  meet_name: string;
  meet_country?: string;
  federation: string;
  equipment: string;
  weight_class_kg: string;
  bodyweight_kg: number;
  best3_squat_kg?: number;
  best3_bench_kg?: number;
  best3_deadlift_kg?: number;
  total_kg?: number;
  dots?: number;
  wilks?: number;
  place: string;
  division?: string;
}

export interface LiftAttempts {
  date: string;
  meet_name: string;
  federation: string;
  equipment: string;
  weight_class_kg: string;
  bodyweight_kg: number;
  best3_squat_kg?: number;
  squat1_kg?: number;
  squat2_kg?: number;
  squat3_kg?: number;
  best3_bench_kg?: number;
  bench1_kg?: number;
  bench2_kg?: number;
  bench3_kg?: number;
  best3_deadlift_kg?: number;
  deadlift1_kg?: number;
  deadlift2_kg?: number;
  deadlift3_kg?: number;
  total_kg?: number;
  place: string;
}

export interface LifterProfile {
  id: number;
  name: string;
  sex: string;
  country: string;
  total_competitions: number;
  first_competition_date: string;
  last_competition_date: string;
  weight_classes: string[];
  equipment_types: string[];
  best_squat_kg?: number;
  best_squat_date?: string;
  best_squat_meet?: string;
  best_bench_kg?: number;
  best_bench_date?: string;
  best_bench_meet?: string;
  best_deadlift_kg?: number;
  best_deadlift_date?: string;
  best_deadlift_meet?: string;
  best_total_kg?: number;
  best_total_date?: string;
  best_total_meet?: string;
  competitions: Competition[];
}

export interface BestLifts {
  name: string;
  timeframe_years: number;
  total_competitions: number;
  best_squat?: LiftAttempts;
  best_bench?: LiftAttempts;
  best_deadlift?: LiftAttempts;
  best_total?: LiftAttempts;
}

export interface PercentileData {
  percentile: number;
  value: number;
  sample_size: number;
  mean: number;
  median: number;
  std_dev: number;
  min: number;
  max: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  criteria: {
    sex: string;
    equipment: string;
    weight_class: string;
    lift_type: string;
    event: string;
  };
}

export interface StrengthStandards {
  sex: string;
  weight_class: string;
  equipment: string;
  event: string;
  standards: {
    [liftType: string]: {
      beginner: number;
      novice: number;
      intermediate: number;
      advanced: number;
      elite: number;
      world_class: number;
      sample_size: number;
      max_recorded: number;
    };
  };
}

export interface ComparisonData {
  timeframe_years: number;
  lifters: BestLifts[];
}
