import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import Notification from "../models/notification.model.js";
import ProfileView from "../models/profile_view.model.js";

// Helper to safely extract public ID from Cloudinary URL
const getCloudinaryPublicId = (url) => {
	if (!url || !url.includes("res.cloudinary.com")) return null;
	try {
		const parts = url.split("/");
		const filename = parts.pop();
		const publicId = filename.split(".")[0];
		// Check if inside a folder
		const folder = parts[parts.length - 1];
		return folder && folder !== "upload" ? `${folder}/${publicId}` : publicId;
	} catch (e) {
		return null;
	}
};

// GET USER PROFILE (By username OR _id)
export const getUserProfile = async (req, res) => {
	try {
		const identifier = req.params.username;
		let user = null;

		if (mongoose.isValidObjectId(identifier)) {
			user = await User.findById(identifier).select("-password");
		}
		if (!user) {
			user = await User.findOne({ username: identifier }).select("-password");
		}

		if (!user) return res.status(404).json({ message: "User not found" });

		// Record profile view (LinkedIn style) non-blockingly if viewed by another user
		if (req.user && req.user._id.toString() !== user._id.toString()) {
			ProfileView.findOneAndUpdate(
				{ profileUser: user._id, viewer: req.user._id },
				{
					$set: { viewedAt: new Date() },
					$inc: { viewCount: 1 },
				},
				{ upsert: true }
			).catch((err) => console.error("Error recording profile view:", err.message));
		}

		// Attach posts count and profile views stats
		const userObj = user.toObject ? user.toObject() : { ...user };
		const postsCount = await Post.countDocuments({ user: user._id });
		userObj.postsCount = postsCount;

		if (req.user && req.user._id.toString() === user._id.toString()) {
			const viewCount = await ProfileView.countDocuments({ profileUser: user._id });
			userObj.profileViewsCount = viewCount;
		}

		res.status(200).json(userObj);
	} catch (error) {
		console.error("Error in getUserProfile:", error);
		res.status(500).json({ error: error.message });
	}
};

// FOLLOW / UNFOLLOW USER
export const followUnfollowUser = async (req, res) => {
	try {
		const userToModify = await User.findById(req.params.id);
		const currentUser = await User.findById(req.user._id);

		if (!userToModify || !currentUser) return res.status(404).json({ error: "User not found" });
		if (userToModify._id.toString() === req.user._id.toString()) return res.status(400).json({ error: "Cannot follow yourself" });

		const isFollowing = currentUser.following.includes(req.params.id);

		if (isFollowing) {
			await User.findByIdAndUpdate(req.params.id, { $pull: { followers: req.user._id } });
			await User.findByIdAndUpdate(req.user._id, { $pull: { following: req.params.id } });
			return res.status(200).json({ message: "User unfollowed" });
		} else {
			await User.findByIdAndUpdate(req.params.id, { $push: { followers: req.user._id } });
			await User.findByIdAndUpdate(req.user._id, { $push: { following: req.params.id } });
			await new Notification({ type: "follow", from: req.user._id, to: userToModify._id }).save();
			return res.status(200).json({ message: "User followed" });
		}
	} catch (error) {
		console.error("Error in followUnfollowUser:", error);
		res.status(500).json({ error: error.message });
	}
};

// GET SUGGESTED USERS ("People You May Know" Mutual Connections Algorithm)
export const getSuggestedUsers = async (req, res) => {
	try {
		const currentUser = await User.findById(req.user._id).select("following");
		if (!currentUser) return res.status(404).json({ error: "User not found" });

		const myFollowing = (currentUser.following || []).map((id) => id.toString());

		// Candidate pool: users not me and not already followed
		const candidates = await User.find({
			_id: { $ne: req.user._id, $nin: currentUser.following },
		})
			.select("fullName username profileImg bio followers following")
			.populate("followers", "fullName username")
			.lean();

		// Calculate mutual connections for each candidate
		const scoredCandidates = candidates.map((candidate) => {
			const candidateFollowers = (candidate.followers || []).map((f) => ({
				_id: f._id ? f._id.toString() : f.toString(),
				fullName: f.fullName || "",
				username: f.username || "",
			}));

			// Intersection: candidate's followers who are also in my following list
			const mutuals = candidateFollowers.filter((f) => myFollowing.includes(f._id));

			let mutualText = "";
			if (mutuals.length === 1) {
				mutualText = `Followed by @${mutuals[0].username}`;
			} else if (mutuals.length === 2) {
				mutualText = `Followed by @${mutuals[0].username} and @${mutuals[1].username}`;
			} else if (mutuals.length > 2) {
				mutualText = `Followed by @${mutuals[0].username} and ${mutuals.length - 1} others you know`;
			}

			return {
				...candidate,
				followers: undefined,
				following: undefined,
				mutualCount: mutuals.length,
				mutualText,
				mutualSample: mutuals.slice(0, 2),
			};
		});

		// Sort by mutual count first (highest mutual friends), then random
		scoredCandidates.sort((a, b) => b.mutualCount - a.mutualCount);

		res.status(200).json(scoredCandidates.slice(0, 5));
	} catch (error) {
		console.error("Error in getSuggestedUsers:", error);
		res.status(500).json({ error: error.message });
	}
};

