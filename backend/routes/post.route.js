import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
	createPost,
	deletePost,
	commentOnPost,
	likeUnlikePost,
	getAllPosts,
	getFollowingPosts,
	getUserPosts,
	getLikedPosts,
	bookmarkPost,
	getBookmarkedPosts,
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
router.delete("/:id", protectRoute, deletePost);

export default router;
