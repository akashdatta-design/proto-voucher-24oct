# Implementation Guide: Sections 7-10
## Vouchers Prototype - Remaining Work

**Document Purpose**: Step-by-step implementation instructions for completing Sections 7-10 of CLAUDE_EXECUTION_PLAN_539pm.md

**Prerequisites**: Sections 3-6 have been completed successfully.

---

## Section 7: Flight Detail Enhancements

### 7.1 - Search UI (Client-side filtering)

**File**: `src/routes/FlightDetail.tsx`

**Objective**: Add search input above passenger table for filtering by PNR, Name, or Seat

#### Step 1: Add search state

**Location**: After existing state declarations (around line 20-25)

```typescript
const [searchQuery, setSearchQuery] = useState('');
```

#### Step 2: Create filtered passengers computation

**Location**: Inside FlightDetail component, after loadData function (around line 60-70)

```typescript
// Compute filtered passengers based on search and filter mode
const filteredPassengers = useMemo(() => {
  if (!passengers) return [];

  let result = passengers;

  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.trim().toLowerCase();
    result = result.filter((p) => {
      // PNR: partial, case-insensitive
      if (p.pnr.toLowerCase().includes(query)) return true;
      // Name: substring, case-insensitive
      if (p.name.toLowerCase().includes(query)) return true;
      // Seat: exact or startsWith
      if (p.seat.toLowerCase() === query || p.seat.toLowerCase().startsWith(query)) return true;
      return false;
    });
  }

  // Apply boarding filter
  if (filter === 'not-boarded') {
    result = result.filter((p) => !p.boarded);
  }

  return result;
}, [passengers, searchQuery, filter]);
```

**Import addition**: Add `useMemo` to React imports:
```typescript
import { useState, useEffect, useMemo } from 'react';
```

#### Step 3: Add search input UI

**Location**: Above the passenger table, after the filter buttons section (around line 150-160, look for the div containing "All passengers" / "Not boarded yet" buttons)

**Insert immediately after the filter buttons div and before the table**:

```typescript
{/* Search input */}
<div className="mb-4">
  <input
    type="text"
    placeholder="Search by PNR, Name, or Seat..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
               bg-white dark:bg-gray-800 text-gray-900 dark:text-white
               placeholder-gray-400 dark:placeholder-gray-500
               focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
  />
  {searchQuery && (
    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
      Showing {filteredPassengers.length} of {passengers?.length || 0} passengers
    </p>
  )}
</div>
```

#### Step 4: Update table to use filteredPassengers

**Location**: Find where passengers are mapped in the table (around line 200+)

**Change**:
```typescript
// BEFORE:
{passengers.filter(...).map((p) => (

// AFTER:
{filteredPassengers.map((p) => (
```

**Remove the inline `.filter()` call** that was filtering by boarding status - this is now handled in filteredPassengers computation.

#### Acceptance Criteria:
- [ ] Search input appears above passenger table
- [ ] Search filters by PNR (partial match, case-insensitive)
- [ ] Search filters by Name (substring match, case-insensitive)
- [ ] Search filters by Seat (exact or startsWith match)
- [ ] Search combines with "Not boarded yet" filter correctly
- [ ] Count shows "Showing X of Y passengers" when searching

---

### 7.2 - Boarding Pass Scanner

**File**: `src/routes/FlightDetail.tsx`

**Objective**: Add "Scan boarding pass" button using BarcodeDetector API to extract PNR

#### Step 1: Check BarcodeDetector support

**Location**: Create a helper function at the top of the component (after loadData)

```typescript
const isScannerSupported = 'BarcodeDetector' in window;
```

#### Step 2: Create scanner handler

**Location**: After loadData function

