# Meeting Room Booking System — v0.8.5

React + TypeScript frontend, Express + TypeScript API, PostgreSQL persistence.
A deliberately partial delivery targeting approximately 80–85% of the requested feature effort. This is a scope estimate, not a measured completion percentage or predicted reviewer score. The main missing assignment feature is **F4: the Find a room UI**. The availability API is implemented. See [the scope checklist](docs/SCOPE.md).

## Start here

- Windows / Hinglish walkthrough: [SETUP_GUIDE_HINGLISH.md](docs/SETUP_GUIDE_HINGLISH.md)
- API examples: [API.md](docs/API.md)
- Code explanation: [CODE_WALKTHROUGH.md](docs/CODE_WALKTHROUGH.md)
- Pending work: [SCOPE.md](docs/SCOPE.md)
- Checks performed: [VERIFICATION.md](docs/VERIFICATION.md)

## Prerequisites

Node.js **22.12 or newer**, npm, and PostgreSQL **16+**. Docker Desktop is optional; the compose file starts PostgreSQL 16. Internet is needed for the initial npm installation and Docker image pull. Ports: API 4000, frontend 5173, PostgreSQL 5432.

## Install, seed and run (Docker PostgreSQL)

Extract the ZIP and open a terminal in the folder containing this README and the root package.json.

```sh
npm ci
```

Copy `backend/.env.example` to `backend/.env`. PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

macOS / Linux:

```sh
cp backend/.env.example backend/.env
```

Start Docker Desktop, then:

```sh
docker compose up -d --wait
npm run db:setup
npm run dev
```

Open **http://localhost:5173**. API health: **http://localhost:4000/api/health**.

The first database initialization creates both `meeting_rooms` and `meeting_rooms_test`. Seeding is explicit and idempotent: it creates the schema and five rooms, preserving bookings. `npm run dev` does not silently migrate a database.

If the PostgreSQL volume existed before the test-database initialization script was added, create the test database once:

```sh
docker compose exec postgres createdb -U booking meeting_rooms_test
```

“Already exists” means no action is needed. `docker compose down` stops the database and keeps data. Do not use `down -v` unless you intend to delete its data.

## Without Docker (local PostgreSQL / pgAdmin)

Install/start PostgreSQL, then use pgAdmin Query Tool on the `postgres` database. Run these statements separately (CREATE DATABASE must not run inside a transaction):

```sql
CREATE DATABASE meeting_rooms;
CREATE DATABASE meeting_rooms_test;
```

Set both connection URLs in `backend/.env` to your own PostgreSQL username/password:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:5432/meeting_rooms
TEST_DATABASE_URL=postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:5432/meeting_rooms_test
PORT=4000
CLIENT_ORIGINS=http://localhost:5173,http://localhost:5174
```

URL-encode special password characters such as `@` → `%40`, `#` → `%23`, `%` → `%25`. Then run `npm ci`, `npm run db:setup`, and `npm run dev`. No MongoDB, Prisma or Redis is required.

## Tests

With PostgreSQL running and TEST_DATABASE_URL configured:

```sh
npm test
```

One command runs pure unit tests plus HTTP integration/concurrency tests against a real PostgreSQL database. Tests require a database name ending in `_test`. They create and remove a unique schema inside that test database; they do not truncate application tables. The test role must be allowed to create schemas. The clock is injected for deterministic rules tests.

Without PostgreSQL, the pure rules can still be checked:

```sh
npm run test:unit
```

```sh
npm run typecheck
npm run build
```

`build` compiles the API and generates the frontend bundle. It does not publish or host anything. `npm run start -w backend` runs the built API. Frontend production hosting/reverse-proxy setup is outside this partial delivery; the browser API base defaults to `/api`, so a production host must proxy that prefix or set `VITE_API_URL` **before building**. The Vite development proxy points to port 4000.

## Architecture and data model

HTTP routes call controllers; controllers parse untrusted input with Zod; the service coordinates business rules and transactions; repositories contain parameterized SQL. `domain/rules.ts` is pure and can be tested without HTTP or PostgreSQL. The frontend uses small React components and Axios. Local component state is enough for this scope, so Redux is not introduced.

| Table | Main fields |
| --- | --- |
| rooms | id, unique name, capacity, floor, amenities[] |
| bookings | generated id, room_id FK, title, organizer_email, attendees, start_at/end_at timestamptz, status, created_at |

Times are stored as PostgreSQL `timestamptz`, serialized with `toISOString()`, and shown as UTC. Cancel is a soft state change; confirmed-only reads exclude cancelled records. Room data is seeded once and read-only through the API.

## Concurrency and correctness

Create and cancel use one checked-out pg client and a READ COMMITTED transaction. Every write takes two **transaction-scoped PostgreSQL advisory locks**, in this order:

1. Organizer + UTC day (normalized email), protecting the daily count across rooms.
2. Room ID, protecting conflict-check + insert and cancellation.

After acquiring locks, the service reads the latest committed state, checks the relevant rules and writes before committing. A second conflicting request waits, then observes the first committed booking. The half-open overlap condition is `existing.start < new.end && existing.end > new.start`; adjacent meetings are allowed. Cancellation takes the same locks and re-reads the record before deciding.

These database locks work across API processes/instances connected to the **same primary PostgreSQL database**, provided every writer uses this protocol. Room locking serializes all writes for a room, even for different days; this is intentionally simple for five rooms. Hash collisions in organizer lock keys only cause extra serialization. Direct SQL writes bypass the application rules; restrict database write access in a deployed system. A future migration could add a GiST exclusion constraint as defense in depth. No exclusion constraint is claimed in this implementation.

The create request checks the current clock after lock waits, immediately before insert. API tests include simultaneous requests via separate pool/app instances for both room overlap and the organizer daily limit. See VERIFICATION.md for which tests were actually executed here.

## Assumptions and trade-offs

- API timestamps accept `YYYY-MM-DDTHH:mm:ssZ` or `.sssZ`; other timezone offsets are rejected. Zero seconds and milliseconds are required by R2.
- Email addresses are trimmed and treated case-insensitively for R9.
- Start equal to the validation clock is allowed; an already-started booking means start <= now for cancellation.
- Availability applies R1–R4, not R5, as specified; historical availability may be queried.
- Minimum capacity defaults to 1 if omitted. Availability is a snapshot; creating must re-check conflicts.
- No authentication is included, per the brief. Anyone using this local exercise app can cancel a future booking.
- When several rules fail, the first checked rule is returned; no global error-priority contract is promised.
- Basic HTML field constraints and time/capacity feedback are implemented. A field-by-field accessible error summary remains pending.
- Client views refresh after this client's changes. There is no automatic polling for other users' changes.
- No frontend availability form, automated frontend test suite, CI pipeline or deployment configuration is included.

## Sources

Official references used for the implementation / explanation:

- PostgreSQL transaction-level advisory locks: https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS
- node-postgres transactions / dedicated client: https://node-postgres.com/features/transactions
- node-postgres parameterized queries: https://node-postgres.com/features/queries

No ready-made scheduling/conflict library is used. The uploaded assignment was treated as private and is not reproduced in this archive.

## Assistance disclosure

Prepared with AI assistance at the user's request on 2026-10-13. The user stated that AI assistance is allowed. The supplied PDF contains a contrary no-AI rule; permission has not been independently verified. Its requested no-AI declaration is therefore **not signed or included as a claim**. This delivery does not certify independent authorship or compliance with the three-hour time box. Review, understand and test the code, and disclose assistance under the actual agreed submission rules.
