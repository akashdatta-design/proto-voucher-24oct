export type Role = 'CSA' | 'SUPERVISOR' | 'FINANCE' | 'ADMIN';

export interface Flight {
  id: string; // "QF401|2025-10-27|SYD-MEL"
  flightNumber: string;
  date: string; // YYYY-MM-DD
  origin: string;
  destination: string;
  depTime: string; // ISO
  arrTime: string; // ISO
  status: 'ON_TIME' | 'DELAYED' | 'CANCELLED';
  reason?: string;
  disruptionCategory?: 'DLY_2H' | 'DLY_4H' | 'CANCEL';
}

export interface Passenger {
  id: string;
  pnr: string;
  name: string;
  seat: string;
  boarded: boolean;
  cabin: 'Y' | 'J';
  qffTier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Platinum One';
  transiting?: boolean;
}

export type VoucherType = 'MEAL' | 'UBER' | 'CABCHARGE' | 'HOTEL';

export interface Issuance {
  id: string;
  batchId?: string | null;
  flightId: string;
  pnr: string;
  passengerName: string;
  seat?: string;
  voucherType: VoucherType;
  amount: number;
  currency: 'AUD';
  method: 'uber_digital' | 'meal_paper' | 'cabcharge_paper' | 'hotel_paper';
  externalId?: string;
  status: 'issued' | 'redeemed' | 'expired' | 'void';
  issuerId: string;
  issuerName: string;
  timestamp: string;
  notes?: string;
  photoUrl?: string; // for paper capture (optional)
  overrideReason?: string;
}

export interface Preset {
  voucherType: VoucherType;
  disruptionCategory: Flight['disruptionCategory'];
  defaultAmount: number;
}

export interface IssuanceIntent {
  id: string;
  payload: Issuance;
  createdAt: string;
  status: 'queued' | 'posting' | 'synced' | 'failed';
  error?: string;
}
