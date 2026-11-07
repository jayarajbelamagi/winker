import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
	sendMessage,
	getMessages,
	deleteMessage,
	getConversations,
	getEligibleContacts,
	initiateCall,
	getActiveCall,
	getCallStatus,
	answerCall,
	declineCall,
	endCall,
	exchangeSignal,
	getSignal,
	getCallHistory,
	logCall,
	createGroup,
	getGroupDetails,
	getGroupMessages,
	sendGroupMessage,
	addGroupMembers,
	leaveGroup,
	initiateGroupCall,
} from "../controllers/message.controller.js";

const router = express.Router();

// Conversations & Contacts
router.get("/conversations", protectRoute, getConversations);
router.get("/contacts", protectRoute, getEligibleContacts);
router.get("/calls/history", protectRoute, getCallHistory);

// Group Messaging & Calling (MUST precede parameterized routes)
router.post("/group/create", protectRoute, createGroup);
router.get("/group/:conversationId", protectRoute, getGroupDetails);
router.get("/group/:conversationId/messages", protectRoute, getGroupMessages);
router.post("/group/send/:conversationId", protectRoute, sendGroupMessage);
router.post("/group/:conversationId/add", protectRoute, addGroupMembers);
router.post("/group/:conversationId/leave", protectRoute, leaveGroup);
router.post("/call/group/initiate/:conversationId", protectRoute, initiateGroupCall);

// Active Call Session Signaling Routes (MUST precede /:otherUserId)
router.get("/call/active", protectRoute, getActiveCall);
router.get("/call/status/:callId", protectRoute, getCallStatus);
router.post("/call/initiate/:receiverId", protectRoute, initiateCall);
router.post("/call/answer/:callId", protectRoute, answerCall);
router.post("/call/decline/:callId", protectRoute, declineCall);
router.post("/call/end/:callId", protectRoute, endCall);
router.post("/call/signal/:callId", protectRoute, exchangeSignal);
router.get("/call/signal/:callId", protectRoute, getSignal);
router.post("/call/:receiverId", protectRoute, logCall);

// Direct Messages
router.get("/:otherUserId", protectRoute, getMessages);
router.post("/send/:receiverId", protectRoute, sendMessage);
router.delete("/:messageId", protectRoute, deleteMessage);

export default router;
