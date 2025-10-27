import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import type { Preset } from '../types';

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadPresets();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadPresets = async () => {
    try {
      const res = await fetch('/api/presets');
      const data = await res.json();
      setPresets(data);
    } catch (err) {
      console.error('Failed to load presets:', err);
    } finally {
      setLoading(false);
    }
  };

  // Access control - show message if not ADMIN
  if (user?.role !== 'ADMIN') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-6">
          <p className="text-yellow-900 font-medium">You don't have access to this page.</p>
          <p className="text-sm text-yellow-800 mt-2">Only ADMIN users can view and manage system presets.</p>
        </div>
      </div>
    );
  }

  // ADMIN view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Presets Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Voucher Presets</h2>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Voucher Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Disruption Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Default Amount (AUD)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {presets.map((preset, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {preset.voucherType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {preset.disruptionCategory}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${preset.defaultAmount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              <strong>Note:</strong> Editable in MVP; read-only in prototype.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
