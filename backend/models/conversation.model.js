import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
	{
		participants: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
				required: true,
			},
		],
		messages: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Message",
				default: [],
			},
		],
		pinnedBy: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
				default: [],
			},
		],
		isGroup: {
			type: Boolean,
			default: false,
			index: true,
		},
		groupName: {
			type: String,
			default: "",
			trim: true,
		},
		groupImg: {
			type: String,
			default: "",
		},
		groupDescription: {
			type: String,
			default: "",
		},
		groupAdmin: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},
		lastMessage: {
			text: { type: String, default: "" },
			senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
			seen: { type: Boolean, default: false },
			createdAt: { type: Date, default: Date.now },
		},
		streak: {
			count: { type: Number, default: 0 },
			lastInteractionAt: { type: Date, default: null },
			lastBumpedAt: { type: Date, default: null },
			lastInteractionUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
		},
		wallpapers: {
			type: Map,
			of: String,
			default: {},
		},
	},
	{ timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
