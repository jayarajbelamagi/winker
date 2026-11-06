import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";

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

// GET USER PROFILE
export const getUserProfile = async (req, res) => {
	try {
		const user = await User.findOne({ username: req.params.username }).select("-password");
		if (!user) return res.status(404).json({ message: "User not found" });
		res.status(200).json(user);
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

// GET SUGGESTED USERS
export const getSuggestedUsers = async (req, res) => {
	try {
		const user = await User.findById(req.user._id);
		const users = await User.aggregate([{ $match: { _id: { $ne: user._id } } }, { $sample: { size: 10 } }]);
		const suggestedUsers = users.filter(u => !user.following.includes(u._id)).slice(0, 4);
		suggestedUsers.forEach(u => u.password = null);
		res.status(200).json(suggestedUsers);
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
