import Notification from "../models/notification.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary";

// CREATE POST
export const createPost = async (req, res) => {
	try {
		const { text, img: imgBase64 } = req.body;
		const userId = req.user._id.toString();

		if (!text && !imgBase64) {
			return res.status(400).json({ error: "Post must have text or image" });
		}

		let img = null;
		if (imgBase64) {
			const uploadedResponse = await cloudinary.uploader.upload(imgBase64);
			img = uploadedResponse.secure_url;
		}

		const newPost = new Post({ user: userId, text, img });
		await newPost.save();

		res.status(201).json(newPost);
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

		if (post.img) {
			const imgId = post.img.split("/").pop().split(".")[0];
			await cloudinary.uploader.destroy(imgId);
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
		const postId = req.params.id;

		if (!text) return res.status(400).json({ error: "Text is required" });

		const post = await Post.findById(postId);
		if (!post) return res.status(404).json({ error: "Post not found" });

		post.comments.push({ user: req.user._id, text });
		await post.save();

		res.status(200).json(post);
	} catch (error) {
		console.error("Error in commentOnPost:", error);
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

			await new Notification({ from: userId, to: post.user, type: "like" }).save();
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
		const posts = await Post.find()
			.sort({ createdAt: -1 })
			.populate("user", "-password")
			.populate("comments.user", "-password");

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

		const posts = await Post.find({ user: { $in: user.following } })
			.sort({ createdAt: -1 })
			.populate("user", "-password")
			.populate("comments.user", "-password");

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

		const posts = await Post.find({ user: user._id })
			.sort({ createdAt: -1 })
			.populate("user", "-password")
			.populate("comments.user", "-password");

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

		const posts = await Post.find({ _id: { $in: user.likedPosts } })
			.populate("user", "-password")
			.populate("comments.user", "-password");

		res.status(200).json(posts);
	} catch (error) {
		console.error("Error in getLikedPosts:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
