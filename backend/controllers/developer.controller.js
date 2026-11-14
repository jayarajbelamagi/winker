import mongoose from "mongoose";
import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import Story from "../models/story.model.js";
import Space from "../models/space.model.js";
import Notification from "../models/notification.model.js";
import ProfileView from "../models/profile_view.model.js";
import CallSession from "../models/call.model.js";

const formatBytes = (bytes, decimals = 2) => {
	if (!bytes || bytes === 0) return "0 B";
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const formatUptime = (seconds) => {
	const days = Math.floor(seconds / (3600 * 24));
	const hours = Math.floor((seconds % (3600 * 24)) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	return `${days}d ${hours}h ${minutes}m ${secs}s`;
};

// Map collection names to their respective Mongoose models
const MODEL_MAP = {
	users: User,
	posts: Post,
	messages: Message,
	conversations: Conversation,
	stories: Story,
	spaces: Space,
	notifications: Notification,
	profileviews: ProfileView,
	calls: CallSession,
};

// 1. Verify Developer Key
export const verifyKey = async (req, res) => {
	res.status(200).json({ valid: true, message: "Developer key verified" });
};

// 2. Comprehensive Database Telemetry & Storage Stats
export const getDatabaseStats = async (req, res) => {
	try {
		const isDbConnected = mongoose.connection.readyState === 1;

		let dbStats = {
			dataSize: 0,
			storageSize: 0,
			indexSize: 0,
			totalSize: 0,
			objects: 0,
			collections: 0,
			avgObjSize: 0,
		};

		if (isDbConnected && mongoose.connection.db) {
			try {
				const rawDbStats = await mongoose.connection.db.stats();
				dbStats = {
					dataSize: rawDbStats.dataSize || 0,
					storageSize: rawDbStats.storageSize || 0,
					indexSize: rawDbStats.indexSize || 0,
					totalSize: (rawDbStats.storageSize || 0) + (rawDbStats.indexSize || 0),
					objects: rawDbStats.objects || 0,
					collections: rawDbStats.collections || 0,
					avgObjSize: rawDbStats.avgObjSize || 0,
				};
			} catch (err) {
				console.warn("db.stats() warning:", err.message);
			}
		}

		// Count documents across all core models
		const [
			totalUsers,
			totalPosts,
			totalMessages,
			totalConversations,
			totalStories,
			totalSpaces,
			totalNotifications,
			totalProfileViews,
			totalCalls,
		] = await Promise.all([
			User.countDocuments().catch(() => 0),
			Post.countDocuments().catch(() => 0),
			Message.countDocuments().catch(() => 0),
			Conversation.countDocuments().catch(() => 0),
			Story.countDocuments().catch(() => 0),
			Space.countDocuments().catch(() => 0),
			Notification.countDocuments().catch(() => 0),
			ProfileView.countDocuments().catch(() => 0),
			CallSession.countDocuments().catch(() => 0),
		]);

		// User registration breakdown
		const now = new Date();
		const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

		const [usersJoined24h, usersJoined7d, usersJoined30d] = await Promise.all([
			User.countDocuments({ createdAt: { $gte: oneDayAgo } }).catch(() => 0),
			User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }).catch(() => 0),
			User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }).catch(() => 0),
		]);

		// Extra content metrics
		const [mediaPostsCount, pollsCount, activeStoriesCount, groupChatsCount] = await Promise.all([
			Post.countDocuments({ img: { $ne: null } }).catch(() => 0),
			Post.countDocuments({ "poll.options.0": { $exists: true } }).catch(() => 0),
			Story.countDocuments({ expiresAt: { $gt: now } }).catch(() => 0),
			Conversation.countDocuments({ isGroup: true }).catch(() => 0),
		]);

		// Collection-by-collection size telemetry
		const collectionsBreakdown = [
			{ name: "Users", key: "users", count: totalUsers, icon: "👥" },
			{ name: "Posts", key: "posts", count: totalPosts, icon: "📝" },
			{ name: "Messages", key: "messages", count: totalMessages, icon: "💬" },
			{ name: "Conversations", key: "conversations", count: totalConversations, icon: "📁" },
			{ name: "Stories", key: "stories", count: totalStories, icon: "📸" },
			{ name: "Audio Spaces", key: "spaces", count: totalSpaces, icon: "🎙️" },
			{ name: "Notifications", key: "notifications", count: totalNotifications, icon: "🔔" },
			{ name: "Profile Views", key: "profileviews", count: totalProfileViews, icon: "👁️" },
			{ name: "Call Logs", key: "calls", count: totalCalls, icon: "📞" },
		];

		// Try to enrich collections with individual collection stats if available
		if (isDbConnected && mongoose.connection.db) {
			for (const col of collectionsBreakdown) {
				try {
					const cStats = await mongoose.connection.db.command({ collStats: col.key });
					col.dataSize = cStats.size || 0;
					col.storageSize = cStats.storageSize || 0;
					col.indexSize = cStats.totalIndexSize || 0;
					col.formattedSize = formatBytes((cStats.storageSize || 0) + (cStats.totalIndexSize || 0));
				} catch (e) {
					col.formattedSize = "Dynamic";
				}
			}
		}

		// Node runtime & memory stats
		const memUsage = process.memoryUsage();

		res.status(200).json({
			database: {
				name: mongoose.connection.name || "winker",
				status: isDbConnected ? "Connected" : "Disconnected",
				host: mongoose.connection.host || "MongoDB Atlas",
				storage: {
					raw: dbStats,
					totalSizeFormatted: formatBytes(dbStats.totalSize),
					dataSizeFormatted: formatBytes(dbStats.dataSize),
					storageSizeFormatted: formatBytes(dbStats.storageSize),
					indexSizeFormatted: formatBytes(dbStats.indexSize),
					avgDocumentSizeFormatted: formatBytes(dbStats.avgObjSize),
					totalDocuments: dbStats.objects || (totalUsers + totalPosts + totalMessages),
					totalCollections: dbStats.collections || collectionsBreakdown.length,
				},
				collections: collectionsBreakdown,
			},
			users: {
				total: totalUsers,
				growth: {
					last24Hours: usersJoined24h,
					last7Days: usersJoined7d,
					last30Days: usersJoined30d,
				},
			},
			activity: {
				posts: { total: totalPosts, withMedia: mediaPostsCount, polls: pollsCount },
				messages: { total: totalMessages, totalConversations, groupChats: groupChatsCount },
				stories: { total: totalStories, active: activeStoriesCount },
				spaces: { total: totalSpaces },
				calls: { total: totalCalls },
				profileViews: { total: totalProfileViews },
				notifications: { total: totalNotifications },
			},
			system: {
				uptimeSeconds: Math.floor(process.uptime()),
				uptimeFormatted: formatUptime(process.uptime()),
				memory: {
					rss: formatBytes(memUsage.rss),
					heapTotal: formatBytes(memUsage.heapTotal),
					heapUsed: formatBytes(memUsage.heapUsed),
					external: formatBytes(memUsage.external),
					raw: memUsage,
				},
				nodeVersion: process.version,
				platform: process.platform,
				arch: process.arch,
			},
		});
	} catch (error) {
		console.error("Error in getDatabaseStats:", error);
		res.status(500).json({ error: error.message || "Failed to fetch database telemetry" });
	}
};

