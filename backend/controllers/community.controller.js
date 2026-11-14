import Community from "../models/community.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary";

// CREATE COMMUNITY
export const createCommunity = async (req, res) => {
	try {
		const { name, description = "", category = "General", isPrivate = false, rules = [] } = req.body;
		let { avatar, banner } = req.body;
		const userId = req.user._id;

		if (!name || !name.trim()) {
			return res.status(400).json({ error: "Community name is required" });
		}

		// Generate URL-friendly slug
		const slug = name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");

		const existing = await Community.findOne({ slug });
		if (existing) {
			return res.status(400).json({ error: "A community with this name already exists" });
		}

		if (avatar && avatar.startsWith("data:image/")) {
			try {
				const uploadRes = await cloudinary.uploader.upload(avatar, { folder: "winker_communities" });
				avatar = uploadRes.secure_url;
			} catch (err) {
				avatar = "";
			}
		}

		if (banner && banner.startsWith("data:image/")) {
			try {
				const uploadRes = await cloudinary.uploader.upload(banner, { folder: "winker_communities" });
				banner = uploadRes.secure_url;
			} catch (err) {
				banner = "";
			}
		}

		const newCommunity = new Community({
			name: name.trim(),
			slug,
			description: description.trim(),
			avatar: avatar || "",
			banner: banner || "",
			category,
			creator: userId,
			admins: [userId],
			members: [userId],
			isPrivate: Boolean(isPrivate),
			rules: Array.isArray(rules) ? rules : [],
		});

		await newCommunity.save();
		const populated = await Community.findById(newCommunity._id).populate("creator", "fullName username profileImg");

		res.status(201).json(populated);
	} catch (error) {
		console.error("Error in createCommunity:", error);
		res.status(500).json({ error: error.message || "Failed to create community" });
	}
};

// GET ALL COMMUNITIES
export const getAllCommunities = async (req, res) => {
	try {
		const { q = "", category = "all" } = req.query;
		const userId = req.user ? req.user._id.toString() : null;

		const filter = {};
		if (category && category.toLowerCase() !== "all") {
			filter.category = new RegExp(`^${category}$`, "i");
		}
		if (q && q.trim()) {
			filter.$or = [
				{ name: { $regex: q.trim(), $options: "i" } },
				{ description: { $regex: q.trim(), $options: "i" } },
			];
		}

		const communities = await Community.find(filter)
			.populate("creator", "fullName username profileImg")
			.sort({ createdAt: -1 })
			.lean();

		const formatted = communities.map((comm) => ({
			...comm,
			membersCount: comm.members ? comm.members.length : 0,
			isMember: userId && comm.members ? comm.members.some((m) => m.toString() === userId) : false,
			isAdmin: userId && comm.admins ? comm.admins.some((a) => a.toString() === userId) : false,
		}));

		res.status(200).json(formatted);
	} catch (error) {
		console.error("Error in getAllCommunities:", error);
		res.status(500).json({ error: "Failed to load communities" });
	}
};

// GET SINGLE COMMUNITY BY SLUG
export const getCommunityBySlug = async (req, res) => {
	try {
		const { slug } = req.params;
		const userId = req.user ? req.user._id.toString() : null;

		const community = await Community.findOne({ slug })
			.populate("creator", "fullName username profileImg")
			.populate("admins", "fullName username profileImg")
			.populate("members", "fullName username profileImg")
			.lean();

		if (!community) {
			return res.status(404).json({ error: "Community not found" });
		}

		const isMember = userId && community.members ? community.members.some((m) => m._id.toString() === userId) : false;
		const isAdmin = userId && community.admins ? community.admins.some((a) => a._id.toString() === userId) : false;

		res.status(200).json({
			...community,
			membersCount: community.members ? community.members.length : 0,
			isMember,
			isAdmin,
		});
	} catch (error) {
		console.error("Error in getCommunityBySlug:", error);
		res.status(500).json({ error: "Failed to load community details" });
	}
};

// JOIN / LEAVE COMMUNITY
export const toggleJoinCommunity = async (req, res) => {
	try {
		const { id } = req.params;
		const userId = req.user._id;

		const community = await Community.findById(id);
		if (!community) {
			return res.status(404).json({ error: "Community not found" });
		}

		const isMember = community.members.some((m) => m.toString() === userId.toString());

		if (isMember) {
			// Cannot leave if user is the sole creator/admin unless others exist
			community.members = community.members.filter((m) => m.toString() !== userId.toString());
			community.admins = community.admins.filter((a) => a.toString() !== userId.toString());
			await community.save();
			return res.status(200).json({ joined: false, membersCount: community.members.length });
		} else {
			community.members.push(userId);
			await community.save();
			return res.status(200).json({ joined: true, membersCount: community.members.length });
		}
	} catch (error) {
		console.error("Error in toggleJoinCommunity:", error);
		res.status(500).json({ error: "Failed to update membership" });
	}
};

// GET POSTS FOR A COMMUNITY
export const getCommunityPosts = async (req, res) => {
	try {
		const { slug } = req.params;
		const community = await Community.findOne({ slug });
		if (!community) {
			return res.status(404).json({ error: "Community not found" });
		}

		const posts = await Post.find({
			community: community._id,
			$or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
		})
			.sort({ createdAt: -1 })
			.populate("user", "-password")
			.populate("community", "name slug avatar")
			.populate("comments.user", "-password")
			.populate("comments.replies.user", "-password")
			.populate({ path: "quotedPost", populate: { path: "user", select: "-password" } });

		res.status(200).json(posts);
	} catch (error) {
		console.error("Error in getCommunityPosts:", error);
		res.status(500).json({ error: "Failed to load community posts" });
	}
};
