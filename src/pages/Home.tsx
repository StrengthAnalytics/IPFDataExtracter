import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LifterSearch } from '../components/LifterSearch';
import { api } from '../services/api';
import type { LifterSearchResult } from '../types';

export function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ total_records: number; unique_lifters: number; latest_competition: string } | null>(null);
  const [useFuzzySearch, setUseFuzzySearch] = useState(false);
  const [showFuzzyInfo, setShowFuzzyInfo] = useState(false);
  const [weightClass, setWeightClass] = useState('');
  const [weightClasses, setWeightClasses] = useState<string[]>([]);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
  }, []);

  useEffect(() => {
    api.getWeightClasses().then((data) => {
      const allClasses = [
        ...(data.M || []),
        ...(data.F || [])
      ].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => parseFloat(a) - parseFloat(b));
      setWeightClasses(allClasses);
    }).catch(err => console.error('Error loading weight classes:', err));
  }, []);

  const handleSelectLifter = (lifter: LifterSearchResult) => {
    navigate(`/lifter/${encodeURIComponent(lifter.name)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            IPF Scout
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Powerlifting Scouting & Analytics Platform
          </p>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Analyze competition data from 150,000+ IPF meets. Scout lifters, compare performances,
            and discover strength percentiles across weight classes.
          </p>
        </div>

        {/* Quick Search */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Find a Lifter</h2>
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
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <LifterSearch
                  onSelectLifter={handleSelectLifter}
                  autoFocus
                  useFuzzySearch={useFuzzySearch}
                  weightClass={weightClass || undefined}
                />
              </div>
              <select
                className="input w-40"
                value={weightClass}
                onChange={(e) => setWeightClass(e.target.value)}
              >
                <option value="">All classes</option>
                {weightClasses.map((wc) => (
                  <option key={wc} value={wc}>{wc} kg</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="card text-center">
              <div className="text-4xl font-bold text-primary-500 mb-2">
                {stats.total_records.toLocaleString()}
              </div>
              <div className="text-gray-400">Competition Records</div>
            </div>
            <div className="card text-center">
              <div className="text-4xl font-bold text-primary-500 mb-2">
                {stats.unique_lifters.toLocaleString()}
              </div>
              <div className="text-gray-400">Unique Lifters</div>
            </div>
            <div className="card text-center">
              <div className="text-4xl font-bold text-primary-500 mb-2">
                {new Date(stats.latest_competition).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
              <div className="text-gray-400">Latest Competition</div>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/scout" className="card hover:border-primary-500 border border-transparent transition-all group">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-500 transition-colors">
              Scout Lifters
            </h3>
            <p className="text-gray-400 text-sm">
              Compare multiple lifters head-to-head. Analyze opening attempts and competition strategies.
            </p>
          </Link>

          <div className="card hover:border-primary-500 border border-transparent transition-all group cursor-pointer"
               onClick={() => {
                 const search = document.querySelector('input');
                 search?.focus();
               }}>
            <div className="text-3xl mb-3">👤</div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-500 transition-colors">
              Lifter Profiles
            </h3>
            <p className="text-gray-400 text-sm">
              View complete competition history, best lifts, and performance trends for any lifter.
            </p>
          </div>

          <Link to="/standards" className="card hover:border-primary-500 border border-transparent transition-all group">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-500 transition-colors">
              Strength Standards
            </h3>
            <p className="text-gray-400 text-sm">
              Discover benchmarks from beginner to world-class for your weight class and equipment.
            </p>
          </Link>
        </div>

        {/* Data Info */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 text-sm">
            Data from <a href="https://www.openpowerlifting.org/" target="_blank" rel="noopener noreferrer"
                        className="text-primary-500 hover:underline">OpenPowerlifting</a>
            {' '}• IPF-affiliated federations only • 2022-present
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Beta Version • Report issues on GitHub
          </p>
        </div>
      </div>
    </div>
  );
}
