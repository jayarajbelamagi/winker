import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import CallSession from "../models/call.model.js";
import Notification from "../models/notification.model.js";
import { v2 as cloudinary } from "cloudinary";

// Helper: Internal call logger to DB
const logCallInternal = async (senderId, receiverId, { callType, duration = 0, status = "completed" }) => {
	try {
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
	} catch (err) {
		console.error("Error logging call internally:", err);
	}
};

// Helper: Check if two users are mutual followers (Supports ObjectIds OR usernames)
export const checkMutualFollow = async (userId1, userId2) => {
	const user1 = mongoose.isValidObjectId(userId1)
		? await User.findById(userId1)
		: await User.findOne({ username: userId1 });
	const user2 = mongoose.isValidObjectId(userId2)
		? await User.findById(userId2)
		: await User.findOne({ username: userId2 });

	if (!user1 || !user2) return { isMutual: false, user1, user2 };

	const u1Id = user1._id.toString();
	const u2Id = user2._id.toString();

	const u1FollowsU2 =
		user1.following?.some((id) => (id?._id || id)?.toString() === u2Id) ||
		user2.followers?.some((id) => (id?._id || id)?.toString() === u1Id);
	const u2FollowsU1 =
		user2.following?.some((id) => (id?._id || id)?.toString() === u1Id) ||
		user1.followers?.some((id) => (id?._id || id)?.toString() === u2Id);

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

// DELETE A DIRECT MESSAGE
export const deleteMessage = async (req, res) => {
	try {
		const { messageId } = req.params;
		const currentUserId = req.user._id.toString();

		const message = await Message.findById(messageId);
		if (!message) {
			return res.status(404).json({ error: "Message not found" });
		}

		// Only the sender or receiver of this message can delete it
		if (
			message.senderId.toString() !== currentUserId &&
			message.receiverId.toString() !== currentUserId
		) {
			return res.status(403).json({ error: "Not authorized to delete this message" });
		}

		// Remove message reference from conversation
		await Conversation.updateOne(
			{ messages: messageId },
			{ $pull: { messages: messageId } }
		);

		// If conversation's lastMessage was this message, update lastMessage
		const conversation = await Conversation.findOne({
			participants: { $all: [message.senderId, message.receiverId] },
		}).populate({
			path: "messages",
			options: { sort: { createdAt: -1 }, limit: 1 },
		});

		if (conversation) {
			const remainingLast = conversation.messages?.[0];
			if (remainingLast) {
				conversation.lastMessage = {
					text: remainingLast.text || (remainingLast.img ? "Photo" : ""),
					senderId: remainingLast.senderId,
					seen: remainingLast.seen,
					createdAt: remainingLast.createdAt,
				};
			} else {
				conversation.lastMessage = {
					text: "",
					senderId: null,
					seen: true,
					createdAt: new Date(),
				};
			}
			await conversation.save();
		}

		await Message.findByIdAndDelete(messageId);

		res.status(200).json({ success: true, messageId });
	} catch (error) {
		console.error("Error in deleteMessage:", error);
		res.status(500).json({ error: "Failed to delete message" });
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

		if (!isMutual || !user2) {
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

		// Auto-cancel any existing active calls by this caller
		await CallSession.updateMany(
			{
				callerId: req.user._id,
				status: { $in: ["ringing", "connected"] },
			},
			{
				$set: { status: "ended", endedAt: Date.now() },
			}
		);

		// Clean up any stale ringing calls (> 45s) for the receiver
		await CallSession.updateMany(
			{
				receiverId: user2._id,
				status: "ringing",
				startedAt: { $lt: Date.now() - 45000 },
			},
			{
				$set: { status: "missed", endedAt: Date.now() },
			}
		);

		const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
		const newCall = await CallSession.create({
			callId,
			callerId: req.user._id,
			receiverId: user2._id,
			caller: {
				_id: senderId,
				fullName: req.user.fullName,
				username: req.user.username,
				profileImg: req.user.profileImg || "/avatar-placeholder.png",
			},
			receiver: {
				_id: user2._id.toString(),
				fullName: user2.fullName,
				username: user2.username,
				profileImg: user2.profileImg || "/avatar-placeholder.png",
			},
			callType: callType === "video" ? "video" : "audio",
			status: "ringing",
			startedAt: Date.now(),
		});

		// Create real-time notification for receiver
		await new Notification({
			from: req.user._id,
			to: user2._id,
			type: "call",
		}).save().catch(() => {});

		res.status(200).json({ call: newCall });
	} catch (error) {
		console.error("Error in initiateCall:", error);
		res.status(500).json({ error: error.message || "Failed to initiate call" });
	}
};

// GET ACTIVE CALL FOR LOGGED IN USER (RECEIVER OR CALLER)
export const getActiveCall = async (req, res) => {
	try {
		const userIdStr = req.user._id.toString();

		// Clean up stale ringing calls (> 45s)
		await CallSession.updateMany(
			{
				status: "ringing",
				startedAt: { $lt: Date.now() - 45000 },
			},
			{
				$set: { status: "missed", endedAt: Date.now() },
			}
		);

		// 1. Look for active ringing or connected call (matched by ObjectId or String ID)
		let call = await CallSession.findOne({
			$or: [
				{ receiverId: req.user._id },
				{ "receiver._id": userIdStr },
				{ callerId: req.user._id },
				{ "caller._id": userIdStr },
			],
			status: { $in: ["ringing", "connected"] },
		}).sort({ createdAt: -1 });

		// 2. If no active ringing/connected call, check if there was a call ended/declined/missed within the last 8 seconds
		if (!call) {
			call = await CallSession.findOne({
				$or: [
					{ receiverId: req.user._id },
					{ "receiver._id": userIdStr },
					{ callerId: req.user._id },
					{ "caller._id": userIdStr },
				],
				status: { $in: ["declined", "ended", "missed"] },
				endedAt: { $gt: Date.now() - 8000 },
			}).sort({ endedAt: -1 });
		}

		res.status(200).json({ activeCall: call || null });
	} catch (error) {
		console.error("Error in getActiveCall:", error);
		res.status(500).json({ error: "Failed to check active call" });
	}
};

// GET SPECIFIC CALL STATUS
export const getCallStatus = async (req, res) => {
	try {
		const { callId } = req.params;
		const call = await CallSession.findOne({ callId });

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

		const call = await CallSession.findOne({ callId });
		if (!call) {
			return res.status(404).json({ error: "Call no longer available or ended" });
		}

		if (call.receiver._id !== userId && call.receiverId.toString() !== userId) {
			return res.status(403).json({ error: "Only the recipient can answer this call" });
		}

		call.status = "connected";
		call.connectedAt = Date.now();
		await call.save();

		res.status(200).json({ call });
	} catch (error) {
		console.error("Error in answerCall:", error);
		res.status(500).json({ error: "Failed to answer call" });
	}
};

// DECLINE INCOMING CALL (RECEIVER)
export const declineCall = async (req, res) => {
	try {
		const { callId } = req.params;

		const call = await CallSession.findOne({ callId });
		if (!call) {
			return res.status(200).json({ success: true, message: "Call already closed" });
		}

		call.status = "declined";
		call.endedAt = Date.now();
		await call.save();

		await logCallInternal(call.callerId, call.receiverId, {
			callType: call.callType,
			status: "declined",
			duration: 0,
		}).catch(() => {});

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

		const call = await CallSession.findOne({ callId });
		if (!call) {
			return res.status(200).json({ success: true, duration: 0 });
		}

		const isCaller = call.caller._id === userId || call.callerId.toString() === userId;
		const isReceiver = call.receiver._id === userId || call.receiverId.toString() === userId;

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
		await call.save();

		await logCallInternal(call.callerId, call.receiverId, {
			callType: call.callType,
			status: wasConnected ? "completed" : "missed",
			duration,
		}).catch(() => {});

		// Create missed call notification for receiver if never connected
		if (!wasConnected) {
			await new Notification({
				from: call.callerId,
				to: call.receiverId,
				type: "missed_call",
			}).save().catch(() => {});
		}

		res.status(200).json({ success: true, duration });
	} catch (error) {
		console.error("Error in endCall:", error);
		res.status(500).json({ error: "Failed to end call" });
	}
};

// SIGNAL EXCHANGE FOR WEBRTC (OFFER / ANSWER / ICE)
export const exchangeSignal = async (req, res) => {
	try {
		const { callId } = req.params;
		const { senderType, signalData, candidate } = req.body; // senderType: "caller" | "receiver"

		const update = {};
		if (signalData) {
			if (senderType === "caller") update.callerSignal = signalData;
			else if (senderType === "receiver") update.receiverSignal = signalData;
		}

		const push = {};
		if (candidate) {
			if (senderType === "caller") push.callerCandidates = candidate;
			else if (senderType === "receiver") push.receiverCandidates = candidate;
		}

		const updateOp = {};
		if (Object.keys(update).length > 0) updateOp.$set = update;
		if (Object.keys(push).length > 0) updateOp.$push = push;

		if (Object.keys(updateOp).length === 0) {
			return res.status(200).json({ success: true });
		}

		const call = await CallSession.findOneAndUpdate({ callId }, updateOp, { new: true });
		if (!call) return res.status(404).json({ error: "Call not found" });

		res.status(200).json({ success: true });
	} catch (error) {
		console.error("Error in exchangeSignal:", error);
		res.status(500).json({ error: "Failed to exchange signal" });
	}
};

export const getSignal = async (req, res) => {
	try {
		const { callId } = req.params;
		const call = await CallSession.findOne({ callId });
		if (!call) return res.status(404).json({ error: "Call not found" });

		res.status(200).json({
			callerSignal: call.callerSignal,
			receiverSignal: call.receiverSignal,
			callerCandidates: call.callerCandidates || [],
			receiverCandidates: call.receiverCandidates || [],
		});
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch signal" });
	}
};

// GET CALL HISTORY FOR LOGGED IN USER
export const getCallHistory = async (req, res) => {
	try {
		const userId = req.user._id;

		const callMessages = await Message.find({
			$or: [{ senderId: userId }, { receiverId: userId }],
			"callInfo.callType": { $in: ["audio", "video"] },
		})
			.sort({ createdAt: -1 })
			.populate("senderId", "fullName username profileImg")
			.populate("receiverId", "fullName username profileImg")
			.limit(60);

		const formatted = callMessages
			.filter((msg) => msg.senderId && msg.receiverId)
			.map((msg) => {
				const isOutgoing = msg.senderId?._id?.toString() === userId.toString();
				const partner = isOutgoing ? msg.receiverId : msg.senderId;

				let direction = isOutgoing ? "outgoing" : "incoming";
				if (msg.callInfo?.status === "missed") {
					direction = isOutgoing ? "outgoing_missed" : "missed";
				} else if (msg.callInfo?.status === "declined") {
					direction = isOutgoing ? "outgoing_declined" : "declined";
				}

				return {
					_id: msg._id,
					partner,
					callType: msg.callInfo?.callType || "audio",
					status: msg.callInfo?.status || "completed",
					duration: msg.callInfo?.duration || 0,
					direction,
					createdAt: msg.createdAt,
				};
			});

		res.status(200).json(formatted);
	} catch (error) {
		console.error("Error in getCallHistory:", error);
		res.status(500).json({ error: "Failed to fetch call history" });
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
