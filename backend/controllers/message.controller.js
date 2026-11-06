import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary";

// Active Call Sessions Registry (in-memory with DB persistence on completion)
// Map: callId -> CallSession
const activeCalls = new Map();

// Helper: Clean expired calls (> 45s ringing without answer or > 4h connected)
const cleanStaleCalls = () => {
	const now = Date.now();
	for (const [callId, call] of activeCalls.entries()) {
		if (call.status === "ringing" && now - call.startedAt > 45000) {
			call.status = "missed";
			call.endedAt = now;
			logCallInternal(call.caller._id, call.receiver._id, {
				callType: call.callType,
				status: "missed",
				duration: 0,
			}).catch(() => {});
			setTimeout(() => activeCalls.delete(callId), 10000);
		} else if (call.status === "ended" || call.status === "declined" || call.status === "missed") {
			if (call.endedAt && now - call.endedAt > 15000) {
				activeCalls.delete(callId);
			}
		} else if (call.status === "connected" && now - call.startedAt > 4 * 60 * 60 * 1000) {
			activeCalls.delete(callId);
		}
	}
};

// Periodically clean stale calls every 30s
setInterval(cleanStaleCalls, 30000);

// Helper: Internal call logger to DB
const logCallInternal = async (senderId, receiverId, { callType, duration = 0, status = "completed" }) => {
	let conversation = await Conversation.findOne({
		participants: { $all: [senderId, receiverId] },
	});

	if (!conversation) {
		conversation = await Conversation.create({
			participants: [senderId, receiverId],
			messages: [],
		});
	}

	const formatDur = (sec) => {
		if (!sec) return "0s";
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return m > 0 ? `${m}m ${s}s` : `${s}s`;
	};

	let statusLabel = status;
	if (status === "completed") {
		statusLabel = formatDur(duration);
	} else if (status === "missed") {
		statusLabel = "Missed call";
	} else if (status === "declined") {
		statusLabel = "Declined";
	}

	const callText = `${callType === "video" ? "📹 Video call" : "📞 Voice call"} (${statusLabel})`;

	const message = new Message({
		senderId,
		receiverId,
		text: callText,
		callInfo: {
			callType: callType || "audio",
			status: status || "completed",
			duration: duration || 0,
		},
		seen: false,
	});

	await message.save();

	conversation.messages.push(message._id);
	conversation.lastMessage = {
		text: callText,
		senderId,
		seen: false,
		createdAt: new Date(),
	};
	await conversation.save();
	return message;
};

// Helper: Check if two users are mutual followers
export const checkMutualFollow = async (userId1, userId2) => {
	const user1 = await User.findById(userId1);
	const user2 = await User.findById(userId2);

	if (!user1 || !user2) return { isMutual: false, user1, user2 };

	const u1FollowsU2 =
		user1.following?.some((id) => id.toString() === userId2.toString()) ||
		user2.followers?.some((id) => id.toString() === userId1.toString());
	const u2FollowsU1 =
		user2.following?.some((id) => id.toString() === userId1.toString()) ||
		user1.followers?.some((id) => id.toString() === userId2.toString());

	return {
		isMutual: Boolean(u1FollowsU2 && u2FollowsU1),
		u1FollowsU2,
		u2FollowsU1,
		user1,
		user2,
	};
};

