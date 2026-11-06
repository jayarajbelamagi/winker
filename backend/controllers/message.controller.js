import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { v2 as cloudinary } from "cloudinary";

// Helper: Check if two users are mutual followers
export const checkMutualFollow = async (userId1, userId2) => {
	const user1 = await User.findById(userId1);
	const user2 = await User.findById(userId2);

	if (!user1 || !user2) return { isMutual: false, user1, user2 };

	const u1FollowsU2 = user1.following?.some((id) => id.toString() === userId2.toString());
	const u2FollowsU1 = user2.following?.some((id) => id.toString() === userId1.toString());

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

		// Create notification for recipient if not call log
		if (!callInfo) {
			try {
				await new Notification({
					from: senderId,
					to: receiverId,
					type: "follow", // subtle inbox notice
				}).save();
			} catch (e) {}
		}

		res.status(201).json(newMessage);
	} catch (error) {
		console.error("Error in sendMessage:", error);
		res.status(500).json({ error: "Failed to send message" });
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

// LOG A CALL (AUDIO OR VIDEO)
export const logCall = async (req, res) => {
	try {
		const senderId = req.user._id;
		const { receiverId } = req.params;
		const { callType, duration, status } = req.body;

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

		const callText = `${callType === "video" ? "📹 Video call" : "📞 Voice call"} ${
			status === "completed" ? `(${formatDur(duration)})` : `(${status || "ended"})`
		}`;

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

		res.status(201).json(message);
	} catch (error) {
		console.error("Error in logCall:", error);
		res.status(500).json({ error: "Failed to log call" });
	}
};