```typescript
const handleScanBoardingPass = async () => {
  if (!('BarcodeDetector' in window)) {
    alert('Barcode scanning is not supported in this browser. Please use Chrome or Edge.');
    return;
  }

  try {
    // Request camera access
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    // Create video element for scanning
    const video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    await video.play();

    // Create barcode detector for PDF417 and QR codes
    const barcodeDetector = new (window as any).BarcodeDetector({
      formats: ['pdf417', 'qr_code']
    });

    // Scan for barcodes
    const detectBarcodes = async () => {
      try {
        const barcodes = await barcodeDetector.detect(video);

        if (barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue;

          // Extract PNR pattern: 6 alphanumeric characters
          const pnrMatch = rawValue.match(/[A-Z0-9]{6}/);

          if (pnrMatch) {
            const extractedPNR = pnrMatch[0];

            // Stop video stream
            stream.getTracks().forEach(track => track.stop());

            // Set search query to extracted PNR
            setSearchQuery(extractedPNR);

            // Show success message
            alert(`Boarding pass scanned! PNR: ${extractedPNR}`);
          } else {
            // No PNR found, continue scanning
            requestAnimationFrame(detectBarcodes);
          }
        } else {
          // No barcode detected yet, continue scanning
          requestAnimationFrame(detectBarcodes);
        }
      } catch (err) {
        console.error('Barcode detection error:', err);
        stream.getTracks().forEach(track => track.stop());
        alert('Failed to scan barcode. Please try again.');
      }
    };

    // Start detection loop
    detectBarcodes();

  } catch (err) {
    console.error('Camera access error:', err);
    alert('Failed to access camera. Please check permissions.');
  }
};
```

#### Step 3: Add scan button UI

**Location**: Next to the search input (within the search div from 7.1)

**Update the search div**:
```typescript
<div className="mb-4 flex gap-3 items-start">
  <div className="flex-1">
    <input
      type="text"
      placeholder="Search by PNR, Name, or Seat..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                 placeholder-gray-400 dark:placeholder-gray-500
                 focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500"
    />
    {searchQuery && (
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
        Showing {filteredPassengers.length} of {passengers?.length || 0} passengers
      </p>
    )}
  </div>

  {isScannerSupported && (
    <button
      onClick={handleScanBoardingPass}
      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white
                 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600
                 flex items-center gap-2 whitespace-nowrap"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
      Scan boarding pass
    </button>
  )}
</div>
```

#### Step 4: Add TypeScript types (if needed)

**Location**: Top of file or in types.ts

```typescript
// Add to window interface if needed
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}
```

#### Acceptance Criteria:
- [ ] "Scan boarding pass" button appears next to search input
- [ ] Button only appears in supported browsers (Chrome, Edge)
- [ ] Clicking button requests camera permission
- [ ] Scanner detects PDF417 and QR codes
- [ ] PNR extracted using `/[A-Z0-9]{6}/` pattern
- [ ] Extracted PNR populates search field
- [ ] Camera stream stops after successful scan
- [ ] Graceful error handling for unsupported browsers, camera failures
- [ ] Alert shows extracted PNR on success

---

### 7.3 - New Columns (QFF Tier, Transiting, Issued)

**File**: `src/routes/FlightDetail.tsx`

**Objective**: Add three columns after Cabin: QFF Tier, Transiting, Issued (voucher counts)

#### Step 1: Install icon library (if not already available)

**Run in terminal**:
```bash
npm install lucide-react
```

**Alternative**: Use heroicons if already available, or inline SVGs

#### Step 2: Add table header cells

**Location**: Find the table header row (around line 180-190, look for `<thead>`)

**After the "Cabin" header cell, add**:
```typescript
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
  QFF Tier
</th>
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
  Transiting
</th>
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
  Issued
</th>
```

#### Step 3: Create QFF Tier badge component

**Location**: Before the FlightDetail component, create helper function

