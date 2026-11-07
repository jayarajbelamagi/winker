import express from "express";
import {
  createStory,
  getUserStories,
  getFeedStories,
  markStoryViewed,
  likeStory,
  getStoryViewers,
  deleteStory,
} from "../controllers/story.controller.js";
import { protectRoute } from "../middleware/protectRoute.js";
import multer from "multer";

const router = express.Router();

// Configure multer for memory storage up to 8MB strictly
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB limit
});

router.post("/", protectRoute, upload.single("media"), createStory);
router.get("/user/:userId", getUserStories);
router.get("/feed/:userId", getFeedStories);
router.post("/viewed", protectRoute, markStoryViewed);
router.post("/like/:storyId", protectRoute, likeStory);
router.get("/viewers/:storyId", protectRoute, getStoryViewers);
router.delete("/:storyId", protectRoute, deleteStory);

export default router;
