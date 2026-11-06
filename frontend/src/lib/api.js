/**
 * API configuration and request client for Winker
 * Supports both Vercel reverse proxy (/api) and direct Render backend (VITE_API_URL).
 */

export const TOKEN_KEY = "winker_token";
export const USER_KEY = "winker_user";

const rawBase = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");

/**
 * Resolves full API URL
 * @param {string} path - e.g. "/api/auth/me" or full URL
 */
export function apiUrl(path) {
	if (!path) return "";
	if (path.startsWith("http://") || path.startsWith("https://")) {
		return path;
	}
	const p = path.startsWith("/") ? path : `/${path}`;
	return rawBase ? `${rawBase}${p}` : p;
}

/**
 * Retrieve saved JWT token from localStorage
 */
export function getStoredToken() {
	try {
		return localStorage.getItem(TOKEN_KEY) || null;
	} catch (e) {
		return null;
	}
}

/**
 * Store JWT token and user profile
 */
export function setStoredAuth(token, user) {
	try {
		if (token) localStorage.setItem(TOKEN_KEY, token);
		if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
	} catch (e) {
		console.warn("Failed to save auth to localStorage", e);
	}
}

/**
 * Retrieve cached user profile
 */
export function getStoredUser() {
	try {
		const raw = localStorage.getItem(USER_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch (e) {
		return null;
	}
}

/**
 * Clear stored credentials upon logout
 */
export function clearStoredAuth() {
	try {
		localStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(USER_KEY);
	} catch (e) {}
}

/**
 * Robust fetch wrapper that automatically:
 * - Attaches Bearer authorization token
 * - Enables cross-site credentials
 * - Configures JSON headers where appropriate
 * - Enforces request timeout
 */
export async function apiFetch(path, options = {}) {
	const url = apiUrl(path);
	const token = getStoredToken();

	const headers = new Headers(options.headers || {});

	// Auto-set JSON content-type if body is a stringified JSON and not already set
	if (
		options.body &&
		typeof options.body === "string" &&
		!headers.has("Content-Type") &&
		!(options.body instanceof FormData)
	) {
		headers.set("Content-Type", "application/json");
	}

	// Always send Bearer token if available
	if (token && !headers.has("Authorization")) {
		headers.set("Authorization", `Bearer ${token}`);
	}

	const config = {
		credentials: "include",
		...options,
		headers,
	};

	// Default 35s timeout for network requests (avoids infinite hangs on cold backend)
	if (!config.signal && typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
		config.signal = AbortSignal.timeout(options.timeout || 35000);
	}

	return fetch(url, config);
}

/**
 * Non-blocking backend wake-up ping for Render free tier
 */
let wakeUpTriggered = false;
export function wakeUpBackend() {
	if (wakeUpTriggered) return;
	wakeUpTriggered = true;

	try {
		fetch(apiUrl("/ping"), { mode: "cors", credentials: "omit" }).catch(() => {
			// Quietly ignore wake-up errors
		});
	} catch (e) {}
}
