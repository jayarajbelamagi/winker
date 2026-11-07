import Story from "../models/story.model.js";
import User from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB limit strictly enforced

// Create a story (photo or video up to 8MB, 15s max, optional music)
export const createStory = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "User not logged in" });

    const { type, caption } = req.body;
    let music = null;
    if (req.body.music) {
      try {
        music = typeof req.body.music === "string" ? JSON.parse(req.body.music) : req.body.music;
      } catch (e) {
        music = null;
      }
    }

    // Enforce 8MB limit check
    if (req.file && req.file.size > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: "File size exceeds 8MB limit. Please select a smaller file." });
    }

    // Support multipart buffer or base64/url
    let uploadRes;
    if (req.file && req.file.buffer) {
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
      // Check approximate base64 size (base64 length * 0.75)
      if (typeof req.body.media === "string" && req.body.media.length * 0.75 > MAX_FILE_SIZE_BYTES + 500000) {
        return res.status(400).json({ error: "File size exceeds 8MB limit. Please select a smaller file." });
      }
      uploadRes = await cloudinary.uploader.upload(req.body.media, {
        resource_type: type === "video" ? "video" : "image",
        folder: "stories",
      });
    } else {
      return res.status(400).json({ error: "Media is required" });
    }

    const story = await Story.create({
      userId,
      user: userId,
      mediaUrl: uploadRes.secure_url,
      type: type === "video" ? "video" : "image",
      caption: caption || "",
      music: music || { title: "", artist: "", previewUrl: "", artwork: "" },
      duration: 15, // strictly 15s
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24-hour expiration
    });

    const populated = await Story.findById(story._id)
      .populate("user", "username fullName profileImg")
      .populate("userId", "username fullName profileImg");
    res.status(201).json(populated);
  } catch (err) {
    console.error("Error creating story:", err);
    res.status(500).json({ error: err.message || "Failed to create story" });
  }
};

// Get all active stories of a specific user
export const getUserStories = async (req, res) => {
  try {
    const { userId } = req.params;
    const stories = await Story.find({
      $or: [{ userId }, { user: userId }],
      expiresAt: { $gt: new Date() },
    })
      .populate("user", "username fullName profileImg")
      .populate("userId", "username fullName profileImg")
      .populate("likes", "username fullName profileImg")
      .sort({ createdAt: 1 });
    res.json(stories);
  } catch (err) {
    console.error("Error fetching user stories:", err);
    res.status(500).json({ error: "Failed to fetch stories" });
  }
};

// Get feed stories (followed users + logged-in user), grouped by user
export const getFeedStories = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const targetUserIds = [user._id, ...(user.following || [])];

    const rawStories = await Story.find({
      $or: [{ userId: { $in: targetUserIds } }, { user: { $in: targetUserIds } }],
      expiresAt: { $gt: new Date() },
    })
      .populate("user", "username fullName profileImg")
      .populate("userId", "username fullName profileImg")
      .sort({ createdAt: 1 });

    // Group stories by user
    const groupedMap = new Map();
    for (const story of rawStories) {
      const u = (story.user && story.user._id)
        ? story.user
        : ((story.userId && story.userId._id)
          ? story.userId
          : (story.user || story.userId));
      const uId = (u?._id || story.userId || story.user)?.toString();
      if (!uId) continue;

      if (!groupedMap.has(uId)) {
        groupedMap.set(uId, {
          user: u,
          stories: [],
          hasUnviewed: false,
          latestCreatedAt: story.createdAt,
        });
      }
      const entry = groupedMap.get(uId);
      entry.stories.push(story);
      entry.latestCreatedAt = story.createdAt;

      // If current user hasn't viewed this story, mark hasUnviewed
      const hasViewed = (story.viewers || []).some(
        (vId) => (vId?._id || vId)?.toString() === userId.toString()
      );
      if (!hasViewed) {
        entry.hasUnviewed = true;
      }
    }

    // Convert map to array: Put user's own stories first (if any), then sort others by unviewed status and latest date
    const groupedArray = Array.from(groupedMap.values()).sort((a, b) => {
      const aId = (a.user?._id || a.user)?.toString();
      const bId = (b.user?._id || b.user)?.toString();
      const aIsSelf = aId === userId.toString();
      const bIsSelf = bId === userId.toString();
      if (aIsSelf) return -1;
      if (bIsSelf) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return new Date(b.latestCreatedAt) - new Date(a.latestCreatedAt);
    });

    res.json(groupedArray);
  } catch (err) {
    console.error("Error fetching feed stories:", err);
    res.status(500).json({ error: "Failed to fetch feed stories" });
  }
};

// Mark story as viewed
export const markStoryViewed = async (req, res) => {
  try {
    const viewerId = req.user?._id;
    if (!viewerId) return res.status(401).json({ error: "User not logged in" });

    const { storyId } = req.body;
    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });

    if (!story.viewers.some((id) => id.toString() === viewerId.toString())) {
      story.viewers.push(viewerId);
      await story.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error marking story as viewed:", err);
    res.status(500).json({ error: "Failed to mark story as viewed" });
  }
};

// Like / Unlike story
export const likeStory = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "User not logged in" });

    const { storyId } = req.params;
    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });

    const userLiked = story.likes.some((id) => id.toString() === userId.toString());
    if (userLiked) {
      story.likes = story.likes.filter((id) => id.toString() !== userId.toString());
    } else {
      story.likes.push(userId);
    }
    await story.save();

    res.json({
      success: true,
      liked: !userLiked,
      likesCount: story.likes.length,
    });
  } catch (err) {
    console.error("Error liking story:", err);
    res.status(500).json({ error: "Failed to like story" });
  }
};

// Get story viewers (only creator can view)
export const getStoryViewers = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "User not logged in" });

    const { storyId } = req.params;
    const story = await Story.findById(storyId).populate(
      "viewers",
      "username fullName profileImg"
    );
    if (!story) return res.status(404).json({ error: "Story not found" });

    const ownerId = (story.userId?._id || story.userId || story.user?._id || story.user)?.toString();
    if (ownerId !== userId.toString()) {
      return res.status(403).json({ error: "Only the story owner can view the viewer list" });
    }

    res.json({ viewers: story.viewers || [] });
  } catch (err) {
    console.error("Error getting story viewers:", err);
    res.status(500).json({ error: "Failed to fetch viewers" });
  }
};

// Delete a story
export const deleteStory = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "User not logged in" });

    const { storyId } = req.params;
    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });

    const ownerId = (story.userId?._id || story.userId || story.user?._id || story.user)?.toString();
    if (ownerId !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await Story.findByIdAndDelete(storyId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting story:", err);
    res.status(500).json({ error: "Failed to delete story" });
  }
};
