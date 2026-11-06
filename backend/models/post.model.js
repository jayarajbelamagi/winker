import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		text: {
			type: String,
		},
		img: {
			type: String,
		},
		is24hStory: {
			type: Boolean,
			default: false,
		},
		expiresAt: {
			type: Date,
			default: null,
		},
		likes: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		comments: [
			{
				text: {
					type: String,
					required: true,
				},
				user: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "User",
					required: true,
				},
			},
		],
	},
	{ timestamps: true }
);

// TTL Index: Automatically clean up expired 24h posts from database
postSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Post = mongoose.model("Post", postSchema);

export default Post;