// UPDATE USER PROFILE
export const updateUser = async (req, res) => {
	try {
		const { fullName, email, username, currentPassword, newPassword, bio, link } = req.body;
		let { profileImg, coverImg } = req.body;

		const user = await User.findById(req.user._id);
		if (!user) return res.status(404).json({ error: "User not found" });

		if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
			return res.status(400).json({ error: "Both current and new password are required" });
		}

		if (currentPassword && newPassword) {
			const match = await bcrypt.compare(currentPassword, user.password);
			if (!match) return res.status(400).json({ error: "Current password incorrect" });
			if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
			const salt = await bcrypt.genSalt(10);
			user.password = await bcrypt.hash(newPassword, salt);
		}

		// Handle profileImg upload only if newly provided as base64 or changed
		if (profileImg && profileImg.startsWith("data:image/")) {
			try {
				const oldId = getCloudinaryPublicId(user.profileImg);
				if (oldId) {
					try {
						await cloudinary.uploader.destroy(oldId);
					} catch (delErr) {
						console.warn("Could not delete old profileImg from Cloudinary:", delErr.message);
					}
				}

				const uploaded = await cloudinary.uploader.upload(profileImg, {
					folder: "winker_profiles",
					resource_type: "image",
				});
				profileImg = uploaded.secure_url;
			} catch (cloudErr) {
				console.error("Cloudinary profileImg upload error:", cloudErr.message);
				// Keep existing image if upload fails
				profileImg = user.profileImg;
			}
		}

		// Handle coverImg upload only if newly provided as base64 or changed
		if (coverImg && coverImg.startsWith("data:image/")) {
			try {
				const oldId = getCloudinaryPublicId(user.coverImg);
				if (oldId) {
					try {
						await cloudinary.uploader.destroy(oldId);
					} catch (delErr) {
						console.warn("Could not delete old coverImg from Cloudinary:", delErr.message);
					}
				}

				const uploaded = await cloudinary.uploader.upload(coverImg, {
					folder: "winker_covers",
					resource_type: "image",
				});
				coverImg = uploaded.secure_url;
			} catch (cloudErr) {
				console.error("Cloudinary coverImg upload error:", cloudErr.message);
				// Keep existing cover if upload fails
				coverImg = user.coverImg;
			}
		}

		user.fullName = fullName || user.fullName;
		user.email = email || user.email;
		user.username = username || user.username;
		user.bio = typeof bio !== "undefined" ? bio : user.bio;
		user.link = typeof link !== "undefined" ? link : user.link;
		user.profileImg = profileImg || user.profileImg;
		user.coverImg = coverImg || user.coverImg;

		await user.save();
		user.password = null;
		res.status(200).json(user);
	} catch (error) {
		console.error("Error in updateUser:", error);
		res.status(500).json({ error: error.message || "Failed to update profile" });
	}
};

// GET FOLLOWERS LIST
export const getFollowers = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .populate("followers", "-password");
      
    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json(user.followers);
  } catch (error) {
    console.error("Error in getFollowers:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET FOLLOWING LIST
export const getFollowing = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .populate("following", "-password");
      
    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json(user.following);
  } catch (error) {
    console.error("Error in getFollowing:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET PROFILE VIEWS (LinkedIn-style Who Viewed Your Profile)
export const getProfileViews = async (req, res) => {
  try {
    const userId = req.user._id;

    const views = await ProfileView.find({ profileUser: userId })
      .sort({ viewedAt: -1 })
      .limit(60)
      .populate({
        path: "viewer",
        select: "username fullName profileImg bio followers following",
      });

    // Clean out any references where user may no longer exist
    const validViews = views.filter((v) => Boolean(v.viewer));

    const totalViews = validViews.reduce((acc, v) => acc + (v.viewCount || 1), 0);
    const uniqueViewersCount = validViews.length;

    res.status(200).json({
      views: validViews,
      totalViews,
      uniqueViewersCount,
    });
  } catch (error) {
    console.error("Error in getProfileViews:", error);
    res.status(500).json({ error: error.message });
  }
};
