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
		callInfo: {
			type: mongoose.Schema.Types.Mixed,
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
