import { http, HttpResponse } from 'msw';
import type { Issuance } from '../types';
import flightsData from './data/flights.json';
import passengersQF401 from './data/passengers_QF401_2025-10-27_SYD-MEL.json';
import passengersQF702 from './data/passengers_QF702_2025-10-27_MEL-BNE.json';
import passengersQF812 from './data/passengers_QF812_2025-10-27_SYD-CBR.json';
import presetsData from './data/presets.json';

// In-memory state
let issuances: Issuance[] = [];

// Helper to generate UUID
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper functions for QFF tier and transiting (deterministic based on index)
function pickTier(i: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Platinum One' {
  const r = (i * 37) % 100;
  if (r < 3) return 'Platinum One';
  if (r < 10) return 'Platinum';
  if (r < 30) return 'Gold';
  if (r < 60) return 'Silver';
  return 'Bronze';
}

function isTransiting(i: number): boolean {
  return ((i * 13) % 100) < 25;
}

function getSSRCodes(i: number): ('WHEELCHAIR' | 'SERVICE_DOG')[] | undefined {
  const codes: ('WHEELCHAIR' | 'SERVICE_DOG')[] = [];
  const r = (i * 47) % 100;
  if (r < 10) codes.push('WHEELCHAIR'); // 10% wheelchair
  if (r >= 10 && r < 15) codes.push('SERVICE_DOG'); // 5% service dog
  return codes.length > 0 ? codes : undefined;
}

function getTransitTimePeriod(i: number): string | undefined {
  const periods = ['2-4h', '4-8h', '8-12h'];
  return periods[(i * 7) % periods.length];
}

function generateContactEmail(name: string): string {
  const nameParts = name.toLowerCase().split(' ');
  return `${nameParts.join('.')}@email.com`;
}

function generateContactPhone(i: number): string {
  const baseNum = 400000000 + (i * 12345678) % 100000000;
  const formatted = baseNum.toString();
  return `+61 ${formatted.substring(0, 3)} ${formatted.substring(3, 6)} ${formatted.substring(6, 9)}`;
}

// Enhance passengers with qffTier, transiting, SSR codes, and contact details
function enhancePassengers(passengers: any[]) {
  return passengers.map((p, i) => {
    const transiting = isTransiting(i);
    return {
      ...p,
      qffTier: pickTier(i),
      transiting: transiting,
      ssrCodes: getSSRCodes(i),
      transitTimePeriod: transiting ? getTransitTimePeriod(i) : undefined,
      contactEmail: generateContactEmail(p.name),
      contactPhone: generateContactPhone(i),
    };
  });
}

export const handlers = [
  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok', message: 'MSW is running' });
  }),

  // Flights
  http.get('/api/flights', ({ request }) => {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');

    if (date) {
      const filtered = flightsData.filter((f) => f.date === date);
      return HttpResponse.json(filtered);
    }

    return HttpResponse.json(flightsData);
  }),

  http.get('/api/flights/:id', ({ params }) => {
    const { id } = params;
    const flight = flightsData.find((f) => f.id === id);

    if (!flight) {
      return HttpResponse.json({ error: 'Flight not found' }, { status: 404 });
    }

    return HttpResponse.json(flight);
  }),

  http.get('/api/flights/:id/passengers', ({ params }) => {
    const { id } = params;

    // Return passengers based on flight number
    if (typeof id === 'string') {
      if (id.startsWith('QF401')) {
        return HttpResponse.json(enhancePassengers(passengersQF401));
      } else if (id.startsWith('QF702')) {
        return HttpResponse.json(enhancePassengers(passengersQF702));
      } else if (id.startsWith('QF812')) {
        return HttpResponse.json(enhancePassengers(passengersQF812));
      }
    }

    return HttpResponse.json([]);
  }),

  // Presets
  http.get('/api/presets', () => {
    return HttpResponse.json(presetsData);
  }),

  // Issuances - GET
  http.get('/api/issuances', ({ request }) => {
    const url = new URL(request.url);
    const flightId = url.searchParams.get('flightId');

    if (flightId) {
      const filtered = issuances.filter((i) => i.flightId === flightId);
      return HttpResponse.json(filtered);
    }

    return HttpResponse.json(issuances);
  }),

  // Issuances - POST (create)
  http.post('/api/issuances', async ({ request }) => {
    const body = await request.json();
    const records = Array.isArray(body) ? body : [body];

    const created = records.map((rec: any) => ({
      ...rec,
      id: uuid(),
      status: 'issued',
      timestamp: new Date().toISOString(),
    }));

    // Prepend to issuances
    issuances = [...created, ...issuances];

    return HttpResponse.json(created, { status: 201 });
  }),

  // Issuances - Void
  http.post('/api/issuances/void/:id', async ({ params, request }) => {
    const { id } = params;
    const body = await request.json() as { overrideReason?: string };

    const issuance = issuances.find((i) => i.id === id);
    if (!issuance) {
      return HttpResponse.json({ error: 'Issuance not found' }, { status: 404 });
    }

    issuance.status = 'void';
    if (body.overrideReason) {
      issuance.overrideReason = body.overrideReason;
    }

    return HttpResponse.json(issuance);
  }),

  // Uber mock
  http.post('/api/uber/issue', async ({ request }) => {
    const body = await request.json() as { amount: number };

    // Failure rule: amount > 80 OR random 10%
    if (body.amount > 80 || Math.random() < 0.1) {
      return HttpResponse.json(
        { error: 'Uber API error (mock)' },
        { status: 502 }
      );
    }

    return HttpResponse.json({
      voucherId: uuid(),
      claimUrl: `https://uber.com/vouchers/${uuid()}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }),

  // 15below mock
  http.post('/api/15below/send', async () => {
    return HttpResponse.json({
      messageId: uuid(),
      status: 'SENT',
    });
  }),

  // CSV Export
  http.get('/api/exports', ({ request }) => {
    const url = new URL(request.url);
    const flightId = url.searchParams.get('flightId');

    let data = issuances;
    if (flightId) {
      data = issuances.filter((i) => i.flightId === flightId);
    }

    // CSV header
    const header = 'issuance_id,flight,date,pnr,passenger_name,seat,voucher_type,amount,method,external_id,issuer,timestamp,notes,status';

    // CSV rows
    const rows = data.map((i) => {
      const flight = flightsData.find((f) => f.id === i.flightId);
      const flightNumber = flight?.flightNumber || '';
      const date = flight?.date || '';

      return [
        i.id,
        flightNumber,
        date,
        i.pnr,
        i.passengerName,
        i.seat || '',
        i.voucherType,
        i.amount,
        i.method,
        i.externalId || '',
        i.issuerName,
        i.timestamp,
        i.notes || '',
        i.status,
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');

    return new HttpResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="vouchers-export-${Date.now()}.csv"`,
      },
    });
  }),
];
