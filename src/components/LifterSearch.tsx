import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import type { LifterSearchResult } from '../types';

interface LifterSearchProps {
  onSelectLifter: (lifter: LifterSearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  weightClass?: string;
  useFuzzySearch?: boolean;
}

// Search history storage
const HISTORY_KEY = 'lifter_search_history';
const MAX_HISTORY_ITEMS = 8;

interface HistoryItem {
  name: string;
  country: string | null;
  sex: string;
  lastSearched: number;
}

const getSearchHistory = (): HistoryItem[] => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const addToSearchHistory = (lifter: LifterSearchResult): void => {
  try {
    const history = getSearchHistory();
    // Remove if already exists
    const filtered = history.filter(item => item.name !== lifter.name);
    // Add to front
    const newHistory: HistoryItem[] = [
      {
        name: lifter.name,
        country: lifter.country,
        sex: lifter.sex,
        lastSearched: Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  } catch (error) {
    console.error('Error saving search history:', error);
  }
};

const clearSearchHistory = (): void => {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing search history:', error);
  }
};

export function LifterSearch({ onSelectLifter, placeholder = 'Search for a lifter...', autoFocus = false, weightClass, useFuzzySearch = false }: LifterSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LifterSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load history on mount
  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setShowHistory(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // Hide history when searching
    setShowHistory(false);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await api.searchLifters(query, 10, weightClass, useFuzzySearch);
        setResults(response.results);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, weightClass, useFuzzySearch]);

  const handleSelect = (lifter: LifterSearchResult) => {
    // Add to history
    addToSearchHistory(lifter);
    setHistory(getSearchHistory());

    onSelectLifter(lifter);
    setQuery('');
    setResults([]);
    setShowResults(false);
    setShowHistory(false);
  };

  const handleHistorySelect = async (item: HistoryItem) => {
    // Search for the lifter and select them
    setIsLoading(true);
    try {
      const response = await api.searchLifters(item.name, 1, undefined, false);
      if (response.results.length > 0) {
        handleSelect(response.results[0]);
      }
    } catch (error) {
      console.error('Error loading from history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setHistory([]);
    setShowHistory(false);
  };

  const handleFocus = () => {
    if (query.length >= 2 && results.length > 0) {
      setShowResults(true);
    } else if (query.length < 2 && history.length > 0) {
      setShowHistory(true);
    }
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <input
        type="text"
        className="input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        autoFocus={autoFocus}
      />

      {isLoading && (
        <div className="absolute right-3 top-3">
          <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Search Results */}
      {showResults && results.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
          {results.map((lifter, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(lifter)}
              className="w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-b-0"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-white">{lifter.name}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {lifter.sex} • {lifter.country || 'Unknown'} • {lifter.total_competitions} competitions
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Weight classes: {lifter.weight_classes?.join(', ') || 'N/A'}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Last competed: {new Date(lifter.last_competition_date).toLocaleDateString()}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {showResults && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 text-center text-gray-400">
          No lifters found for "{query}"
        </div>
      )}

      {/* Search History */}
      {showHistory && history.length > 0 && !showResults && (
        <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
          <div className="px-4 py-2 border-b border-gray-700 flex justify-between items-center">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Recent Searches</span>
            <button
              onClick={handleClearHistory}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          </div>
          {history.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleHistorySelect(item)}
              className="w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-b-0 flex items-center gap-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-medium text-white">{item.name}</div>
                <div className="text-xs text-gray-500">
                  {item.sex} • {item.country || 'Unknown'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
