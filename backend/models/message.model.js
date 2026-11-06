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
			required: true,
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

const Message = mongoose.model("Message", messageSchema);

export default Message;
