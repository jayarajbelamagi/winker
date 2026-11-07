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
		mediaType: {
			type: String,
			enum: ["image", "video"],
			default: "image",
		},
		poll: {
			question: { type: String, default: "" },
			options: [
				{
					text: { type: String, required: true },
					votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
				},
			],
			expiresAt: { type: Date, default: null },
		},
		quotedPost: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Post",
			default: null,
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
				createdAt: {
					type: Date,
					default: Date.now,
				},
				likes: [
					{
						type: mongoose.Schema.Types.ObjectId,
						ref: "User",
					},
				],
				replies: [
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
						createdAt: {
							type: Date,
							default: Date.now,
						},
						likes: [
							{
								type: mongoose.Schema.Types.ObjectId,
								ref: "User",
							},
						],
					},
				],
			},
		],
	},
	{ timestamps: true }
);

// TTL Index: Automatically clean up expired 24h posts from database
postSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Post = mongoose.model("Post", postSchema);

export default Post;
