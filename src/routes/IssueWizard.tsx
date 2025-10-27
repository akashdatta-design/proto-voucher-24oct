import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelectionStore } from '../store/selection';
import { useAuthStore } from '../store/auth';
import { useToast } from '../store/useToast';
import { fetchIssuancesByFlight, createIssuances } from '../api/vouchers';
import { issueUberVoucher } from '../api/uber';
import { CONFIG } from '../config';
import type { VoucherType, Issuance, Preset, Passenger } from '../types';

interface PendingVoucher {
  id: string;
  type: VoucherType;
  amount: number;
  sendComms?: boolean;
  mode?: 'quick' | 'manual';
  startSerial?: string;
  manualSerials?: string[];
  photoDataUrl?: string | null;
}

export default function IssueWizard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { flight, passengers, selectedIds, clear } = useSelectionStore();
  const { show: showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pendingVouchers, setPendingVouchers] = useState<PendingVoucher[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [existingIssuances, setExistingIssuances] = useState<Issuance[]>([]);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [passengerNotes, setPassengerNotes] = useState<Record<string, Record<string, string>>>({});
  const [notesExpanded, setNotesExpanded] = useState<Record<string, boolean>>({});

  const selectedPassengers = passengers.filter((p) => selectedIds.has(p.id));

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
      return type === 'UBER' ? 50 : type === 'MEAL' ? 30 : type === 'HOTEL' ? 180 : 50;
    }

    const preset = presets.find(
      (p) => p.voucherType === type && p.disruptionCategory === flight.disruptionCategory
    );
    return preset?.defaultAmount || (type === 'UBER' ? 50 : type === 'MEAL' ? 30 : type === 'HOTEL' ? 180 : 50);
  };

  const addVoucher = (type: VoucherType) => {
    const newVoucher: PendingVoucher = {
      id: crypto.randomUUID(),
      type,
      amount: getDefaultAmount(type),
      sendComms: type === 'UBER' ? true : undefined,
      mode: type !== 'UBER' ? 'quick' : undefined,
      startSerial: type === 'MEAL' ? 'M1000' : type === 'CABCHARGE' ? 'C2000' : type === 'HOTEL' ? 'H3000' : undefined,
      photoDataUrl: null,
    };
    setPendingVouchers([...pendingVouchers, newVoucher]);
  };

  const removeVoucher = (id: string) => {
    setPendingVouchers(pendingVouchers.filter((v) => v.id !== id));
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
      for (const voucher of pendingVouchers) {
        for (let i = 0; i < selectedPassengers.length; i++) {
          const pax = selectedPassengers[i];

          let externalId: string | undefined;
          let notes = '';

          // Handle serials
          if (voucher.mode === 'quick' && voucher.startSerial) {
            const serial = `${voucher.startSerial}-${i}`;
            notes = `serial:${serial}`;
          } else if (voucher.mode === 'manual' && voucher.manualSerials) {
            const serial = voucher.manualSerials[i];
            notes = `serial:${serial}`;
          }

          // Append per-passenger notes for this specific voucher
          const paxNote = passengerNotes[voucher.id]?.[pax.id];
          if (paxNote?.trim()) {
            notes += notes ? `, note: ${paxNote.trim()}` : `note: ${paxNote.trim()}`;
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
                : voucher.type === 'CABCHARGE'
                ? 'cabcharge_paper'
                : 'hotel_paper',
            externalId,
            issuerId: user?.name || 'unknown',
            issuerName: user?.name || 'Unknown User',
            notes,
            photoUrl: voucher.photoDataUrl || undefined,
            overrideReason: isDuplicate && canOverride ? overrideReason : undefined,
          });
        }
      }

      await createIssuances(rows as Issuance[]);

      // Send comms for UBER vouchers if toggle is on (non-blocking)
      if (CONFIG.SEND_COMMS_15BELOW) {
        for (const voucher of pendingVouchers) {
          if (voucher.type === 'UBER' && voucher.sendComms) {
            for (const pax of selectedPassengers) {
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
      setNotesExpanded({});
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
        <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Select voucher type(s)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => addVoucher('UBER')}
                className="p-6 border-2 border-gray-300 dark:border-dark-border rounded-lg hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition dark:text-white"
              >
                <div className="text-lg font-semibold">UBER</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Digital voucher</div>
              </button>
              <button
                onClick={() => addVoucher('MEAL')}
                className="p-6 border-2 border-gray-300 dark:border-dark-border rounded-lg hover:border-blue-500 dark:hover:border-primary hover:bg-blue-50 dark:hover:bg-primary/20 transition dark:text-white"
              >
                <div className="text-lg font-semibold">MEAL</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Paper voucher</div>
              </button>
              <button
                onClick={() => addVoucher('CABCHARGE')}
                className="p-6 border-2 border-gray-300 dark:border-dark-border rounded-lg hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition dark:text-white"
              >
                <div className="text-lg font-semibold">CABCHARGE</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Paper voucher</div>
              </button>
              <button
                onClick={() => addVoucher('HOTEL')}
                className="p-6 border-2 border-gray-300 dark:border-dark-border rounded-lg hover:border-orange-500 dark:hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition dark:text-white"
              >
                <div className="text-lg font-semibold">HOTEL</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Paper voucher</div>
              </button>
            </div>
          </div>

          {/* Current batch */}
          {pendingVouchers.length > 0 && (
            <div className="border-t border-gray-200 dark:border-dark-border pt-6">
              <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Current batch</h3>
              <div className="space-y-2">
                {pendingVouchers.map((v) => (
                  <div key={v.id} className="flex items-center justify-between bg-gray-50 dark:bg-dark-hover p-3 rounded">
                    <div className="text-gray-900 dark:text-white">
                      <span className="font-medium">{v.type}</span> • ${v.amount}
                    </div>
                    <button
                      onClick={() => removeVoucher(v.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
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

      {/* Stage 2: Configure details */}
      {step === 2 && (
        <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Configure voucher details</h2>

          {pendingVouchers.map((voucher) => (
            <div key={voucher.id} className="border border-gray-200 dark:border-dark-border rounded-lg p-4 space-y-4 bg-gray-50 dark:bg-dark-bg">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{voucher.type}</h3>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (AUD)</label>
                <input
                  type="number"
                  value={voucher.amount}
                  onChange={(e) => updateVoucher(voucher.id, { amount: Number(e.target.value) })}
                  className="w-32 px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white"
                />
              </div>

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
                    <span className="text-sm font-medium">Send comms (15below)</span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Comms are mocked in this prototype</p>
                </div>
              )}

              {/* MEAL/CABCHARGE: Serial entry */}
              {voucher.type !== 'UBER' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Serial entry mode</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-gray-900 dark:text-white">
                        <input
                          type="radio"
                          checked={voucher.mode === 'quick'}
                          onChange={() =>
                            updateVoucher(voucher.id, {
                              mode: 'quick',
                              startSerial: voucher.type === 'MEAL' ? 'M1000' : voucher.type === 'CABCHARGE' ? 'C2000' : 'H3000',
                            })
                          }
                          className="h-4 w-4 text-primary dark:text-primary"
                        />
                        <span className="text-sm">Quick</span>
                      </label>
                      <label className="flex items-center gap-2 text-gray-900 dark:text-white">
                        <input
                          type="radio"
                          checked={voucher.mode === 'manual'}
                          onChange={() => updateVoucher(voucher.id, { mode: 'manual', manualSerials: [] })}
                          className="h-4 w-4 text-primary dark:text-primary"
                        />
                        <span className="text-sm">Manual</span>
                      </label>
                    </div>
                  </div>

                  {voucher.mode === 'quick' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Starting serial</label>
                      <input
                        type="text"
                        value={voucher.startSerial || ''}
                        onChange={(e) => updateVoucher(voucher.id, { startSerial: e.target.value })}
                        className="w-48 px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white"
                        placeholder={voucher.type === 'MEAL' ? 'M1000' : voucher.type === 'CABCHARGE' ? 'C2000' : 'H3000'}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Will auto-increment per passenger (e.g., M1000-0, M1000-1...)
                      </p>
                    </div>
                  )}

                  {voucher.mode === 'manual' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Serial numbers (one per line)
                      </label>
                      <textarea
                        value={voucher.manualSerials?.join('\n') || ''}
                        onChange={(e) =>
                          updateVoucher(voucher.id, { manualSerials: e.target.value.split('\n').filter(Boolean) })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg font-mono text-sm bg-white dark:bg-dark-card text-gray-900 dark:text-white"
                        rows={Math.min(selectedPassengers.length, 8)}
                        placeholder="M1000\nM1001\nM1002..."
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {voucher.manualSerials?.length || 0} / {selectedPassengers.length} serials provided
                        {voucher.manualSerials?.length !== selectedPassengers.length && (
                          <span className="text-red-600 dark:text-red-400 ml-2">⚠ Count mismatch</span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Photo capture */}
                  {CONFIG.PHOTO_CAPTURE && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Photo (optional)</label>
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

                  {/* Per-passenger notes for this voucher */}
                  <div className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setNotesExpanded({
                        ...notesExpanded,
                        [voucher.id]: !notesExpanded[voucher.id]
                      })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700
                                 flex items-center justify-between text-left transition-colors"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">
                        Per-Passenger Notes (optional)
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${notesExpanded[voucher.id] ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {notesExpanded[voucher.id] && (
                      <div className="p-4 bg-white dark:bg-gray-900">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          Add specific notes for individual passengers for this {voucher.type} voucher.
                        </p>

                        {selectedPassengers.length > 0 ? (
                          <div className="space-y-2">
                            {selectedPassengers.map((pax) => (
                              <div key={pax.id} className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-32 text-sm">
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {pax.name}
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-400">
                                    {pax.pnr}
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Note (optional)"
                                  value={passengerNotes[voucher.id]?.[pax.id] || ''}
                                  onChange={(e) => setPassengerNotes({
                                    ...passengerNotes,
                                    [voucher.id]: {
                                      ...(passengerNotes[voucher.id] || {}),
                                      [pax.id]: e.target.value,
                                    }
                                  })}
                                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                                             placeholder-gray-400 dark:placeholder-gray-500
                                             focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500
                                             text-sm"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                            Select passengers first to add notes.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          <div className="bg-blue-50 dark:bg-primary/20 border border-blue-200 dark:border-primary/40 rounded p-3 text-sm text-blue-800 dark:text-primary">
            This will create <span className="font-semibold">{totalRows} issuance record(s)</span>.
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover dark:text-white transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={pendingVouchers.some(
                (v) => v.mode === 'manual' && v.manualSerials?.length !== selectedPassengers.length
              )}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Stage 3: Confirm & issue */}
      {step === 3 && (
        <div className="bg-white dark:bg-dark-card rounded-lg shadow border border-gray-200 dark:border-dark-border p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Confirm & issue</h2>

          {/* Summary */}
          <div className="border border-gray-200 dark:border-dark-border rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-dark-bg">
            {pendingVouchers.map((v) => (
              <div key={v.id} className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{v.type}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    ${v.amount} • {selectedPassengers.length} passenger(s)
                    {v.sendComms && ' • Comms enabled'}
                    {v.mode === 'quick' && ` • Starting serial: ${v.startSerial}`}
                    {v.mode === 'manual' && ' • Manual serials'}
                    {v.photoDataUrl && ' • Photo attached'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-dark-border rounded p-3 text-sm text-gray-900 dark:text-white">
            Total: <span className="font-semibold">{totalRows} issuance record(s)</span>
          </div>

          {/* Duplicate warning */}
          {CONFIG.SHOW_DUPLICATE_GUARD && hasDuplicates && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
              <div className="font-semibold text-yellow-900 dark:text-yellow-400 mb-2">
                ⚠ {duplicates.length} passenger(s) already have vouchers
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
