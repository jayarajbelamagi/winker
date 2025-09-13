import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { getUserProfile, followUnfollowUser, getSuggestedUsers, updateUser, getFollowers,getFollowing } from "../controllers/user.controller.js";

const router = express.Router();

router.get("/profile/:username", protectRoute, getUserProfile);
router.get("/suggested", protectRoute, getSuggestedUsers);
router.post("/follow/:id", protectRoute, followUnfollowUser);
router.post("/update", protectRoute, updateUser);
router.get("/:username/followers", getFollowers);
router.get("/:username/following", getFollowing);


export default router;
