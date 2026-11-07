import Space from "../models/space.model.js";

// GET ALL ACTIVE SPACES
export const getActiveSpaces = async (req, res) => {
	try {
		const spaces = await Space.find({ isActive: true })
			.populate("hostId", "fullName username profileImg")
			.populate("speakers", "fullName username profileImg")
			.populate("listeners", "fullName username profileImg")
			.sort({ createdAt: -1 });

		res.status(200).json(spaces);
	} catch (error) {
		console.error("Error fetching active spaces:", error);
		res.status(500).json({ error: "Failed to fetch active spaces" });
	}
};

// CREATE A NEW LIVE AUDIO SPACE
export const createSpace = async (req, res) => {
	try {
		const userId = req.user._id;
		const { title } = req.body;

		if (!title || !title.trim()) {
			return res.status(400).json({ error: "Space title is required" });
		}

		// End any previously active spaces where user was host
		await Space.updateMany(
			{ hostId: userId, isActive: true },
			{ $set: { isActive: false, endedAt: new Date() } }
		);

		const newSpace = await Space.create({
			title: title.trim(),
			hostId: userId,
			speakers: [userId],
			listeners: [],
			raisedHands: [],
			isActive: true,
		});

		const populated = await Space.findById(newSpace._id)
			.populate("hostId", "fullName username profileImg")
			.populate("speakers", "fullName username profileImg")
			.populate("listeners", "fullName username profileImg");

		res.status(201).json(populated);
	} catch (error) {
		console.error("Error creating space:", error);
		res.status(500).json({ error: "Failed to create space" });
	}
};

// JOIN AN AUDIO SPACE AS LISTENER
export const joinSpace = async (req, res) => {
	try {
		const userId = req.user._id;
		const { spaceId } = req.params;

		const space = await Space.findOne({ _id: spaceId, isActive: true });
		if (!space) return res.status(404).json({ error: "Space not found or has ended" });

		const isSpeaker = space.speakers.some((id) => id.toString() === userId.toString());
		if (!isSpeaker && !space.listeners.some((id) => id.toString() === userId.toString())) {
			space.listeners.push(userId);
			await space.save();
		}

		const populated = await Space.findById(spaceId)
			.populate("hostId", "fullName username profileImg")
			.populate("speakers", "fullName username profileImg")
			.populate("listeners", "fullName username profileImg")
			.populate("raisedHands", "fullName username profileImg");

		res.status(200).json(populated);
	} catch (error) {
		console.error("Error joining space:", error);
		res.status(500).json({ error: "Failed to join space" });
	}
};

// LEAVE AN AUDIO SPACE
export const leaveSpace = async (req, res) => {
	try {
		const userId = req.user._id.toString();
		const { spaceId } = req.params;

		const space = await Space.findById(spaceId);
		if (!space) return res.status(404).json({ error: "Space not found" });

		// If host leaves, end the space
		if (space.hostId.toString() === userId) {
			space.isActive = false;
			space.endedAt = new Date();
			await space.save();
			return res.status(200).json({ ended: true, message: "Space ended by host" });
		}

		space.listeners = space.listeners.filter((id) => id.toString() !== userId);
		space.speakers = space.speakers.filter((id) => id.toString() !== userId);
		space.raisedHands = space.raisedHands.filter((id) => id.toString() !== userId);
		await space.save();

		res.status(200).json({ success: true });
	} catch (error) {
		console.error("Error leaving space:", error);
		res.status(500).json({ error: "Failed to leave space" });
	}
};

// RAISE HAND TO SPEAK
export const raiseHand = async (req, res) => {
	try {
		const userId = req.user._id;
		const { spaceId } = req.params;

		const space = await Space.findOne({ _id: spaceId, isActive: true });
		if (!space) return res.status(404).json({ error: "Space not found" });

		if (!space.raisedHands.some((id) => id.toString() === userId.toString())) {
			space.raisedHands.push(userId);
			await space.save();
		}

		const populated = await Space.findById(spaceId)
			.populate("hostId", "fullName username profileImg")
			.populate("speakers", "fullName username profileImg")
			.populate("listeners", "fullName username profileImg")
			.populate("raisedHands", "fullName username profileImg");

		res.status(200).json(populated);
	} catch (error) {
		console.error("Error raising hand:", error);
		res.status(500).json({ error: "Failed to raise hand" });
	}
};

// PROMOTE LISTENER TO SPEAKER (HOST ONLY)
export const promoteToSpeaker = async (req, res) => {
	try {
		const hostId = req.user._id.toString();
		const { spaceId } = req.params;
		const { targetUserId } = req.body;

		const space = await Space.findById(spaceId);
		if (!space) return res.status(404).json({ error: "Space not found" });

		if (space.hostId.toString() !== hostId) {
			return res.status(403).json({ error: "Only the host can promote speakers" });
		}

		// Remove from listeners and raised hands, add to speakers
		space.listeners = space.listeners.filter((id) => id.toString() !== targetUserId.toString());
		space.raisedHands = space.raisedHands.filter((id) => id.toString() !== targetUserId.toString());
		if (!space.speakers.some((id) => id.toString() === targetUserId.toString())) {
			space.speakers.push(targetUserId);
		}
		await space.save();

		const populated = await Space.findById(spaceId)
			.populate("hostId", "fullName username profileImg")
			.populate("speakers", "fullName username profileImg")
			.populate("listeners", "fullName username profileImg")
			.populate("raisedHands", "fullName username profileImg");

		res.status(200).json(populated);
	} catch (error) {
		console.error("Error promoting speaker:", error);
		res.status(500).json({ error: "Failed to promote speaker" });
	}
};

// END AN AUDIO SPACE (HOST ONLY)
export const endSpace = async (req, res) => {
	try {
		const hostId = req.user._id.toString();
		const { spaceId } = req.params;

		const space = await Space.findById(spaceId);
		if (!space) return res.status(404).json({ error: "Space not found" });

		if (space.hostId.toString() !== hostId) {
			return res.status(403).json({ error: "Only the host can end the space" });
		}

		space.isActive = false;
		space.endedAt = new Date();
		await space.save();

		res.status(200).json({ success: true, message: "Space ended" });
	} catch (error) {
		console.error("Error ending space:", error);
		res.status(500).json({ error: "Failed to end space" });
	}
};
