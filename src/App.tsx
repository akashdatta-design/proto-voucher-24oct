import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import SignIn from './routes/SignIn';
import Dashboard from './routes/Dashboard';
import FlightDetail from './routes/FlightDetail';
import IssueWizard from './routes/IssueWizard';
import Exports from './routes/Exports';
import Admin from './routes/Admin';
import Toast from './components/Toast';
import ThemeToggle from './components/ThemeToggle';
import qantasLogo from './assets/logo.svg';

function ProtectedLayout() {
  const { user, signOut } = useAuthStore();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-200">
      {/* Top Nav */}
      <nav className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-6">
              <img src={qantasLogo} alt="Qantas" className="h-8" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                Vouchers
              </h1>
              <Link
                to="/dashboard"
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-primary uppercase tracking-wide"
              >
                Dashboard
              </Link>
              <Link
                to="/exports"
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-primary uppercase tracking-wide"
              >
                Exports
              </Link>
              <Link
                to="/admin"
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-primary uppercase tracking-wide"
              >
                Admin
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <span className="px-3 py-1 text-xs font-semibold rounded bg-primary/10 text-primary dark:bg-primary/20 uppercase tracking-wide">
                {user.role}
              </span>
              <button
                onClick={signOut}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-dark-border rounded hover:bg-gray-50 dark:hover:bg-dark-hover dark:text-white"
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
          <Route path="/exports" element={<Exports />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
