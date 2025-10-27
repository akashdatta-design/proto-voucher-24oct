import { create } from 'zustand';

export interface IssuanceIntent {
  id: string;
  createdAt: string;
  status: 'queued' | 'posting' | 'synced' | 'failed';
  error?: string;
  payload: {
    flightId: string;
    recipientPaxIds: string[]; // PNRs
    passengers?: Array<{ // Optional: for better display
      pnr: string;
      name: string;
      seat?: string;
    }>;
    vouchers: Array<{
      type: 'MEAL' | 'UBER' | 'CABCHARGE';
      amount: number;
      sendComms?: boolean;
      mode?: 'quick' | 'manual';
      startSerial?: string;
      manualSerials?: string[];
      photoDataUrl?: string | null;
    }>;
  };
}

interface OfflineQueueStore {
  intents: IssuanceIntent[];
  enqueue: (intent: Omit<IssuanceIntent, 'id' | 'createdAt' | 'status'>) => void;
  updateStatus: (id: string, status: IssuanceIntent['status'], error?: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useOfflineQueue = create<OfflineQueueStore>((set) => ({
  intents: [],

  enqueue: (intent) => {
    const newIntent: IssuanceIntent = {
      ...intent,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'queued',
    };

    set((state) => ({
      intents: [...state.intents, newIntent],
    }));
  },

  updateStatus: (id, status, error) => {
    set((state) => ({
      intents: state.intents.map((intent) =>
        intent.id === id ? { ...intent, status, error } : intent
      ),
    }));
  },

  remove: (id) => {
    set((state) => ({
      intents: state.intents.filter((intent) => intent.id !== id),
    }));
  },

  clear: () => {
    set({ intents: [] });
  },
}));
