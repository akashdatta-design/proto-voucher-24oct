import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import ThemeToggle from '../components/ThemeToggle';
import type { Role } from '../types';

export default function SignIn() {
  const navigate = useNavigate();
  const { user, signIn } = useAuthStore();

  const handleSignIn = (role: Role) => {
    signIn(role);
    navigate('/dashboard');
  };

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-lg p-8 max-w-md w-full text-center border border-gray-200 dark:border-dark-border">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
            Welcome back
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Signed in as <span className="font-semibold text-primary">{user.role}</span>
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium transition-colors"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-lg p-8 max-w-md w-full border border-gray-200 dark:border-dark-border">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-wide">
          Vouchers
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Select your role to continue</p>

        <div className="space-y-3">
          <button
            onClick={() => handleSignIn('CSA')}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium uppercase tracking-wide transition-colors"
          >
            CSA
          </button>
          <button
            onClick={() => handleSignIn('SUPERVISOR')}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium uppercase tracking-wide transition-colors"
          >
            SUPERVISOR
          </button>
          <button
            onClick={() => handleSignIn('FINANCE')}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium uppercase tracking-wide transition-colors"
          >
            FINANCE
          </button>
          <button
            onClick={() => handleSignIn('ADMIN')}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium uppercase tracking-wide transition-colors"
          >
            ADMIN
          </button>
        </div>
      </div>
    </div>
  );
}
