import mongoose from "mongoose";

const callSessionSchema = new mongoose.Schema(
	{
		callId: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		callerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		receiverId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		caller: {
			_id: { type: String, required: true },
			fullName: { type: String, default: "" },
			username: { type: String, default: "" },
			profileImg: { type: String, default: "/avatar-placeholder.png" },
		},
		receiver: {
			_id: { type: String, required: true },
			fullName: { type: String, default: "" },
			username: { type: String, default: "" },
			profileImg: { type: String, default: "/avatar-placeholder.png" },
		},
		callType: {
			type: String,
			enum: ["audio", "video"],
			default: "audio",
		},
		status: {
			type: String,
			enum: ["ringing", "connected", "declined", "ended", "missed"],
			default: "ringing",
			index: true,
		},
		startedAt: {
			type: Number,
			default: () => Date.now(),
		},
		connectedAt: {
			type: Number,
			default: null,
		},
		endedAt: {
			type: Number,
			default: null,
		},
		callerSignal: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
		receiverSignal: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
		callerCandidates: {
			type: [mongoose.Schema.Types.Mixed],
			default: [],
		},
		receiverCandidates: {
			type: [mongoose.Schema.Types.Mixed],
			default: [],
		},
	},
	{ timestamps: true }
);

callSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7200 });

const CallSession = mongoose.model("CallSession", callSessionSchema);
export default CallSession;