```typescript
function QffTierBadge({ tier }: { tier?: string }) {
  if (!tier) return <span className="text-gray-400 dark:text-gray-600">-</span>;

  const colors: Record<string, string> = {
    'Platinum One': 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
    'Platinum': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
    'Gold': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    'Silver': 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
    'Bronze': 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[tier] || colors['Bronze']}`}>
      {tier}
    </span>
  );
}
```

#### Step 4: Create Transiting badge component

**Location**: After QffTierBadge

```typescript
function TransitingBadge({ transiting }: { transiting?: boolean }) {
  if (transiting === undefined) return <span className="text-gray-400 dark:text-gray-600">-</span>;

  return transiting ? (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
      Yes
    </span>
  ) : (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
      No
    </span>
  );
}
```

#### Step 5: Create Issued counts component

**Location**: After TransitingBadge

**Import icons** (top of file):
```typescript
import { Utensils, Car, CreditCard, Hotel } from 'lucide-react';
// Alternative: import from heroicons or use inline SVGs
```

**Component**:
```typescript
function IssuedCounts({
  pax,
  counts
}: {
  pax: Passenger;
  counts: Record<VoucherType, number>
}) {
  const icons = {
    MEAL: <Utensils className="w-4 h-4" />,
    UBER: <Car className="w-4 h-4" />,
    CABCHARGE: <CreditCard className="w-4 h-4" />,
    HOTEL: <Hotel className="w-4 h-4" />,
  };

  const abbreviations = {
    MEAL: 'M',
    UBER: 'U',
    CABCHARGE: 'C',
    HOTEL: 'H',
  };

  // Get all non-zero voucher types
  const issued = (Object.keys(counts) as VoucherType[]).filter(
    (type) => counts[type] > 0
  );

  if (issued.length === 0) {
    return <span className="text-gray-400 dark:text-gray-600">-</span>;
  }

  return (
    <div className="flex gap-2 items-center flex-wrap">
      {issued.map((type) => (
        <div
          key={type}
          className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          title={`${type}: ${counts[type]}`}
        >
          {icons[type]}
          <span className="text-xs font-medium">{counts[type]}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {abbreviations[type]}
          </span>
        </div>
      ))}
    </div>
  );
}
```

**Note**: If icons don't work, use abbreviation-only fallback:
```typescript
function IssuedCounts({
  pax,
  counts
}: {
  pax: Passenger;
  counts: Record<VoucherType, number>
}) {
  const abbreviations = {
    MEAL: 'M',
    UBER: 'U',
    CABCHARGE: 'C',
    HOTEL: 'H',
  };

  const issued = (Object.keys(counts) as VoucherType[]).filter(
    (type) => counts[type] > 0
  );

  if (issued.length === 0) {
    return <span className="text-gray-400 dark:text-gray-600">-</span>;
  }

  return (
    <div className="flex gap-2">
      {issued.map((type) => (
        <span
          key={type}
          className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium"
          title={`${type}: ${counts[type]}`}
        >
          {abbreviations[type]}{counts[type]}
        </span>
      ))}
    </div>
  );
}
```

#### Step 6: Update issuanceCounts initialization

**Location**: Where issuanceCounts is initialized (around line 25-30)

**Change**:
```typescript
// BEFORE:
const [issuanceCounts, setIssuanceCounts] = useState<
  Record<string, Record<'MEAL' | 'UBER' | 'CABCHARGE', number>>
>({});

// AFTER:
const [issuanceCounts, setIssuanceCounts] = useState<
  Record<string, Record<VoucherType, number>>
>({});
```

#### Step 7: Update issuanceCounts computation in loadData

**Location**: Inside loadData function where counts are calculated

**Change**:
```typescript
// BEFORE (around line 50-55):
const newCounts: Record<string, Record<'MEAL' | 'UBER' | 'CABCHARGE', number>> = {};
paxData.forEach((p) => {
  newCounts[p.id] = { MEAL: 0, UBER: 0, CABCHARGE: 0 };
});

// AFTER:
const newCounts: Record<string, Record<VoucherType, number>> = {};
paxData.forEach((p) => {
  newCounts[p.id] = { MEAL: 0, UBER: 0, CABCHARGE: 0, HOTEL: 0 };
});
```

#### Step 8: Add table body cells

**Location**: Inside the table body row mapping (around line 200-250)

**After the Cabin cell, add**:
```typescript
<td className="px-4 py-4 whitespace-nowrap">
  <QffTierBadge tier={p.qffTier} />
</td>
<td className="px-4 py-4 whitespace-nowrap">
  <TransitingBadge transiting={p.transiting} />
</td>
<td className="px-4 py-4">
  <IssuedCounts pax={p} counts={issuanceCounts[p.id] || { MEAL: 0, UBER: 0, CABCHARGE: 0, HOTEL: 0 }} />
</td>
```

#### Acceptance Criteria:
- [ ] Three new columns appear after Cabin column
- [ ] QFF Tier shows colored badge (Platinum One=purple, Platinum=indigo, Gold=yellow, Silver=gray, Bronze=orange)
- [ ] Transiting shows "Yes" (blue) or "No" (gray) badge
- [ ] Issued shows per-type counts with icons OR abbreviations
- [ ] Issued column blank if no vouchers issued
- [ ] All counts correctly reflect issuances from state
- [ ] HOTEL type included in all counts

---

## Section 8: Issue Wizard Enhancements

### 8.1 - Add HOTEL Voucher Type

**File**: `src/routes/IssueWizard.tsx`

**Objective**: Add HOTEL as 4th voucher type with paper flow (serials + optional photo)

#### Step 1: Add HOTEL tile in Stage 1

**Location**: Find the voucher type selection grid (around line 100-150)

**After CABCHARGE tile, add**:
```typescript
<button
  onClick={() => {
    setVoucher({ type: 'HOTEL', amount: presets.HOTEL || 180 });
    setStage(2);
  }}
  className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 dark:from-purple-600 dark:to-purple-900 p-8 transition-all hover:shadow-2xl hover:scale-105"
