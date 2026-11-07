import mongoose from "mongoose";

const storySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  mediaUrl: { type: String, required: true },
  type: { type: String, enum: ["image", "video"], default: "image" },
  caption: { type: String, default: "" },
  music: {
    title: { type: String, default: "" },
    artist: { type: String, default: "" },
    previewUrl: { type: String, default: "" },
    artwork: { type: String, default: "" },
  },
  duration: { type: Number, default: 15 }, // stories are strictly 15s
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
});

// Auto-delete expired stories
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Synchronize user and userId
storySchema.pre("save", function (next) {
  if (!this.user && this.userId) this.user = this.userId;
  if (!this.userId && this.user) this.userId = this.user;
  next();
});

storySchema.set("toObject", { virtuals: true });
storySchema.set("toJSON", { virtuals: true });

export default mongoose.model("Story", storySchema);
