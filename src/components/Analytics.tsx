import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Flight, Issuance } from '../types';
import {
  calculateAnalytics,
  filterIssuancesByDateRange,
  filterIssuancesByFlight,
  getDateRange,
  calculatePercentageChange,
  formatCurrency,
  formatPercentage,
  DATE_RANGE_PRESETS,
} from '../utils/analytics';

interface AnalyticsProps {
  flights: Flight[];
}

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export default function Analytics({ flights }: AnalyticsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedDays, setSelectedDays] = useState(7); // Default to 7 days
  const [selectedFlightId, setSelectedFlightId] = useState<string>('all');
  const [showComparison, setShowComparison] = useState(true);
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all issuances
  useEffect(() => {
    loadIssuances();
  }, []);

  const loadIssuances = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/issuances');

      // Check if response is JSON
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response. Please refresh the page.');
      }

      const data = await res.json();
      setIssuances(data);
    } catch (err: any) {
      console.error('Failed to load issuances:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate current and previous period data
  const { startDate: currentStart, endDate: currentEnd } = getDateRange(selectedDays);
  const { startDate: prevStart, endDate: prevEnd } = getDateRange(selectedDays * 2);

  // Filter issuances
  let currentIssuances = filterIssuancesByDateRange(issuances, currentStart, currentEnd);
  currentIssuances = filterIssuancesByFlight(currentIssuances, selectedFlightId);

  let previousIssuances = filterIssuancesByDateRange(issuances, prevStart, prevEnd);
  previousIssuances = filterIssuancesByFlight(previousIssuances, selectedFlightId);
  // Only take the period before current period
  previousIssuances = filterIssuancesByDateRange(previousIssuances, prevStart, currentStart);

  // Calculate analytics
  const currentData = calculateAnalytics(currentIssuances);
  const previousData = calculateAnalytics(previousIssuances);

  // Calculate trends
  const valueTrend = calculatePercentageChange(currentData.totalValue, previousData.totalValue);
  const countTrend = calculatePercentageChange(currentData.totalCount, previousData.totalCount);
  const avgTrend = calculatePercentageChange(currentData.averageValue, previousData.averageValue);

  // Get most issued voucher type
  const mostIssuedType = currentData.voucherTypeBreakdown[0]?.type || 'N/A';

  // Empty state check
  const hasData = currentIssuances.length > 0;

  if (loading) {
    return (
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-6">
        <p className="text-gray-600 dark:text-gray-400">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={loadIssuances}
            className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border overflow-hidden">
      {/* Header with toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
            Analytics Dashboard
          </h2>
          {!hasData && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              No Data
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        )}
      </button>

      {/* Collapsed view - 3 key highlights */}
      {!isExpanded && (
        <div className="px-6 pb-4">
          {!hasData ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No vouchers have been issued yet. Issue your first voucher to see analytics.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Total Value"
                value={formatCurrency(currentData.totalValue)}
                trend={showComparison ? valueTrend : null}
              />
              <StatCard
                label="Total Issued"
                value={currentData.totalCount.toString()}
                trend={showComparison ? countTrend : null}
              />
              <StatCard
                label="Most Issued"
                value={mostIssuedType}
                trend={null}
              />
            </div>
          )}
        </div>
      )}

      {/* Expanded view - detailed analytics */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <select
                value={selectedDays}
                onChange={(e) => setSelectedDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm"
              >
                {DATE_RANGE_PRESETS.map((preset) => (
                  <option key={preset.days} value={preset.days}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Flight
              </label>
              <select
                value={selectedFlightId}
                onChange={(e) => setSelectedFlightId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Flights</option>
                {flights.map((flight) => (
                  <option key={flight.id} value={flight.id}>
                    {flight.flightNumber} - {flight.origin} to {flight.destination}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Comparison
              </label>
              <button
                onClick={() => setShowComparison(!showComparison)}
                className={`w-full px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  showComparison
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border'
                }`}
              >
                {showComparison ? 'vs Previous Period ✓' : 'vs Previous Period'}
              </button>
            </div>
          </div>

          {/* Empty state for filtered data */}
          {!hasData ? (
            <div className="py-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-2">No vouchers found for the selected filters</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Try adjusting your date range or flight filter to see data
              </p>
            </div>
          ) : (
            <>
              {/* Key metrics cards */}
              <div className="grid grid-cols-3 gap-4">
                <StatCard
                  label="Total Value"
                  value={formatCurrency(currentData.totalValue)}
                  trend={showComparison ? valueTrend : null}
                  large
                />
                <StatCard
                  label="Total Issued"
                  value={currentData.totalCount.toString()}
                  trend={showComparison ? countTrend : null}
                  large
                />
                <StatCard
                  label="Average Value"
                  value={formatCurrency(currentData.averageValue)}
                  trend={showComparison ? avgTrend : null}
                  large
                />
              </div>

              {/* Visualizations */}
              <div className="grid grid-cols-2 gap-6">
                {/* Voucher Types */}
                <ChartCard title="Voucher Types">
                  {currentData.voucherTypeBreakdown.length > 0 ? (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={currentData.voucherTypeBreakdown}
                            dataKey="count"
                            nameKey="type"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            label={({ type, percentage }: { type: string; percentage: number }) => `${type} (${percentage.toFixed(0)}%)`}
                          >
                            {currentData.voucherTypeBreakdown.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {currentData.voucherTypeBreakdown.map((item, index) => (
                          <div key={item.type} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-gray-700 dark:text-gray-300">{item.type}</span>
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">
                              {item.count} ({item.percentage.toFixed(1)}%)
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                      No voucher type data available
                    </p>
                  )}
                </ChartCard>

                {/* Time of Day Patterns */}
                <ChartCard title="Issuance by Time of Day">
                  {currentData.timeOfDayPatterns.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={currentData.timeOfDayPatterns}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                        <XAxis
                          dataKey="hour"
                          label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5 }}
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                        />
                        <YAxis
                          label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '0.5rem',
                            color: '#fff',
                          }}
                        />
                        <Line type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                      No time-of-day data available
                    </p>
                  )}
                </ChartCard>
              </div>

              {/* Disruption Reasons */}
              {currentData.disruptionReasons.length > 0 && (
                <ChartCard title="Top Disruption Reasons">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={currentData.disruptionReasons} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                      <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="reason"
                        width={150}
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '0.5rem',
                          color: '#fff',
                        }}
                      />
                      <Bar dataKey="count" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string;
  trend: number | null;
  large?: boolean;
}

function StatCard({ label, value, trend, large = false }: StatCardProps) {
  const hasPositiveTrend = trend !== null && trend > 0;
  const hasNegativeTrend = trend !== null && trend < 0;

  return (
    <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-4 border border-gray-200 dark:border-dark-border">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`font-bold text-gray-900 dark:text-white ${large ? 'text-2xl' : 'text-xl'}`}>
        {value}
      </p>
      {trend !== null && (
        <div className="flex items-center gap-1 mt-1">
          {hasPositiveTrend && <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />}
          {hasNegativeTrend && <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />}
          <span
            className={`text-xs font-medium ${
              hasPositiveTrend
                ? 'text-green-600 dark:text-green-400'
                : hasNegativeTrend
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {formatPercentage(trend)}
          </span>
        </div>
      )}
    </div>
  );
}

// Chart Card Component
interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-4 border border-gray-200 dark:border-dark-border">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}
