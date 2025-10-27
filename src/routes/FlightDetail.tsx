import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Utensils, Car, CreditCard, Hotel } from 'lucide-react';
import { fetchFlight, fetchPassengers } from '../api/io';
import { fetchIssuancesByFlight } from '../api/vouchers';
import { useSelectionStore } from '../store/selection';
import type { VoucherType, Issuance } from '../types';

type FilterMode = 'all' | 'not-boarded';

function QffTierBadge({ tier }: { tier?: string }) {
  if (!tier) return <span className="text-gray-400 dark:text-gray-600">-</span>;

  const colors: Record<string, string> = {
    'Platinum One': 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
    'Platinum': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
    'Gold': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    'Silver': 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
    'Bronze': 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[tier] || colors['Bronze']}`}>
      {tier}
    </span>
  );
}

function TransitingBadge({ transiting }: { transiting?: boolean }) {
  if (transiting === undefined) return <span className="text-gray-400 dark:text-gray-600">-</span>;

  return transiting ? (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
      Yes
    </span>
  ) : (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
      No
    </span>
  );
}

function IssuedCounts({
  counts
}: {
  counts: Record<VoucherType, number>
}) {
  const icons = {
    MEAL: <Utensils className="w-4 h-4" />,
    UBER: <Car className="w-4 h-4" />,
    CABCHARGE: <CreditCard className="w-4 h-4" />,
    HOTEL: <Hotel className="w-4 h-4" />,
  };

  const abbreviations = {
    MEAL: 'M',
    UBER: 'U',
    CABCHARGE: 'C',
    HOTEL: 'H',
  };

  // Get all non-zero voucher types
  const issued = (Object.keys(counts) as VoucherType[]).filter(
    (type) => counts[type] > 0
  );

  if (issued.length === 0) {
    return <span className="text-gray-400 dark:text-gray-600">-</span>;
  }

  return (
    <div className="flex gap-2 items-center flex-wrap">
      {issued.map((type) => (
        <div
          key={type}
          className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          title={`${type}: ${counts[type]}`}
        >
          {icons[type]}
          <span className="text-xs font-medium">{counts[type]}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {abbreviations[type]}
          </span>
        </div>
      ))}
    </div>
  );
}

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
  const [searchQuery, setSearchQuery] = useState('');
  const [issuanceCounts, setIssuanceCounts] = useState<
    Record<string, Record<VoucherType, number>>
  >({});
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

      // Count issuances by passenger and type
      const newCounts: Record<string, Record<VoucherType, number>> = {};
      passengersData.forEach((p) => {
        newCounts[p.id] = { MEAL: 0, UBER: 0, CABCHARGE: 0, HOTEL: 0 };
      });

      issuancesData.forEach((iss) => {
        if (iss.status === 'issued') {
          const pax = passengersData.find((p) => p.pnr === iss.pnr);
          if (pax && newCounts[pax.id]) {
            newCounts[pax.id][iss.voucherType]++;
          }
        }
      });

      setIssuanceCounts(newCounts);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Compute filtered passengers based on search and filter mode
  const filteredPassengers = useMemo(() => {
    if (!passengers) return [];

    let result = passengers;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((p) => {
        // PNR: partial, case-insensitive
        if (p.pnr.toLowerCase().includes(query)) return true;
        // Name: substring, case-insensitive
        if (p.name.toLowerCase().includes(query)) return true;
        // Seat: exact or startsWith
        if (p.seat.toLowerCase() === query || p.seat.toLowerCase().startsWith(query)) return true;
        return false;
      });
    }

    // Apply boarding filter
    if (filter === 'not-boarded') {
      result = result.filter((p) => !p.boarded);
    }

    return result;
  }, [passengers, searchQuery, filter]);

  const handleSelectAll = () => {
    const ids = filteredPassengers.map((p) => p.id);
    selectAll(ids);
  };

  const handleSelectAllNotBoarded = () => {
    const ids = passengers.filter((p) => !p.boarded).map((p) => p.id);
    selectAll(ids);
  };

  const handleClear = () => {
    clear(); // Clear selections from store
    setSearchQuery(''); // Clear search
    setFilter('all'); // Reset filter to show all
  };

  // Compute total counts across all passengers
  const totalCounts = useMemo(() => {
    const totals: Record<VoucherType, number> = { MEAL: 0, UBER: 0, CABCHARGE: 0, HOTEL: 0 };
    Object.values(issuanceCounts).forEach((counts) => {
      totals.MEAL += counts.MEAL;
      totals.UBER += counts.UBER;
      totals.CABCHARGE += counts.CABCHARGE;
      totals.HOTEL += counts.HOTEL;
    });
    return totals;
  }, [issuanceCounts]);

  const isScannerSupported = true; // Always show scanner button for mock

  const handleScanBoardingPass = () => {
    // Mock boarding pass scan - pick a passenger to simulate scanning
    // Prefer not-boarded passengers first
    const notBoarded = passengers.filter(p => !p.boarded);
    const candidateList = notBoarded.length > 0 ? notBoarded : passengers;

    if (candidateList.length === 0) {
      alert('No passengers available to scan');
      return;
    }

    // Simulate scanning the first candidate
    const scannedPax = candidateList[0];
    setSearchQuery(scannedPax.pnr);
    alert(`Boarding pass scanned! PNR: ${scannedPax.pnr}`);
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
                  Meal: {totalCounts.MEAL}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                  Uber: {totalCounts.UBER}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Cabcharge: {totalCounts.CABCHARGE}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                  Hotel: {totalCounts.HOTEL}
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

      {/* Search & Selection Controls */}
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-6">
        {/* Search & Scan */}
        <div className="flex gap-3 items-start mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by PNR, Name, or Seat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
            />
            {searchQuery && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Showing {filteredPassengers.length} of {passengers?.length || 0} passengers
              </p>
            )}
          </div>

          {isScannerSupported && (
            <button
              onClick={handleScanBoardingPass}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white
                         rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600
                         flex items-center gap-2 whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Scan boarding pass
            </button>
          )}
        </div>

        {/* Filters & Actions */}
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
                onClick={handleClear}
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
                        handleClear();
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
                  QFF Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Transiting
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Issued
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Boarded
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-dark-border">
              {filteredPassengers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-600 dark:text-gray-400">
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <QffTierBadge tier={passenger.qffTier} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <TransitingBadge transiting={passenger.transiting} />
                    </td>
                    <td className="px-6 py-4">
                      <IssuedCounts counts={issuanceCounts[passenger.id] || { MEAL: 0, UBER: 0, CABCHARGE: 0, HOTEL: 0 }} />
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
