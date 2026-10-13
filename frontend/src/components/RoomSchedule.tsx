import type { Booking, Room } from '../types';
import { utcTime } from '../lib/time';
interface Props { rooms: Room[]; bookings: Booking[]; onSelect: (roomId: number) => void; onCancel: (booking: Booking) => Promise<void>; cancelling: number | null; busy: boolean; }
export function RoomSchedule({ rooms, bookings, onSelect, onCancel, cancelling, busy }: Props) {
  return <div className="room-list">{rooms.map(room => {
    const meetings = bookings.filter(b => b.roomId === room.id);
    return <article className="panel room-card" key={room.id}>
      <div className="room-heading"><div className="room-identity"><span className="room-icon" aria-hidden="true">{room.name[0]}</span><div><h3>{room.name}</h3><span className="muted">Up to {room.capacity} people · Floor {room.floor}</span></div></div><button className="secondary" disabled={busy} onClick={() => onSelect(room.id)}>Book room</button></div>
      <div className="amenities">{room.amenities.length ? room.amenities.map(a => <span key={a}>{a.replaceAll('-', ' ')}</span>) : <span>Quiet meeting space</span>}</div>
      {meetings.length === 0 ? <p className="empty-room">No bookings for this day</p> : <ul className="meetings">{meetings.map(b => <li key={b.id}>
        <div className="meeting-time">{utcTime(b.start)}–{utcTime(b.end)}<small>UTC</small></div>
        <div className="meeting-info"><strong>{b.title}</strong><span>{b.organizerEmail} · {b.attendees} people</span></div>
        <button className="cancel" disabled={cancelling !== null || new Date(b.start) <= new Date()} onClick={() => void onCancel(b)} aria-label={`Cancel ${b.title}`} title={new Date(b.start) <= new Date() ? 'Started bookings cannot be cancelled' : 'Cancel booking'}>{cancelling === b.id ? 'Cancelling…' : 'Cancel'}</button>
      </li>)}</ul>}
    </article>;
  })}</div>;
}
