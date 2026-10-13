export interface Room { id: number; name: string; capacity: number; floor: number; amenities: string[] }
export interface BookingInput { roomId: number; title: string; organizerEmail: string; attendees: number; start: string; end: string }
export interface Booking extends BookingInput { id: number; status: 'confirmed' | 'cancelled'; createdAt: string }
export interface TimeWindow { start: string; end: string }
