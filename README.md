# RentCar

Car rental website for Tunisia (prices in DT) with a 3D showcase, online booking in English, French and Arabic, and a real-time admin dashboard.

## Features

**Customers**
- Browse the fleet, open a car page with a photo gallery, and book online
- Availability calendar with booked days blocked out
- Pick-up and return times, agency pick-up or delivery to an address
- Extras (child seat, extra driver, insurance...), automatic discounts for 7+ and 30+ days, refundable deposit
- Booking reference (e.g. `RC-7K3F9Q`) and a **My booking** page to check status with reference + phone
- Emails when a request is received, confirmed, declined or cancelled, in the customer's language
- English, French and Arabic (right-to-left), WhatsApp chat button
- Lighter home page without the 3D scene on weak or data-saving devices (or with `?lite=1`)

**Admin**
- Dashboard with revenue per month, today's rentals and the next 7 days of pick-ups/returns
- Bookings: search and filter, CSV export, add bookings for phone/walk-in customers, edit bookings
- Rental lifecycle: pending → approved → picked up → completed (or declined / cancelled)
- Payment tracking (unpaid / deposit / paid, amount paid, balance due)
- Fleet calendar showing which car is out on which day
- Customers grouped by phone number, repeat customers, blacklist for online booking
- WhatsApp messages to customers, pre-written in their language
- Team accounts with **owner** and **staff** roles, and an activity log of every change
- Business settings: delivery fee, discounts, deposit, extras, contact details, WhatsApp number

**Security**
- Customer ID documents are private on Cloudinary; admins get a link that expires after 10 minutes
- Documents and photos are deleted from Cloudinary with their booking or car
- The live admin feed requires an admin login
- Rate limits on login, booking and status lookup, optional Cloudflare Turnstile CAPTCHA
- Every input is validated on the server; double-booking is prevented even when two admins approve at the same moment

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + TypeScript |
| Backend | Node.js + Express + Prisma + Zod + TypeScript |
| Database | PostgreSQL (Neon in production, any PostgreSQL locally) |
| Storage | Cloudinary (car photos public, ID documents private) |
| Real-time | Socket.io |
| Monitoring | Sentry (optional) |
| Deployment | Render (server) |

## Local Development

### 1. Install

```bash
git clone <repo-url>
cd <repo-folder>
npm run install:all
```

### 2. Configure

```bash
cp .env.example server/.env
# Edit server/.env
```

Required in `server/.env`:
- `DATABASE_URL`: a Neon connection string, or a local PostgreSQL such as `postgresql://youruser@localhost/rentcar?host=/var/run/postgresql`
- `JWT_SECRET`: a random string of at least 32 characters
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: needed for photo and document uploads
- `CLIENT_URL`: `http://localhost:5173` for development

Optional: `SMTP_*` (emails are skipped if unset), `TURNSTILE_SECRET_KEY` + `VITE_TURNSTILE_SITE_KEY` (CAPTCHA), `SENTRY_DSN` + `VITE_SENTRY_DSN` (error alerts). See `.env.example`.

### 3. Set up the database

```bash
cd server
npx prisma migrate deploy
npm run seed      # creates the first admin (an owner) and 8 sample cars
```

### 4. Run

```bash
# Terminal 1 — backend on http://localhost:4000
cd server && npm run dev

# Terminal 2 — frontend on http://localhost:5173
cd client && npm run dev
```

Log in at http://localhost:5173/login with `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`.

## Tests

```bash
createdb rentcar_test          # once; any database whose name contains "test"
cd server
TEST_DATABASE_URL="postgresql://youruser@localhost/rentcar_test?host=/var/run/postgresql" npm test
```

The test database is wiped and rebuilt on every run, which is why its name must contain "test".
GitHub Actions (`.github/workflows/ci.yml`) runs the type check, the tests and both builds on every push and pull request.

## Backups

Neon keeps a restore history automatically (Neon console → your project → **Restore**; the free plan keeps 24 hours, paid plans up to 30 days). For your own copies:

```bash
cd server
npm run backup           # saves server/backups/rentcar-<date>.dump (keeps the 30 newest)
npm run backup:verify    # restores the newest backup into a temporary database and compares row counts
```

To back up production, run it with the Neon connection string: `DATABASE_URL="<neon url>" npm run backup`.
To restore a backup: `pg_restore --clean --no-owner --dbname="<database url>" server/backups/<file>.dump`.
Backups contain customer data and are git-ignored; keep copies somewhere safe.

---

## Production Deployment

### Backend → Render

1. Create a new **Web Service** on [render.com](https://render.com) (or use the included `render.yaml` blueprint)
2. **Root directory:** `server`
3. **Build command:** `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
4. **Start command:** `npm run start`
5. Add the env vars from `.env.example` (set `CLIENT_URL` to your site's URL)
6. After the first deploy, open the Render shell and run `npm run seed`

### Cloudinary

Copy the Cloud Name, API Key and API Secret (click the eye icon to reveal the secret before copying).
If customers upload PDF documents, enable **Settings → Security → Allow delivery of PDF and ZIP files**.

---

## API Reference

### Public
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/cars` | List cars |
| GET | `/api/cars/brands` · `/api/cars/types` | Distinct brands / types |
| GET | `/api/cars/:id` | One car |
| GET | `/api/settings` | Extras, fees, discounts and contact details |
| POST | `/api/bookings/quote` | Price for a car, dates, extras and delivery (JSON) |
| GET | `/api/bookings/car/:id` | Upcoming booked date ranges for a car |
| POST | `/api/bookings/public` | Create a booking (FormData; CAPTCHA token in `X-Captcha-Token`) |
| GET | `/api/bookings/status?reference=&phone=` | Booking status for customers |
| POST | `/api/auth/login` | Admin login |

### Admin (Bearer token; ★ = owner only)
| Method | Path | Description |
|---|---|---|
| GET / PUT | `/api/auth/me` | Current admin / update own account |
| POST · PUT | `/api/cars` · `/api/cars/:id` | Add / update a car (FormData: `image`, `gallery`, `gallery_keep`) |
| DELETE ★ | `/api/cars/:id` | Delete a car, its photos, bookings and documents |
| GET · POST | `/api/bookings` | All bookings / add a booking |
| GET · PUT | `/api/bookings/:id` | One booking / edit it |
| PUT | `/api/bookings/:id/status` | Change status (checked against allowed transitions) |
| PUT | `/api/bookings/:id/payment` | Payment status and amount paid |
| GET | `/api/bookings/:id/document` | 10-minute signed link to the ID document |
| DELETE ★ | `/api/bookings/:id` | Delete a booking and its document |
| GET | `/api/customers` | Customers grouped by phone |
| POST · DELETE | `/api/customers/block` · `/api/customers/block/:phone` | Blacklist / unblock |
| GET | `/api/dashboard` | Stats, 12-month revenue, next 7 days |
| GET · PUT | `/api/dashboard/notifications` · `…/:id/read` · `…/read-all` | Notifications |
| PUT ★ | `/api/settings` | Business settings |
| GET · POST · PUT · DELETE ★ | `/api/admins` · `/api/admins/:id` | Team accounts |
| GET ★ | `/api/audit` | Activity log |
