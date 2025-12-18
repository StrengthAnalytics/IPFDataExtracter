import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { ConfigCheck } from './components/ConfigCheck';
import { Navigation } from './components/Navigation';
import { ToastProvider } from './components/Toast';
import { Home } from './pages/Home';
import { Scout } from './pages/Scout';
import { LifterProfile } from './pages/LifterProfile';
import { Standards } from './pages/Standards';

export default function App() {
  return (
    <ConfigCheck>
      <ToastProvider>
        <Router>
          <div className="min-h-screen bg-gray-950">
            <Navigation />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/scout" element={<Scout />} />
              <Route path="/lifter/:name" element={<LifterProfile />} />
              <Route path="/standards" element={<Standards />} />
            </Routes>
          </div>
        </Router>
        <Analytics />
      </ToastProvider>
    </ConfigCheck>
  );
}
