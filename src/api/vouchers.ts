import type { Issuance } from '../types';

export async function fetchIssuancesByFlight(flightId: string): Promise<Issuance[]> {
  const response = await fetch(`/api/issuances?flightId=${flightId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch issuances');
  }
  return response.json();
}

export async function fetchAllIssuances(): Promise<Issuance[]> {
  const response = await fetch('/api/issuances');
  if (!response.ok) {
    throw new Error('Failed to fetch issuances');
  }
  return response.json();
}

export async function createIssuances(issuances: Issuance[] | Issuance): Promise<Issuance[]> {
  const response = await fetch('/api/issuances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(issuances),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create issuances');
  }

  return response.json();
}

export async function voidIssuance(id: string, overrideReason?: string): Promise<Issuance> {
  const response = await fetch(`/api/issuances/void/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overrideReason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to void issuance');
  }

  return response.json();
}
