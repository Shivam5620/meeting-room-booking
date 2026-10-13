import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/domain/errors.js';
import { blocksSlot, parseUtc, validateCancellation, validateCapacity, validateDailyLimit, validateFuture, validateWindow } from '../src/domain/rules.js';
import { bookingSchema, dateSchema } from '../src/domain/validation.js';
const stamp = (time: string) => `2030-05-14T${time}:00Z`;
const window = (start: string, end: string) => ({start: stamp(start), end: stamp(end)});
const rejects = (fn: () => unknown, code: string) => assert.throws(fn, error => error instanceof AppError && error.code === code);
const existing = { roomId: 1, status: 'confirmed' as const, ...window('10:00','11:00') };
for (const [start, end, roomId, expected] of [
  ['09:00','10:00',1,false], ['11:00','12:00',1,false], ['09:30','10:30',1,true],
  ['10:30','11:30',1,true], ['10:15','10:45',1,true], ['09:00','12:00',1,true],
  ['10:00','11:00',1,true], ['10:00','11:00',2,false],
] as const) {
  test(`R7: ${start}–${end}, room ${roomId}: blocks=${expected}`, () => {
    assert.equal(blocksSlot(existing, { roomId, ...window(start, end) }), expected);
  });
}
test('R7: cancelled bookings do not block', () => assert.equal(blocksSlot({...existing,status:'cancelled'}, {roomId:1,...window('10:00','11:00')}),false));
test('R1: end must be later', () => rejects(() => validateWindow(window('10:00','10:00')), 'R1_END_AFTER_START'));
test('R2: invalid minute boundary', () => rejects(() => validateWindow(window('10:01','11:00')), 'R2_QUARTER_HOUR'));
test('R2: nonzero seconds and milliseconds', () => {
  for (const start of ['2030-05-14T10:00:01Z', '2030-05-14T10:00:00.001Z']) rejects(() => validateWindow({...window('10:00','11:00'), start}), 'R2_QUARTER_HOUR');
});
test('R3: maximum duration', () => rejects(() => validateWindow(window('10:00','14:15')), 'R3_DURATION'));
test('R3: 15-minute and 4-hour limits accepted', () => { validateWindow(window('08:00','08:15')); validateWindow(window('16:00','20:00')); });
test('R4: outside business hours', () => { rejects(() => validateWindow(window('07:45','08:00')), 'R4_BUSINESS_HOURS'); rejects(() => validateWindow(window('19:45','20:15')), 'R4_BUSINESS_HOURS'); });
test('R4: crossing UTC midnight', () => rejects(() => validateWindow({start:stamp('23:00'),end:'2030-05-15T01:00:00Z'}), 'R4_BUSINESS_HOURS'));
test('R5: past rejected, exact now accepted', () => { rejects(() => validateFuture(stamp('10:00'), new Date(stamp('10:01'))), 'R5_PAST_START'); validateFuture(stamp('10:00'),new Date(stamp('10:00'))); });
test('R6: capacity boundary', () => { validateCapacity(4,4); rejects(() => validateCapacity(5,4), 'R6_CAPACITY'); });
test('R8: future cancellation allowed; started forbidden', () => { validateCancellation(existing,new Date(stamp('09:00'))); rejects(() => validateCancellation(existing,new Date(stamp('10:00'))), 'R8_ALREADY_STARTED'); });
test('R8: already cancelled remains successful after start', () => validateCancellation({...existing,status:'cancelled'},new Date(stamp('12:00'))));
test('R9: fourth booking rejected', () => { validateDailyLimit(2); rejects(() => validateDailyLimit(3),'R9_DAILY_LIMIT'); });
test('Timestamp rejects invalid date, local time and non-UTC offsets', () => {
  for (const value of ['2030-02-30T10:00:00Z','2030-05-14T10:00:00+05:30','2030-05-14T10:00:00','invalid']) rejects(() => parseUtc(value),'INVALID_TIMESTAMP');
  assert.equal(parseUtc('2030-05-14T10:00:00.000Z').toISOString(),'2030-05-14T10:00:00.000Z');
});
test('Calendar query rejects impossible dates', () => { assert.equal(dateSchema.safeParse('2030-02-30').success,false); assert.equal(dateSchema.safeParse('2032-02-29').success,true); });
test('Input trims title, normalizes email, rejects invalid scalar fields', () => {
  const input = {roomId:1,title:' Sync ',organizerEmail:'SAM@EXAMPLE.COM',attendees:1,...window('10:00','11:00')};
  assert.equal(bookingSchema.parse(input).title,'Sync');
  assert.equal(bookingSchema.parse(input).organizerEmail,'sam@example.com');
  for (const patch of [{title:'  '},{title:'a'.repeat(101)},{organizerEmail:'bad'},{attendees:0},{attendees:1.5},{roomId:'1'}]) assert.equal(bookingSchema.safeParse({...input,...patch}).success,false);
});
