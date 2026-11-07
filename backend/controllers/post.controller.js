import Notification from "../models/notification.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary";

// Active filter: shows permanent posts + 24h story posts that haven't expired yet
const getActivePostFilter = (extraConditions = {}) => ({
	...extraConditions,
	$or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8MB strict limit

// CREATE POST (supports text, image, video up to 8MB, poll, quotedPost, 24h expiration)
export const createPost = async (req, res) => {
	try {
		const { text, img: mediaBase64, mediaType = "image", poll, quotedPost, is24hStory } = req.body;
		const userId = req.user._id.toString();

		if (!text && !mediaBase64 && !poll && !quotedPost) {
			return res.status(400).json({ error: "Post must have text, media, poll, or a quoted post" });
		}

		let img = null;
		let detectedMediaType = mediaType === "video" ? "video" : "image";

		if (mediaBase64) {
			// Enforce 8MB limit check on mediaBase64
			if (typeof mediaBase64 === "string" && mediaBase64.length * 0.75 > MAX_MEDIA_BYTES + 500000) {
				return res.status(400).json({ error: "Media file exceeds 8MB limit. Please choose a smaller file." });
			}

			try {
				if (
					mediaBase64.startsWith("data:image/") ||
					mediaBase64.startsWith("data:video/") ||
					mediaBase64.startsWith("http")
				) {
					if (mediaBase64.startsWith("data:video/")) {
						detectedMediaType = "video";
					}
					const uploadedResponse = await cloudinary.uploader.upload(mediaBase64, {
						folder: "winker_posts",
						resource_type: "auto",
					});
					img = uploadedResponse.secure_url;
					if (uploadedResponse.resource_type === "video") {
						detectedMediaType = "video";
					}
				} else {
					img = mediaBase64;
				}
			} catch (cloudErr) {
				console.error("Cloudinary upload failed in createPost:", cloudErr.message);
				if (mediaBase64.startsWith("http")) {
					img = mediaBase64;
				} else {
					return res.status(500).json({ error: "Failed to upload media. Please check format and size (max 8MB)." });
				}
			}
		}

		// Handle poll options
		let parsedPoll = null;
		if (poll && poll.options && Array.isArray(poll.options)) {
			const cleanOptions = poll.options
				.filter((opt) => opt && (typeof opt === "string" ? opt.trim() : opt.text && opt.text.trim()))
				.map((opt) => ({
					text: typeof opt === "string" ? opt.trim() : opt.text.trim(),
					votes: [],
				}));

			if (cleanOptions.length >= 2) {
				const durationHours = Number(poll.durationHours) || 24;
				parsedPoll = {
					question: (poll.question || text || "Poll").trim(),
					options: cleanOptions,
					expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000),
				};
			}
		}

		// Calculate 24-hour expiration if marked as a 24-hour story post
		const expiresAt = is24hStory ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

		const newPost = new Post({
			user: userId,
			text,
			img,
			mediaType: detectedMediaType,
			poll: parsedPoll || undefined,
			quotedPost: quotedPost || null,
			is24hStory: Boolean(is24hStory),
			expiresAt,
		});
		await newPost.save();

		const populatedPost = await Post.findById(newPost._id)
			.populate("user", "-password")
			.populate({ path: "quotedPost", populate: { path: "user", select: "-password" } });

		res.status(201).json(populatedPost);
	} catch (error) {
		console.error("Error in createPost:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// VOTE ON A POLL
export const votePoll = async (req, res) => {
	try {
		const { id: postId } = req.params;
		const { optionIndex } = req.body;
		const userId = req.user._id;

		const post = await Post.findById(postId);
		if (!post || !post.poll || !post.poll.options) {
			return res.status(404).json({ error: "Poll not found" });
		}

		if (post.poll.expiresAt && new Date() > new Date(post.poll.expiresAt)) {
			return res.status(400).json({ error: "This poll has already ended" });
		}

		const optIdx = Number(optionIndex);
		if (isNaN(optIdx) || optIdx < 0 || optIdx >= post.poll.options.length) {
			return res.status(400).json({ error: "Invalid option selected" });
		}

		// Remove user's vote from any previous options
		post.poll.options.forEach((opt) => {
			opt.votes = opt.votes.filter((vId) => vId.toString() !== userId.toString());
		});

		// Add vote to the chosen option
		post.poll.options[optIdx].votes.push(userId);
		await post.save();

		const populated = await Post.findById(postId)
			.populate("user", "-password")
			.populate("comments.user", "-password")
			.populate({ path: "quotedPost", populate: { path: "user", select: "-password" } });

		res.status(200).json(populated);
	} catch (error) {
		console.error("Error in votePoll:", error);
		res.status(500).json({ error: "Failed to submit vote" });
	}
};

// DELETE POST
export const deletePost = async (req, res) => {
	try {
		const post = await Post.findById(req.params.id);
		if (!post) return res.status(404).json({ error: "Post not found" });

		if (post.user.toString() !== req.user._id.toString()) {
			return res.status(401).json({ error: "You are not authorized to delete this post" });
		}

		if (post.img) {
			const imgId = post.img.split("/").pop().split(".")[0];
			await cloudinary.uploader.destroy(imgId).catch(() => {});
		}

		await Post.findByIdAndDelete(req.params.id);
		res.status(200).json({ message: "Post deleted successfully" });
	} catch (error) {
		console.error("Error in deletePost:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// COMMENT ON A POST
export const commentOnPost = async (req, res) => {
	try {
		const { text } = req.body;
		const postId = req.params.id;
		const userId = req.user._id;

		if (!text) return res.status(400).json({ error: "Text field is required" });

		const post = await Post.findById(postId);
		if (!post) return res.status(404).json({ error: "Post not found" });

		const comment = { user: userId, text };
		post.comments.push(comment);
		await post.save();

		if (post.user && post.user.toString() !== userId.toString()) {
			await new Notification({ from: userId, to: post.user, type: "comment" })
				.save()
				.catch((err) => console.error("Comment notification failed:", err));
		}

		const populatedPost = await Post.findById(postId)
			.populate("user", "-password")
			.populate("comments.user", "-password")
			.populate("comments.replies.user", "-password")
			.populate({ path: "quotedPost", populate: { path: "user", select: "-password" } });

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
			.populate("comments.replies.user", "-password")
			.populate({ path: "quotedPost", populate: { path: "user", select: "-password" } });

		const updatedComment = populatedPost.comments.id(commentId);
		res.status(200).json(updatedComment.replies);
	} catch (error) {
		console.error("Error in replyToComment:", error);
		res.status(500).json({ error: error.message || "Internal server error" });
	}
};

// LIKE / UNLIKE A COMMENT
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
			.populate("comments.replies.user", "-password")
			.populate({ path: "quotedPost", populate: { path: "user", select: "-password" } });

		if (!post) return res.status(404).json({ error: "Post not found" });
		res.status(200).json(post);
	} catch (error) {
		console.error("Error in getPostById:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// LIKE / UNLIKE POST
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

		const updatedPost = await Post.findById(postId)
			.populate("user", "-password")
			.populate({ path: "quotedPost", populate: { path: "user", select: "-password" } });
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
			.populate("comments.replies.user", "-password")
			.populate({ path: "quotedPost", populate: { path: "user", select: "-password" } });

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
			.populate("comments.replies.user", "-password")
			.populate({ path: "quotedPost", populate: { path: "user", select: "-password" } });

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
			.populate("comments.replies.user", "-password")
			.populate({ path: "quotedPost", populate: { path: "user", select: "-password" } });

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
			.populate("comments.replies.user", "-password")
			.populate({ path: "quotedPost", populate: { path: "user", select: "-password" } });

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

		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ error: "User not found" });

		if (!user.bookmarkedPosts) user.bookmarkedPosts = [];
		const isBookmarked = user.bookmarkedPosts.includes(postId);

		if (isBookmarked) {
			await User.updateOne({ _id: userId }, { $pull: { bookmarkedPosts: postId } });
		} else {
			await User.updateOne({ _id: userId }, { $push: { bookmarkedPosts: postId } });
		}

		res.status(200).json({ bookmarked: !isBookmarked });
	} catch (error) {
		console.error("Error in bookmarkPost:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

// GET BOOKMARKED POSTS
export const getBookmarkedPosts = async (req, res) => {
	try {
		const userId = req.user._id;
		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ error: "User not found" });

		const posts = await Post.find(getActivePostFilter({ _id: { $in: user.bookmarkedPosts || [] } }))
			.sort({ createdAt: -1 })
			.populate("user", "-password")
			.populate("comments.user", "-password")
			.populate("comments.replies.user", "-password")
			.populate({ path: "quotedPost", populate: { path: "user", select: "-password" } });

		res.status(200).json(posts);
	} catch (error) {
		console.error("Error in getBookmarkedPosts:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
