import Notification from "../models/notification.model.js";

export const getNotifications = async (req, res) => {
	try {
		const userId = req.user._id;
		// Filter notifications from the last 24 hours only
		const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

		const notifications = await Notification.find({
			to: userId,
			createdAt: { $gte: last24Hours },
		})
			.sort({ createdAt: -1 })
			.populate({
				path: "from",
				select: "username fullName profileImg",
			});

		await Notification.updateMany(
			{ to: userId, createdAt: { $gte: last24Hours } },
			{ read: true }
		);

		res.status(200).json(notifications);
	} catch (error) {
		console.log("Error in getNotifications function", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const deleteNotifications = async (req, res) => {
	try {
		const userId = req.user._id;

		await Notification.deleteMany({ to: userId });

		res.status(200).json({ message: "Notifications deleted successfully" });
	} catch (error) {
		console.log("Error in deleteNotifications function", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};