// SEND DIRECT MESSAGE
export const sendMessage = async (req, res) => {
	try {
		const senderId = req.user._id;
		const { receiverId } = req.params;
		const { text, img: imgBase64, callInfo } = req.body;

		if (senderId.toString() === receiverId.toString()) {
			return res.status(400).json({ error: "You cannot message yourself" });
		}

		if (!text?.trim() && !imgBase64 && !callInfo) {
			return res.status(400).json({ error: "Message text or attachment required" });
		}

		// Enforce mutual follow requirement
		const { isMutual, u1FollowsU2, u2FollowsU1, user2 } = await checkMutualFollow(
			senderId,
			receiverId
		);

		if (!isMutual) {
			if (u1FollowsU2 && !u2FollowsU1) {
				return res.status(403).json({
					error: `You follow @${user2?.username || "this user"}, but they haven't followed you back yet. You can only start texting once both of you follow each other.`,
				});
			} else {
				return res.status(403).json({
					error: "Texting is only permitted between mutual followers (both users must follow each other).",
				});
			}
		}

		let imgUrl = null;
		if (imgBase64) {
			try {
				if (imgBase64.startsWith("data:image/") || imgBase64.startsWith("http")) {
					const uploadRes = await cloudinary.uploader.upload(imgBase64, {
						folder: "winker_dms",
						resource_type: "image",
					});
					imgUrl = uploadRes.secure_url;
				} else {
					imgUrl = imgBase64;
				}
			} catch (cloudErr) {
				console.error("DM image upload error:", cloudErr.message);
			}
		}

		// Find or create conversation
		let conversation = await Conversation.findOne({
			participants: { $all: [senderId, receiverId] },
		});

		if (!conversation) {
			conversation = await Conversation.create({
				participants: [senderId, receiverId],
				messages: [],
			});
		}

		// Create message
		const newMessage = new Message({
			senderId,
			receiverId,
			text: text?.trim() || (callInfo ? `${callInfo.callType === "video" ? "📹 Video call" : "📞 Voice call"} (${callInfo.status || "ended"})` : ""),
			img: imgUrl,
			callInfo: callInfo || undefined,
			seen: false,
			seenAt: null,
		});

		await newMessage.save();

		// Update conversation
		conversation.messages.push(newMessage._id);
		conversation.lastMessage = {
			text: newMessage.text || "Photo",
			senderId,
			seen: false,
			createdAt: new Date(),
		};
		await conversation.save();

		res.status(201).json(newMessage);
	} catch (error) {
		console.error("Error in sendMessage:", error);
		res.status(500).json({ error: error.message || "Failed to send message" });
	}
};

// GET MESSAGES IN CONVERSATION WITH READ RECEIPT UPDATES
export const getMessages = async (req, res) => {
	try {
		const currentUserId = req.user._id;
		const { otherUserId } = req.params;

		const conversation = await Conversation.findOne({
			participants: { $all: [currentUserId, otherUserId] },
		}).populate({
			path: "messages",
			options: { sort: { createdAt: 1 } },
		});

		if (!conversation) {
			return res.status(200).json([]);
		}

		// Automatically mark incoming unread messages as SEEN
		const now = new Date();
		const unreadCount = await Message.countDocuments({
			senderId: otherUserId,
			receiverId: currentUserId,
			seen: false,
		});

		if (unreadCount > 0) {
			await Message.updateMany(
				{
					senderId: otherUserId,
					receiverId: currentUserId,
					seen: false,
				},
				{
					$set: { seen: true, seenAt: now },
				}
			);

			if (
				conversation.lastMessage?.senderId?.toString() === otherUserId.toString() &&
				!conversation.lastMessage.seen
			) {
				conversation.lastMessage.seen = true;
				await conversation.save();
			}

			// Re-fetch with updated seen flags
			const updatedMessages = await Message.find({
				_id: { $in: conversation.messages },
			}).sort({ createdAt: 1 });

			return res.status(200).json(updatedMessages);
		}

		res.status(200).json(conversation.messages);
	} catch (error) {
		console.error("Error in getMessages:", error);
		res.status(500).json({ error: "Failed to load messages" });
	}
};

// GET ALL USER CONVERSATIONS
export const getConversations = async (req, res) => {
	try {
		const currentUserId = req.user._id;

		const conversations = await Conversation.find({
			participants: currentUserId,
		})
			.sort({ updatedAt: -1 })
			.populate("participants", "fullName username profileImg")
			.populate("lastMessage.senderId", "username");

		// Filter out self from each conversation participant list
		const formatted = conversations.map((conv) => {
			const otherParticipant =
				conv.participants.find(
					(p) => p._id.toString() !== currentUserId.toString()
				) || {};

			return {
				_id: conv._id,
				otherUser: otherParticipant,
				lastMessage: conv.lastMessage,
				updatedAt: conv.updatedAt,
			};
		});

		res.status(200).json(formatted);
	} catch (error) {
		console.error("Error in getConversations:", error);
		res.status(500).json({ error: "Failed to fetch conversations" });
	}
};

