import mongoose from "mongoose";

const communitySchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
			maxlength: 50,
		},
		slug: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
			index: true,
		},
		description: {
			type: String,
			default: "",
			maxlength: 300,
		},
		avatar: {
			type: String,
			default: "",
		},
		banner: {
			type: String,
			default: "",
		},
		category: {
			type: String,
			enum: ["Tech", "Gaming", "Sports", "Music", "College", "Memes", "Design", "General"],
			default: "General",
		},
		creator: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		admins: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		members: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		rules: [
			{
				type: String,
			},
		],
		isPrivate: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

communitySchema.index({ name: "text", description: "text" });

const Community = mongoose.model("Community", communitySchema);

export default Community;
