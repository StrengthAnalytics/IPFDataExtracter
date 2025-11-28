import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LifterSearch } from '../components/LifterSearch';
import { api } from '../services/api';
import type { LifterSearchResult } from '../types';

export function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ total_records: number; unique_lifters: number; latest_competition: string } | null>(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
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
            <h2 className="text-xl font-semibold text-white mb-4">Find a Lifter</h2>
            <LifterSearch onSelectLifter={handleSelectLifter} autoFocus />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

          <Link to="/percentile" className="card hover:border-primary-500 border border-transparent transition-all group">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-500 transition-colors">
              Percentile Calculator
            </h3>
            <p className="text-gray-400 text-sm">
              See how your lifts rank compared to thousands of lifters in your weight class.
            </p>
          </Link>

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
