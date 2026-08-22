import { Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import LoginPortal from './pages/LoginPortal';

export default function App() {
  return (
    <div className="app-shell">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
        <div className="container">
          <Link className="navbar-brand fw-bold" to="/">
            Credential & Session Manager
          </Link>
          <div className="navbar-nav ms-auto">
            <Link className="nav-link" to="/">
              Dashboard
            </Link>
            <Link className="nav-link" to="/login/gmail">
              Provider Test
            </Link>
          </div>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login/:provider" element={<LoginPortal />} />
      </Routes>
    </div>
  );
}
