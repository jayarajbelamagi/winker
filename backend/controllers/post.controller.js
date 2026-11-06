import Notification from "../models/notification.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary";

// Active filter: shows permanent posts + 24h story posts that haven't expired yet
const getActivePostFilter = (extraConditions = {}) => ({
	...extraConditions,
	$or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

// CREATE POST (supports optional 24-hour expiration)
export const createPost = async (req, res) => {
	try {
		const { text, img: imgBase64, is24hStory } = req.body;
		const userId = req.user._id.toString();

		if (!text && !imgBase64) {
			return res.status(400).json({ error: "Post must have text or image" });
		}

		let img = null;
		if (imgBase64) {
			try {
				if (imgBase64.startsWith("data:image/") || imgBase64.startsWith("http")) {
					const uploadedResponse = await cloudinary.uploader.upload(imgBase64, {
						folder: "winker_posts",
						resource_type: "auto",
					});
					img = uploadedResponse.secure_url;
				} else {
					img = imgBase64;
				}
			} catch (cloudErr) {
				console.error("Cloudinary upload failed in createPost:", cloudErr.message);
				if (imgBase64.startsWith("http")) {
					img = imgBase64;
				} else {
					return res.status(500).json({ error: "Failed to upload image. Please check image format." });
				}
			}
		}

		// Calculate 24-hour expiration if marked as a 24-hour story post
		const expiresAt = is24hStory ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

		const newPost = new Post({
			user: userId,
			text,
			img,
			is24hStory: Boolean(is24hStory),
			expiresAt,
		});
		await newPost.save();

		const populatedPost = await Post.findById(newPost._id).populate("user", "-password");
		res.status(201).json(populatedPost);
	} catch (error) {
		console.error("Error in createPost:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// DELETE POST
export const deletePost = async (req, res) => {
	try {
		const post = await Post.findById(req.params.id);
		if (!post) return res.status(404).json({ error: "Post not found" });

		if (post.user.toString() !== req.user._id.toString()) {
			return res.status(401).json({ error: "Not authorized" });
		}

		if (post.img && post.img.includes("cloudinary.com")) {
			try {
				const imgId = post.img.split("/").pop().split(".")[0];
				await cloudinary.uploader.destroy(imgId);
			} catch (err) {
				console.warn("Could not delete post image from Cloudinary:", err.message);
			}
		}

		await Post.findByIdAndDelete(req.params.id);
		res.status(200).json({ message: "Post deleted successfully" });
	} catch (error) {
		console.error("Error in deletePost:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// COMMENT ON POST
export const commentOnPost = async (req, res) => {
	try {
		const { text } = req.body;
		const postId = req.params.id || req.params.postId;

		if (!text || !text.trim()) return res.status(400).json({ error: "Text is required" });

		const post = await Post.findById(postId);
		if (!post) return res.status(404).json({ error: "Post not found" });

		post.comments.push({ user: req.user._id, text: text.trim(), createdAt: new Date() });
		await post.save();

		// Notify post author if not self
		if (post.user && post.user.toString() !== req.user._id.toString()) {
			await new Notification({
				from: req.user._id,
				to: post.user,
				type: "comment",
			}).save().catch((err) => console.error("Notification save failed:", err));
		}

		const populatedPost = await Post.findById(postId)
			.populate("user", "-password")
			.populate("comments.user", "-password")
			.populate("comments.replies.user", "-password");

		if (!populatedPost) return res.status(404).json({ error: "Post not found" });

		res.status(200).json(populatedPost.comments);
	} catch (error) {
		console.error("Error in commentOnPost:", error);
		res.status(500).json({ error: error.message || "Internal server error" });
	}
};

// REPLY TO A COMMENT ON A POST
export const replyToComment = async (req, res) => {
	try {
		const { postId, commentId } = req.params;
		const { text } = req.body;

		if (!text || !text.trim()) return res.status(400).json({ error: "Reply text is required" });

		const post = await Post.findById(postId);
		if (!post) return res.status(404).json({ error: "Post not found" });

		const comment = post.comments.id(commentId);
		if (!comment) return res.status(404).json({ error: "Comment not found" });

		if (!comment.replies) comment.replies = [];
		comment.replies.push({
			user: req.user._id,
			text: text.trim(),
			createdAt: new Date(),
		});

		await post.save();

		// Notify comment author if not self
		if (comment.user && comment.user.toString() !== req.user._id.toString()) {
			await new Notification({
				from: req.user._id,
				to: comment.user,
				type: "reply",
			}).save().catch((err) => console.error("Notification save failed:", err));
		}

		const populatedPost = await Post.findById(postId)
			.populate("user", "-password")
			.populate("comments.user", "-password")
			.populate("comments.replies.user", "-password");

		if (!populatedPost) return res.status(404).json({ error: "Post not found" });

		res.status(200).json(populatedPost.comments);
	} catch (error) {
		console.error("Error in replyToComment:", error);
		res.status(500).json({ error: error.message || "Internal server error" });
	}
};

// LIKE / UNLIKE COMMENT
export const likeComment = async (req, res) => {
	try {
		const { postId, commentId } = req.params;
		const userId = req.user._id;

		const post = await Post.findById(postId);
		if (!post) return res.status(404).json({ error: "Post not found" });

		const comment = post.comments.id(commentId);
		if (!comment) return res.status(404).json({ error: "Comment not found" });

		if (!comment.likes) comment.likes = [];
		const isLiked = comment.likes.some((id) => id.toString() === userId.toString());

		if (isLiked) {
			comment.likes = comment.likes.filter((id) => id.toString() !== userId.toString());
		} else {
			comment.likes.push(userId);
		}

		await post.save();
		res.status(200).json(comment.likes);
	} catch (error) {
		console.error("Error in likeComment:", error);
		res.status(500).json({ error: error.message || "Internal server error" });
	}
};

// GET SINGLE POST BY ID
export const getPostById = async (req, res) => {
	try {
		const { id } = req.params;
		const post = await Post.findById(id)
			.populate("user", "-password")
			.populate("comments.user", "-password")
			.populate("comments.replies.user", "-password");

		if (!post) return res.status(404).json({ error: "Post not found" });

		res.status(200).json(post);
	} catch (error) {
		console.error("Error in getPostById:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// LIKE / UNLIKE
export const likeUnlikePost = async (req, res) => {
	try {
		const postId = req.params.id;
		const userId = req.user._id;

		const post = await Post.findById(postId);
		if (!post) return res.status(404).json({ error: "Post not found" });

		const liked = post.likes.includes(userId);

		if (liked) {
			await Post.updateOne({ _id: postId }, { $pull: { likes: userId } });
			await User.updateOne({ _id: userId }, { $pull: { likedPosts: postId } });
		} else {
			post.likes.push(userId);
			await User.updateOne({ _id: userId }, { $push: { likedPosts: postId } });
			await post.save();

			if (post.user && post.user.toString() !== userId.toString()) {
				await new Notification({ from: userId, to: post.user, type: "like" })
					.save()
					.catch((err) => console.error("Like notification failed:", err));
			}
		}

		const updatedPost = await Post.findById(postId).populate("user", "-password");
		res.status(200).json(updatedPost.likes);
	} catch (error) {
		console.error("Error in likeUnlikePost:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// GET ALL POSTS (For You)
export const getAllPosts = async (req, res) => {
	try {
		const posts = await Post.find(getActivePostFilter())
			.sort({ createdAt: -1 })
			.populate("user", "-password")
			.populate("comments.user", "-password")
			.populate("comments.replies.user", "-password");

		res.status(200).json(posts);
	} catch (error) {
		console.error("Error in getAllPosts:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// GET FOLLOWING POSTS
export const getFollowingPosts = async (req, res) => {
	try {
		const user = await User.findById(req.user._id);
		if (!user) return res.status(404).json({ error: "User not found" });

		const posts = await Post.find(getActivePostFilter({ user: { $in: user.following } }))
			.sort({ createdAt: -1 })
			.populate("user", "-password")
			.populate("comments.user", "-password")
			.populate("comments.replies.user", "-password");

		res.status(200).json(posts);
	} catch (error) {
		console.error("Error in getFollowingPosts:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// GET USER POSTS
export const getUserPosts = async (req, res) => {
	try {
		const user = await User.findOne({ username: req.params.username });
		if (!user) return res.status(404).json({ error: "User not found" });

		const posts = await Post.find(getActivePostFilter({ user: user._id }))
			.sort({ createdAt: -1 })
			.populate("user", "-password")
			.populate("comments.user", "-password")
			.populate("comments.replies.user", "-password");

		res.status(200).json(posts);
	} catch (error) {
		console.error("Error in getUserPosts:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// GET LIKED POSTS
export const getLikedPosts = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);
		if (!user) return res.status(404).json({ error: "User not found" });

		const posts = await Post.find(getActivePostFilter({ _id: { $in: user.likedPosts } }))
			.populate("user", "-password")
			.populate("comments.user", "-password")
			.populate("comments.replies.user", "-password");

		res.status(200).json(posts);
	} catch (error) {
		console.error("Error in getLikedPosts:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// BOOKMARK / UNBOOKMARK POST
export const bookmarkPost = async (req, res) => {
	try {
		const postId = req.params.id;
		const userId = req.user._id;

		const post = await Post.findById(postId);
		if (!post) return res.status(404).json({ error: "Post not found" });

		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ error: "User not found" });

		const isBookmarked = user.bookmarks?.some((b) => b.toString() === postId.toString());

		if (isBookmarked) {
			await User.findByIdAndUpdate(userId, { $pull: { bookmarks: postId } });
			return res.status(200).json({ bookmarked: false, message: "Removed from bookmarks" });
		} else {
			await User.findByIdAndUpdate(userId, { $addToSet: { bookmarks: postId } });
			return res.status(200).json({ bookmarked: true, message: "Added to bookmarks" });
		}
	} catch (error) {
		console.error("Error in bookmarkPost:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// GET USER BOOKMARKED POSTS
export const getBookmarkedPosts = async (req, res) => {
	try {
		const user = await User.findById(req.user._id);
		if (!user) return res.status(404).json({ error: "User not found" });

		const posts = await Post.find(getActivePostFilter({ _id: { $in: user.bookmarks || [] } }))
			.sort({ createdAt: -1 })
			.populate("user", "-password")
			.populate("comments.user", "-password")
			.populate("comments.replies.user", "-password");

		res.status(200).json(posts);
	} catch (error) {
		console.error("Error in getBookmarkedPosts:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
