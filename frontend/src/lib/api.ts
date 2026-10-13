import axios from 'axios';
import type { Booking, BookingInput, Room } from '../types';
const client = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 10000 });
export const api = {
  rooms: async () => (await client.get<{data: Room[]}>('/rooms')).data.data,
  bookings: async (date: string, signal?: AbortSignal) => (await client.get<{data: Booking[]}>('/bookings', { params: { date }, signal })).data.data,
  create: async (input: BookingInput) => (await client.post<{data: Booking}>('/bookings', input)).data.data,
  cancel: async (id: number) => (await client.delete<{data: Booking}>(`/bookings/${id}`)).data.data,
};
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) return error.response?.data?.error?.message || 'Cannot reach the API. Check the backend and PostgreSQL are running.';
  return error instanceof Error ? error.message : 'Something went wrong.';
}
