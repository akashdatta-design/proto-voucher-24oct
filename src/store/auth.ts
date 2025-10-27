import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '../types';

interface User {
  name: string;
  role: Role;
}

interface AuthState {
  user: User | null;
  signIn: (role: Role) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      signIn: (role) => set({ user: { name: 'Demo User', role } }),
      signOut: () => set({ user: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
