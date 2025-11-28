import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { PercentileData } from '../types';

export function Percentile() {
  const [value, setValue] = useState('');
  const [sex, setSex] = useState('M');
  const [equipment, setEquipment] = useState('Raw');
  const [weightClass, setWeightClass] = useState('93');
  const [liftType, setLiftType] = useState('squat');
  const [result, setResult] = useState<PercentileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [weightClasses, setWeightClasses] = useState<{ M: string[]; F: string[] } | null>(null);

  useEffect(() => {
    api.getWeightClasses().then((data) => {
      if (data.M && data.F) {
        setWeightClasses(data as { M: string[]; F: string[] });
      }
    });
  }, []);

  useEffect(() => {
    // Update weight class when sex changes
    if (weightClasses) {
      setWeightClass(weightClasses[sex as 'M' | 'F'][0]);
    }
  }, [sex, weightClasses]);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      alert('Please enter a valid weight');
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.calculatePercentile({
        value: numValue,
        sex,
        equipment,
        weight_class: weightClass,
        lift_type: liftType,
        event: 'SBD',
      });
      setResult(data);
    } catch (error) {
      console.error('Percentile calculation error:', error);
      alert('Error calculating percentile. This combination may not have enough data.');
    } finally {
      setIsLoading(false);
    }
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 95) return 'text-purple-400';
    if (percentile >= 90) return 'text-yellow-400';
    if (percentile >= 75) return 'text-green-400';
    if (percentile >= 50) return 'text-blue-400';
    return 'text-gray-400';
  };

  const getPercentileLabel = (percentile: number) => {
    if (percentile >= 95) return 'World Class';
    if (percentile >= 90) return 'Elite';
    if (percentile >= 75) return 'Advanced';
    if (percentile >= 50) return 'Intermediate';
    if (percentile >= 25) return 'Novice';
    return 'Beginner';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Percentile Calculator</h1>
        <p className="text-gray-400">See how your lifts rank compared to IPF lifters</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-6">Enter Your Lift</h2>
          <form onSubmit={handleCalculate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Lift Weight (kg)
              </label>
              <input
                type="number"
                step="0.5"
                className="input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g., 200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Sex</label>
              <select className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Weight Class</label>
              <select
                className="input"
                value={weightClass}
                onChange={(e) => setWeightClass(e.target.value)}
              >
                {weightClasses &&
                  weightClasses[sex as 'M' | 'F'].map((wc) => (
                    <option key={wc} value={wc}>
                      {wc} kg
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Equipment</label>
              <select
                className="input"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              >
                <option value="Raw">Raw</option>
                <option value="Wraps">Wraps</option>
                <option value="Single-ply">Single-ply</option>
                <option value="Multi-ply">Multi-ply</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Lift Type</label>
              <select
                className="input"
                value={liftType}
                onChange={(e) => setLiftType(e.target.value)}
              >
                <option value="squat">Squat</option>
                <option value="bench">Bench Press</option>
                <option value="deadlift">Deadlift</option>
                <option value="total">Total</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
              {isLoading ? 'Calculating...' : 'Calculate Percentile'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div>
          {result ? (
            <div className="space-y-6">
              {/* Main Percentile */}
              <div className="card text-center">
                <div className="text-6xl font-bold mb-2">
                  <span className={getPercentileColor(result.percentile)}>
                    {result.percentile.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xl text-white mb-1">Percentile</div>
                <div className="text-gray-400">{getPercentileLabel(result.percentile)}</div>
                <div className="text-sm text-gray-500 mt-4">
                  Based on {result.sample_size.toLocaleString()} lifters
                </div>
              </div>

              {/* Statistics */}
              <div className="card">
                <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Mean</div>
                    <div className="text-white font-semibold">{result.mean} kg</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Median</div>
                    <div className="text-white font-semibold">{result.median} kg</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Min</div>
                    <div className="text-white font-semibold">{result.min} kg</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Max</div>
                    <div className="text-white font-semibold">{result.max} kg</div>
                  </div>
                </div>
              </div>

              {/* Percentile Breakdown */}
              <div className="card">
                <h3 className="text-lg font-semibold text-white mb-4">Percentile Breakdown</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Top 1%', value: result.p99 },
                    { label: 'Top 5%', value: result.p95 },
                    { label: 'Top 10%', value: result.p90 },
                    { label: 'Top 25%', value: result.p75 },
                    { label: '50th percentile', value: result.p50 },
                    { label: '25th percentile', value: result.p25 },
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="text-white font-semibold">{item.value} kg</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-16">
              <div className="text-5xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-white mb-2">Ready to Calculate</h3>
              <p className="text-gray-400">
                Enter your lift details and click calculate to see your percentile ranking
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
