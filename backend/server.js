import path from "path";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import postRoutes from "./routes/post.route.js";
import notificationRoutes from "./routes/notification.route.js";
import storyRoutes from "./routes/story.route.js";
import chatRoutes from "./routes/chat.route.js";
import newsRoutes from "./routes/news.route.js";

import connectMongoDB from "./db/connectMongoDB.js";

dotenv.config();

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();

// Behind proxy (Render)
app.set("trust proxy", 1);

// CORS Configuration
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
	.split(",")
	.map((s) => s.trim().replace(/\/$/, ""))
	.filter(Boolean);

const isOriginAllowed = (origin) => {
	if (!origin) return true; // allow server-to-server, curl, health checks
	if (allowedOrigins.includes("*")) return true;

	const cleanOrigin = origin.replace(/\/$/, "");
	if (allowedOrigins.includes(cleanOrigin)) return true;

	// Allow all Vercel deployments (production + preview branches)
	if (/^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(cleanOrigin)) return true;

	// Allow local development
	if (/^http:\/\/localhost(:\d+)?$/.test(cleanOrigin)) return true;
	if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(cleanOrigin)) return true;

	return false;
};

const corsOptions = {
	origin(origin, callback) {
		if (isOriginAllowed(origin)) {
			return callback(null, true);
		}
		console.warn(`❌ CORS blocked origin: ${origin}`);
		return callback(new Error("Not allowed by CORS"));
	},
	credentials: true,
	methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
};

// Apply CORS & Handle Preflight
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Middlewares - Increased payload limit to 50mb to prevent "Entity Too Large" errors
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// Health & Ping routes (fast, lightweight, warm-up friendly)
app.get("/", (req, res) => {
	res.send("Backend is running 🚀");
});

app.get("/ping", (req, res) => {
	res.status(200).send("pong");
});

app.get("/api/health", (req, res) => {
	res.status(200).json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/news", newsRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
	console.error("Unhandled error:", err.message);
	if (err.type === "entity.too.large") {
		return res.status(413).json({ error: "File payload too large. Please select a smaller file." });
	}
	res.status(500).json({ error: err.message || "Internal server error" });
});

// Start server
app.listen(PORT, () => {
	console.log(`🚀 Server running on port ${PORT}`);
	connectMongoDB();
});
