import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { StrengthStandards as StrengthStandardsType } from '../types';

export function Standards() {
  const [sex, setSex] = useState('M');
  const [weightClass, setWeightClass] = useState('93');
  const [equipment, setEquipment] = useState('Raw');
  const [standards, setStandards] = useState<StrengthStandardsType | null>(null);
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
    if (weightClasses) {
      setWeightClass(weightClasses[sex as 'M' | 'F'][0]);
    }
  }, [sex, weightClasses]);

  useEffect(() => {
    loadStandards();
  }, [sex, weightClass, equipment]);

  const loadStandards = async () => {
    setIsLoading(true);
    try {
      const data = await api.getStrengthStandards(sex, weightClass, equipment);
      setStandards(data);
    } catch (error) {
      console.error('Error loading standards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const levels = [
    { key: 'beginner', label: 'Beginner', color: 'bg-gray-600', percentile: '10th' },
    { key: 'novice', label: 'Novice', color: 'bg-blue-600', percentile: '25th' },
    { key: 'intermediate', label: 'Intermediate', color: 'bg-green-600', percentile: '50th' },
    { key: 'advanced', label: 'Advanced', color: 'bg-yellow-600', percentile: '75th' },
    { key: 'elite', label: 'Elite', color: 'bg-orange-600', percentile: '90th' },
    { key: 'world_class', label: 'World Class', color: 'bg-purple-600', percentile: '95th' },
  ];

  const lifts = [
    { key: 'squat', label: 'Squat', icon: '🏋️', color: 'text-green-400' },
    { key: 'bench', label: 'Bench', icon: '💪', color: 'text-blue-400' },
    { key: 'deadlift', label: 'Deadlift', icon: '🔥', color: 'text-red-400' },
    { key: 'total', label: 'Total', icon: '🎯', color: 'text-purple-400' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Strength Standards</h1>
        <p className="text-gray-400">Benchmarks from beginner to world-class</p>
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </div>
      </div>

      {/* Standards Tables */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading standards...</p>
        </div>
      ) : standards && standards.standards ? (
        <div className="space-y-8">
          {lifts.map((lift) => {
            const liftData = standards.standards[lift.key];
            if (!liftData) return null;

            return (
              <div key={lift.key} className="card">
                <div className="flex items-center mb-6">
                  <span className="text-3xl mr-3">{lift.icon}</span>
                  <div>
                    <h2 className={`text-2xl font-bold ${lift.color}`}>{lift.label}</h2>
                    <p className="text-sm text-gray-500">
                      Based on {liftData.sample_size.toLocaleString()} lifters • Max: {liftData.max_recorded} kg
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Level</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Percentile</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Weight (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levels.map((level) => {
                        const weight = liftData[level.key as keyof typeof liftData];
                        return (
                          <tr key={level.key} className="border-b border-gray-800">
                            <td className="py-3 px-4">
                              <span className={`inline-block px-3 py-1 rounded-full text-white text-sm ${level.color}`}>
                                {level.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-400">{level.percentile} percentile</td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-2xl font-bold text-white">{weight}</span>
                              <span className="text-gray-400 ml-2">kg</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Understanding Levels</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {levels.map((level) => (
                <div key={level.key} className="flex items-start space-x-3">
                  <span className={`inline-block w-4 h-4 rounded-full ${level.color} mt-1`}></span>
                  <div>
                    <div className="font-semibold text-white">{level.label}</div>
                    <div className="text-gray-400">{level.percentile} percentile of all IPF lifters in this category</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📈</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Data Available</h3>
          <p className="text-gray-400">
            Not enough data for this combination. Try a different weight class or equipment type.
          </p>
        </div>
      )}
    </div>
  );
}
