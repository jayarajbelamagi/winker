import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import CallSession from "../models/call.model.js";
import Notification from "../models/notification.model.js";
import { v2 as cloudinary } from "cloudinary";

// HELPER: Update streak on text/call interaction
export const recordStreakInteraction = (conversation, userId) => {
	if (!conversation) return;
	if (!conversation.streak) {
		conversation.streak = { count: 0, lastInteractionAt: null, lastBumpedAt: null, lastInteractionUser: null };
	}

	const now = new Date();
	const lastAt = conversation.streak.lastInteractionAt ? new Date(conversation.streak.lastInteractionAt) : null;
	const lastBump = conversation.streak.lastBumpedAt ? new Date(conversation.streak.lastBumpedAt) : null;

	if (!lastAt || !conversation.streak.count || conversation.streak.count === 0) {
		// First interaction or restarted streak
		conversation.streak.count = 1;
		conversation.streak.lastInteractionAt = now;
		conversation.streak.lastBumpedAt = now;
		conversation.streak.lastInteractionUser = userId;
		return;
	}

	const diffLastHours = (now.getTime() - lastAt.getTime()) / (1000 * 60 * 60);
	const diffBumpHours = lastBump ? (now.getTime() - lastBump.getTime()) / (1000 * 60 * 60) : diffLastHours;

	if (diffLastHours > 36) {
		// Inactive for more than 36 hours: streak expired -> reset to 1
		conversation.streak.count = 1;
		conversation.streak.lastInteractionAt = now;
		conversation.streak.lastBumpedAt = now;
		conversation.streak.lastInteractionUser = userId;
	} else if (diffBumpHours >= 20 || diffLastHours >= 24) {
		// New 24h streak cycle (or saved within the 12h warning window!) -> increment count
		conversation.streak.count += 1;
		conversation.streak.lastInteractionAt = now;
		conversation.streak.lastBumpedAt = now;
		conversation.streak.lastInteractionUser = userId;
	} else {
		// Ongoing interaction within same 24h block -> extend lastInteractionAt
		conversation.streak.lastInteractionAt = now;
		conversation.streak.lastInteractionUser = userId;
	}
};

