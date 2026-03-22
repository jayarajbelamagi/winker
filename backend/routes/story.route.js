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

// Configure multer for memory storage (we'll stream to Cloudinary)
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", protectRoute, upload.single("media"), createStory);           // Only logged-in users
router.get("/user/:userId", getUserStories);
router.get("/feed/:userId", getFeedStories);
router.post("/viewed", protectRoute, markStoryViewed); // Only logged-in users
router.delete("/:storyId", protectRoute, deleteStory); // Only owner

export default router;
