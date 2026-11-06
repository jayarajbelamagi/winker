import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
	sendMessage,
	getMessages,
	getConversations,
	getEligibleContacts,
	logCall,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/conversations", protectRoute, getConversations);
router.get("/contacts", protectRoute, getEligibleContacts);
router.get("/:otherUserId", protectRoute, getMessages);
router.post("/send/:receiverId", protectRoute, sendMessage);
router.post("/call/:receiverId", protectRoute, logCall);

export default router;
