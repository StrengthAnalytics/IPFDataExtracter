import { Link, useLocation } from 'react-router-dom';

export function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/scout', label: 'Scout' },
    { path: '/percentile', label: 'Percentile' },
    { path: '/standards', label: 'Standards' },
  ];

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3">
            <div className="text-2xl font-bold">🏋️</div>
            <div>
              <div className="text-xl font-bold text-white">IPF Scout</div>
              <div className="text-xs text-gray-400">Powerlifting Analytics</div>
            </div>
          </Link>

          <div className="flex space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
