import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
	{
		senderId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		receiverId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: false,
			default: null,
		},
		conversationId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Conversation",
			default: null,
			index: true,
		},
		isGroupMessage: {
			type: Boolean,
			default: false,
		},
		isSystem: {
			type: Boolean,
			default: false,
		},
		text: {
			type: String,
			default: "",
		},
		img: {
			type: String,
			default: null,
		},
		audio: {
			type: String,
			default: null,
		},
		audioDuration: {
			type: Number,
			default: 0,
		},
		mediaType: {
			type: String,
			enum: ["text", "image", "video", "audio"],
			default: "text",
		},
		isViewOnce: {
			type: Boolean,
			default: false,
		},
		viewedBy: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
				default: [],
			},
		],
		reactions: [
			{
				user: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "User",
				},
				emoji: {
					type: String,
					required: true,
				},
			},
		],
		starredBy: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
				default: [],
			},
		],
		status: {
			type: String,
			enum: ["sent", "delivered", "read"],
			default: "sent",
		},
		callInfo: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
		sharedPost: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Post",
			default: null,
		},
		seen: {
			type: Boolean,
			default: false,
		},
		seenAt: {
			type: Date,
			default: null,
		},
	},
	{ timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
