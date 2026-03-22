# Deploy: Render (API) + Vercel (frontend)

This app splits into:

- **Backend** → [Render](https://render.com) (Node / Express on `backend/`)
- **Frontend** → [Vercel](https://vercel.com) (Vite on `frontend/`)

The frontend calls the API using `VITE_API_URL` in production. JWT cookies use **cross-site** settings (`SameSite=None`, `Secure`) so login works from Vercel → Render.

---

## 1. Deploy backend on Render

1. Push the repo to GitHub/GitLab/Bitbucket.
2. In Render: **New** → **Blueprint** (or **Web Service**).
3. If using **Blueprint**, connect the repo — Render reads `render.yaml` at the repo root (`rootDir: backend`).
4. If creating a **Web Service** manually:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free (or paid for always-on).

### Environment variables (Render)

| Variable | Required | Notes |
|----------|----------|--------|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Long random string |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary |
| `CLOUDINARY_API_KEY` | Yes | |
| `CLOUDINARY_API_SECRET` | Yes | |
| `FRONTEND_URL` | Yes | Your Vercel URL(s), comma-separated if multiple (e.g. production + preview) |
| `HF_API_KEY` | Optional | Hugging Face API key for `/api/chat` |
| `NODE_ENV` | Auto | Render sets `production` |

**Important:** `FRONTEND_URL` must exactly match the browser origin (e.g. `https://your-app.vercel.app`). Add preview URLs if you use Vercel preview deployments:

```text
https://your-app.vercel.app,https://your-app-git-develop-username.vercel.app
```

5. Deploy and copy your service URL, e.g. `https://twitter-clone-backend-xxxx.onrender.com`.

**Free tier:** The API may spin down after inactivity; first request can take ~50s.

---

## 2. Deploy frontend on Vercel

1. **New Project** → import the same Git repo.
2. **Root Directory:** `frontend`
3. **Framework Preset:** Vite (auto-detected).
4. **Build Command:** `npm run build`  
5. **Output Directory:** `dist`

### Environment variables (Vercel)

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://your-backend-xxxx.onrender.com` (no trailing slash) |

Set this for **Production** and **Preview** if previews should hit the same API (or use a staging Render URL for previews).

6. Deploy, then add the Vercel URL(s) to Render’s `FRONTEND_URL` and redeploy the backend if needed.

---

## 3. Local development (unchanged)

- Backend: `cd backend && npm run dev` → port **5000**
- Frontend: `cd frontend && npm run dev` → port **3000**, Vite proxies `/api` → `localhost:5000`
- Do **not** set `VITE_API_URL` locally (leave unset so requests stay relative).

---

## 4. Checklist

- [ ] Render web service shows **Healthy** (`GET /` returns “Backend is running”).
- [ ] `FRONTEND_URL` on Render includes your exact Vercel origin(s).
- [ ] `VITE_API_URL` on Vercel equals your Render URL (HTTPS, no trailing `/`).
- [ ] Sign up / login on the Vercel URL — session should persist (cookies).

---

## Files added for deployment

- `render.yaml` — optional Render Blueprint
- `frontend/vercel.json` — SPA fallback for React Router
- `frontend/src/lib/api.js` — `VITE_API_URL` + `apiUrl()`
- `backend/server.js` — CORS for multiple origins, `trust proxy`
- `backend/lib/utils/cookieOptions.js` — production cross-site cookies
