import crypto from "crypto";
import { generateTokenAndSetCookie } from "../lib/utils/generateToken.js";
import { getJwtCookieOptions } from "../lib/utils/cookieOptions.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";

export const signup = async (req, res) => {
	try {
		const { fullName, username, email, password } = req.body;

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({ error: "Invalid email format" });
		}

		const existingUser = await User.findOne({ username });
		if (existingUser) {
			return res.status(400).json({ error: "Username is already taken" });
		}

		const existingEmail = await User.findOne({ email });
		if (existingEmail) {
			return res.status(400).json({ error: "Email is already taken" });
		}

		if (password.length < 6) {
			return res.status(400).json({ error: "Password must be at least 6 characters long" });
		}

		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		const newUser = new User({
			fullName,
			username,
			email,
			password: hashedPassword,
		});

		if (newUser) {
			const token = generateTokenAndSetCookie(newUser._id, res);
			await newUser.save();

			res.status(201).json({
				_id: newUser._id,
				fullName: newUser.fullName,
				username: newUser.username,
				email: newUser.email,
				followers: newUser.followers,
				following: newUser.following,
				profileImg: newUser.profileImg,
				coverImg: newUser.coverImg,
				bookmarks: newUser.bookmarks,
				token,
			});
		} else {
			res.status(400).json({ error: "Invalid user data" });
		}
	} catch (error) {
		console.log("Error in signup controller", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const login = async (req, res) => {
	try {
		const { username, password } = req.body;
		const user = await User.findOne({ username });
		const isPasswordCorrect = await bcrypt.compare(password, user?.password || "");

		if (!user || !isPasswordCorrect) {
			return res.status(400).json({ error: "Invalid username or password" });
		}

		const token = generateTokenAndSetCookie(user._id, res);

		res.status(200).json({
			_id: user._id,
			fullName: user.fullName,
			username: user.username,
			email: user.email,
			followers: user.followers,
			following: user.following,
			profileImg: user.profileImg,
			coverImg: user.coverImg,
			bookmarks: user.bookmarks,
			token,
		});
	} catch (error) {
		console.log("Error in login controller", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const logout = async (req, res) => {
	try {
		res.cookie("jwt", "", getJwtCookieOptions(0));
		res.status(200).json({ message: "Logged out successfully" });
	} catch (error) {
		console.log("Error in logout controller", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const getMe = async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select("-password");
		res.status(200).json(user);
	} catch (error) {
		console.log("Error in getMe controller", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

// SOCIAL LOGIN (Google, X / Twitter)
export const socialLogin = async (req, res) => {
	try {
		const { provider = "google", email, fullName, avatar } = req.body;

		if (!email) {
			return res.status(400).json({ error: "Email is required for social login" });
		}

		let user = await User.findOne({ email });

		if (!user) {
			let baseUsername = (fullName || email.split("@")[0])
				.toLowerCase()
				.replace(/[^a-z0-9]/g, "")
				.slice(0, 15);
			if (!baseUsername) baseUsername = "user";
			let username = `${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`;

			while (await User.findOne({ username })) {
				username = `${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`;
			}

			const randomPassword = crypto.randomBytes(16).toString("hex");
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = await bcrypt.hash(randomPassword, salt);

			user = new User({
				fullName: fullName || username,
				username,
				email,
				password: hashedPassword,
				profileImg: avatar || "/avatar-placeholder.png",
				authProvider: provider,
			});
			await user.save();
		}

		const token = generateTokenAndSetCookie(user._id, res);

		res.status(200).json({
			_id: user._id,
			fullName: user.fullName,
			username: user.username,
			email: user.email,
			followers: user.followers,
			following: user.following,
			profileImg: user.profileImg,
			coverImg: user.coverImg,
			bookmarks: user.bookmarks,
			token,
		});
	} catch (error) {
		console.error("Error in socialLogin:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

// FORGOT PASSWORD
export const forgotPassword = async (req, res) => {
	try {
		const { email } = req.body;
		if (!email) {
			return res.status(400).json({ error: "Please provide your email address" });
		}

		const user = await User.findOne({ email: email.toLowerCase().trim() });
		if (!user) {
			// Don't leak account existence
			return res.status(200).json({
				message: "If an account exists with that email, a password reset link has been generated.",
			});
		}

		const resetToken = crypto.randomBytes(32).toString("hex");
		user.resetPasswordToken = resetToken;
		user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
		await user.save();

		const resetLink = `/reset-password/${resetToken}`;

		res.status(200).json({
			message: "Password reset link generated successfully.",
			resetToken,
			resetLink,
		});
	} catch (error) {
		console.error("Error in forgotPassword:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
	try {
		const { token, newPassword } = req.body;

		if (!token || !newPassword) {
			return res.status(400).json({ error: "Token and new password are required" });
		}

		if (newPassword.length < 6) {
			return res.status(400).json({ error: "Password must be at least 6 characters" });
		}

		const user = await User.findOne({
			resetPasswordToken: token,
			resetPasswordExpires: { $gt: Date.now() },
		});

		if (!user) {
			return res.status(400).json({ error: "Invalid or expired password reset token" });
		}

		const salt = await bcrypt.genSalt(10);
		user.password = await bcrypt.hash(newPassword, salt);
		user.resetPasswordToken = null;
		user.resetPasswordExpires = null;
		await user.save();

		res.status(200).json({ message: "Password has been reset successfully. Please log in." });
	} catch (error) {
		console.error("Error in resetPassword:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
