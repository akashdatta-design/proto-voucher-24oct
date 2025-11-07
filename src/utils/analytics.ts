import type { Issuance, Flight } from '../types';

export interface AnalyticsData {
  totalValue: number;
  totalCount: number;
  averageValue: number;
  voucherTypeBreakdown: { type: string; count: number; percentage: number; value: number }[];
  qffTierBreakdown: { tier: string; count: number; value: number }[];
  disruptionReasons: { reason: string; count: number }[];
  timeOfDayPatterns: { hour: number; count: number }[];
}

export interface DateRangePreset {
  label: string;
  days: number;
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { label: '24 Hours', days: 1 },
  { label: '3 Days', days: 3 },
  { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 },
  { label: 'Month', days: 30 },
  { label: 'Quarter', days: 90 },
  { label: 'Year', days: 365 },
];

/**
 * Calculate date range based on preset
 */
export function getDateRange(days: number): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return { startDate, endDate };
}

/**
 * Filter issuances by date range
 */
export function filterIssuancesByDateRange(
  issuances: Issuance[],
  startDate: Date,
  endDate: Date
): Issuance[] {
  return issuances.filter((issuance) => {
    const timestamp = new Date(issuance.timestamp);
    return timestamp >= startDate && timestamp <= endDate;
  });
}

/**
 * Filter issuances by flight
 */
export function filterIssuancesByFlight(
  issuances: Issuance[],
  flightId: string | null
): Issuance[] {
  if (!flightId || flightId === 'all') return issuances;
  return issuances.filter((issuance) => issuance.flightId === flightId);
}

/**
 * Calculate analytics data from issuances
 */
export function calculateAnalytics(issuances: Issuance[]): AnalyticsData {
  // Filter only issued vouchers
  const validIssuances = issuances.filter((i) => i.status === 'issued');

  // Total value and count
  const totalValue = validIssuances.reduce((sum, i) => sum + i.amount, 0);
  const totalCount = validIssuances.length;
  const averageValue = totalCount > 0 ? totalValue / totalCount : 0;

  // Voucher type breakdown
  const typeMap = new Map<string, { count: number; value: number }>();
  validIssuances.forEach((i) => {
    const existing = typeMap.get(i.voucherType) || { count: 0, value: 0 };
    typeMap.set(i.voucherType, {
      count: existing.count + 1,
      value: existing.value + i.amount,
    });
  });

  const voucherTypeBreakdown = Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      percentage: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
      value: data.value,
    }))
    .sort((a, b) => b.count - a.count);

  // QFF Tier breakdown (need to fetch passenger data separately)
  // For now, we'll use a placeholder - this will be populated by the component
  const qffTierBreakdown: { tier: string; count: number; value: number }[] = [];

  // Disruption reasons (extract from notes field)
  const reasonMap = new Map<string, number>();
  validIssuances.forEach((i) => {
    if (i.notes) {
      // Extract reason from notes - assuming format like "Disruption: Reason text"
      const match = i.notes.match(/Disruption:\s*([^;,]+)/i);
      const reason = match ? match[1].trim() : 'Other';
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    }
  });

  const disruptionReasons = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 reasons

  // Time of day patterns (group by hour)
  const hourMap = new Map<number, number>();
  validIssuances.forEach((i) => {
    const hour = new Date(i.timestamp).getHours();
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
  });

  const timeOfDayPatterns = Array.from(hourMap.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour);

  return {
    totalValue,
    totalCount,
    averageValue,
    voucherTypeBreakdown,
    qffTierBreakdown,
    disruptionReasons,
    timeOfDayPatterns,
  };
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return `A$${value.toFixed(2)}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}
