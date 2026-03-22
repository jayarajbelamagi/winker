/** JWT cookie settings — production uses cross-site cookies (Vercel → Render). */
export const getJwtCookieOptions = (maxAgeMs = 15 * 24 * 60 * 60 * 1000) => {
	// Render sets RENDER=true; NODE_ENV should still be production in deployed envs
	const isProd =
		process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
	return {
		maxAge: maxAgeMs,
		httpOnly: true,
		sameSite: isProd ? "none" : "lax",
		secure: isProd,
	};
};
