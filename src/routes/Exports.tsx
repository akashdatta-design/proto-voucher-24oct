import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Flight, Issuance } from '../types';

export default function Exports() {
  const navigate = useNavigate();
  const [date, setDate] = useState('2025-10-27');
  const [flights, setFlights] = useState<Flight[]>([]);
  const [selectedFlightId, setSelectedFlightId] = useState<string>('all');
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const ROWS_PER_PAGE = 20;

  // Load flights when date changes
  useEffect(() => {
    loadFlights();
  }, [date]);

  // Load issuances when flight selection changes
  useEffect(() => {
    loadIssuances();
  }, [selectedFlightId]);

  const loadFlights = async () => {
    try {
      const res = await fetch(`/api/flights?date=${date}`);
      const data = await res.json();
      setFlights(data);
    } catch (err) {
      console.error('Failed to load flights:', err);
    }
  };

  const loadIssuances = async () => {
    setLoading(true);
    try {
      const url = selectedFlightId === 'all'
        ? '/api/issuances'
        : `/api/issuances?flightId=${selectedFlightId}`;
      const res = await fetch(url);
      const data = await res.json();
      setIssuances(data);
      setPreviewPage(1); // Reset to first page
    } catch (err) {
      console.error('Failed to load issuances:', err);
      setIssuances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const url = selectedFlightId === 'all'
        ? '/api/exports'
        : `/api/exports?flightId=${selectedFlightId}`;
      const res = await fetch(url);
      const blob = await res.blob();

      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `vouchers-export-${selectedFlightId}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to download CSV:', err);
    }
  };

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString();
  };

  // Pagination
  const totalPages = Math.ceil(issuances.length / ROWS_PER_PAGE);
  const startIndex = (previewPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const previewRows = issuances.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-wide">Finance Exports</h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-dark-border rounded hover:bg-gray-50 dark:hover:bg-dark-hover dark:text-white transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Card 1: Filters */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white uppercase tracking-wide">Filters</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flight</label>
            <select
              value={selectedFlightId}
              onChange={(e) => setSelectedFlightId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            >
              <option value="all">Export All (all flights)</option>
              {flights.map((flight) => (
                <option key={flight.id} value={flight.id}>
                  {flight.flightNumber} - {flight.origin} to {flight.destination}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Card 2: Actions + Preview */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Preview & Download</h2>
          <button
            onClick={handleDownloadCSV}
            disabled={issuances.length === 0}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
          >
            Download CSV
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        ) : issuances.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No issuances found for the selected filters.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Showing {startIndex + 1}-{Math.min(endIndex, issuances.length)} of {issuances.length} rows
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border text-sm">
                <thead className="bg-gray-50 dark:bg-dark-bg">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Flight</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">PNR</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Passenger</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Seat</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Method</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">External ID</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Timestamp</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Notes</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {previewRows.map((iss) => {
                    const flight = flights.find((f) => f.id === iss.flightId);
                    return (
                      <tr key={iss.id}>
                        <td className="px-3 py-2 whitespace-nowrap">{flight?.flightNumber || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{flight?.date || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.pnr}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.passengerName}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.seat || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.voucherType}</td>
                        <td className="px-3 py-2 whitespace-nowrap">${iss.amount}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.method}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{iss.externalId || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(iss.timestamp)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">{iss.notes || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                              iss.status === 'issued'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {iss.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setPreviewPage(Math.max(1, previewPage - 1))}
                  disabled={previewPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-dark-border rounded hover:bg-gray-50 dark:hover:bg-dark-hover dark:text-white disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {previewPage} of {totalPages}
                </span>
                <button
                  onClick={() => setPreviewPage(Math.min(totalPages, previewPage + 1))}
                  disabled={previewPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-dark-border rounded hover:bg-gray-50 dark:hover:bg-dark-hover dark:text-white disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
