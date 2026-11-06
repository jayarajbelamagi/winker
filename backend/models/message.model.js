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
			callType: {
				type: String,
				enum: ["audio", "video"],
				default: null,
			},
			status: {
				type: String,
				enum: ["completed", "missed", "declined"],
				default: null,
			},
			duration: {
				type: Number,
				default: 0, // in seconds
			},
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