// 3. Get Every User in Detail
export const getAllUsersDetailed = async (req, res) => {
	try {
		const { q = "", sortBy = "createdAt", order = "desc" } = req.query;

		const filter = {};
		if (q.trim()) {
			const safeRegex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
			filter.$or = [
				{ fullName: safeRegex },
				{ username: safeRegex },
				{ email: safeRegex },
			];
		}

		const sortOption = {};
		sortOption[sortBy] = order === "asc" ? 1 : -1;

		const users = await User.find(filter)
			.select("-password")
			.sort(sortOption)
			.lean();

		// Enrich each user with derived metrics
		const detailedUsers = users.map((u) => ({
			_id: u._id,
			fullName: u.fullName || "",
			username: u.username || "",
			email: u.email || "",
			profileImg: u.profileImg || "/avatar-placeholder.png",
			coverImg: u.coverImg || "",
			bio: u.bio || "",
			link: u.link || "",
			authProvider: u.authProvider || "local",
			followersCount: u.followers ? u.followers.length : 0,
			followingCount: u.following ? u.following.length : 0,
			likedPostsCount: u.likedPosts ? u.likedPosts.length : 0,
			bookmarksCount: u.bookmarks ? u.bookmarks.length : 0,
			followers: u.followers || [],
			following: u.following || [],
			createdAt: u.createdAt,
			updatedAt: u.updatedAt,
		}));

		res.status(200).json({
			totalCount: detailedUsers.length,
			users: detailedUsers,
		});
	} catch (error) {
		console.error("Error in getAllUsersDetailed:", error);
		res.status(500).json({ error: "Failed to fetch users" });
	}
};

