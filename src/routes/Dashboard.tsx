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
        return <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">On time</span>;
      case 'DELAYED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-amber-100 text-amber-800">Delayed</span>;
      case 'CANCELLED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">Cancelled</span>;
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
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Filter by Date</h2>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Flights</h2>
        </div>

        {loading && (
          <div className="px-6 py-8 text-center text-gray-600">Loading flights...</div>
        )}

        {error && (
          <div className="px-6 py-8">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={loadFlights}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && flights.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-600">No flights found for this date.</div>
        )}

        {!loading && !error && flights.length > 0 && (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Flight
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dep
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Arr
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {flights.map((flight) => (
                <tr key={flight.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{flight.flightNumber}</span>
                      {flight.status !== 'ON_TIME' && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                          Disrupted
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {flight.origin} → {flight.destination}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {formatTime(flight.depTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {formatTime(flight.arrTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(flight.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => navigate(`/flight/${flight.id}`)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
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
