import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchFlight, fetchPassengers } from '../api/io';
import { fetchIssuancesByFlight } from '../api/vouchers';
import { useSelectionStore } from '../store/selection';
import type { VoucherType, Issuance } from '../types';

type FilterMode = 'all' | 'not-boarded';

export default function FlightDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    flight,
    passengers,
    selectedIds,
    setFlight,
    setPassengers,
    toggle,
    selectAll,
    clear,
  } = useSelectionStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [issuanceCounts, setIssuanceCounts] = useState<Record<VoucherType, number>>({
    MEAL: 0,
    UBER: 0,
    CABCHARGE: 0,
  });
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [vouchersExpanded, setVouchersExpanded] = useState(false);

  const loadData = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const [flightData, passengersData, issuancesData] = await Promise.all([
        fetchFlight(id),
        fetchPassengers(id),
        fetchIssuancesByFlight(id),
      ]);

      setFlight(flightData);
      setPassengers(passengersData);
      setIssuances(issuancesData);

      // Count issuances by type
      const counts: Record<VoucherType, number> = { MEAL: 0, UBER: 0, CABCHARGE: 0 };
      issuancesData.forEach((iss) => {
        if (iss.status === 'issued') {
          counts[iss.voucherType]++;
        }
      });
      setIssuanceCounts(counts);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const filteredPassengers = passengers.filter((p) => {
    if (filter === 'not-boarded') return !p.boarded;
    return true;
  });

  const handleSelectAll = () => {
    const ids = filteredPassengers.map((p) => p.id);
    selectAll(ids);
  };

  const handleSelectAllNotBoarded = () => {
    const ids = passengers.filter((p) => !p.boarded).map((p) => p.id);
    selectAll(ids);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!flight) {
    return (
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">Flight not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Flight Header */}
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-6">
        <div className="flex items-center justify-between mb-4 text-gray-900 dark:text-white">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{flight.flightNumber}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {flight.origin} → {flight.destination} • {flight.date}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">Status</div>
            <span
              className={`px-3 py-1 text-sm font-medium rounded ${
                flight.status === 'ON_TIME'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : flight.status === 'DELAYED'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {flight.status}
            </span>
          </div>
        </div>

      </div>

      {/* Vouchers Issued - Collapsible Section */}
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border">
        <button
          onClick={() => setVouchersExpanded(!vouchersExpanded)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-hover transition"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Vouchers Issued</h2>
            {!vouchersExpanded && (
              <div className="flex gap-2">
                <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  Meal: {issuanceCounts.MEAL}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                  Uber: {issuanceCounts.UBER}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Cabcharge: {issuanceCounts.CABCHARGE}
                </span>
              </div>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${vouchersExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {vouchersExpanded && (
          <div className="px-6 pb-6 border-t border-gray-200 dark:border-dark-border">
            {issuances.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No vouchers issued yet</p>
            ) : (
              <div className="space-y-4 mt-4">
                {/* Group by passenger */}
                {Object.entries(
                  issuances
                    .filter((iss) => iss.status === 'issued')
                    .reduce((acc, iss) => {
                      const key = iss.pnr;
                      if (!acc[key]) {
                        acc[key] = {
                          pnr: iss.pnr,
                          passengerName: iss.passengerName,
                          seat: iss.seat,
                          vouchers: [],
                        };
                      }
                      acc[key].vouchers.push(iss);
                      return acc;
                    }, {} as Record<string, { pnr: string; passengerName: string; seat: string | undefined; vouchers: Issuance[] }>)
                ).map(([pnr, data]) => (
                  <div key={pnr} className="border border-gray-200 dark:border-dark-border rounded-lg p-4 bg-white dark:bg-dark-card">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{data.passengerName}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          PNR: {data.pnr} {data.seat && `• Seat: ${data.seat}`}
                        </p>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{data.vouchers.length} voucher(s)</span>
                    </div>
                    <div className="space-y-2">
                      {data.vouchers.map((voucher) => (
                        <div key={voucher.id} className="flex items-center justify-between bg-gray-50 dark:bg-dark-hover px-3 py-2 rounded text-sm">
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded ${
                                voucher.voucherType === 'MEAL'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                  : voucher.voucherType === 'UBER'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                  : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              }`}
                            >
                              {voucher.voucherType}
                            </span>
                            <span className="text-gray-900 dark:text-white font-medium">${voucher.amount}</span>
                            {voucher.externalId && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">ID: {voucher.externalId.substring(0, 8)}...</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(voucher.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selection Controls */}
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterMode)}
              className="px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All passengers</option>
              <option value="not-boarded">Not boarded</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover dark:text-white transition-colors"
              >
                Select all
              </button>
              <button
                onClick={handleSelectAllNotBoarded}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover dark:text-white transition-colors"
              >
                Select all not-boarded
              </button>
              <button
                onClick={clear}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover dark:text-white transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">{selectedIds.size} selected</span>
            <button
              onClick={() => navigate('/issue')}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Issue voucher{selectedIds.size > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>

      {/* Manifest Table */}
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
            <thead className="bg-gray-50 dark:bg-dark-bg sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={
                      filteredPassengers.length > 0 &&
                      filteredPassengers.every((p) => selectedIds.has(p.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleSelectAll();
                      } else {
                        clear();
                      }
                    }}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-dark-border dark:bg-dark-bg rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  PNR
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Seat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cabin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Boarded
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-dark-border">
              {filteredPassengers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-600 dark:text-gray-400">
                    No passengers match the current filter.
                  </td>
                </tr>
              ) : (
                filteredPassengers.map((passenger) => (
                  <tr
                    key={passenger.id}
                    className={`hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors ${
                      selectedIds.has(passenger.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(passenger.id)}
                        onChange={() => toggle(passenger.id)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-dark-border dark:bg-dark-bg rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {passenger.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-300">
                      {passenger.pnr}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {passenger.seat}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          passenger.cabin === 'J'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {passenger.cabin}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {passenger.boarded ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
