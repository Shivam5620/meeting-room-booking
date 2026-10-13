export interface Room { id: number; name: string; capacity: number; floor: number; amenities: string[] }
export interface Booking { id: number; roomId: number; title: string; organizerEmail: string; attendees: number; start: string; end: string; status: 'confirmed' | 'cancelled'; createdAt: string }
export type BookingInput = Omit<Booking, 'id' | 'status' | 'createdAt'>;
