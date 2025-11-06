import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelectionStore } from '../store/selection';
import { useAuthStore } from '../store/auth';
import { useToast } from '../store/useToast';
import { fetchIssuancesByFlight, createIssuances } from '../api/vouchers';
import { issueUberVoucher } from '../api/uber';
import { CONFIG } from '../config';
import type { VoucherType, Issuance, Preset, Passenger } from '../types';
import { Utensils, Car, Receipt, ChevronDown, Info, Check, Accessibility, Dog, X } from 'lucide-react';

interface PendingVoucher {
  id: string;
  type: VoucherType;
  passengerId: string; // NEW: Each voucher is for a specific passenger
  amount: number;
  reason?: string;
  sendComms?: boolean;
  mode?: 'quick' | 'manual';
  startSerial?: string;
  serialNumber?: string; // Individual serial for this voucher
  photoDataUrl?: string | null;
  uberVehicleType?: 'UberX' | 'Comfort' | 'Black' | 'XL';
  uberDestination?: 'home' | 'hotel';
  uberPaxCount?: number;
  mealTier?: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  additionalComments?: string[];
}

// Voucher-specific reasons for issuance
const VOUCHER_REASONS: Record<VoucherType, string[]> = {
  MEAL: [
    "Flight delay compensation",
    "Flight cancellation",
    "Missed meal service"
  ],
  UBER: [
    "Missed connection",
    "Flight cancellation",
    "Accommodation transport"
  ],
  CABCHARGE: [
    "Ground transportation delay",
    "Flight cancellation",
    "Airport access assistance"
  ]
};

// Calculate Uber price based on destination, vehicle type, and passenger count
function calculateUberPrice(
  destination: 'home' | 'hotel',
  vehicleType: 'UberX' | 'Comfort' | 'Black' | 'XL',
  paxCount: number
): number {
  const basePrice: Record<string, number> = {
    'UberX': 50,
    'Comfort': 70,
    'Black': 100,
    'XL': 80
  };

  const base = basePrice[vehicleType] || 50;
  const destinationModifier = destination === 'hotel' ? 0.8 : 1.0; // Hotel 20% closer
  const paxModifier = 1 + ((paxCount - 1) * 0.15); // Each additional pax adds 15%

  return Math.round(base * destinationModifier * paxModifier);
}

