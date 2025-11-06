import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFlights } from '../api/io';
import type { Flight } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [date, setDate] = useState('2025-10-27');
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFlights = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFlights(date);
      setFlights(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlights();
  }, [date]);

  const getStatusBadge = (status: Flight['status']) => {
    switch (status) {
      case 'ON_TIME':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 uppercase">On time</span>;
      case 'DELAYED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 uppercase">Delayed</span>;
      case 'CANCELLED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 uppercase">Cancelled</span>;
    }
  };

  const formatTime = (isoTime: string) => {
    return new Date(isoTime).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Filter by Date</h2>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Flights</h2>
        </div>

        {loading && (
          <div className="px-6 py-8 text-center text-gray-600 dark:text-gray-400">Loading flights...</div>
        )}

        {error && (
          <div className="px-6 py-8">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={loadFlights}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && flights.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-600 dark:text-gray-400">No flights found for this date.</div>
        )}

        {!loading && !error && flights.length > 0 && (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
            <thead className="bg-gray-50 dark:bg-dark-bg">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Flight
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dep
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Arr
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-dark-border">
              {flights.map((flight) => (
                <tr key={flight.id} className="hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{flight.flightNumber}</span>
                      {flight.status !== 'ON_TIME' && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 uppercase">
                          Disrupted
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(flight.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    {flight.origin} → {flight.destination}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-mono">
                    {formatTime(flight.depTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-mono">
                    {formatTime(flight.arrTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => navigate(`/flight/${flight.id}`)}
                      className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors font-medium"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