// GET MUTUAL FOLLOWERS (ELIGIBLE CONTACTS FOR CHAT)
export const getEligibleContacts = async (req, res) => {
	try {
		const currentUserId = req.user._id;
		const user = await User.findById(currentUserId)
			.populate("following", "fullName username profileImg followers")
			.populate("followers", "fullName username profileImg following");

		if (!user) return res.status(404).json({ error: "User not found" });

		const followingSet = new Set(user.following.map((u) => u._id.toString()));
		const followersSet = new Set(user.followers.map((u) => u._id.toString()));

		// Mutual = in both following and followers
		const mutuals = user.following.filter((u) => followersSet.has(u._id.toString()));

		// Following only (awaiting them to follow back)
		const waitingForFollowBack = user.following.filter(
			(u) => !followersSet.has(u._id.toString())
		);

		res.status(200).json({
			mutuals,
			waitingForFollowBack,
		});
	} catch (error) {
		console.error("Error in getEligibleContacts:", error);
		res.status(500).json({ error: "Failed to fetch contacts" });
	}
};

// INITIATE A CALL (CALLER SENDS RING TO RECEIVER)
export const initiateCall = async (req, res) => {
	try {
		cleanStaleCalls();
		const senderId = req.user._id.toString();
		const { receiverId } = req.params;
		const { callType = "audio" } = req.body;

		if (senderId === receiverId) {
			return res.status(400).json({ error: "You cannot call yourself" });
		}

		// Check mutual follow requirement
		const { isMutual, u1FollowsU2, u2FollowsU1, user2 } = await checkMutualFollow(
			senderId,
			receiverId
		);

		if (!isMutual) {
			if (u1FollowsU2 && !u2FollowsU1) {
				return res.status(403).json({
					error: `You follow @${user2?.username || "this user"}, but they haven't followed you back yet. Calling requires mutual follow.`,
				});
			} else {
				return res.status(403).json({
					error: "Calling is only permitted between mutual followers.",
				});
			}
		}

		// Check if receiver is already in a call
		for (const [_, call] of activeCalls.entries()) {
			if (
				(call.receiver._id === receiverId || call.caller._id === receiverId) &&
				(call.status === "ringing" || call.status === "connected")
			) {
				return res.status(400).json({ error: `@${user2.username} is currently on another call` });
			}
		}

		// Clear any old active calls by this sender
		for (const [cId, call] of activeCalls.entries()) {
			if (call.caller._id === senderId && (call.status === "ringing" || call.status === "connected")) {
				call.status = "ended";
				call.endedAt = Date.now();
				setTimeout(() => activeCalls.delete(cId), 5000);
			}
		}

		const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
		const session = {
			callId,
			caller: {
				_id: senderId,
				fullName: req.user.fullName,
				username: req.user.username,
				profileImg: req.user.profileImg || "/avatar-placeholder.png",
			},
			receiver: {
				_id: receiverId,
				fullName: user2.fullName,
				username: user2.username,
				profileImg: user2.profileImg || "/avatar-placeholder.png",
			},
			callType: callType === "video" ? "video" : "audio",
			status: "ringing",
			startedAt: Date.now(),
			connectedAt: null,
			endedAt: null,
		};

		activeCalls.set(callId, session);

		res.status(200).json({ call: session });
	} catch (error) {
		console.error("Error in initiateCall:", error);
		res.status(500).json({ error: "Failed to initiate call" });
	}
};