// 4. Explore Entries in Any Collection with Search & Pagination
export const getCollectionEntries = async (req, res) => {
	try {
		const { collection } = req.params;
		const { page = 1, limit = 50, q = "", sortBy = "createdAt", order = "desc" } = req.query;

		const Model = MODEL_MAP[collection.toLowerCase()];
		if (!Model) {
			return res.status(400).json({ error: `Collection '${collection}' is not supported` });
		}

		const pageNum = Math.max(1, parseInt(page, 10));
		const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
		const skip = (pageNum - 1) * limitNum;

		const filter = {};
		if (q.trim()) {
			const safeRegex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
			if (collection === "users") {
				filter.$or = [{ fullName: safeRegex }, { username: safeRegex }, { email: safeRegex }];
			} else if (collection === "posts") {
				filter.$or = [{ text: safeRegex }];
			} else if (collection === "messages") {
				filter.$or = [{ text: safeRegex }];
			} else if (collection === "conversations") {
				filter.$or = [{ groupName: safeRegex }];
			} else if (collection === "spaces") {
				filter.$or = [{ title: safeRegex }];
			}
		}

		const sortOption = {};
		sortOption[sortBy] = order === "asc" ? 1 : -1;

		let query = Model.find(filter).sort(sortOption).skip(skip).limit(limitNum);

		// Deep population depending on collection
		if (collection === "posts") {
			query = query.populate("user", "fullName username email profileImg");
		} else if (collection === "messages") {
			query = query
				.populate("senderId", "fullName username email profileImg")
				.populate("receiverId", "fullName username email profileImg");
		} else if (collection === "conversations") {
			query = query
				.populate("participants", "fullName username email profileImg")
				.populate("groupAdmin", "fullName username email");
		} else if (collection === "stories") {
			query = query.populate("user", "fullName username email profileImg");
		} else if (collection === "spaces") {
			query = query.populate("host", "fullName username email profileImg");
		} else if (collection === "notifications") {
			query = query
				.populate("from", "fullName username email")
				.populate("to", "fullName username email");
		} else if (collection === "profileviews") {
			query = query
				.populate("viewer", "fullName username email profileImg")
				.populate("viewedUser", "fullName username email");
		}

		const [items, totalCount] = await Promise.all([
			query.lean(),
			Model.countDocuments(filter),
		]);

		res.status(200).json({
			collection,
			page: pageNum,
			limit: limitNum,
			totalPages: Math.ceil(totalCount / limitNum),
			totalCount,
			items,
		});
	} catch (error) {
		console.error("Error in getCollectionEntries:", error);
		res.status(500).json({ error: error.message || "Failed to load collection entries" });
	}
};

// 5. Delete an Entry by Collection & ID
export const deleteEntry = async (req, res) => {
	try {
		const { collection, id } = req.params;
		const Model = MODEL_MAP[collection.toLowerCase()];

		if (!Model) {
			return res.status(400).json({ error: `Invalid collection: ${collection}` });
		}

		const deleted = await Model.findByIdAndDelete(id);
		if (!deleted) {
			return res.status(404).json({ error: "Document not found" });
		}

		res.status(200).json({ success: true, message: `Document ${id} deleted successfully from ${collection}` });
	} catch (error) {
		console.error("Error in deleteEntry:", error);
		res.status(500).json({ error: error.message || "Failed to delete document" });
	}
};
