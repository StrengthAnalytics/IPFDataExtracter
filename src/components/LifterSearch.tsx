import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import type { LifterSearchResult } from '../types';

interface LifterSearchProps {
  onSelectLifter: (lifter: LifterSearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  weightClass?: string;
}

export function LifterSearch({ onSelectLifter, placeholder = 'Search for a lifter...', autoFocus = false, weightClass }: LifterSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LifterSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await api.searchLifters(query, 10, weightClass);
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
  }, [query, weightClass]);

  const handleSelect = (lifter: LifterSearchResult) => {
    onSelectLifter(lifter);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <input
        type="text"
        className="input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowResults(true)}
        autoFocus={autoFocus}
      />

      {isLoading && (
        <div className="absolute right-3 top-3">
          <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
      )}

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

      {showResults && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 text-center text-gray-400">
          No lifters found for "{query}"
        </div>
      )}
    </div>
  );
}
