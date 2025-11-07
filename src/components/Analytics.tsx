import { useEffect, useState, useRef } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Search, X, Utensils, Car, CreditCard, DollarSign, Hash, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
  const [flightSearch, setFlightSearch] = useState('');
  const [showFlightDropdown, setShowFlightDropdown] = useState(false);
  const [showComparison, setShowComparison] = useState(true);
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFlightDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Filter flights for search
  const filteredFlights = flights.filter((flight) => {
    if (!flightSearch.trim()) return true;
    const searchLower = flightSearch.toLowerCase();
    return (
      flight.flightNumber.toLowerCase().includes(searchLower) ||
      flight.origin.toLowerCase().includes(searchLower) ||
      flight.destination.toLowerCase().includes(searchLower)
    );
  });

  // Get selected flight display name
  const selectedFlight = flights.find((f) => f.id === selectedFlightId);
  const selectedFlightDisplay = selectedFlight
    ? `${selectedFlight.flightNumber} - ${selectedFlight.origin} to ${selectedFlight.destination}`
    : 'All Flights';

  // Generate summary statements
  const totalValueSummary = `Total voucher value of ${formatCurrency(currentData.totalValue)} was issued${showComparison ? ` (${formatPercentage(valueTrend)} vs previous period)` : ''}.`;
  const totalCountSummary = `${currentData.totalCount} voucher${currentData.totalCount !== 1 ? 's were' : ' was'} issued${showComparison ? ` (${formatPercentage(countTrend)} vs previous period)` : ''}.`;
  const avgValueSummary = `Average voucher value was ${formatCurrency(currentData.averageValue)}${showComparison ? ` (${formatPercentage(avgTrend)} vs previous period)` : ''}.`;

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
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Voucher analytics
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              {isExpanded ? 'Track issuance trends and patterns' : 'View key metrics at a glance'}
            </p>
          </div>
          {!hasData && !isExpanded && (
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              No data
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
        <div className="px-6 pb-5 border-t border-gray-200 dark:border-dark-border">
          {!hasData ? (
            <div className="text-center py-6">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                No vouchers issued yet
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Issue your first voucher to see analytics and trends
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 pt-5">
              <StatCard
                label="Total Value"
                value={formatCurrency(currentData.totalValue)}
                trend={showComparison ? valueTrend : null}
                showComparisonLabel={false}
                icon={<DollarSign className="w-4 h-4" />}
              />
              <StatCard
                label="Total Issued"
                value={currentData.totalCount.toString()}
                trend={showComparison ? countTrend : null}
                showComparisonLabel={false}
                icon={<Hash className="w-4 h-4" />}
              />
              <StatCard
                label="Most Issued"
                value={mostIssuedType}
                trend={null}
                showComparisonLabel={false}
                icon={getVoucherIcon(mostIssuedType)}
              />
            </div>
          )}
        </div>
      )}

      {/* Expanded view - detailed analytics */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-gray-200 dark:border-dark-border">
          {/* Filters */}
          <div className="grid grid-cols-3 gap-4 pt-6">
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

            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Flight
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={selectedFlightId === 'all' ? flightSearch : selectedFlightDisplay}
                  onChange={(e) => {
                    setFlightSearch(e.target.value);
                    setShowFlightDropdown(true);
                    if (e.target.value === '') {
                      setSelectedFlightId('all');
                    }
                  }}
                  onFocus={() => setShowFlightDropdown(true)}
                  placeholder="Search flights..."
                  className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                />
                {selectedFlightId !== 'all' && (
                  <button
                    onClick={() => {
                      setSelectedFlightId('all');
                      setFlightSearch('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Flight dropdown */}
              {showFlightDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedFlightId('all');
                      setFlightSearch('');
                      setShowFlightDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-dark-hover text-gray-900 dark:text-white"
                  >
                    All Flights
                  </button>
                  {filteredFlights.map((flight) => (
                    <button
                      key={flight.id}
                      onClick={() => {
                        setSelectedFlightId(flight.id);
                        setFlightSearch('');
                        setShowFlightDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-dark-hover text-gray-900 dark:text-white"
                    >
                      {flight.flightNumber} - {flight.origin} to {flight.destination}
                    </button>
                  ))}
                  {filteredFlights.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      No flights found
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Comparison
              </label>
              <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                <input
                  type="checkbox"
                  checked={showComparison}
                  onChange={(e) => setShowComparison(e.target.checked)}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="text-sm text-gray-900 dark:text-white">vs Previous Period</span>
              </label>
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
              {/* Key metrics cards with summaries */}
              <div className="grid grid-cols-3 gap-5">
                <StatCard
                  label="Total Value"
                  value={formatCurrency(currentData.totalValue)}
                  trend={showComparison ? valueTrend : null}
                  summary={totalValueSummary}
                  showComparisonLabel={showComparison}
                  large
                  icon={<DollarSign className="w-5 h-5" />}
                />
                <StatCard
                  label="Total Issued"
                  value={currentData.totalCount.toString()}
                  trend={showComparison ? countTrend : null}
                  summary={totalCountSummary}
                  showComparisonLabel={showComparison}
                  large
                  icon={<Hash className="w-5 h-5" />}
                />
                <StatCard
                  label="Average Value"
                  value={formatCurrency(currentData.averageValue)}
                  trend={showComparison ? avgTrend : null}
                  summary={avgValueSummary}
                  showComparisonLabel={showComparison}
                  large
                  icon={<DollarSign className="w-5 h-5" />}
                />
              </div>

              {/* Visualizations */}
              <div className="grid grid-cols-2 gap-6">
                {/* Voucher Types */}
                <ChartCard
                  title="Voucher Types"
                  summary={`${currentData.voucherTypeBreakdown.map(v => `${v.type}: ${v.count} (${v.percentage.toFixed(0)}%)`).join(', ')}.`}
                >
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
                            label={(entry: any) => `${entry.type} (${entry.percentage.toFixed(0)}%)`}
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

                {/* Disruption Reasons */}
                <ChartCard
                  title="Top Disruption Reasons"
                  summary={currentData.disruptionReasons.length > 0
                    ? `Top reason: ${currentData.disruptionReasons[0].reason} (${currentData.disruptionReasons[0].count} vouchers, ${formatCurrency(currentData.disruptionReasons[0].value)}).`
                    : 'No disruption data available.'
                  }
                >
                  {currentData.disruptionReasons.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
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
                          formatter={(value: any, name: string, props: any) => {
                            if (name === 'count') {
                              return [`${value} vouchers (${formatCurrency(props.payload.value)})`, 'Count & Value'];
                            }
                            return [value, name];
                          }}
                        />
                        <Bar dataKey="count" fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                      No disruption data available
                    </p>
                  )}
                </ChartCard>
              </div>
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
  summary?: string;
  showComparisonLabel?: boolean;
  large?: boolean;
  icon?: React.ReactNode;
}

function StatCard({ label, value, trend, summary, showComparisonLabel = false, large = false, icon }: StatCardProps) {
  const hasPositiveTrend = trend !== null && trend > 0;
  const hasNegativeTrend = trend !== null && trend < 0;

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg p-5 border border-gray-200 dark:border-dark-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        {icon && (
          <div className="p-1.5 rounded-md bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-400">
            {icon}
          </div>
        )}
      </div>
      <p className={`font-bold text-gray-900 dark:text-white mb-2 ${large ? 'text-3xl' : 'text-2xl'}`}>
        {value}
      </p>
      {trend !== null && (
        <div className="flex items-center gap-1.5 mb-2">
          {hasPositiveTrend && <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />}
          {hasNegativeTrend && <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />}
          <span
            className={`text-sm font-semibold ${
              hasPositiveTrend
                ? 'text-green-600 dark:text-green-400'
                : hasNegativeTrend
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {formatPercentage(trend)}
            {showComparisonLabel && <span className="font-normal text-xs ml-1">vs previous period</span>}
          </span>
        </div>
      )}
      {summary && (
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          {summary}
        </p>
      )}
    </div>
  );
}

// Chart Card Component
interface ChartCardProps {
  title: string;
  summary?: string;
  children: React.ReactNode;
}

function ChartCard({ title, summary, children }: ChartCardProps) {
  return (
    <div className="bg-white dark:bg-dark-card rounded-lg p-5 border border-gray-200 dark:border-dark-border shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      {summary && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
          {summary}
        </p>
      )}
      {children}
    </div>
  );
}

// Helper function to get voucher type icon
function getVoucherIcon(type: string): React.ReactNode {
  switch (type) {
    case 'MEAL':
      return <Utensils className="w-4 h-4" />;
    case 'UBER':
      return <Car className="w-4 h-4" />;
    case 'CABCHARGE':
      return <CreditCard className="w-4 h-4" />;
    default:
      return <Hash className="w-4 h-4" />;
  }
}
