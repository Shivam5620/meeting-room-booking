import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './lib/api';
import { nextDay, utcToday } from './lib/time';
import type { Booking, BookingInput, Room } from './types';
import { BookingForm } from './components/BookingForm';
import { RoomSchedule } from './components/RoomSchedule';
export default function App() {
  const [date, setDate] = useState(utcToday);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [roomId, setRoomId] = useState(1);
  const [formRevision, setFormRevision] = useState(0);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [mutating, setMutating] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setBookings([]);
    Promise.all([api.rooms(), api.bookings(date, controller.signal)])
      .then(([r, b]) => { if (!controller.signal.aborted) { setRooms(r); setBookings(b); } })
      .catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date, revision]);
  function changeDate(value: string) { if (value) { setDate(value); setNotice(''); } }
  async function createBooking(input: BookingInput) {
    setMutating(true);
    try { await api.create(input); setNotice('Booking confirmed.'); setRevision(v => v + 1); }
    finally { setMutating(false); }
  }
  async function cancelBooking(booking: Booking) {
    if (!window.confirm(`Cancel “${booking.title}”? This frees the room for other people.`)) return;
    setCancelling(booking.id); setMutating(true); setError(''); setNotice('');
    try { await api.cancel(booking.id); setNotice('Booking cancelled.'); setRevision(v => v + 1); }
    catch (err) { setError(errorMessage(err)); }
    finally { setCancelling(null); setMutating(false); }
  }
  return <>
    <header><div className="brand"><span className="brand-mark" aria-hidden="true">r.</span><span>roomly<span className="brand-divider">/</span><small>WORKPLACE</small></span></div><span className="timezone">UTC workspace</span></header>
    <main>
      <div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE, ORGANIZED</div><h1>A little room for big ideas.</h1><p className="muted">Find your space. Bring your team. Make things happen.</p></div><span className="version">Booking workspace · v0.8.5</span></div>
      <div className="toolbar"><div className="date-controls"><button disabled={mutating} aria-label="Previous day" onClick={() => changeDate(nextDay(date, -1))}>←</button><label className="date-label" htmlFor="day">Schedule date<input id="day" type="date" value={date} onChange={e => changeDate(e.target.value)} disabled={mutating} /></label><button disabled={mutating} aria-label="Next day" onClick={() => changeDate(nextDay(date, 1))}>→</button><button disabled={mutating} className="today" onClick={() => changeDate(utcToday())}>Today</button></div><span className="hours">Business hours <strong>08:00–20:00 UTC</strong></span></div>
      {notice && <p className="success" role="status">{notice}</p>}
      {error && <div className="error" role="alert">{error} <button onClick={() => setRevision(v => v+1)}>Retry</button></div>}
      <div className="workspace"><section aria-label="Room schedule" aria-busy={loading}><div className="section-title"><h2>Meeting rooms</h2><span>{rooms.length} rooms · {bookings.length} bookings</span></div>
        {loading ? <div className="panel loading" role="status">Loading room schedule…</div> : !rooms.length ? <div className="panel loading">No rooms loaded. Check the API connection and run the database seed.</div> : <RoomSchedule rooms={rooms} bookings={bookings} busy={mutating} cancelling={cancelling} onCancel={cancelBooking} onSelect={id => { setRoomId(id); setFormRevision(v => v+1); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => document.getElementById('title')?.focus(), 0); }} />}
      </section><aside ref={formRef}><BookingForm key={`${date}-${roomId}-${formRevision}`} rooms={rooms} date={date} initialRoomId={roomId} disabled={mutating} onCreate={createBooking} /><div className="pending-note">Availability search is available through the API. The “Find a room” interface is planned for the next iteration.</div></aside></div>
      <footer>Meeting Room Booking System <span>All dates and times are UTC</span></footer>
    </main>
  </>;
}
