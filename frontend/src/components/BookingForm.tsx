import { useState, type FormEvent } from 'react';
import type { BookingInput, Room } from '../types';
import { validateTime } from '../lib/time';
import { errorMessage } from '../lib/api';
interface Props { rooms: Room[]; date: string; initialRoomId: number; disabled: boolean; onCreate: (input: BookingInput) => Promise<void>; }
export function BookingForm({ rooms, date, initialRoomId, disabled, onCreate }: Props) {
  const [roomId, setRoomId] = useState(initialRoomId);
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [attendees, setAttendees] = useState(1);
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const room = rooms.find(r => r.id === roomId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const timeError = validateTime(date, start, end);
    if (timeError) { setError(timeError); return; }
    if (!title.trim()) { setError('Enter a meeting title.'); return; }
    if (!room || attendees > room.capacity) { setError('Attendees exceed room capacity.'); return; }
    setBusy(true);
    try {
      await onCreate({ roomId, title: title.trim(), organizerEmail: email.trim(), attendees, start: `${date}T${start}:00Z`, end: `${date}T${end}:00Z` });
      setTitle('');
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <section className="panel form-panel" aria-labelledby="new-booking">
    <div className="eyebrow">MAKE SPACE FOR YOUR NEXT IDEA</div><h2 id="new-booking">Book a meeting</h2>
    <p className="muted">For {date} · All times UTC</p>
    <form onSubmit={submit}>
      <fieldset disabled={disabled || busy || !rooms.length}>
        <label htmlFor="room">Meeting room</label><select id="room" value={roomId} onChange={e => setRoomId(Number(e.target.value))}>{rooms.map(r => <option key={r.id} value={r.id}>{r.name} · {r.capacity} people</option>)}</select>
        <label htmlFor="title">Meeting title</label><input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Product team sync" required maxLength={100} />
        <label htmlFor="email">Organizer email</label><input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required maxLength={254} />
        <label htmlFor="attendees">Attendees</label><input id="attendees" type="number" value={attendees} min={1} max={room?.capacity} step={1} onChange={e => setAttendees(Number(e.target.value))} required />
        <div className="time-fields"><div><label htmlFor="start">Start (UTC)</label><input id="start" type="time" value={start} onChange={e => setStart(e.target.value)} min="08:00" max="19:45" step={900} required /></div><div><label htmlFor="end">End (UTC)</label><input id="end" type="time" value={end} onChange={e => setEnd(e.target.value)} min="08:15" max="20:00" step={900} required /></div></div>
        <p className="hint">15-minute slots · Maximum 4 hours</p>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary full" type="submit">{busy ? 'Booking…' : 'Confirm booking'}</button>
      </fieldset>
    </form>
    <div className="note">No sign-in needed. Use your work email to organize up to 3 meetings per UTC day.</div>
  </section>;
}
