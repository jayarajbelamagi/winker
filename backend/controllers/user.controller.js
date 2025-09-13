import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";

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
			const salt = await bcrypt.genSalt(10);
			user.password = await bcrypt.hash(newPassword, salt);
		}

		if (profileImg) {
			if (user.profileImg) await cloudinary.uploader.destroy(user.profileImg.split("/").pop().split(".")[0]);
			const uploaded = await cloudinary.uploader.upload(profileImg);
			profileImg = uploaded.secure_url;
		}

		if (coverImg) {
			if (user.coverImg) await cloudinary.uploader.destroy(user.coverImg.split("/").pop().split(".")[0]);
			const uploaded = await cloudinary.uploader.upload(coverImg);
			coverImg = uploaded.secure_url;
		}

		user.fullName = fullName || user.fullName;
		user.email = email || user.email;
		user.username = username || user.username;
		user.bio = bio || user.bio;
		user.link = link || user.link;
		user.profileImg = profileImg || user.profileImg;
		user.coverImg = coverImg || user.coverImg;

		await user.save();
		user.password = null;
		res.status(200).json(user);
	} catch (error) {
		console.error("Error in updateUser:", error);
		res.status(500).json({ error: error.message });
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
