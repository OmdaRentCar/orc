# Omda Rent Car

Premium car rental platform with 3D showcase, real-time admin dashboard, and Cloudinary image management.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + TypeScript |
| Backend | Node.js + Express + Prisma + TypeScript |
| Database | PostgreSQL (Neon or Supabase) |
| Storage | Cloudinary (car images + booking documents) |
| Real-time | Socket.io |
| Deployment | Vercel (client) + Render (server) |

## Local Development

### 1. Clone and install

```bash
git clone <repo-url>
cd omda
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

```bash
cp .env.example server/.env
# Edit server/.env with your values
```

Required env vars in `server/.env`:
- `DATABASE_URL` — PostgreSQL connection string (Neon/Supabase)
- `JWT_SECRET` — random string (min 32 chars)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `CLIENT_URL` — `http://localhost:5173` for dev

### 3. Set up database

```bash
cd server
npx prisma migrate dev --name init
npm run seed
```

### 4. Run dev servers

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

Frontend: http://localhost:5173  
Backend API: http://localhost:4000

---

## Production Deployment

### Backend → Render

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repo
3. **Root directory:** `server`
4. **Build command:** `npm install && npm run build && npx prisma migrate deploy`
5. **Start command:** `node dist/index.js`
6. Add all env vars from `.env.example` (set `CLIENT_URL` to your Vercel URL)
7. After first deploy, run seed: open Render shell → `npm run seed`

### Frontend → Vercel

1. Import repo on [vercel.com](https://vercel.com)
2. **Framework:** Vite
3. **Root directory:** `client`
4. **Build command:** `npm run build`
5. **Output directory:** `dist`
6. Add env var: `VITE_API_BASE_URL=https://your-app.onrender.com`

### Database → Neon

1. Create project at [neon.tech](https://neon.tech)
2. Copy the connection string to `DATABASE_URL`
3. Run `npx prisma migrate deploy` on Render

### Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Copy Cloud Name, API Key, API Secret to env vars

---

## API Reference

### Public Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/cars` | List all cars |
| GET | `/api/cars/brands` | Distinct brands |
| GET | `/api/cars/types` | Distinct types |
| GET | `/api/cars/:id` | Get car by ID |
| GET | `/api/bookings/car/:id` | Approved date ranges for a car |
| POST | `/api/bookings/public` | Create booking (FormData) |
| POST | `/api/auth/login` | Admin login |

### Admin Endpoints (Bearer token required)
| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/me` | Current admin user |
| POST | `/api/cars` | Add car (FormData) |
| PUT | `/api/cars/:id` | Update car (FormData) |
| DELETE | `/api/cars/:id` | Delete car |
| GET | `/api/bookings` | All bookings |
| PUT | `/api/bookings/:id/status` | Approve/decline |
| DELETE | `/api/bookings/:id` | Delete booking |
| GET | `/api/dashboard` | Stats |
| GET | `/api/dashboard/notifications` | Notifications |
| PUT | `/api/dashboard/notifications/:id/read` | Mark read |
| PUT | `/api/dashboard/notifications/read-all` | Mark all read |