// HELPER: Compute live streak status for client display
export const computeStreakInfo = (streak) => {
	if (!streak || !streak.count || !streak.lastInteractionAt) {
		return { count: 0, status: "none", hoursRemaining: 0, isExpiring: false };
	}

	const now = Date.now();
	const diffMs = now - new Date(streak.lastInteractionAt).getTime();
	const diffHours = diffMs / (1000 * 60 * 60);

	if (diffHours > 36) {
		return { count: 0, status: "expired", hoursRemaining: 0, isExpiring: false };
	}

	if (diffHours > 24) {
		// Within the 12-hour warning window (Hour 24 to 36)
		const hoursRemaining = Math.max(1, Math.ceil(36 - diffHours));
		return {
			count: streak.count,
			status: "expiring",
			hoursRemaining,
			isExpiring: true,
			lastInteractionAt: streak.lastInteractionAt,
		};
	}

	// Active streak (within 24 hours)
	const hoursUntilWarning = Math.max(1, Math.ceil(24 - diffHours));
	return {
		count: streak.count,
		status: "active",
		hoursRemaining: hoursUntilWarning,
		isExpiring: false,
		lastInteractionAt: streak.lastInteractionAt,
	};
};

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
		recordStreakInteraction(conversation, senderId);
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
		const {
			text,
			img: imgBase64,
			audio: audioBase64,
			audioDuration = 0,
			mediaType,
			isViewOnce = false,
			callInfo,
		} = req.body;

		if (senderId.toString() === receiverId.toString()) {
			return res.status(400).json({ error: "You cannot message yourself" });
		}

		if (!text?.trim() && !imgBase64 && !audioBase64 && !callInfo) {
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
		let audioUrl = null;
		let detectedMediaType = mediaType || (audioBase64 ? "audio" : "text");

		if (audioBase64) {
			try {
				if (audioBase64.startsWith("data:audio/") || audioBase64.startsWith("http")) {
					const uploadRes = await cloudinary.uploader.upload(audioBase64, {
						folder: "winker_audio",
						resource_type: "video",
					});
					audioUrl = uploadRes.secure_url;
					detectedMediaType = "audio";
				} else {
					audioUrl = audioBase64;
					detectedMediaType = "audio";
				}
			} catch (cloudErr) {
				console.error("Audio upload error in sendMessage:", cloudErr.message);
			}
		}

		if (imgBase64) {
			try {
				const isVid = imgBase64.startsWith("data:video/");
				detectedMediaType = isVid ? "video" : "image";
				if (imgBase64.startsWith("data:") || imgBase64.startsWith("http")) {
					const uploadRes = await cloudinary.uploader.upload(imgBase64, {
						folder: "winker_dms",
						resource_type: isVid ? "video" : "image",
					});
					imgUrl = uploadRes.secure_url;
				} else {
					imgUrl = imgBase64;
				}
			} catch (cloudErr) {
				console.error("DM media upload error:", cloudErr.message);
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
			text:
				text?.trim() ||
				(callInfo
					? `${callInfo.callType === "video" ? "📹 Video call" : "📞 Voice call"} (${callInfo.status || "ended"})`
					: ""),
			img: imgUrl,
			audio: audioUrl,
			audioDuration: Number(audioDuration) || 0,
			mediaType: detectedMediaType,
			isViewOnce: Boolean(isViewOnce),
			status: "delivered",
			callInfo: callInfo || undefined,
			seen: false,
			seenAt: null,
		});

		await newMessage.save();

		// Update conversation
		conversation.messages.push(newMessage._id);
		conversation.lastMessage = {
			text:
				newMessage.text ||
				(audioUrl
					? "🎤 Voice message"
					: isViewOnce
					? "1️⃣ View once media"
					: imgUrl
					? detectedMediaType === "video"
						? "📹 Video"
						: "📷 Photo"
					: ""),
			senderId,
			seen: false,
			createdAt: new Date(),
		};
		recordStreakInteraction(conversation, senderId);
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

		// Automatically mark incoming unread messages as SEEN and READ
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
					$set: { seen: true, seenAt: now, status: "read" },
				}
			);

			if (
				conversation.lastMessage?.senderId?.toString() === otherUserId.toString() &&
				!conversation.lastMessage.seen
			) {
				conversation.lastMessage.seen = true;
				await conversation.save();
			}
		}

		// Re-fetch with updated flags and populated reactions
		const updatedMessages = await Message.find({
			_id: { $in: conversation.messages },
		})
			.populate("reactions.user", "fullName username profileImg")
			.sort({ createdAt: 1 });

		res.status(200).json(updatedMessages);
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

		// Format conversations (handling 1-on-1 chats and groups, with pinned priority)
		const formatted = conversations
			.map((conv) => {
				const isPinned = Boolean(
					conv.pinnedBy?.some((id) => id.toString() === currentUserId.toString())
				);

				if (conv.isGroup) {
					return {
						_id: conv._id,
						isGroup: true,
						isPinned,
						groupName: conv.groupName || "Unnamed Group",
						groupImg: conv.groupImg || "",
						groupDescription: conv.groupDescription || "",
						groupAdmin: conv.groupAdmin,
						participants: conv.participants,
						lastMessage: conv.lastMessage,
						updatedAt: conv.updatedAt,
						streak: null,
					};
				}

				const otherParticipant =
					conv.participants.find(
						(p) => p._id.toString() !== currentUserId.toString()
					) || {};

				return {
					_id: conv._id,
					isGroup: false,
					isPinned,
					otherUser: otherParticipant,
					participants: conv.participants,
					lastMessage: conv.lastMessage,
					updatedAt: conv.updatedAt,
					streak: computeStreakInfo(conv.streak),
				};
			})
			.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

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

		// Auto-cancel any existing active calls involving this user
		await CallSession.updateMany(
			{
				$or: [
					{ callerId: req.user._id },
					{ receiverId: req.user._id },
				],
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

		// 1. Look for active ringing or connected call (matched by ObjectId, String ID, or group participant)
		let call = await CallSession.findOne({
			$or: [
				{ receiverId: req.user._id },
				{ "receiver._id": userIdStr },
				{ callerId: req.user._id },
				{ "caller._id": userIdStr },
				{ participantIds: req.user._id },
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
					{ participantIds: req.user._id },
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

// ANSWER INCOMING CALL (RECEIVER OR GROUP PARTICIPANT)
export const answerCall = async (req, res) => {
	try {
		const userId = req.user._id.toString();
		const { callId } = req.params;

		const call = await CallSession.findOne({ callId });
		if (!call) {
			return res.status(404).json({ error: "Call no longer available or ended" });
		}

		const isReceiver =
			(call.receiver && call.receiver._id === userId) ||
			(call.receiverId && call.receiverId.toString() === userId);
		const isParticipant =
			call.isGroupCall &&
			call.participantIds?.some((id) => id?.toString() === userId);

		if (!isReceiver && !isParticipant) {
			return res.status(403).json({ error: "Only the recipient or participant can answer this call" });
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

		if (call.callerId && call.receiverId) {
			await logCallInternal(call.callerId, call.receiverId, {
				callType: call.callType,
				status: "declined",
				duration: 0,
			}).catch(() => {});
		}

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

		const isCaller = call.caller?._id === userId || call.callerId?.toString() === userId;
		const isReceiver = call.receiver?._id === userId || call.receiverId?.toString() === userId;
		const isParticipant =
			call.isGroupCall &&
			call.participantIds?.some((id) => id?.toString() === userId);

		if (!isCaller && !isReceiver && !isParticipant) {
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

		if (call.callerId && call.receiverId && !call.isGroupCall) {
			await logCallInternal(call.callerId, call.receiverId, {
				callType: call.callType,
				status: wasConnected ? "completed" : "missed",
				duration,
			}).catch(() => {});
		}

		// Create missed call notification for receiver if never connected
		if (!wasConnected && call.callerId && call.receiverId && !call.isGroupCall) {
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
		const { senderType, signalData, candidate, candidates } = req.body; // senderType: "caller" | "receiver"

		const update = {};
		if (signalData) {
			if (senderType === "caller") update.callerSignal = signalData;
			else if (senderType === "receiver") update.receiverSignal = signalData;
		}

		const push = {};
		const candidateList = candidates || (candidate ? [candidate] : []);
		if (candidateList.length > 0) {
			if (senderType === "caller") push.callerCandidates = { $each: candidateList };
			else if (senderType === "receiver") push.receiverCandidates = { $each: candidateList };
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

// ==========================================
// GROUP CHAT & GROUP CALLING METHODS (WHATSAPP STYLE)
// ==========================================

// CREATE GROUP CHAT
export const createGroup = async (req, res) => {
	try {
		const currentUserId = req.user._id;
		const { groupName, memberIds = [], groupImgBase64, groupDescription = "" } = req.body;

		if (!groupName || !groupName.trim()) {
			return res.status(400).json({ error: "Group name is required" });
		}

		if (!Array.isArray(memberIds) || memberIds.length === 0) {
			return res.status(400).json({ error: "Please select at least one member to add to the group" });
		}

		// Ensure current user is in participants and eliminate duplicates
		const participantsSet = new Set([currentUserId.toString(), ...memberIds.map((id) => id.toString())]);
		const participants = Array.from(participantsSet);

		let groupImg = "";
		if (groupImgBase64) {
			try {
				if (groupImgBase64.startsWith("data:image/") || groupImgBase64.startsWith("http")) {
					const uploadRes = await cloudinary.uploader.upload(groupImgBase64, {
						folder: "winker_groups",
						resource_type: "image",
					});
					groupImg = uploadRes.secure_url;
				} else {
					groupImg = groupImgBase64;
				}
			} catch (cloudErr) {
				console.error("Group image upload error:", cloudErr.message);
			}
		}

		// Create group conversation
		const conversation = new Conversation({
			participants,
			isGroup: true,
			groupName: groupName.trim(),
			groupImg,
			groupDescription: groupDescription.trim(),
			groupAdmin: currentUserId,
			messages: [],
		});

		// Create system initial message
		const initialMessage = new Message({
			senderId: currentUserId,
			conversationId: conversation._id,
			isGroupMessage: true,
			isSystem: true,
			text: `${req.user.fullName} created group "${groupName.trim()}"`,
			seen: true,
		});
		await initialMessage.save();

		conversation.messages.push(initialMessage._id);
		conversation.lastMessage = {
			text: initialMessage.text,
			senderId: currentUserId,
			seen: true,
			createdAt: new Date(),
		};

		await conversation.save();

		const populatedConv = await Conversation.findById(conversation._id)
			.populate("participants", "fullName username profileImg")
			.populate("groupAdmin", "fullName username profileImg");

		res.status(201).json(populatedConv);
	} catch (error) {
		console.error("Error in createGroup:", error);
		res.status(500).json({ error: error.message || "Failed to create group" });
	}
};

// GET GROUP DETAILS
export const getGroupDetails = async (req, res) => {
	try {
		const { conversationId } = req.params;
		const currentUserId = req.user._id.toString();

		const conversation = await Conversation.findOne({
			_id: conversationId,
			isGroup: true,
			participants: currentUserId,
		})
			.populate("participants", "fullName username profileImg bio")
			.populate("groupAdmin", "fullName username profileImg");

		if (!conversation) {
			return res.status(404).json({ error: "Group not found or you are not a member" });
		}

		res.status(200).json(conversation);
	} catch (error) {
		console.error("Error in getGroupDetails:", error);
		res.status(500).json({ error: "Failed to fetch group details" });
	}
};

// GET GROUP MESSAGES
export const getGroupMessages = async (req, res) => {
	try {
		const { conversationId } = req.params;
		const currentUserId = req.user._id.toString();

		const conversation = await Conversation.findOne({
			_id: conversationId,
			isGroup: true,
			participants: currentUserId,
		}).populate({
			path: "messages",
			options: { sort: { createdAt: 1 } },
			populate: [
				{
					path: "senderId",
					select: "fullName username profileImg",
				},
				{
					path: "reactions.user",
					select: "fullName username profileImg",
				},
			],
		});

		if (!conversation) {
			return res.status(404).json({ error: "Group not found or you are not a member" });
		}

		res.status(200).json(conversation.messages || []);
	} catch (error) {
		console.error("Error in getGroupMessages:", error);
		res.status(500).json({ error: "Failed to fetch group messages" });
	}
};

// SEND GROUP MESSAGE
export const sendGroupMessage = async (req, res) => {
	try {
		const currentUserId = req.user._id;
		const { conversationId } = req.params;
		const {
			text,
			img: imgBase64,
			audio: audioBase64,
			audioDuration = 0,
			mediaType,
			isViewOnce = false,
			callInfo,
		} = req.body;

		const conversation = await Conversation.findOne({
			_id: conversationId,
			isGroup: true,
			participants: currentUserId,
		});

		if (!conversation) {
			return res.status(404).json({ error: "Group not found or you are not a member" });
		}

		let imgUrl = null;
		let audioUrl = null;
		let detectedMediaType = mediaType || (audioBase64 ? "audio" : "text");

		if (audioBase64) {
			try {
				if (audioBase64.startsWith("data:audio/") || audioBase64.startsWith("http")) {
					const uploadRes = await cloudinary.uploader.upload(audioBase64, {
						folder: "winker_audio",
						resource_type: "video",
					});
					audioUrl = uploadRes.secure_url;
					detectedMediaType = "audio";
				} else {
					audioUrl = audioBase64;
					detectedMediaType = "audio";
				}
			} catch (cloudErr) {
				console.error("Group audio upload error:", cloudErr.message);
			}
		}

		if (imgBase64) {
			try {
				const isVid = imgBase64.startsWith("data:video/");
				detectedMediaType = isVid ? "video" : "image";
				if (imgBase64.startsWith("data:") || imgBase64.startsWith("http")) {
					const uploadRes = await cloudinary.uploader.upload(imgBase64, {
						folder: "winker_dms",
						resource_type: isVid ? "video" : "image",
					});
					imgUrl = uploadRes.secure_url;
				} else {
					imgUrl = imgBase64;
				}
			} catch (cloudErr) {
				console.error("Group image upload error:", cloudErr.message);
			}
		}

		const newMessage = new Message({
			senderId: currentUserId,
			conversationId: conversation._id,
			isGroupMessage: true,
			text:
				text?.trim() ||
				(callInfo
					? `${callInfo.callType === "video" ? "📹 Group video call" : "📞 Group voice call"}`
					: ""),
			img: imgUrl,
			audio: audioUrl,
			audioDuration: Number(audioDuration) || 0,
			mediaType: detectedMediaType,
			isViewOnce: Boolean(isViewOnce),
			status: "delivered",
			callInfo: callInfo || undefined,
			seen: false,
		});

		await newMessage.save();

		conversation.messages.push(newMessage._id);
		conversation.lastMessage = {
			text:
				newMessage.text ||
				(audioUrl
					? "🎤 Voice message"
					: isViewOnce
					? "1️⃣ View once media"
					: imgUrl
					? detectedMediaType === "video"
						? "📹 Video"
						: "📷 Photo"
					: ""),
			senderId: currentUserId,
			seen: false,
			createdAt: new Date(),
		};
		await conversation.save();

		const populatedMsg = await Message.findById(newMessage._id)
			.populate("senderId", "fullName username profileImg")
			.populate("reactions.user", "fullName username profileImg");

		res.status(201).json(populatedMsg);
	} catch (error) {
		console.error("Error in sendGroupMessage:", error);
		res.status(500).json({ error: error.message || "Failed to send group message" });
	}
};

// ADD MEMBERS TO GROUP
export const addGroupMembers = async (req, res) => {
	try {
		const currentUserId = req.user._id.toString();
		const { conversationId } = req.params;
		const { newMemberIds = [] } = req.body;

		const conversation = await Conversation.findOne({
			_id: conversationId,
			isGroup: true,
			participants: currentUserId,
		});

		if (!conversation) {
			return res.status(404).json({ error: "Group not found or you are not a member" });
		}

		const existing = new Set(conversation.participants.map((p) => p.toString()));
		const toAdd = newMemberIds.filter((id) => !existing.has(id.toString()));

		if (toAdd.length === 0) {
			return res.status(400).json({ error: "Selected users are already in the group" });
		}

		toAdd.forEach((id) => conversation.participants.push(id));

		const addedUsers = await User.find({ _id: { $in: toAdd } }).select("fullName");
		const names = addedUsers.map((u) => u.fullName).join(", ");

		const sysMsg = new Message({
			senderId: currentUserId,
			conversationId: conversation._id,
			isGroupMessage: true,
			isSystem: true,
			text: `${req.user.fullName} added ${names}`,
			seen: true,
		});
		await sysMsg.save();

		conversation.messages.push(sysMsg._id);
		conversation.lastMessage = {
			text: sysMsg.text,
			senderId: currentUserId,
			seen: true,
			createdAt: new Date(),
		};
		await conversation.save();

		const updatedConv = await Conversation.findById(conversation._id)
			.populate("participants", "fullName username profileImg bio")
			.populate("groupAdmin", "fullName username profileImg");

		res.status(200).json(updatedConv);
	} catch (error) {
		console.error("Error in addGroupMembers:", error);
		res.status(500).json({ error: "Failed to add group members" });
	}
};

// LEAVE GROUP
export const leaveGroup = async (req, res) => {
	try {
		const currentUserId = req.user._id.toString();
		const { conversationId } = req.params;

		const conversation = await Conversation.findOne({
			_id: conversationId,
			isGroup: true,
			participants: currentUserId,
		});

		if (!conversation) {
			return res.status(404).json({ error: "Group not found or you are not a member" });
		}

		conversation.participants = conversation.participants.filter(
			(p) => p.toString() !== currentUserId
		);

		// If admin leaves, transfer admin to another member if any left
		if (conversation.groupAdmin?.toString() === currentUserId && conversation.participants.length > 0) {
			conversation.groupAdmin = conversation.participants[0];
		}

		const sysMsg = new Message({
			senderId: req.user._id,
			conversationId: conversation._id,
			isGroupMessage: true,
			isSystem: true,
			text: `${req.user.fullName} left the group`,
			seen: true,
		});
		await sysMsg.save();

		conversation.messages.push(sysMsg._id);
		conversation.lastMessage = {
			text: sysMsg.text,
			senderId: req.user._id,
			seen: true,
			createdAt: new Date(),
		};
		await conversation.save();

		res.status(200).json({ success: true, message: "Left group successfully" });
	} catch (error) {
		console.error("Error in leaveGroup:", error);
		res.status(500).json({ error: "Failed to leave group" });
	}
};

// INITIATE GROUP CALL (VOICE OR VIDEO)
export const initiateGroupCall = async (req, res) => {
	try {
		const currentUserId = req.user._id;
		const { conversationId } = req.params;
		const { callType = "audio" } = req.body;

		const conversation = await Conversation.findOne({
			_id: conversationId,
			isGroup: true,
			participants: currentUserId,
		}).populate("participants", "fullName username profileImg");

		if (!conversation) {
			return res.status(404).json({ error: "Group not found or you are not a member" });
		}

		// Cancel any existing active calls involving this caller
		await CallSession.updateMany(
			{
				$or: [
					{ callerId: currentUserId },
					{ receiverId: currentUserId },
				],
				status: { $in: ["ringing", "connected"] },
			},
			{
				$set: { status: "ended", endedAt: Date.now() },
			}
		);

		const otherParticipants = conversation.participants.filter(
			(p) => p._id.toString() !== currentUserId.toString()
		);

		const callId = `call_grp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
		const newCall = await CallSession.create({
			callId,
			callerId: currentUserId,
			receiverId: otherParticipants[0]?._id || currentUserId,
			isGroupCall: true,
			groupName: conversation.groupName,
			conversationId: conversation._id,
			participantIds: conversation.participants.map((p) => p._id),
			caller: {
				_id: currentUserId.toString(),
				fullName: req.user.fullName,
				username: req.user.username,
				profileImg: req.user.profileImg || "/avatar-placeholder.png",
			},
			receiver: {
				_id: conversation._id.toString(),
				fullName: conversation.groupName,
				username: "group",
				profileImg: conversation.groupImg || "/avatar-placeholder.png",
			},
			callType: callType === "video" ? "video" : "audio",
			status: "ringing",
			startedAt: Date.now(),
		});

		// Create notifications for group members
		const notifs = otherParticipants.map((p) => ({
			from: currentUserId,
			to: p._id,
			type: "call",
		}));
		await Notification.insertMany(notifs).catch(() => {});

		// Log call message in group chat
		const logMsg = new Message({
			senderId: currentUserId,
			conversationId: conversation._id,
			isGroupMessage: true,
			text: `${callType === "video" ? "📹 Group video call" : "📞 Group voice call"} started by ${req.user.fullName}`,
			callInfo: {
				callType,
				status: "started",
				isGroupCall: true,
				groupName: conversation.groupName,
			},
			seen: true,
		});
		await logMsg.save();

		conversation.messages.push(logMsg._id);
		conversation.lastMessage = {
			text: logMsg.text,
			senderId: currentUserId,
			seen: true,
			createdAt: new Date(),
		};
		await conversation.save();

		res.status(200).json({ call: newCall });
	} catch (error) {
		console.error("Error in initiateGroupCall:", error);
		res.status(500).json({ error: error.message || "Failed to initiate group call" });
	}
};

// REACT TO MESSAGE (EMOJI REACTION)
export const reactToMessage = async (req, res) => {
	try {
		const { messageId } = req.params;
		const { emoji } = req.body;
		const userId = req.user._id;

		if (!emoji) return res.status(400).json({ error: "Emoji is required" });

		const message = await Message.findById(messageId);
		if (!message) return res.status(404).json({ error: "Message not found" });

		if (!message.reactions) message.reactions = [];

		const existingIndex = message.reactions.findIndex(
			(r) => r.user.toString() === userId.toString()
		);

		if (existingIndex > -1) {
			if (message.reactions[existingIndex].emoji === emoji) {
				// Toggle off if same emoji tapped
				message.reactions.splice(existingIndex, 1);
			} else {
				// Update to new emoji
				message.reactions[existingIndex].emoji = emoji;
			}
		} else {
			message.reactions.push({ user: userId, emoji });
		}

		await message.save();
		const updated = await Message.findById(messageId).populate(
			"reactions.user",
			"fullName username profileImg"
		);
		res.status(200).json(updated.reactions);
	} catch (error) {
		console.error("Error in reactToMessage:", error);
		res.status(500).json({ error: "Failed to react to message" });
	}
};

// MARK VIEW ONCE MESSAGE AS OPENED
export const markViewOnceOpened = async (req, res) => {
	try {
		const { messageId } = req.params;
		const userId = req.user._id;

		const message = await Message.findById(messageId);
		if (!message) return res.status(404).json({ error: "Message not found" });

		if (!message.isViewOnce) return res.status(400).json({ error: "Not a view once message" });

		if (!message.viewedBy) message.viewedBy = [];
		if (!message.viewedBy.some((id) => id.toString() === userId.toString())) {
			message.viewedBy.push(userId);
			await message.save();
		}

		res.status(200).json({ success: true, messageId });
	} catch (error) {
		console.error("Error in markViewOnceOpened:", error);
		res.status(500).json({ error: "Failed to update view once status" });
	}
};

// TOGGLE PIN CONVERSATION
export const togglePinConversation = async (req, res) => {
	try {
		const { conversationId } = req.params;
		const userId = req.user._id;

		const conversation = await Conversation.findOne({
			_id: conversationId,
			participants: userId,
		});
		if (!conversation) return res.status(404).json({ error: "Conversation not found" });

		if (!conversation.pinnedBy) conversation.pinnedBy = [];
		const isPinned = conversation.pinnedBy.some((id) => id.toString() === userId.toString());

		if (isPinned) {
			conversation.pinnedBy = conversation.pinnedBy.filter(
				(id) => id.toString() !== userId.toString()
			);
		} else {
			conversation.pinnedBy.push(userId);
		}
		await conversation.save();

		res.status(200).json({ success: true, isPinned: !isPinned });
	} catch (error) {
		console.error("Error in togglePinConversation:", error);
		res.status(500).json({ error: "Failed to pin conversation" });
	}
};

// TOGGLE STAR MESSAGE
export const toggleStarMessage = async (req, res) => {
	try {
		const { messageId } = req.params;
		const userId = req.user._id;

		const message = await Message.findById(messageId);
		if (!message) return res.status(404).json({ error: "Message not found" });

		if (!message.starredBy) message.starredBy = [];
		const isStarred = message.starredBy.some((id) => id.toString() === userId.toString());

		if (isStarred) {
			message.starredBy = message.starredBy.filter((id) => id.toString() !== userId.toString());
		} else {
			message.starredBy.push(userId);
		}
		await message.save();

		res.status(200).json({ success: true, isStarred: !isStarred });
	} catch (error) {
		console.error("Error in toggleStarMessage:", error);
		res.status(500).json({ error: "Failed to star message" });
	}
};
