import type { Flight, Passenger } from '../types';

export async function fetchFlights(date?: string): Promise<Flight[]> {
  const url = date ? `/api/flights?date=${date}` : '/api/flights';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch flights');
  }
  return response.json();
}

export async function fetchFlight(flightId: string): Promise<Flight> {
  const response = await fetch(`/api/flights/${flightId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch flight');
  }
  return response.json();
}

export async function fetchPassengers(flightId: string): Promise<Passenger[]> {
  const response = await fetch(`/api/flights/${flightId}/passengers`);
  if (!response.ok) {
    throw new Error('Failed to fetch passengers');
  }
  return response.json();
}
