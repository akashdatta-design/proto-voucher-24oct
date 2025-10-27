import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome back</h1>
          <p className="text-gray-600 mb-6">
            Signed in as <span className="font-semibold">{user.role}</span>
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Disruption Voucher System
        </h1>
        <p className="text-gray-600 mb-6">Select your role to continue</p>

        <div className="space-y-3">
          <button
            onClick={() => handleSignIn('CSA')}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            CSA
          </button>
          <button
            onClick={() => handleSignIn('SUPERVISOR')}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
          >
            SUPERVISOR
          </button>
          <button
            onClick={() => handleSignIn('FINANCE')}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            FINANCE
          </button>
          <button
            onClick={() => handleSignIn('ADMIN')}
            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 font-medium"
          >
            ADMIN
          </button>
        </div>
      </div>
    </div>
  );
}
