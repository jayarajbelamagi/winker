import Story from "../models/story.model.js";
import User from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary";

// Create a story
export const createStory = async (req, res) => {
  try {
    const userId = req.user?._id; // get userId from JWT middleware
    if (!userId) return res.status(401).json({ error: "User not logged in" });

    const { type, caption } = req.body;

    // Support both multipart upload (via multer memoryStorage) and base64/url in body
    let uploadRes;
    if (req.file && req.file.buffer) {
      // Faster: stream buffer to Cloudinary instead of base64 encoding
      uploadRes = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: type === "video" ? "video" : "image",
            folder: "stories",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
    } else if (req.body.media) {
      uploadRes = await cloudinary.uploader.upload(req.body.media, {
        resource_type: type === "video" ? "video" : "image",
        folder: "stories",
      });
    } else {
      return res.status(400).json({ error: "Media is required" });
    }

    const story = await Story.create({
      userId,
      mediaUrl: uploadRes.secure_url,
      type,
      caption,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // expire after 24h
    });

    res.status(201).json(story);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create story" });
  }
};

// Get all stories of a user
export const getUserStories = async (req, res) => {
  try {
    const { userId } = req.params;
    const stories = await Story.find({ userId, expiresAt: { $gt: new Date() } })
      .populate("user", "username profileImg")
      .sort({ createdAt: -1 });
    res.json(stories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stories" });
  }
};

// Get stories from followed users (feed)
export const getFeedStories = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Include user's own stories in the feed
    const followedPlusSelf = [...new Set([user._id, ...user.following])];

    const stories = await Story.find({ userId: { $in: followedPlusSelf }, expiresAt: { $gt: new Date() } })
      .populate("user", "username profileImg")
      .sort({ createdAt: -1 });

    res.json(stories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch feed stories" });
  }
};

// Mark story as viewed
export const markStoryViewed = async (req, res) => {
  try {
    const viewerId = req.user?._id; // get viewerId from JWT middleware
    if (!viewerId) return res.status(401).json({ error: "User not logged in" });

    const { storyId } = req.body;
    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });

    if (!story.viewers.includes(viewerId)) {
      story.viewers.push(viewerId);
      await story.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark story as viewed" });
  }
};

// Delete a story
export const deleteStory = async (req, res) => {
  try {
    const userId = req.user?._id; // get userId from JWT middleware
    if (!userId) return res.status(401).json({ error: "User not logged in" });

    const { storyId } = req.params;
    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });

    if (story.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await Story.findByIdAndDelete(storyId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete story" });
  }
};
