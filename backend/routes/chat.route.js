import express from "express";
import { sendMessage, getChatHistory, clearChatHistory } from "../controllers/chat.controller.js";
import { protectRoute } from "../middleware/protectRoute.js";

const router = express.Router();

// Protected routes - require authentication
router.post("/send", protectRoute, sendMessage);
router.get("/history", protectRoute, getChatHistory);
router.delete("/clear", protectRoute, clearChatHistory);

export default router;
