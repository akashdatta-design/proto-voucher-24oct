# Vouchers System - Technical Documentation

## Project Overview

**Application Name**: Vouchers
**Purpose**: Airline voucher issuance and management system prototype
**Type**: Single Page Application (SPA)
**Deployment**: Vercel (https://proto-voucher-24oct.vercel.app/)
**Repository**: https://github.com/akashdatta-design/proto-voucher-24oct

This is a **fully functional prototype** with mocked backend services. All API calls are intercepted by Mock Service Worker (MSW) and return realistic data patterns.

---

## Tech Stack & Architecture

### Core Technologies
- **Language**: TypeScript 5.9.3
- **Framework**: React 19.1.1
- **Build Tool**: Vite 7.1.7
- **Routing**: React Router DOM 7.9.4
- **State Management**: Zustand 5.0.8
- **Styling**: Tailwind CSS 3.4.18
- **API Mocking**: Mock Service Worker (MSW) 2.11.6

### Development Stack
- **Node Package Manager**: npm
- **Type Checking**: TypeScript strict mode
- **Linting**: ESLint 9.36.0
- **Font**: Inter (Google Fonts)

---

## Project Structure

```
proto-voucher-24oct/
├── public/
│   └── mockServiceWorker.js          # MSW service worker
├── src/
│   ├── api/                          # API client functions
│   │   ├── fifteenBelow.ts          # 15below comms integration
│   │   ├── io.ts                    # Integrated Operations API
│   │   ├── uber.ts                  # Uber voucher API
│   │   └── vouchers.ts              # Voucher issuance API
│   ├── components/                   # Reusable components
│   │   ├── ThemeToggle.tsx          # Light/Dark mode toggle
│   │   └── Toast.tsx                # Toast notifications
│   ├── mocks/                        # MSW mock handlers
│   │   ├── browser.ts               # Browser worker setup
│   │   └── handlers.ts              # Request handlers
│   ├── routes/                       # Page components
│   │   ├── Admin.tsx                # Admin presets management
│   │   ├── Dashboard.tsx            # Flight list dashboard
│   │   ├── Exports.tsx              # Finance export tool
│   │   ├── FlightDetail.tsx         # Flight passenger manifest
│   │   ├── IssueWizard.tsx          # Voucher issuance wizard
│   │   ├── Offline.tsx              # Offline queue management
│   │   └── SignIn.tsx               # Authentication page
│   ├── store/                        # Zustand state stores
│   │   ├── auth.ts                  # User authentication
│   │   ├── selection.ts             # Passenger selection state
│   │   ├── useOfflineQueue.ts       # Offline sync queue
│   │   ├── useTheme.ts              # Theme preference
│   │   └── useToast.ts              # Toast notifications
│   ├── App.tsx                       # Main app with routing
│   ├── config.ts                     # Feature flags
│   ├── main.tsx                      # App entry point + MSW init
│   ├── styles.css                    # Global Tailwind styles
│   └── types.ts                      # TypeScript interfaces
├── index.html                        # HTML entry point
├── tailwind.config.js                # Tailwind configuration
├── tsconfig.json                     # TypeScript configuration
├── vercel.json                       # Vercel SPA routing config
└── package.json                      # Dependencies & scripts
```

**Total Files**: 24 TypeScript/TSX files

---

## Data Models & Types

### User Roles
```typescript
type Role = 'CSA' | 'SUPERVISOR' | 'FINANCE' | 'ADMIN'
```

- **CSA** (Customer Service Agent): Can issue vouchers, view flights
- **SUPERVISOR**: CSA permissions + can override duplicate issuance
- **FINANCE**: Can export financial reports
- **ADMIN**: Full access to all features + preset management

### Flight
```typescript
interface Flight {
  id: string;                    // "QF401|2025-10-27|SYD-MEL"
  flightNumber: string;          // "QF401"
  date: string;                  // "2025-10-27"
  origin: string;                // "SYD"
  destination: string;           // "MEL"
  depTime: string;               // ISO datetime
  arrTime: string;               // ISO datetime
  status: 'ON_TIME' | 'DELAYED' | 'CANCELLED';
  reason?: string;
  disruptionCategory?: 'DLY_2H' | 'DLY_4H' | 'CANCEL';
}
```

### Passenger
```typescript
interface Passenger {
  id: string;
  pnr: string;                   // Passenger Name Record
  name: string;
  seat: string;                  // "12A"
  boarded: boolean;
  cabin: 'Y' | 'J';             // Economy or Business
}
```

### Voucher Types
```typescript
type VoucherType = 'MEAL' | 'UBER' | 'CABCHARGE'
```

- **MEAL**: Paper meal voucher with serial number
- **UBER**: Digital Uber ride credit
- **CABCHARGE**: Paper taxi voucher with serial number

### Issuance
```typescript
interface Issuance {
  id: string;
  batchId?: string | null;
  flightId: string;
  pnr: string;
  passengerName: string;
  seat?: string;
  voucherType: VoucherType;
  amount: number;
  currency: 'AUD';
  method: 'uber_digital' | 'meal_paper' | 'cabcharge_paper';
  externalId?: string;           // Uber voucher ID
  status: 'issued' | 'redeemed' | 'expired' | 'void';
  issuerId: string;
  issuerName: string;
  timestamp: string;             // ISO datetime
  notes?: string;                // Serial numbers stored here
  photoUrl?: string;             // Photo capture (optional)
  overrideReason?: string;       // Supervisor override reason
}
```

### Preset
```typescript
interface Preset {
  voucherType: VoucherType;
  disruptionCategory: 'DLY_2H' | 'DLY_4H' | 'CANCEL';
  defaultAmount: number;
}
```

### Offline Queue
```typescript
interface IssuanceIntent {
  id: string;
  payload: any;                  // Full issuance data
  createdAt: string;
  status: 'queued' | 'posting' | 'synced' | 'failed';
  error?: string;
}
```

---

## Feature Flags (config.ts)

```typescript
export const CONFIG = {
  PHOTO_CAPTURE: true,           // Enable photo capture for paper vouchers
  SEND_COMMS_15BELOW: true,      // Enable 15below passenger comms
  OFFLINE_MODE: true,            // Enable offline queue functionality
  SHOW_DUPLICATE_GUARD: true,    // Show duplicate issuance warnings
}
```

---

## Key Features

### 1. Authentication & Authorization
- **File**: `src/routes/SignIn.tsx`, `src/store/auth.ts`
- Mock authentication with role-based access
- Users: `csa@qantas.com`, `supervisor@qantas.com`, `finance@qantas.com`, `admin@qantas.com` (all password: "password")
- Persists to localStorage
- Protected routes based on role

### 2. Flight Dashboard
- **File**: `src/routes/Dashboard.tsx`
- Lists all flights for a given date
- Shows flight status (ON_TIME, DELAYED, CANCELLED)
- Color-coded status badges
- Click flight to view passenger manifest
- Displays departure/arrival times

### 3. Flight Detail & Passenger Manifest
- **File**: `src/routes/FlightDetail.tsx`
- Shows complete passenger manifest with:
  - PNR, name, seat, cabin class, boarded status
  - Multi-select passengers via checkboxes
  - Filter: All passengers or Not boarded only
  - Bulk actions: Select all, Select all not-boarded, Clear
- Displays vouchers already issued (collapsible section)
- Shows voucher count by type (MEAL, UBER, CABCHARGE)
- "Issue voucher" button (disabled if no passengers selected)

### 4. Voucher Issuance Wizard (3-Step Flow)
- **File**: `src/routes/IssueWizard.tsx`

**Step 1: Pick Voucher Type(s)**
- Select one or more voucher types (MEAL, UBER, CABCHARGE)
- Can add multiple types to batch

**Step 2: Configure Details**
- Set amount (AUD) per voucher type
- **UBER-specific**: Toggle to send comms via 15below
- **MEAL/CABCHARGE-specific**:
  - Quick mode: Starting serial number with auto-increment
  - Manual mode: Enter individual serial numbers per passenger
  - Photo capture: Optional image upload

**Step 3: Confirm & Issue**
- Review summary
- **Duplicate Detection**: Warns if passenger already has voucher of same type
- **Supervisor Override**: SUPERVISOR/ADMIN can override with reason
- **Offline Handling**: If backend unavailable, queues issuance locally
- Creates issuance records in batch

### 5. Offline Mode & Queue Management
- **File**: `src/routes/Offline.tsx`, `src/store/useOfflineQueue.ts`
- Simulates backend unavailability
- Queues issuance intents locally (localStorage)
- Shows queue status: queued, posting, synced, failed
- Retry failed items
- Clear synced items
- Auto-retry on reconnection

### 6. Finance Exports
- **File**: `src/routes/Exports.tsx`
- Filter by date and flight
- Preview table with pagination (20 rows per page)
- Export to CSV
- Shows: Timestamp, Flight, PNR, Passenger, Type, Amount, Status, Issuer

### 7. Admin Presets
- **File**: `src/routes/Admin.tsx`
- Configure default voucher amounts by disruption category
- E.g., DLY_2H → MEAL $25, UBER $40
- Only accessible to ADMIN role

### 8. Light/Dark Mode Theme
- **Files**: `src/store/useTheme.ts`, `src/components/ThemeToggle.tsx`
- Toggle between light and dark themes
- Persists to localStorage
- Detects system preference on first load
- Smooth transitions across all UI elements
- Custom dark mode color palette:
  - Primary: Cyan (#06b6d4)
  - Dark background: #0a0a0a
  - Dark card: #1e1e1e
  - Dark border: #333333
  - Dark hover: #252525

### 9. Toast Notifications
- **Files**: `src/store/useToast.ts`, `src/components/Toast.tsx`
- Success, error, warning, info types
- Auto-dismiss after 5 seconds
- Color-coded left border
- Dark mode support

---

## State Management (Zustand)

### auth.ts
- Current user
- Login/logout functions
- Persists to localStorage

### selection.ts
- Currently selected flight
- List of passengers
- Set of selected passenger IDs
- Clear function

### useTheme.ts
- Current theme: 'light' | 'dark'
- Toggle theme function
- Persists to localStorage
- Manages `dark` class on `<html>` element

### useToast.ts
- Toast queue
- Show/dismiss functions
- Auto-dismiss timer

### useOfflineQueue.ts
- Queue of issuance intents
- Enqueue/dequeue functions
- Retry/clear functions
- Persists to localStorage

---

## API Layer (Mocked with MSW)

All API calls are intercepted by Mock Service Worker and return realistic data.

### Endpoints

#### Flights
- `GET /api/flights?date=YYYY-MM-DD` - List flights for date
- `GET /api/passengers?flightId={id}` - Get passenger manifest

#### Issuances
- `POST /api/issuances` - Create voucher issuances (bulk)
- `GET /api/issuances` - Get all issuances
- `GET /api/issuances?flightId={id}` - Get issuances by flight

#### Presets
- `GET /api/presets` - Get all presets
- `PUT /api/presets` - Update presets

#### Uber Integration
- `POST /api/uber/issue` - Issue Uber voucher (returns mock voucher ID)

#### 15below Comms
- `POST /api/15below/send` - Send passenger comms (mocked)

#### Offline Simulation
- `GET /api/_offline_state` - Get offline status
- `POST /api/_offline_state` - Toggle offline mode

---

## Styling System

### Tailwind CSS Configuration
- **Dark Mode**: Class-based (add `dark` class to `<html>`)
- **Primary Color**: Cyan (#06b6d4)
- **Font**: Inter (sans-serif)
- **Custom Colors**:
  ```javascript
  colors: {
    primary: { DEFAULT: '#06b6d4', dark: '#0891b2' },
    dark: {
      bg: '#0a0a0a',
      card: '#1e1e1e',
      border: '#333333',
      hover: '#252525',
    },
  }
  ```

### Dark Mode Pattern
Every element has both light and dark variants:
```jsx
className="bg-white dark:bg-dark-card text-gray-900 dark:text-white border-gray-200 dark:border-dark-border"
```

---

## Routing

| Path | Component | Access |
|------|-----------|--------|
| `/` | SignIn | Public |
| `/dashboard` | Dashboard | Authenticated |
| `/flight/:flightId` | FlightDetail | Authenticated |
| `/issue` | IssueWizard | Authenticated (CSA+) |
| `/offline` | Offline | Authenticated |
| `/exports` | Exports | FINANCE, ADMIN |
| `/admin` | Admin | ADMIN only |

---

## Key User Flows

### Flow 1: Issue Vouchers to Passengers
1. Sign in as CSA or SUPERVISOR
2. Navigate to Dashboard
3. Click on a DELAYED or CANCELLED flight
4. Select passengers (checkboxes)
5. Click "Issue voucher"
6. Step 1: Choose voucher type(s) (MEAL, UBER, CABCHARGE)
7. Step 2: Configure amounts, serials, comms settings
8. Step 3: Review and confirm
9. System creates issuance records
10. Redirects back to flight detail page

### Flow 2: Handle Offline Scenario
1. Issue vouchers normally
2. If backend is offline (503 error), issuance is queued
3. User sees toast: "Your issuance was queued (offline)"
4. Navigate to Offline page to see queue
5. When online, retry queued items
6. Items sync and clear from queue

### Flow 3: Export Finance Report
1. Sign in as FINANCE or ADMIN
2. Navigate to Exports
3. Select date and flight
4. Preview issuances in table
5. Download CSV file

### Flow 4: Manage Admin Presets
1. Sign in as ADMIN
2. Navigate to Admin page
3. Edit default amounts for voucher types by disruption category
4. Save changes

---

## Mock Data Patterns

### Mock Flights (4 flights on 2025-10-27)
- **QF401** SYD→MEL: Delayed 2hrs (DLY_2H)
- **QF402** MEL→SYD: Cancelled (CANCEL)
- **QF403** SYD→BNE: On time
- **QF404** BNE→SYD: Delayed 4hrs (DLY_4H)

### Mock Passengers
- Each flight has 10-15 passengers
- Mix of Economy (Y) and Business (J) class
- Some boarded, some not boarded
- Realistic Australian names

### Mock Presets
- DLY_2H: MEAL $25, UBER $40, CABCHARGE $50
- DLY_4H: MEAL $35, UBER $60, CABCHARGE $80
- CANCEL: MEAL $40, UBER $80, CABCHARGE $100

---

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server (localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm preview

# Lint code
npm run lint
```

---

## Deployment

- **Platform**: Vercel
- **SPA Routing**: Handled via `vercel.json` (all routes → `/index.html`)
- **MSW in Production**: Enabled (prototype only)
- **Auto-deploy**: Pushes to `main` branch trigger deployment

---

## Important Technical Notes

1. **MSW Runs in Production**: This is intentional for the prototype. In a real app, MSW would only run in development.

2. **LocalStorage Usage**: Auth, theme, and offline queue all use localStorage for persistence.

3. **Passenger Selection State**: Uses Zustand store, cleared after voucher issuance.

4. **Serial Number Storage**: Stored in `Issuance.notes` field as `serial:M1000-0` format.

5. **Duplicate Detection**: Checks if passenger already has voucher of same type on same flight. Supervisors can override with reason.

6. **Photo Capture**: Uses `<input type="file" capture="environment">` for mobile camera. Stores as data URL in `photoUrl` field.

7. **Batch Issuance**: Multiple passengers × multiple voucher types = N×M issuance records, all with same `batchId`.

8. **Dark Mode Implementation**: Uses Tailwind's class-based dark mode. The `useTheme` store adds/removes `dark` class on `<html>` element.

---

## Code Quality Standards

- **TypeScript**: Strict mode enabled, full type coverage
- **React**: Functional components with hooks
- **State Management**: Zustand for global state
- **Styling**: Tailwind utility classes (no custom CSS except globals)
- **Error Handling**: Try-catch blocks, user-friendly error messages
- **Accessibility**: Proper ARIA labels, semantic HTML
- **Performance**: React Router lazy loading, optimistic updates

---

## Common Code Patterns

### API Call Pattern
```typescript
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
const result = await response.json();
```

### Zustand Store Pattern
```typescript
export const useStore = create<StoreState>((set) => ({
  value: initialValue,
  setValue: (value) => set({ value }),
}));
```

### Toast Notification Pattern
```typescript
const { show: showToast } = useToast();
showToast('Message here', 'success');
```

### Dark Mode Class Pattern
```jsx
<div className="bg-white dark:bg-dark-card text-gray-900 dark:text-white">
```

---

## Testing Credentials

| Email | Password | Role |
|-------|----------|------|
| csa@qantas.com | password | CSA |
| supervisor@qantas.com | password | SUPERVISOR |
| finance@qantas.com | password | FINANCE |
| admin@qantas.com | password | ADMIN |

---

## Next Steps / Future Enhancements

This prototype demonstrates core functionality. In a production system, you would need:

1. Real backend API integration
2. Database persistence (PostgreSQL, etc.)
3. Real authentication (OAuth, SAML)
4. Real Uber API integration
5. Real 15below comms integration
6. Audit logging
7. User management
8. Role/permission management
9. Advanced reporting
10. Search and filtering improvements
11. Print voucher functionality
12. Barcode/QR code generation
13. Mobile app (React Native)
14. Push notifications
15. Real-time sync (WebSockets)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-27
**Prepared For**: AI Assistant Context

This document provides a comprehensive overview of the Vouchers system prototype. Use it as a reference for understanding the codebase structure, features, data models, and technical implementation details.
