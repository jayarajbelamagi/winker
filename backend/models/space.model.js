import mongoose from "mongoose";

const spaceSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
		},
		hostId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		speakers: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
				default: [],
			},
		],
		listeners: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
				default: [],
			},
		],
		raisedHands: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
				default: [],
			},
		],
		isActive: {
			type: Boolean,
			default: true,
			index: true,
		},
		startedAt: {
			type: Date,
			default: Date.now,
		},
		endedAt: {
			type: Date,
			default: null,
		},
	},
	{ timestamps: true }
);

spaceSchema.index({ isActive: 1, startedAt: -1 });

const Space = mongoose.model("Space", spaceSchema);

export default Space;
