import { create } from 'zustand';
import type { Flight, Passenger } from '../types';

interface SelectionState {
  flight: Flight | null;
  passengers: Passenger[];
  selectedIds: Set<string>;
  setFlight: (flight: Flight | null) => void;
  setPassengers: (passengers: Passenger[]) => void;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  flight: null,
  passengers: [],
  selectedIds: new Set(),

  setFlight: (flight) => set({ flight }),

  setPassengers: (passengers) => set({ passengers }),

  toggle: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { selectedIds: newSet };
    }),

  selectAll: (ids) =>
    set({ selectedIds: new Set(ids) }),

  clear: () =>
    set({ selectedIds: new Set() }),
}));
