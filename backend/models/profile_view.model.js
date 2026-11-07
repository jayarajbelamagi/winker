import mongoose from "mongoose";

const profileViewSchema = new mongoose.Schema(
  {
    profileUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    viewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    viewCount: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

// Ensure one record per viewer-profileUser pair with quick lookup
profileViewSchema.index({ profileUser: 1, viewer: 1 }, { unique: true });
profileViewSchema.index({ profileUser: 1, viewedAt: -1 });

const ProfileView = mongoose.model("ProfileView", profileViewSchema);

export default ProfileView;
