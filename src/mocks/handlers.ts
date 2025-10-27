import { http, HttpResponse } from 'msw';
import type { Issuance } from '../types';
import flightsData from './data/flights.json';
import passengersQF401 from './data/passengers_QF401_2025-10-27_SYD-MEL.json';
import passengersQF702 from './data/passengers_QF702_2025-10-27_MEL-BNE.json';
import passengersQF812 from './data/passengers_QF812_2025-10-27_SYD-CBR.json';
import presetsData from './data/presets.json';

// In-memory state
let offline = false;
let issuances: Issuance[] = [];

// Helper to generate UUID
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to check if offline
function checkOffline() {
  if (offline) {
    return HttpResponse.json({ error: 'Service unavailable (offline)' }, { status: 503 });
  }
  return null;
}

export const handlers = [
  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok', message: 'MSW is running' });
  }),

  // Offline state management
  http.get('/api/_offline_state', () => {
    return HttpResponse.json({ offline });
  }),

  http.post('/api/_toggle_offline', () => {
    offline = !offline;
    return HttpResponse.json({ offline });
  }),

  http.post('/api/_sync_now', () => {
    return HttpResponse.json({ ok: true });
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
        return HttpResponse.json(passengersQF401);
      } else if (id.startsWith('QF702')) {
        return HttpResponse.json(passengersQF702);
      } else if (id.startsWith('QF812')) {
        return HttpResponse.json(passengersQF812);
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
    const offlineCheck = checkOffline();
    if (offlineCheck) return offlineCheck;

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
    const offlineCheck = checkOffline();
    if (offlineCheck) return offlineCheck;

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
    const offlineCheck = checkOffline();
    if (offlineCheck) return offlineCheck;

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
    const offlineCheck = checkOffline();
    if (offlineCheck) return offlineCheck;

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
