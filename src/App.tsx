import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { CONFIG } from './config';
import SignIn from './routes/SignIn';
import Dashboard from './routes/Dashboard';
import FlightDetail from './routes/FlightDetail';
import IssueWizard from './routes/IssueWizard';
import Offline from './routes/Offline';
import Exports from './routes/Exports';
import Admin from './routes/Admin';
import Toast from './components/Toast';

function ProtectedLayout() {
  const { user, signOut } = useAuthStore();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold text-gray-900">Voucher System</h1>
              <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
              <Link to="/exports" className="text-sm text-gray-600 hover:text-gray-900">
                Exports
              </Link>
              {CONFIG.OFFLINE_MODE && (
                <Link to="/offline" className="text-sm text-gray-600 hover:text-gray-900">
                  Offline Mode
                </Link>
              )}
              <Link to="/admin" className="text-sm text-gray-600 hover:text-gray-900">
                Admin
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 text-sm font-medium rounded bg-blue-100 text-blue-800">
                {user.role}
              </span>
              <button
                onClick={signOut}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toast />
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/flight/:id" element={<FlightDetail />} />
          <Route path="/issue" element={<IssueWizard />} />
          <Route path="/offline" element={<Offline />} />
          <Route path="/exports" element={<Exports />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
