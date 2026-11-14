import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
	createCommunity,
	getAllCommunities,
	getCommunityBySlug,
	toggleJoinCommunity,
	getCommunityPosts,
} from "../controllers/community.controller.js";

const router = express.Router();

router.get("/", getAllCommunities);
router.post("/create", protectRoute, createCommunity);
router.get("/:slug", getCommunityBySlug);
router.post("/:id/join", protectRoute, toggleJoinCommunity);
router.get("/:slug/posts", getCommunityPosts);

export default router;