// GET ACTIVE CALL FOR LOGGED IN USER (RECEIVER OR CALLER)
export const getActiveCall = async (req, res) => {
	try {
		cleanStaleCalls();
		const userId = req.user._id.toString();

		let userCall = null;
		for (const [_, call] of activeCalls.entries()) {
			if (
				(call.receiver._id === userId || call.caller._id === userId) &&
				(call.status === "ringing" || call.status === "connected" || call.status === "declined" || call.status === "ended")
			) {
				userCall = call;
				break;
			}
		}

		res.status(200).json({ activeCall: userCall });
	} catch (error) {
		console.error("Error in getActiveCall:", error);
		res.status(500).json({ error: "Failed to check active call" });
	}
};

// GET SPECIFIC CALL STATUS
export const getCallStatus = async (req, res) => {
	try {
		const { callId } = req.params;
		const call = activeCalls.get(callId);

		if (!call) {
			return res.status(200).json({ call: null, status: "ended" });
		}

		res.status(200).json({ call, status: call.status });
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch call status" });
	}
};

// ANSWER INCOMING CALL (RECEIVER)
export const answerCall = async (req, res) => {
	try {
		const userId = req.user._id.toString();
		const { callId } = req.params;

		const call = activeCalls.get(callId);
		if (!call) {
			return res.status(404).json({ error: "Call no longer available or ended" });
		}

		if (call.receiver._id !== userId) {
			return res.status(403).json({ error: "Only the recipient can answer this call" });
		}

		call.status = "connected";
		call.connectedAt = Date.now();

		res.status(200).json({ call });
	} catch (error) {
		console.error("Error in answerCall:", error);
		res.status(500).json({ error: "Failed to answer call" });
	}
};

// DECLINE INCOMING CALL (RECEIVER)
export const declineCall = async (req, res) => {
	try {
		const userId = req.user._id.toString();
		const { callId } = req.params;

		const call = activeCalls.get(callId);
		if (!call) {
			return res.status(200).json({ success: true, message: "Call already closed" });
		}

		call.status = "declined";
		call.endedAt = Date.now();

		await logCallInternal(call.caller._id, call.receiver._id, {
			callType: call.callType,
			status: "declined",
			duration: 0,
		}).catch(() => {});

		setTimeout(() => activeCalls.delete(callId), 10000);

		res.status(200).json({ call });
	} catch (error) {
		console.error("Error in declineCall:", error);
		res.status(500).json({ error: "Failed to decline call" });
	}
};

// END ACTIVE CALL (EITHER PARTY)
export const endCall = async (req, res) => {
	try {
		const userId = req.user._id.toString();
		const { callId } = req.params;

		const call = activeCalls.get(callId);
		if (!call) {
			return res.status(200).json({ success: true, duration: 0 });
		}

		const isCaller = call.caller._id === userId;
		const isReceiver = call.receiver._id === userId;

		if (!isCaller && !isReceiver) {
			return res.status(403).json({ error: "Not authorized to end this call" });
		}

		const now = Date.now();
		const wasConnected = call.status === "connected" && call.connectedAt;
		const duration = wasConnected
			? Math.max(1, Math.round((now - call.connectedAt) / 1000))
			: 0;

		call.status = "ended";
		call.endedAt = now;

		await logCallInternal(call.caller._id, call.receiver._id, {
			callType: call.callType,
			status: wasConnected ? "completed" : "missed",
			duration,
		}).catch(() => {});

		setTimeout(() => activeCalls.delete(callId), 10000);

		res.status(200).json({ success: true, duration });
	} catch (error) {
		console.error("Error in endCall:", error);
		res.status(500).json({ error: "Failed to end call" });
	}
};

// LOG A CALL (FALLBACK REST ROUTE)
export const logCall = async (req, res) => {
	try {
		const senderId = req.user._id;
		const { receiverId } = req.params;
		const { callType, duration, status } = req.body;

		const message = await logCallInternal(senderId, receiverId, {
			callType,
			duration,
			status,
		});

		res.status(201).json(message);
	} catch (error) {
		console.error("Error in logCall:", error);
		res.status(500).json({ error: "Failed to log call" });
	}
};
