import type {
  LifterSearchResult,
  LifterProfile,
  BestLifts,
  Competition,
  PercentileData,
  StrengthStandards,
  ComparisonData
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new APIError(response.status, error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  // Search
  async searchLifters(query: string, limit = 10): Promise<{ query: string; results: LifterSearchResult[]; count: number }> {
    return fetchAPI(`/search/lifters?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  // Lifter Profile
  async getLifterProfile(name: string): Promise<LifterProfile> {
    return fetchAPI(`/lifter/${encodeURIComponent(name)}`);
  },

  async getBestLifts(name: string, years = 3, equipment?: string, weightClass?: string): Promise<BestLifts> {
    const params = new URLSearchParams({ years: years.toString() });
    if (equipment) params.append('equipment', equipment);
    if (weightClass) params.append('weight_class', weightClass);
    return fetchAPI(`/lifter/${encodeURIComponent(name)}/best-lifts?${params}`);
  },

  async getCompetitionHistory(name: string, limit = 20): Promise<{ name: string; competitions: Competition[]; count: number }> {
    return fetchAPI(`/lifter/${encodeURIComponent(name)}/history?limit=${limit}`);
  },

  // Scouting
  async compareLifters(lifters: string[], years = 3, equipment?: string): Promise<ComparisonData> {
    return fetchAPI('/scouting/compare', {
      method: 'POST',
      body: JSON.stringify({ lifters, years, equipment }),
    });
  },

  // Percentiles
  async calculatePercentile(params: {
    value: number;
    sex: string;
    equipment: string;
    weight_class: string;
    lift_type: string;
    event?: string;
  }): Promise<PercentileData> {
    return fetchAPI('/percentile/calculate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getStrengthStandards(
    sex: string,
    weightClass: string,
    equipment = 'Raw',
    event = 'SBD'
  ): Promise<StrengthStandards> {
    return fetchAPI(`/standards/${sex}/${weightClass}?equipment=${equipment}&event=${event}`);
  },

  // Utility
  async getStats(): Promise<{ total_records: number; unique_lifters: number; latest_competition: string }> {
    return fetchAPI('/stats');
  },

  async getWeightClasses(sex?: string): Promise<{ M?: string[]; F?: string[]; sex?: string; weight_classes?: string[] }> {
    const params = sex ? `?sex=${sex}` : '';
    return fetchAPI(`/weight-classes${params}`);
  },

  async getEquipmentTypes(): Promise<{ equipment_types: string[] }> {
    return fetchAPI('/equipment-types');
  },

  async healthCheck(): Promise<{ status: string; service: string }> {
    return fetch(`${API_BASE.replace('/api/v1', '')}/health`).then(r => r.json());
  },
};
