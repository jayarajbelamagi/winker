const DEVELOPER_KEY = process.env.DEVELOPER_KEY || "Jayaraj@18Komal";

export const developerAuth = (req, res, next) => {
	try {
		const keyFromHeader = req.headers["x-developer-key"];
		const keyFromQuery = req.query.devKey;
		const keyFromCookie = req.cookies?.developerKey;

		const providedKey = keyFromHeader || keyFromQuery || keyFromCookie;

		if (!providedKey) {
			return res.status(401).json({ error: "Developer access key is required" });
		}

		if (providedKey.trim() !== DEVELOPER_KEY.trim()) {
			return res.status(403).json({ error: "Invalid developer access key" });
		}

		next();
	} catch (error) {
		console.error("Developer auth middleware error:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
