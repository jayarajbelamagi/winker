import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
	createPost,
	deletePost,
	commentOnPost,
	replyToComment,
	likeComment,
	likeUnlikePost,
	getAllPosts,
	getFollowingPosts,
	getUserPosts,
	getLikedPosts,
	bookmarkPost,
	getBookmarkedPosts,
	getPostById,
} from "../controllers/post.controller.js";

const router = express.Router();

// FEED
router.get("/all", protectRoute, getAllPosts);              // For You
router.get("/following", protectRoute, getFollowingPosts);  // Following
router.get("/bookmarks", protectRoute, getBookmarkedPosts);  // Bookmarked posts

// USER POSTS & LIKED
router.get("/user/:username", protectRoute, getUserPosts);
router.get("/likes/:id", protectRoute, getLikedPosts);

// POST ACTIONS
router.post("/create", protectRoute, createPost);
router.post("/like/:id", protectRoute, likeUnlikePost);
router.post("/bookmark/:id", protectRoute, bookmarkPost);
router.post("/comment/:id", protectRoute, commentOnPost);
router.post("/comment/:postId/reply/:commentId", protectRoute, replyToComment);
router.post("/comment/:postId/like/:commentId", protectRoute, likeComment);
router.delete("/:id", protectRoute, deletePost);

// SINGLE POST (Must be after other GET routes to avoid shadowing)
router.get("/:id", protectRoute, getPostById);

export default router;