export default function IssueWizard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { flight, passengers, selectedIds, clear, toggle } = useSelectionStore();
  const { show: showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pendingVouchers, setPendingVouchers] = useState<PendingVoucher[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [existingIssuances, setExistingIssuances] = useState<Issuance[]>([]);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [passengerNotes, setPassengerNotes] = useState<Record<string, Record<string, string>>>({});
  const [expandedPassengers, setExpandedPassengers] = useState<Record<string, boolean>>({});
  const [activePassengerId, setActivePassengerId] = useState<string | null>(null);
  const [editableContacts, setEditableContacts] = useState<Record<string, { email: string; phone: string }>>({});

  const selectedPassengers = passengers.filter((p) => selectedIds.has(p.id));

  // Initialize editable contacts
  useEffect(() => {
    const contacts: Record<string, { email: string; phone: string }> = {};
    selectedPassengers.forEach((pax) => {
      contacts[pax.id] = {
        email: pax.contactEmail || '',
        phone: pax.contactPhone || '',
      };
    });
    setEditableContacts(contacts);
  }, [selectedPassengers.map(p => p.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Only check on initial mount, not when selection changes during submission
    if (!flight || selectedPassengers.length === 0) {
      navigate('/dashboard');
      return;
    }

    // Load presets
    fetch('/api/presets')
      .then((res) => res.json())
      .then(setPresets);

    // Load existing issuances
    if (flight) {
      fetchIssuancesByFlight(flight.id).then(setExistingIssuances);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  const getDefaultAmount = (type: VoucherType): number => {
    if (!flight?.disruptionCategory) {
      return type === 'UBER' ? 50 : type === 'MEAL' ? 30 : 50;
    }

    const preset = presets.find(
      (p) => p.voucherType === type && p.disruptionCategory === flight.disruptionCategory
    );
    return preset?.defaultAmount || (type === 'UBER' ? 50 : type === 'MEAL' ? 30 : 50);
  };

  const addVoucher = (type: VoucherType) => {
    // Create one voucher per selected passenger
    const newVouchers: PendingVoucher[] = selectedPassengers.map((pax) => ({
      id: crypto.randomUUID(),
      type,
      passengerId: pax.id,
      amount: getDefaultAmount(type),
      reason: '',
      sendComms: type === 'UBER' ? true : undefined,
      mode: type !== 'UBER' ? 'quick' : undefined,
      startSerial: type === 'MEAL' ? 'M1000' : type === 'CABCHARGE' ? 'C2000' : undefined,
      photoDataUrl: null,
      uberVehicleType: type === 'UBER' ? 'UberX' : undefined,
      uberDestination: type === 'UBER' ? 'home' : undefined,
      uberPaxCount: type === 'UBER' ? 1 : undefined,
      mealTier: type === 'MEAL' ? 'Lunch' : undefined,
      additionalComments: [],
    }));
    setPendingVouchers([...pendingVouchers, ...newVouchers]);
  };

  const updateVoucher = (id: string, updates: Partial<PendingVoucher>) => {
    setPendingVouchers(
      pendingVouchers.map((v) => (v.id === id ? { ...v, ...updates } : v))
    );
  };

  const handlePhotoCapture = (voucherId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      updateVoucher(voucherId, { photoDataUrl: e.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  // Duplicate detection
  const getDuplicates = () => {
    const duplicates: { passenger: Passenger; voucherType: VoucherType }[] = [];

    selectedPassengers.forEach((pax) => {
      pendingVouchers.forEach((voucher) => {
        const existing = existingIssuances.find(
          (iss) =>
            iss.pnr === pax.pnr &&
            iss.flightId === flight?.id &&
            iss.voucherType === voucher.type &&
            iss.status !== 'void'
        );
        if (existing) {
          duplicates.push({ passenger: pax, voucherType: voucher.type });
        }
      });
    });

    return duplicates;
  };

  const duplicates = getDuplicates();
  const hasDuplicates = duplicates.length > 0;
  const canOverride = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';
  const isBlocked = CONFIG.SHOW_DUPLICATE_GUARD && hasDuplicates && !canOverride;
  const needsOverrideReason = CONFIG.SHOW_DUPLICATE_GUARD && hasDuplicates && canOverride && !overrideReason.trim();

  const totalRows = selectedPassengers.length * pendingVouchers.length;

  const handleSubmit = async () => {
    if (isBlocked || needsOverrideReason) return;

    setSubmitting(true);
    setErrors([]);

    const batchId = crypto.randomUUID();
    const rows: Partial<Issuance>[] = [];
    const uberErrors: string[] = [];
    const commsFailures: string[] = [];

    try {
      // Each voucher is now tied to a specific passenger
      for (const voucher of pendingVouchers) {
        const pax = selectedPassengers.find((p) => p.id === voucher.passengerId);
        if (!pax) continue; // Skip if passenger not found

        let externalId: string | undefined;
        let notes = '';

        // Handle serial number
        if (voucher.serialNumber) {
          notes = `serial:${voucher.serialNumber}`;
        }

        // Append per-passenger notes for this specific voucher
        const paxNote = passengerNotes[voucher.id]?.[pax.id];
        if (paxNote?.trim()) {
          notes += notes ? `, note: ${paxNote.trim()}` : `note: ${paxNote.trim()}`;
        }

        // Append reason
        if (voucher.reason) {
          notes += notes ? `, reason: ${voucher.reason}` : `reason: ${voucher.reason}`;
        }

        // Call Uber API for digital vouchers
        if (voucher.type === 'UBER') {
          try {
            const uberRes = await issueUberVoucher(pax.pnr, pax.name, voucher.amount);
            externalId = uberRes.voucherId;
          } catch (e: any) {
            uberErrors.push(`${pax.name}: ${e.message}`);
          }
        }

        const isDuplicate = duplicates.some(
          (d) => d.passenger.id === pax.id && d.voucherType === voucher.type
        );

        rows.push({
          batchId,
          flightId: flight!.id,
          pnr: pax.pnr,
          passengerName: pax.name,
          seat: pax.seat,
          voucherType: voucher.type,
          amount: voucher.amount,
          currency: 'AUD',
          method:
            voucher.type === 'UBER'
              ? 'uber_digital'
              : voucher.type === 'MEAL'
              ? 'meal_paper'
              : 'cabcharge_paper',
          externalId,
          issuerId: user?.name || 'unknown',
          issuerName: user?.name || 'Unknown User',
          notes,
          photoUrl: voucher.photoDataUrl || undefined,
          overrideReason: isDuplicate && canOverride ? overrideReason : undefined,
        });
      }

      await createIssuances(rows as Issuance[]);

      // Send comms for UBER vouchers if toggle is on (non-blocking)
      if (CONFIG.SEND_COMMS_15BELOW) {
        for (const voucher of pendingVouchers) {
          if (voucher.type === 'UBER' && voucher.sendComms) {
            const pax = selectedPassengers.find((p) => p.id === voucher.passengerId);
            if (pax) {
              try {
                await fetch('/api/15below/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    pnr: pax.pnr,
                    passengerName: pax.name,
                    message: `Your Uber voucher for $${voucher.amount} is ready`,
                  }),
                });
              } catch (e: any) {
                commsFailures.push(pax.name);
              }
            }
          }
        }
      }

      // Success - show toasts and navigate back
      const flightId = flight!.id;

      if (uberErrors.length > 0) {
        showToast(`Some Uber vouchers failed to generate IDs (mock): ${uberErrors.length} failed`, 'warning');
      }

      if (commsFailures.length > 0) {
        showToast(`Comms failed for ${commsFailures.length} passenger(s) (mock)`, 'warning');
      }

      showToast(`Issued ${rows.length} voucher(s).`, 'success');

      // Navigate and clear
      navigate(`/flight/${flightId}`);
      clear();

      // Reset local state
      setStep(1);
      setPendingVouchers([]);
      setPassengerNotes({});
      setOverrideReason('');
    } catch (e: any) {
      showToast('Something went wrong. Please try again.', 'error');
      setErrors([e.message]);
      setSubmitting(false);
    }
  };

  if (!flight || selectedPassengers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-wide">Issue Voucher</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {flight.flightNumber} • {selectedPassengers.length} passenger(s) selected
        </p>
      </div>

      {/* Progress indicator */}
      <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-4">
        <div className="flex items-center justify-between">
          <div className={`flex-1 text-center ${step >= 1 ? 'text-primary font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
            1) Pick voucher type
          </div>
          <div className="w-12 h-0.5 bg-gray-300 dark:bg-dark-border"></div>
          <div className={`flex-1 text-center ${step >= 2 ? 'text-primary font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
            2) Voucher details
          </div>
          <div className="w-12 h-0.5 bg-gray-300 dark:bg-dark-border"></div>
          <div className={`flex-1 text-center ${step >= 3 ? 'text-primary font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
            3) Confirm & issue
          </div>
        </div>
      </div>

      {/* Stage 1: Pick voucher type */}
      {step === 1 && (
        <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-8 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Select voucher type(s)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                onClick={() => addVoucher('MEAL')}
                className="p-8 border-2 border-gray-300 dark:border-dark-border rounded-lg hover:border-blue-500 dark:hover:border-primary hover:bg-blue-50 dark:hover:bg-primary/20 transition dark:text-white flex flex-col items-center text-center gap-4"
              >
                <Utensils className="w-16 h-16 text-blue-500 dark:text-primary" />
                <div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">MEAL</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Food & beverage voucher</div>
                </div>
              </button>
              <button
                onClick={() => addVoucher('UBER')}
                className="p-8 border-2 border-gray-300 dark:border-dark-border rounded-lg hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition dark:text-white flex flex-col items-center text-center gap-4"
              >
                <Car className="w-16 h-16 text-purple-500 dark:text-purple-400" />
                <div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">UBER</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Digital ride credit</div>
                </div>
              </button>
              <button
                onClick={() => addVoucher('CABCHARGE')}
                className="p-8 border-2 border-gray-300 dark:border-dark-border rounded-lg hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition dark:text-white flex flex-col items-center text-center gap-4"
              >
                <Receipt className="w-16 h-16 text-green-500 dark:text-green-400" />
                <div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">CABCHARGE</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Taxi voucher</div>
                </div>
              </button>
            </div>
          </div>

          {/* Current batch */}
          {pendingVouchers.length > 0 && (
            <div className="border-t border-gray-200 dark:border-dark-border pt-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Current batch</h3>
              <div className="space-y-2">
                {(['MEAL', 'UBER', 'CABCHARGE'] as VoucherType[]).map((type) => {
                  const vouchersOfType = pendingVouchers.filter((v) => v.type === type);
                  if (vouchersOfType.length === 0) return null;

                  return (
                    <div key={type} className="flex items-center justify-between bg-gray-50 dark:bg-dark-hover p-4 rounded">
                      <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                        {type === 'MEAL' && <Utensils className="w-5 h-5 text-blue-500" />}
                        {type === 'UBER' && <Car className="w-5 h-5 text-purple-500" />}
                        {type === 'CABCHARGE' && <Receipt className="w-5 h-5 text-green-500" />}
                        <span className="font-medium">{type}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">× {vouchersOfType.length} passenger{vouchersOfType.length !== 1 ? 's' : ''}</span>
                      </div>
                      <button
                        onClick={() => {
                          // Remove all vouchers of this type
                          const idsToRemove = vouchersOfType.map((v) => v.id);
                          setPendingVouchers(pendingVouchers.filter((v) => !idsToRemove.includes(v.id)));
                        }}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium"
                      >
                        Remove All
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover dark:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={pendingVouchers.length === 0}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: Configure details - PASSENGER-CENTRIC */}
      {step === 2 && (
        <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-6 space-y-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Configure voucher details</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Configure vouchers for each passenger individually</p>

          {/* Sidebar + Main Content Layout */}
          <div className="flex gap-6">
            {/* Left Sidebar Navigation */}
            <div className="hidden md:block w-64 flex-shrink-0">
              <div className="sticky top-6 space-y-2 max-h-[calc(100vh-8rem)] overflow-y-auto">
                {selectedPassengers.map((pax) => {
                  const paxVouchers = pendingVouchers.filter((v) => v.passengerId === pax.id);
                  if (paxVouchers.length === 0) return null;

                  const isActive = activePassengerId === pax.id;

                  return (
                    <div
                      key={pax.id}
                      className={`relative group rounded-lg border transition-colors ${
                        isActive
                          ? 'bg-primary/10 border-primary dark:bg-primary/20 dark:border-primary'
                          : 'bg-white dark:bg-dark-bg border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover'
                      }`}
                    >
                      <button
                        onClick={() => {
                          const element = document.getElementById(`passenger-${pax.id}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            setActivePassengerId(pax.id);
                          }
                        }}
                        className="w-full text-left p-3"
                      >
                        <div className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                          {pax.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {pax.pnr} • {pax.seat}
                          {pax.qffTier && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                              {pax.qffTier}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {paxVouchers.map((v) => (
                            <div
                              key={v.id}
                              className={`flex items-center justify-center w-6 h-6 rounded ${
                                v.type === 'MEAL'
                                  ? 'bg-blue-100 dark:bg-blue-900/30'
                                  : v.type === 'UBER'
                                  ? 'bg-purple-100 dark:bg-purple-900/30'
                                  : 'bg-green-100 dark:bg-green-900/30'
                              }`}
                            >
                              {v.type === 'MEAL' && <Utensils className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                              {v.type === 'UBER' && <Car className="w-3 h-3 text-purple-600 dark:text-purple-400" />}
                              {v.type === 'CABCHARGE' && <Receipt className="w-3 h-3 text-green-600 dark:text-green-400" />}
                            </div>
                          ))}
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Remove passenger from selection
                          toggle(pax.id);
                          // Remove all vouchers for this passenger
                          setPendingVouchers(pendingVouchers.filter((v) => v.passengerId !== pax.id));
                        }}
                        className="absolute top-2 right-2 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove passenger"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 space-y-6">
              {selectedPassengers.map((pax) => {
                const paxVouchers = pendingVouchers.filter((v) => v.passengerId === pax.id);
                if (paxVouchers.length === 0) return null;

                const isExpanded = expandedPassengers[pax.id] !== false; // Default to expanded

                return (
                  <div
                    key={pax.id}
                    id={`passenger-${pax.id}`}
                    className="border border-gray-200 dark:border-dark-border rounded-lg bg-gray-50 dark:bg-dark-bg scroll-mt-6"
                  >
                    {/* Passenger Header - Clickable to expand/collapse */}
                    <button
                      onClick={() => {
                        setExpandedPassengers((prev) => ({
                          ...prev,
                          [pax.id]: !isExpanded,
                        }));
                      }}
                      className="w-full flex items-center gap-3 p-6 pb-4 border-b border-gray-200 dark:border-dark-border hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-xl text-gray-900 dark:text-white">{pax.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {pax.pnr} • {pax.seat}
                          {pax.qffTier && (
                            <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
                              {pax.qffTier}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {!isExpanded && (
                          <div className="flex items-center gap-1">
                            {paxVouchers.map((v) => (
                              <div
                                key={v.id}
                                className={`flex items-center justify-center w-7 h-7 rounded ${
                                  v.type === 'MEAL'
                                    ? 'bg-blue-100 dark:bg-blue-900/30'
                                    : v.type === 'UBER'
                                    ? 'bg-purple-100 dark:bg-purple-900/30'
                                    : 'bg-green-100 dark:bg-green-900/30'
                                }`}
                              >
                                {v.type === 'MEAL' && <Utensils className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                                {v.type === 'UBER' && <Car className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                                {v.type === 'CABCHARGE' && <Receipt className="w-4 h-4 text-green-600 dark:text-green-400" />}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {paxVouchers.length} voucher{paxVouchers.length !== 1 ? 's' : ''}
                        </div>
                        <ChevronDown
                          className={`w-5 h-5 text-gray-400 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </button>

                    {/* Vouchers for this passenger - only show when expanded */}
                    {isExpanded && (
                      <div className="p-6 space-y-6">
                        {paxVouchers.map((voucher) => (
                          <div key={voucher.id} className="border border-gray-200 dark:border-dark-border rounded-lg p-6 space-y-6 bg-white dark:bg-dark-card">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-dark-border">
                      {voucher.type === 'MEAL' && <Utensils className="w-6 h-6 text-blue-500" />}
                      {voucher.type === 'UBER' && <Car className="w-6 h-6 text-purple-500" />}
                      {voucher.type === 'CABCHARGE' && <Receipt className="w-6 h-6 text-green-500" />}
                      <h3 className="font-semibold text-xl text-gray-900 dark:text-white">{voucher.type}</h3>
                    </div>

                    {/* Reason for issuance */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Info className="w-4 h-4" />
                        <span>Reason for issuance</span>
                      </label>
                      <select
                        value={voucher.reason || ''}
                        onChange={(e) => updateVoucher(voucher.id, { reason: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white text-sm"
                      >
                        <option value="">Select reason...</option>
                        {VOUCHER_REASONS[voucher.type].map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* MEAL: Tier selection */}
                    {voucher.type === 'MEAL' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Meal Tier <span className="text-gray-500 dark:text-gray-400">(optional)</span></label>
                        <div className="grid grid-cols-4 gap-2">
                          {(['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const).map((tier) => (
                            <button
                              key={tier}
                              type="button"
                              onClick={() => updateVoucher(voucher.id, { mealTier: tier })}
                              className={`px-3 py-2 text-sm rounded border transition ${
                                voucher.mealTier === tier
                                  ? 'bg-blue-500 text-white border-blue-500'
                                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                              }`}
                            >
                              {tier}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* UBER: Destination → Vehicle → Pax → Calculated Price */}
                    {voucher.type === 'UBER' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Destination</label>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                const newDestination = 'home';
                                const calculated = calculateUberPrice(
                                  newDestination,
                                  voucher.uberVehicleType || 'UberX',
                                  voucher.uberPaxCount || 1
                                );
                                updateVoucher(voucher.id, { uberDestination: newDestination, amount: calculated });
                              }}
                              className={`flex-1 px-4 py-3 rounded border transition ${
                                (voucher.uberDestination || 'home') === 'home'
                                  ? 'bg-purple-500 text-white border-purple-500'
                                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400'
                              }`}
                            >
                              Home
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newDestination = 'hotel';
                                const calculated = calculateUberPrice(
                                  newDestination,
                                  voucher.uberVehicleType || 'UberX',
                                  voucher.uberPaxCount || 1
                                );
                                updateVoucher(voucher.id, { uberDestination: newDestination, amount: calculated });
                              }}
                              className={`flex-1 px-4 py-3 rounded border transition ${
                                voucher.uberDestination === 'hotel'
                                  ? 'bg-purple-500 text-white border-purple-500'
                                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400'
                              }`}
                            >
                              Hotel (closer)
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. Vehicle Type</label>
                          <select
                            value={voucher.uberVehicleType || 'UberX'}
                            onChange={(e) => {
                              const newVehicle = e.target.value as 'UberX' | 'Comfort' | 'Black' | 'XL';
                              const calculated = calculateUberPrice(
                                voucher.uberDestination || 'home',
                                newVehicle,
                                voucher.uberPaxCount || 1
                              );
                              updateVoucher(voucher.id, { uberVehicleType: newVehicle, amount: calculated });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white"
                          >
                            <option value="UberX">UberX (Standard, 1-4 passengers)</option>
                            <option value="Comfort">Comfort (Premium, 1-4 passengers)</option>
                            <option value="Black">Black (Luxury, 1-3 passengers)</option>
                            <option value="XL">XL (Large groups, 1-6 passengers)</option>
                          </select>
                          {pax.qffTier && ['Platinum One', 'Platinum'].includes(pax.qffTier) && (
                            <p className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400 mt-1">
                              <Info className="w-3 h-3" />
                              High-tier frequent flyer - consider Comfort or Black
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">3. Passengers per ride</label>
                          <div className="flex gap-2">
                            {Array.from({ length: voucher.uberVehicleType === 'XL' ? 6 : voucher.uberVehicleType === 'Black' ? 3 : 4 }, (_, i) => i + 1).map((count) => (
                              <button
                                key={count}
                                type="button"
                                onClick={() => {
                                  const calculated = calculateUberPrice(
                                    voucher.uberDestination || 'home',
                                    voucher.uberVehicleType || 'UberX',
                                    count
                                  );
                                  updateVoucher(voucher.id, { uberPaxCount: count, amount: calculated });
                                }}
                                className={`px-4 py-2 rounded border transition ${
                                  (voucher.uberPaxCount || 1) === count
                                    ? 'bg-purple-500 text-white border-purple-500'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400'
                                }`}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            This Uber voucher will be shared by {voucher.uberPaxCount || 1} passenger(s)
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">4. Amount (editable)</label>
                          <input
                            type="number"
                            min={10}
                            max={200}
                            step={5}
                            value={voucher.amount}
                            onChange={(e) => updateVoucher(voucher.id, { amount: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white text-lg font-semibold"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Calculated: Base{' '}
                            {voucher.uberVehicleType === 'UberX' ? '$50' : voucher.uberVehicleType === 'Comfort' ? '$70' : voucher.uberVehicleType === 'Black' ? '$100' : '$80'}
                            {' × '}{(voucher.uberDestination || 'home') === 'hotel' ? '0.8 (hotel)' : '1.0 (home)'}
                            {' × '}{1 + ((voucher.uberPaxCount || 1) - 1) * 0.15} ({voucher.uberPaxCount || 1} pax)
                            {' = $'}{calculateUberPrice(voucher.uberDestination || 'home', voucher.uberVehicleType || 'UberX', voucher.uberPaxCount || 1)}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Amount - Dropdown for MEAL and CABCHARGE only */}
                    {voucher.type !== 'UBER' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (AUD)</label>
                        <select
                          value={voucher.amount}
                          onChange={(e) => updateVoucher(voucher.id, { amount: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white"
                        >
                          {voucher.type === 'MEAL' && (
                            <>
                              <option value={15}>$15</option>
                              <option value={30}>$30</option>
                              <option value={45}>$45</option>
                              <option value={60}>$60</option>
                            </>
                          )}
                          {voucher.type === 'CABCHARGE' && (
                            <>
                              <option value={30}>$30</option>
                              <option value={50}>$50</option>
                              <option value={70}>$70</option>
                            </>
                          )}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Values can be customized per port in Admin settings
                        </p>
                      </div>
                    )}

                    {/* UBER: Send comms */}
                    {voucher.type === 'UBER' && CONFIG.SEND_COMMS_15BELOW && (
                      <div>
                        <label className="flex items-center gap-2 text-gray-900 dark:text-white">
                          <input
                            type="checkbox"
                            checked={voucher.sendComms}
                            onChange={(e) => updateVoucher(voucher.id, { sendComms: e.target.checked })}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <span className="text-sm font-medium">Send comms (15below) <span className="text-gray-500 dark:text-gray-400">(optional)</span></span>
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Comms are mocked in this prototype</p>
                      </div>
                    )}

                    {/* MEAL/CABCHARGE: Serial number */}
                    {voucher.type !== 'UBER' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Serial Number <span className="text-gray-500 dark:text-gray-400">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={voucher.serialNumber || ''}
                            onChange={(e) => updateVoucher(voucher.id, { serialNumber: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white font-mono"
                            placeholder={voucher.type === 'MEAL' ? 'M1000' : 'C2000'}
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Enter the serial number for this voucher
                          </p>
                        </div>

                        {/* Photo capture */}
                        {CONFIG.PHOTO_CAPTURE && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Photo <span className="text-gray-500 dark:text-gray-400">(optional)</span></label>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePhotoCapture(voucher.id, file);
                              }}
                              className="text-sm"
                            />
                            {voucher.photoDataUrl && (
                              <div className="mt-2">
                                <img src={voucher.photoDataUrl} alt="Captured" className="w-32 h-32 object-cover rounded" />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Additional notes */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Additional Notes <span className="text-gray-500 dark:text-gray-400">(optional)</span>
                          </label>
                          <textarea
                            value={passengerNotes[voucher.id]?.[pax.id] || ''}
                            onChange={(e) => setPassengerNotes({
                              ...passengerNotes,
                              [voucher.id]: {
                                ...(passengerNotes[voucher.id] || {}),
                                [pax.id]: e.target.value,
                              }
                            })}
                            placeholder="Any additional notes for this voucher..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white text-sm"
                            rows={2}
                          />
                        </div>
                      </>
                    )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-primary/20 border border-blue-200 dark:border-primary/40 rounded p-3 text-sm text-blue-800 dark:text-primary">
            This will create <span className="font-semibold">{totalRows} issuance record(s)</span>.
          </div>

          {/* Sticky Navigation Bar */}
          <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-dark-card border-t border-gray-200 dark:border-dark-border p-4 -mx-6 -mb-6 mt-6 rounded-b-lg">
            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover dark:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 3: Confirm & issue */}
      {step === 3 && (
        <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-6 space-y-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Confirm & issue</h2>

          {/* Executive Summary */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="font-semibold text-xl text-gray-900 dark:text-white mb-4">
              Issuance Summary
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Passengers</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {selectedPassengers.length}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Vouchers</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {pendingVouchers.length}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Value</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  ${pendingVouchers.reduce((sum, v) => sum + v.amount, 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Passenger Review */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Passenger Details</h3>
            {selectedPassengers.map((pax) => {
              const paxVouchers = pendingVouchers.filter((v) => v.passengerId === pax.id);
              return (
                <div key={pax.id} className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
                  <button
                    onClick={() =>
                      setExpandedPassengers({
                        ...expandedPassengers,
                        [pax.id]: !expandedPassengers[pax.id],
                      })
                    }
                    className="w-full p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <ChevronDown
                        className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${
                          expandedPassengers[pax.id] ? 'rotate-180' : ''
                        }`}
                      />
                      <div className="text-left flex-1">
                        <div className="font-semibold text-gray-900 dark:text-white">{pax.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{pax.pnr}</div>
                        {!expandedPassengers[pax.id] && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                            <div>{editableContacts[pax.id]?.email || pax.contactEmail || 'No email'}</div>
                            <div>{editableContacts[pax.id]?.phone || pax.contactPhone || 'No phone'}</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {paxVouchers.length} voucher{paxVouchers.length !== 1 ? 's' : ''}
                    </div>
                  </button>

                  {expandedPassengers[pax.id] && (
                    <div className="p-6 space-y-6 bg-white dark:bg-gray-900">
                      {/* Passenger Details Grid */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Passenger Information</h4>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">PNR:</span>{' '}
                            <span className="text-gray-900 dark:text-white font-medium">{pax.pnr}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Seat:</span>{' '}
                            <span className="text-gray-900 dark:text-white font-medium">{pax.seat}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">QFF Tier:</span>{' '}
                            <span className="text-gray-900 dark:text-white font-medium">{pax.qffTier || 'None'}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Cabin:</span>{' '}
                            <span className="text-gray-900 dark:text-white font-medium">{pax.cabin}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Boarded:</span>{' '}
                            <span className="text-gray-900 dark:text-white font-medium">{pax.boarded ? 'Yes' : 'No'}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Transit:</span>{' '}
                            <span className="text-gray-900 dark:text-white font-medium">
                              {pax.transiting ? pax.transitTimePeriod || 'Yes' : 'No'}
                            </span>
                          </div>
                          {pax.ssrCodes && pax.ssrCodes.length > 0 && (
                            <div className="col-span-2 flex items-center gap-2">
                              <span className="text-gray-600 dark:text-gray-400">SSR:</span>
                              {pax.ssrCodes.includes('WHEELCHAIR') && (
                                <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs">
                                  <Accessibility className="w-3 h-3" />
                                  <span>Wheelchair</span>
                                </div>
                              )}
                              {pax.ssrCodes.includes('SERVICE_DOG') && (
                                <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs">
                                  <Dog className="w-3 h-3" />
                                  <span>Service Dog</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Contact Details - Editable */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Contact Details</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Email</label>
                            <input
                              type="email"
                              value={editableContacts[pax.id]?.email || ''}
                              onChange={(e) =>
                                setEditableContacts({
                                  ...editableContacts,
                                  [pax.id]: { ...editableContacts[pax.id], email: e.target.value },
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white text-sm"
                              placeholder="email@example.com"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                            <input
                              type="tel"
                              value={editableContacts[pax.id]?.phone || ''}
                              onChange={(e) =>
                                setEditableContacts({
                                  ...editableContacts,
                                  [pax.id]: { ...editableContacts[pax.id], phone: e.target.value },
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white text-sm"
                              placeholder="+61 xxx xxx xxx"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Allocated Vouchers */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Allocated Vouchers</h4>
                        <div className="space-y-3">
                          {paxVouchers.map((voucher) => (
                            <div key={voucher.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center gap-2 mb-2">
                                {voucher.type === 'MEAL' && <Utensils className="w-4 h-4 text-blue-500" />}
                                {voucher.type === 'UBER' && <Car className="w-4 h-4 text-purple-500" />}
                                {voucher.type === 'CABCHARGE' && <Receipt className="w-4 h-4 text-green-500" />}
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {voucher.type} - ${voucher.amount}
                                </span>
                              </div>

                              <div className="text-sm space-y-1">
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Reason:</span>{' '}
                                  <span className="text-gray-900 dark:text-white">
                                    {voucher.reason || 'Not specified'}
                                  </span>
                                </div>

                                {voucher.type === 'MEAL' && (
                                  <>
                                    {voucher.mealTier && (
                                      <div>
                                        <span className="text-gray-600 dark:text-gray-400">Tier:</span>{' '}
                                        <span className="text-gray-900 dark:text-white">{voucher.mealTier}</span>
                                      </div>
                                    )}
                                    {voucher.serialNumber && (
                                      <div>
                                        <span className="text-gray-600 dark:text-gray-400">Serial:</span>{' '}
                                        <span className="text-gray-900 dark:text-white font-mono">{voucher.serialNumber}</span>
                                      </div>
                                    )}
                                  </>
                                )}

                                {voucher.type === 'CABCHARGE' && voucher.serialNumber && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Serial:</span>{' '}
                                    <span className="text-gray-900 dark:text-white font-mono">{voucher.serialNumber}</span>
                                  </div>
                                )}

                                {voucher.type === 'UBER' && (
                                  <>
                                    <div>
                                      <span className="text-gray-600 dark:text-gray-400">Vehicle:</span>{' '}
                                      <span className="text-gray-900 dark:text-white">{voucher.uberVehicleType || 'UberX'}</span>
                                      {' to '}
                                      <span className="text-gray-900 dark:text-white capitalize">{voucher.uberDestination || 'home'}</span>
                                      {' ('}
                                      <span className="text-gray-900 dark:text-white">{voucher.uberPaxCount || 1} pax</span>
                                      {')'}
                                    </div>
                                    {pax.qffTier && ['Platinum One', 'Platinum'].includes(pax.qffTier) && voucher.uberVehicleType && ['Black', 'Comfort'].includes(voucher.uberVehicleType) && (
                                      <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-1">
                                        <Info className="w-3 h-3" />
                                        <span>Premium vehicle allocated for high-tier FF</span>
                                      </div>
                                    )}
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                                      <Check className="w-3 h-3" />
                                      <span>QR Code will be available after issuance for scanning</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-dark-border rounded p-3 text-sm text-gray-900 dark:text-white">
            Total: <span className="font-semibold">{totalRows} issuance record(s)</span>
          </div>

          {/* Duplicate warning */}
          {CONFIG.SHOW_DUPLICATE_GUARD && hasDuplicates && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
              <div className="font-semibold text-yellow-900 dark:text-yellow-400 mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                <span>{duplicates.length} passenger(s) already have vouchers</span>
              </div>
              <ul className="text-sm text-yellow-800 dark:text-yellow-400 space-y-1">
                {duplicates.slice(0, 5).map((d, i) => (
                  <li key={i}>
                    {d.passenger.name} already has a {d.voucherType} voucher
                  </li>
                ))}
                {duplicates.length > 5 && <li>...and {duplicates.length - 5} more</li>}
              </ul>

              {!canOverride && (
                <div className="mt-3 text-sm text-red-700 dark:text-red-400 font-medium">
                  Only a SUPERVISOR can override duplicate issuance.
                </div>
              )}

              {canOverride && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Override reason (required)
                  </label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                    rows={2}
                    placeholder="Explain why this override is necessary..."
                  />
                </div>
              )}
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4">
              <div className="font-semibold text-red-900 dark:text-red-400 mb-2">Errors</div>
              {errors.map((err, i) => (
                <div key={i} className="text-sm text-red-800 dark:text-red-400">
                  {err}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover disabled:opacity-50 dark:text-white transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isBlocked || needsOverrideReason || submitting}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-700 font-medium transition-colors"
            >
              {submitting ? 'Issuing...' : 'Issue now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
