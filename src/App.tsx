import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { Home } from './pages/Home';
import { Scout } from './pages/Scout';
import { LifterProfile } from './pages/LifterProfile';
import { Percentile } from './pages/Percentile';
import { Standards } from './pages/Standards';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scout" element={<Scout />} />
          <Route path="/lifter/:name" element={<LifterProfile />} />
          <Route path="/percentile" element={<Percentile />} />
          <Route path="/standards" element={<Standards />} />
        </Routes>
      </div>
    </Router>
  );
}
