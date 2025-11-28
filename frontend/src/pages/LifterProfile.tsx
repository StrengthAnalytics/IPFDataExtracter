import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import type { LifterProfile as LifterProfileType } from '../types';

export function LifterProfile() {
  const { name } = useParams<{ name: string }>();
  const [profile, setProfile] = useState<LifterProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-gray-400 mt-4">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-2xl font-bold text-white mb-2">Lifter Not Found</h2>
        <p className="text-gray-400 mb-6">{error || 'Could not find this lifter'}</p>
        <Link to="/" className="btn btn-primary">Back to Home</Link>
      </div>
    );
  }

  const formatWeight = (kg?: number) => kg ? `${kg} kg` : 'N/A';
  const formatDate = (date?: string) => date ? new Date(date).toLocaleDateString() : 'N/A';

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Best Squat</div>
          <div className="text-3xl font-bold text-green-400 mb-1">{formatWeight(profile.best_squat_kg)}</div>
          <div className="text-xs text-gray-500">{formatDate(profile.best_squat_date)}</div>
          <div className="text-xs text-gray-600 truncate">{profile.best_squat_meet || '-'}</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Best Bench</div>
          <div className="text-3xl font-bold text-blue-400 mb-1">{formatWeight(profile.best_bench_kg)}</div>
          <div className="text-xs text-gray-500">{formatDate(profile.best_bench_date)}</div>
          <div className="text-xs text-gray-600 truncate">{profile.best_bench_meet || '-'}</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Best Deadlift</div>
          <div className="text-3xl font-bold text-red-400 mb-1">{formatWeight(profile.best_deadlift_kg)}</div>
          <div className="text-xs text-gray-500">{formatDate(profile.best_deadlift_date)}</div>
          <div className="text-xs text-gray-600 truncate">{profile.best_deadlift_meet || '-'}</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Best Total</div>
          <div className="text-3xl font-bold text-purple-400 mb-1">{formatWeight(profile.best_total_kg)}</div>
          <div className="text-xs text-gray-500">{formatDate(profile.best_total_date)}</div>
          <div className="text-xs text-gray-600 truncate">{profile.best_total_meet || '-'}</div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-3">Weight Classes</h3>
          <div className="flex flex-wrap gap-2">
            {profile.weight_classes && profile.weight_classes.length > 0 ? (
              profile.weight_classes.map((wc: string, idx: number) => (
                <span key={idx} className="bg-gray-700 px-3 py-1 rounded-full text-sm text-gray-300">
                  {wc} kg
                </span>
              ))
            ) : (
              <span className="text-gray-500">No data</span>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-3">Equipment</h3>
          <div className="flex flex-wrap gap-2">
            {profile.equipment_types && profile.equipment_types.length > 0 ? (
              profile.equipment_types.map((eq: string, idx: number) => (
                <span key={idx} className="bg-gray-700 px-3 py-1 rounded-full text-sm text-gray-300">
                  {eq}
                </span>
              ))
            ) : (
              <span className="text-gray-500">No data</span>
            )}
          </div>
        </div>
      </div>

      {/* Competition History */}
      <div className="card">
        <h3 className="text-xl font-semibold text-white mb-4">Competition History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Date</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Meet</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Federation</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Squat</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Bench</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Deadlift</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Total</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Place</th>
              </tr>
            </thead>
            <tbody>
              {profile.competitions && profile.competitions.length > 0 ? (
                profile.competitions.map((comp, idx) => (
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
                    <td className="py-3 px-4 text-center text-gray-300">{comp.place || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
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
