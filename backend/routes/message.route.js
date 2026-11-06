import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
	sendMessage,
	getMessages,
	getConversations,
	getEligibleContacts,
	initiateCall,
	getActiveCall,
	getCallStatus,
	answerCall,
	declineCall,
	endCall,
	logCall,
} from "../controllers/message.controller.js";

const router = express.Router();

// Conversations & Contacts
router.get("/conversations", protectRoute, getConversations);
router.get("/contacts", protectRoute, getEligibleContacts);

// Active Call Session Signaling Routes (MUST precede /:otherUserId)
router.get("/call/active", protectRoute, getActiveCall);
router.get("/call/status/:callId", protectRoute, getCallStatus);
router.post("/call/initiate/:receiverId", protectRoute, initiateCall);
router.post("/call/answer/:callId", protectRoute, answerCall);
router.post("/call/decline/:callId", protectRoute, declineCall);
router.post("/call/end/:callId", protectRoute, endCall);
router.post("/call/:receiverId", protectRoute, logCall);

// Direct Messages
router.get("/:otherUserId", protectRoute, getMessages);
router.post("/send/:receiverId", protectRoute, sendMessage);

export default router;
