/**
 * API base URL for production (Render). Leave unset locally — Vite proxy sends `/api` → localhost:5000.
 * On Vercel: set `VITE_API_URL` to your Render backend origin, e.g. https://your-app.onrender.com
 */
const rawBase = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");

/**
 * @param {string} path - Must start with `/`, e.g. `/api/auth/login`
 */
export function apiUrl(path) {
	const p = path.startsWith("/") ? path : `/${path}`;
	return rawBase ? `${rawBase}${p}` : p;
}
