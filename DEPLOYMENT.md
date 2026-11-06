# Deploy: Render (API) + Vercel (frontend)

This app splits into:

- **Backend** → [Render](https://render.com) (Node / Express on `backend/`)
- **Frontend** → [Vercel](https://vercel.com) (Vite on `frontend/`)

The architecture uses:
1. **Hybrid Auth (Bearer Token + Cookies)**: JWT tokens are returned in responses, stored in `localStorage`, and sent as `Authorization: Bearer <token>` on all requests. This ensures authentication works 100% reliably even on Safari iOS/macOS and Chrome where cross-site cookies are blocked.
2. **Instant Open & Background Warm-up**: Visitors without existing tokens load the login page in **0ms** without waiting for the server to spin up. A background ping awakens the backend while the user enters credentials.
3. **Vercel Reverse Proxy Rewrites**: `/api/*` requests can route through Vercel's edge proxy directly to Render, eliminating CORS preflight delays and third-party cookie restrictions.

---

## ⚡ Zero Cold Start: Keeping Render Awake for Free

Render free web services spin down after 15 minutes of inactivity. To make your site open in **under 1 second every single time**:

1. Go to [cron-job.org](https://cron-job.org/) (100% free forever) or [UptimeRobot](https://uptimerobot.com/).
2. Create a new cron job:
   - **URL**: `https://winker-4.onrender.com/ping`
   - **Schedule**: Every `10 minutes`
3. Save it! Render will never go to sleep, meaning your backend responds instantly 24/7.

---

## 1. Deploy backend on Render

1. Push the repository to GitHub.
2. In Render: **New** → **Web Service** (or Blueprint).
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free (or Starter for paid always-on).

### Environment variables (Render)

| Variable | Required | Notes |
|----------|----------|--------|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Long random string |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary |
| `FRONTEND_URL` | Yes | `https://winker-six.vercel.app` (or comma-separated URLs) |
| `HF_API_KEY` | Optional | Hugging Face API key for `/api/chat` |
| `NODE_ENV` | Auto | Render sets `production` |

---

## 2. Deploy frontend on Vercel

1. **New Project** → Import the Git repo.
2. **Root Directory:** `frontend`
3. **Framework Preset:** Vite (auto-detected).
4. **Build Command:** `npm run build`  
5. **Output Directory:** `dist`

### Environment variables (Vercel)

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://winker-4.onrender.com` (no trailing slash) |

---

## 3. Local development

- Backend: `cd backend && npm run dev` → port **5000**
- Frontend: `cd frontend && npm run dev` → port **3000**
