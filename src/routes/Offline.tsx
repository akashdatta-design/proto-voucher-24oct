import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOfflineQueue } from '../store/useOfflineQueue';
import { useToast } from '../store/useToast';
import type { IssuanceIntent } from '../store/useOfflineQueue';

export default function Offline() {
  const navigate = useNavigate();
  const location = useLocation();
  const { intents, updateStatus, remove } = useOfflineQueue();
  const { show: showToast } = useToast();
  const [offlineState, setOfflineState] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Load offline state
  useEffect(() => {
    fetchOfflineState();

    // Show toast from navigation state
    if (location.state?.toast) {
      showToast(location.state.toast, 'info');
      // Clear state
      navigate(location.pathname, { replace: true });
    }
  }, []);

  const fetchOfflineState = async () => {
    try {
      const res = await fetch('/api/_offline_state');
      const data = await res.json();
      setOfflineState(data.offline);
    } catch (err) {
      console.error('Failed to fetch offline state:', err);
    }
  };

  const toggleOffline = async () => {
    try {
      const res = await fetch('/api/_toggle_offline', { method: 'POST' });
      const data = await res.json();
      setOfflineState(data.offline);
      showToast(data.offline ? 'System is now OFFLINE' : 'System is now ONLINE', 'info');
    } catch (err) {
      console.error('Failed to toggle offline:', err);
    }
  };

  const retryIntent = async (intent: IssuanceIntent) => {
    updateStatus(intent.id, 'posting');

    try {
      // Reconstruct issuance rows from intent using stored passenger data
      const passengers = intent.payload.passengers || intent.payload.recipientPaxIds.map((pnr) => ({
        pnr,
        name: `Passenger ${pnr}`,
        seat: '',
      }));

      const rows = passengers.flatMap((pax, paxIndex) =>
        intent.payload.vouchers.map((voucher) => {
          let notes = '';

          // Handle serials
          if (voucher.mode === 'quick' && voucher.startSerial) {
            notes = `serial:${voucher.startSerial}-${paxIndex}`;
          } else if (voucher.mode === 'manual' && voucher.manualSerials?.[paxIndex]) {
            notes = `serial:${voucher.manualSerials[paxIndex]}`;
          }

          return {
            flightId: intent.payload.flightId,
            pnr: pax.pnr,
            passengerName: pax.name,
            seat: pax.seat || '',
            voucherType: voucher.type,
            amount: voucher.amount,
            currency: 'AUD',
            method: voucher.type === 'UBER' ? 'uber_digital' : voucher.type === 'MEAL' ? 'meal_paper' : 'cabcharge_paper',
            externalId: voucher.type === 'UBER' ? '' : undefined, // Empty for UBER when offline
            issuerId: 'offline-queue',
            issuerName: 'Offline Queue',
            notes,
            photoUrl: voucher.photoDataUrl || undefined,
          };
        })
      );

      const res = await fetch('/api/issuances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      updateStatus(intent.id, 'synced');
      showToast('Intent synced successfully.', 'success');
    } catch (err: any) {
      updateStatus(intent.id, 'failed', err.message || 'Network error');
      showToast('Retry failed - check connection.', 'error');
    }
  };

  const syncAll = async () => {
    setSyncing(true);
    const toSync = intents.filter((i) => i.status === 'queued' || i.status === 'failed');

    let succeeded = 0;
    let failed = 0;

    for (const intent of toSync) {
      try {
        await retryIntent(intent);
        succeeded++;
      } catch {
        failed++;
      }
    }

    setSyncing(false);
    showToast(`Sync completed: ${succeeded} succeeded, ${failed} failed.`, succeeded > 0 ? 'success' : 'warning');
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString();
  };

  const getVoucherSummary = (vouchers: IssuanceIntent['payload']['vouchers']) => {
    return vouchers.map((v) => v.type).join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Offline Mode & Queue</h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Back to Dashboard
        </button>
      </div>


      {/* Offline State Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">System Status</h2>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-600">Current State:</p>
            <p className="text-lg font-bold">
              {offlineState ? (
                <span className="text-red-600">OFFLINE</span>
              ) : (
                <span className="text-green-600">ONLINE</span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={toggleOffline}
              className={`px-4 py-2 text-sm font-medium rounded ${
                offlineState
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {offlineState ? 'Go Online' : 'Go Offline'}
            </button>
            <button
              onClick={syncAll}
              disabled={syncing || intents.filter((i) => i.status === 'queued' || i.status === 'failed').length === 0}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Queued Issuances ({intents.length})</h2>

        {intents.length === 0 ? (
          <p className="text-sm text-gray-500">No queued issuances</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created At</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flight ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Passengers</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher Types</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {intents.map((intent) => (
                  <tr key={intent.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(intent.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{intent.payload.flightId}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{intent.payload.recipientPaxIds.length}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{getVoucherSummary(intent.payload.vouchers)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          intent.status === 'synced'
                            ? 'bg-green-100 text-green-800'
                            : intent.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : intent.status === 'posting'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {intent.status}
                      </span>
                      {intent.error && (
                        <p className="text-xs text-red-600 mt-1">{intent.error}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button
                        onClick={() => retryIntent(intent)}
                        disabled={intent.status === 'posting' || intent.status === 'synced'}
                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Retry
                      </button>
                      <button
                        onClick={() => remove(intent.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
