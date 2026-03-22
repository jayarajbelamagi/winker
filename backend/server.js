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

// Behind Render / reverse proxies (needed for secure cookies, IPs, etc.)
app.set("trust proxy", 1);

// CORS — comma-separated origins: production Vercel URL + optional preview URLs
// CORS — FIXED VERSION
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);

app.use(
	cors({
		origin(origin, callback) {
			// allow server-to-server or Postman
			if (!origin) return callback(null, true);

			// 🔥 allow all if "*" is set
			if (allowedOrigins.includes("*")) {
				return callback(null, true);
			}

			// allow specific origins
			if (allowedOrigins.includes(origin)) {
				return callback(null, true);
			}

			console.warn(`CORS blocked origin: ${origin}`);
			return callback(new Error("Not allowed by CORS"));
		},
		credentials: true,
	})
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
	res.send("Backend is running 🚀");
});

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
	connectMongoDB();
});
