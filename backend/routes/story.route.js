import express from "express";
import {
  createStory,
  getUserStories,
  getFeedStories,
  markStoryViewed,
  deleteStory,
} from "../controllers/story.controller.js";
import { protectRoute } from "../middleware/protectRoute.js";
import multer from "multer";

const router = express.Router();

// Configure multer for memory storage up to 50MB (handles camera photos and short videos)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post("/", protectRoute, upload.single("media"), createStory); // Only logged-in users
router.get("/user/:userId", getUserStories);
router.get("/feed/:userId", getFeedStories);
router.post("/viewed", protectRoute, markStoryViewed); // Only logged-in users
router.delete("/:storyId", protectRoute, deleteStory); // Only owner

export default router;
