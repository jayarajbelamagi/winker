import mongoose from "mongoose";

const storySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  mediaUrl: { type: String, required: true },
  type: { type: String, enum: ["image", "video"], default: "image" },
  caption: { type: String, default: "" }, // default empty string
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
});

// Auto-delete expired stories
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual to populate user info easily in frontend
storySchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

storySchema.set("toObject", { virtuals: true });
storySchema.set("toJSON", { virtuals: true });

export default mongoose.model("Story", storySchema);