>
  <div className="relative z-10">
    <div className="text-6xl mb-4">🏨</div>
    <h3 className="text-2xl font-bold text-white mb-2">HOTEL</h3>
    <p className="text-purple-100">Accommodation voucher</p>
    <div className="mt-4 text-sm text-purple-200">
      Default: ${presets.HOTEL || 180}
    </div>
  </div>
  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
</button>
```

#### Step 2: Update presets state type

**Location**: Where presets state is defined (around line 20-30)

**Change**:
```typescript
// BEFORE:
const [presets, setPresets] = useState<Record<'MEAL' | 'UBER' | 'CABCHARGE', number>>({
  MEAL: 15,
  UBER: 50,
  CABCHARGE: 50,
});

// AFTER:
const [presets, setPresets] = useState<Record<VoucherType, number>>({
  MEAL: 15,
  UBER: 50,
  CABCHARGE: 50,
  HOTEL: 180,
});
```

#### Step 3: Update presets fetch logic

**Location**: Inside useEffect that fetches presets (around line 40-60)

**Add HOTEL to the preset matching**:
```typescript
useEffect(() => {
  if (!flight) return;

  fetch('/api/presets')
    .then((res) => res.json())
    .then((data: Preset[]) => {
      const category = flight.disruptionCategory;
      if (!category) return;

      const match = (type: VoucherType) =>
        data.find((p) => p.voucherType === type && p.disruptionCategory === category);

      setPresets({
        MEAL: match('MEAL')?.defaultAmount || 15,
        UBER: match('UBER')?.defaultAmount || 50,
        CABCHARGE: match('CABCHARGE')?.defaultAmount || 50,
        HOTEL: match('HOTEL')?.defaultAmount || 180,  // NEW
      });
    })
    .catch((err) => console.error('Failed to load presets:', err));
}, [flight]);
```

#### Step 4: Update Stage 2 paper voucher handling

**Location**: Stage 2 rendering section (around line 200-300)

**Find the section that handles paper vouchers** (MEAL, CABCHARGE). Update the condition to include HOTEL:

```typescript
// BEFORE:
{voucher.type === 'MEAL' || voucher.type === 'CABCHARGE' ? (

// AFTER:
{voucher.type === 'MEAL' || voucher.type === 'CABCHARGE' || voucher.type === 'HOTEL' ? (
```

**Update the paper voucher section headings/labels**:
```typescript
<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
  {voucher.type === 'MEAL' && 'Meal voucher details'}
  {voucher.type === 'CABCHARGE' && 'Cabcharge voucher details'}
  {voucher.type === 'HOTEL' && 'Hotel voucher details'}
</h3>
```

#### Step 5: Update submission logic

**Location**: handleSubmit function (around line 400-500)

**Find where method is determined**:
```typescript
// BEFORE:
const method =
  voucher.type === 'UBER' ? 'uber_digital' :
  voucher.type === 'MEAL' ? 'meal_paper' :
  'cabcharge_paper';

// AFTER:
const method =
  voucher.type === 'UBER' ? 'uber_digital' :
  voucher.type === 'MEAL' ? 'meal_paper' :
  voucher.type === 'CABCHARGE' ? 'cabcharge_paper' :
  'hotel_paper';
```

#### Acceptance Criteria:
- [ ] HOTEL tile appears in Stage 1 (purple gradient, hotel emoji)
- [ ] Default amount $180 shown on tile
- [ ] Clicking HOTEL advances to Stage 2
- [ ] Stage 2 shows paper voucher flow (Quick/Manual serials)
- [ ] Photo capture available for HOTEL (if CONFIG.PHOTO_CAPTURE=true)
- [ ] Submission creates issuances with method='hotel_paper'
- [ ] Issuances appear in manifest with HOTEL type

---

### 8.2 - Per-Passenger Notes

**File**: `src/routes/IssueWizard.tsx`

**Objective**: Add collapsible notes section in Stage 2 for all voucher types

#### Step 1: Add notes state

**Location**: After existing state declarations (around line 30-40)

```typescript
const [passengerNotes, setPassengerNotes] = useState<Record<string, string>>({});
const [notesExpanded, setNotesExpanded] = useState(false);
```

#### Step 2: Create notes UI component

**Location**: Inside Stage 2 rendering, after passenger selection and before amount input (around line 250-280)

```typescript
{/* Per-passenger notes */}
<div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
  <button
    type="button"
    onClick={() => setNotesExpanded(!notesExpanded)}
    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700
               flex items-center justify-between text-left transition-colors"
  >
    <span className="font-medium text-gray-900 dark:text-white">
      Per-Passenger Notes (optional)
    </span>
    <svg
      className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${notesExpanded ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {notesExpanded && (
    <div className="p-4 bg-white dark:bg-gray-900">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Add specific notes for individual passengers. These will appear in the CSV export.
      </p>

      {selected.length > 0 ? (
        <div className="space-y-2">
          {selected.map((paxId) => {
            const pax = passengers?.find((p) => p.id === paxId);
            if (!pax) return null;

            return (
              <div key={paxId} className="flex items-center gap-3">
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
                  value={passengerNotes[paxId] || ''}
                  onChange={(e) => setPassengerNotes({
                    ...passengerNotes,
                    [paxId]: e.target.value,
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                             placeholder-gray-400 dark:placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500
                             text-sm"
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Select passengers first to add notes.
        </p>
      )}
    </div>
  )}
</div>
```

#### Step 3: Clear notes when selection changes

**Location**: Create a useEffect to clean up notes (around line 80-100)

```typescript
useEffect(() => {
  // Remove notes for unselected passengers
  setPassengerNotes((prev) => {
    const updated = { ...prev };
    Object.keys(updated).forEach((paxId) => {
      if (!selected.includes(paxId)) {
        delete updated[paxId];
      }
    });
    return updated;
  });
}, [selected]);
```

#### Step 4: Update submission to include notes

**Location**: Inside handleSubmit where issuances are created (around line 450-500)

**For batch issuances**:
```typescript
// BEFORE:
const records = selected.map((paxId) => {
  const pax = passengers?.find((p) => p.id === paxId);
  if (!pax) throw new Error('Passenger not found');

  return {
    flightId: flight.id,
    pnr: pax.pnr,
    passengerName: pax.name,
    seat: pax.seat,
    voucherType: voucher.type,
    amount: voucher.amount,
    currency: 'AUD' as const,
    method,
    issuerId: 'mock-user-id',
    issuerName: 'Mock User',
    photoUrl: voucher.photoUrl,
  };
});

// AFTER:
const records = selected.map((paxId) => {
  const pax = passengers?.find((p) => p.id === paxId);
  if (!pax) throw new Error('Passenger not found');

  // Build notes field
  let notesField = '';
  if (serialsMap[paxId]) {
    notesField = `serial: ${serialsMap[paxId]}`;
  }
  if (passengerNotes[paxId]?.trim()) {
    notesField += notesField ? `, note: ${passengerNotes[paxId].trim()}` : `note: ${passengerNotes[paxId].trim()}`;
  }

  return {
    flightId: flight.id,
    pnr: pax.pnr,
    passengerName: pax.name,
    seat: pax.seat,
    voucherType: voucher.type,
    amount: voucher.amount,
    currency: 'AUD' as const,
    method,
    issuerId: 'mock-user-id',
    issuerName: 'Mock User',
    photoUrl: voucher.photoUrl,
    notes: notesField || undefined,  // NEW
  };
});
```

**Note**: This format ensures notes appear in CSV export in the `notes` column as:
- `serial: ABC123, note: Passenger requested vegetarian meal`
- `note: VIP passenger`
- `serial: XYZ789`

#### Step 5: Clear notes on wizard completion

**Location**: Inside clear() function (around line 350-370)

```typescript
const clear = () => {
  setStage(1);
  setVoucher({ type: 'MEAL', amount: presets.MEAL });
  setSelected([]);
  setSerialsMode('quick');
  setSerialsValue('');
  setSerialsMap({});
  setErrors([]);
  setPassengerNotes({});  // NEW
  setNotesExpanded(false);  // NEW
};
```

#### Acceptance Criteria:
- [ ] Per-passenger notes section appears in Stage 2 for ALL voucher types
- [ ] Section is collapsible (collapsed by default)
- [ ] Shows selected passengers with PNR in a table format
- [ ] Each passenger has a note input field
- [ ] Notes persist during stage navigation
- [ ] Notes cleared when passengers deselected
- [ ] Notes appended to `Issuance.notes` field as `serial: X, note: Y` format
- [ ] Notes visible in CSV export under notes column
- [ ] Section shows "Select passengers first" when no selection

---

## Section 9: Verify API Clients

**Objective**: Confirm all API interactions support HOTEL vouchers without changes

### 9.1 - Issuances POST Endpoint

**File**: `src/mocks/handlers.ts` (already updated in Section 4)

**Verification**:
1. Check that the endpoint accepts any VoucherType
2. Confirm no hardcoded type checks that would reject HOTEL

**Action**: Read the POST `/api/issuances` handler (around line 110-125)

**Expected**: Handler should accept records with `voucherType: 'HOTEL'` and `method: 'hotel_paper'` without modification

**Test**: After Section 8 implementation, issue a HOTEL voucher and verify:
- POST request succeeds
- Issuance created with status='issued'
- Response includes generated ID and timestamp

### 9.2 - CSV Export Endpoint

**File**: `src/mocks/handlers.ts` (already has correct header)

**Verification**:
1. Check CSV header includes `voucher_type` column (line 183)
2. Confirm HOTEL issuances export correctly

**Action**: Read GET `/api/exports` handler (around line 173-217)

**Expected**:
- CSV header: `issuance_id,flight,date,pnr,passenger_name,seat,voucher_type,amount,method,external_id,issuer,timestamp,notes,status`
- HOTEL rows appear with `voucher_type=HOTEL` and `method=hotel_paper`
- Notes field includes per-passenger notes from Section 8.2

**Test**: After Section 8 implementation:
1. Issue HOTEL vouchers with notes
2. Export CSV from Exports page
3. Verify HOTEL rows appear correctly
4. Verify notes column includes "serial: X, note: Y" format

### 9.3 - Flights and Passengers Endpoints

**File**: `src/mocks/handlers.ts` (already updated in Section 4)

**Verification**:
1. Passengers endpoint returns qffTier and transiting fields
2. Flights endpoint unchanged

**Action**: Test in browser:
```
GET /api/flights/QF401|2025-10-27|SYD-MEL/passengers
```

**Expected response** includes:
```json
{
  "id": "p001",
  "pnr": "AB12CD",
  "name": "Emma Thompson",
  "seat": "1A",
  "boarded": true,
  "cabin": "J",
  "qffTier": "Platinum One",
  "transiting": false
}
```

**Test**: Navigate to Flight Detail page and verify QFF Tier and Transiting columns populate correctly

### Acceptance Criteria:
- [ ] POST `/api/issuances` accepts HOTEL vouchers
- [ ] CSV export includes HOTEL rows with correct columns
- [ ] CSV export shows per-passenger notes
- [ ] Passengers endpoint returns qffTier and transiting
- [ ] No API client code changes needed

---

## Section 10: QA & Acceptance Testing

**Objective**: Comprehensive testing of all features (regression + new)

### 10.1 - Regression Testing (Original Use Cases)

#### UC1: Single Uber Digital Voucher
1. Navigate to Flights > Today > QF401
2. Select 1 passenger (not boarded)
3. Click "Issue Vouchers"
4. Select UBER tile
5. Select passenger
6. Verify amount = $50 (or preset for DLY_2H)
7. Click "Submit"
8. Verify success toast
9. Verify passenger row shows "U1" in Issued column
10. Verify issuance appears in Exports CSV

**Expected**: ✅ No errors, voucher issued successfully

#### UC2: Meal Voucher with Photo
1. Navigate to QF401
2. Select 3 passengers
3. Click "Issue Vouchers"
4. Select MEAL tile
5. Select all 3 passengers
6. Enter serials (Quick: "ABC,DEF,GHI")
7. Capture photo (if CONFIG.PHOTO_CAPTURE=true)
8. Click "Submit"
9. Verify success toast
10. Verify passengers show "M1" in Issued column
11. Verify CSV export includes serials in notes column

**Expected**: ✅ No errors, 3 vouchers issued with serials

#### UC3: Batch Cabcharge
1. Navigate to QF702
2. Select 5 passengers
3. Click "Issue Vouchers"
4. Select CABCHARGE tile
5. Select all 5 passengers
6. Enter manual serials: "CC001, CC002, CC003, CC004, CC005"
7. Click "Submit"
8. Verify success toast
9. Verify passengers show "C1" in Issued column
10. Verify batch ID is same for all 5 issuances

**Expected**: ✅ No errors, batch issued successfully

#### UC4: Duplicate Guard Warning
1. Navigate to QF401
2. Select passenger who already has a MEAL voucher (from UC2)
3. Click "Issue Vouchers"
4. Select MEAL tile
5. Select same passenger
6. Verify warning appears: "Already has MEAL voucher"
7. Issue anyway (override)
8. Verify success
9. Verify passenger shows "M2" in Issued column

**Expected**: ✅ Duplicate warning shown, override works

#### UC5: Uber API Failure Handling
1. Navigate to QF401
2. Select 1 passenger
3. Click "Issue Vouchers"
4. Select UBER tile
5. Select passenger
6. Enter amount > $80 (triggers mock failure)
7. Click "Submit"
8. Verify error toast appears
9. Verify no issuance created

**Expected**: ✅ Error handled gracefully, no crash

### 10.2 - New Features Testing

#### Feature 1: Qantas Logo
1. Navigate to any page
2. Verify Qantas logo appears in top-left of header
3. Verify logo height ~32px (h-8 class)
4. Test in dark mode

**Expected**: ✅ Logo visible, properly sized, works in both themes

#### Feature 2: Offline Mode Removed
1. Navigate to all pages: Flights, Exports
2. Verify no "Offline Mode" nav link
3. Verify no `/offline` route exists
4. Issue vouchers in Issue Wizard
5. Verify no offline warnings or queue UI
6. Check browser console for errors

**Expected**: ✅ No offline UI, no console errors, no `/offline` route

#### Feature 3: Flight Detail Search
1. Navigate to QF401
2. Type "AB12" in search box
3. Verify only passengers with PNR matching "AB12" shown
4. Type "Emma" in search
5. Verify only passengers with name containing "Emma" shown
6. Type "1A" in search
7. Verify only passenger in seat 1A shown
8. Clear search
9. Verify all passengers return
10. Test with "Not boarded yet" filter active

**Expected**: ✅ Search filters correctly by PNR/Name/Seat, combines with boarding filter

#### Feature 4: Boarding Pass Scanner (Chrome only)
1. Navigate to QF401 in Chrome browser
2. Verify "Scan boarding pass" button appears
3. Click button
4. Grant camera permission
5. Show boarding pass barcode to camera
6. Verify PNR extracted and populated in search field
7. Verify passenger with matching PNR highlighted/filtered
8. Test in Firefox/Safari: verify button doesn't appear

**Expected**: ✅ Scanner works in Chrome, graceful fallback in other browsers

#### Feature 5: QFF Tier Column
1. Navigate to QF401
2. Verify "QFF Tier" column appears after Cabin
3. Verify colored badges show:
   - Platinum One: purple
   - Platinum: indigo
   - Gold: yellow
   - Silver: gray
   - Bronze: orange
4. Test in dark mode

**Expected**: ✅ QFF Tier column shows badges with correct colors

#### Feature 6: Transiting Column
1. Navigate to QF401
2. Verify "Transiting" column appears after QFF Tier
3. Verify passengers show "Yes" (blue) or "No" (gray)
4. Verify ~25% of passengers show "Yes"

**Expected**: ✅ Transiting column shows correct badges

#### Feature 7: Issued Column
1. Navigate to QF401
2. Verify "Issued" column appears after Transiting
3. Issue 1 MEAL to passenger p001
4. Verify p001 row shows "M1" badge
5. Issue 1 UBER to p001
6. Verify p001 row shows "M1 U1" badges
7. Issue 1 HOTEL to p001
8. Verify p001 row shows "M1 U1 H1" badges
9. Verify unissued passengers show "-"

**Expected**: ✅ Issued column shows per-type counts with icons/abbreviations

#### Feature 8: HOTEL Voucher Type
1. Navigate to QF401
2. Click "Issue Vouchers"
3. Verify HOTEL tile appears (purple, hotel emoji)
4. Verify default amount $180 shown
5. Click HOTEL tile
6. Select 2 passengers
7. Enter serials: "H001, H002"
8. Capture photo (optional)
9. Click "Submit"
10. Verify success toast
11. Verify passengers show "H1" in Issued column
12. Export CSV
13. Verify HOTEL rows appear with `voucher_type=HOTEL` and `method=hotel_paper`

**Expected**: ✅ HOTEL vouchers issue successfully, appear in CSV

#### Feature 9: Per-Passenger Notes
1. Navigate to QF401
2. Click "Issue Vouchers"
3. Select MEAL tile
4. Select 3 passengers
5. Expand "Per-Passenger Notes" section
6. Verify 3 rows appear (Name | PNR | Note input)
7. Enter notes for 2 passengers:
   - p001: "VIP passenger"
   - p002: "Vegetarian meal requested"
8. Enter serials: "M001, M002, M003"
9. Click "Submit"
10. Export CSV
11. Verify notes column contains:
    - p001: `serial: M001, note: VIP passenger`
    - p002: `serial: M002, note: Vegetarian meal requested`
    - p003: `serial: M003`

**Expected**: ✅ Notes saved, exported in correct format

### 10.3 - Final Checks

#### Build & Type Safety
```bash
npm run build
```
**Expected**: ✅ No TypeScript errors, build succeeds

#### Dark Mode
1. Toggle dark mode using system preferences
2. Navigate through all pages
3. Verify all new UI elements render correctly in dark mode

**Expected**: ✅ All UI elements styled for dark mode

#### Responsive Design
1. Resize browser to mobile width (375px)
2. Test Flight Detail page:
   - Search input
   - Scan button
   - Table scrolls horizontally
   - New columns visible (may need horizontal scroll)

**Expected**: ✅ UI remains usable on mobile

#### CSV Export Headers
1. Export CSV from any flight
2. Verify header row is EXACTLY:
   ```
   issuance_id,flight,date,pnr,passenger_name,seat,voucher_type,amount,method,external_id,issuer,timestamp,notes,status
   ```

**Expected**: ✅ CSV header unchanged from original

#### No Offline References
1. Search codebase for "offline" (case-insensitive)
2. Verify only matches are in:
   - This document
   - CLAUDE_EXECUTION_PLAN_539pm.md
   - No matches in src/ files

**Expected**: ✅ No offline code remains in src/

### 10.4 - Sign-off Checklist

- [ ] All regression tests pass (UC1-UC5)
- [ ] All new features work correctly (Features 1-9)
- [ ] Build succeeds with no TypeScript errors
- [ ] Dark mode works for all new UI
- [ ] Mobile responsive design acceptable
- [ ] CSV export unchanged (headers + data correct)
- [ ] No offline mode references in codebase
- [ ] All acceptance criteria from Sections 3-9 met

---

## Summary

**Implementation Order**:
1. Section 7.1: Search UI (~30 min)
2. Section 7.2: Boarding pass scanner (~45 min)
3. Section 7.3: New columns (~60 min)
4. Section 8.1: HOTEL voucher type (~45 min)
5. Section 8.2: Per-passenger notes (~60 min)
6. Section 9: API verification (~15 min)
7. Section 10: QA testing (~90 min)

**Total Estimated Time**: 5.5 hours

**Key Dependencies**:
- lucide-react (or heroicons) for icons in Section 7.3
- BarcodeDetector API support (Chrome/Edge only) for Section 7.2

**Critical Notes**:
- ALWAYS test after each section before moving to next
- Use TypeScript strict mode - fix all type errors immediately
- Preserve existing dark mode styling patterns
- DO NOT modify CSV header row (only data rows)
- Follow existing code style (Tailwind classes, React patterns)

---

## Deployment Checklist

After completing all sections:

1. **Final build test**:
   ```bash
   npm run build
   npm run preview
   ```

2. **Browser testing**:
   - Chrome: Full feature set including scanner
   - Firefox: All features except scanner
   - Safari: All features except scanner

3. **Git commit** (only after user approval):
   ```bash
   git add .
   git commit -m "Implement voucher system enhancements

   - Add Qantas logo to header
   - Remove offline mode completely
   - Add search and boarding pass scanner to Flight Detail
   - Add QFF Tier, Transiting, and Issued columns
   - Add HOTEL voucher type with paper flow
   - Add per-passenger notes for all voucher types
   - Update mock data with qffTier and transiting fields

   Completed Sections 3-10 per CLAUDE_EXECUTION_PLAN_539pm.md"
   ```

---

**END OF IMPLEMENTATION GUIDE**
