import { useState } from "react";
import { FaPlus } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { apiFetch } from "../../lib/api";

const StoryUploader = ({ authUser, onUploadSuccess }) => {
  const [media, setMedia] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (fileToUpload) => {
    const file = fileToUpload || media;
    if (!authUser?._id) return toast.error("You must be logged in to upload stories");
    if (!file) return toast.error("Select a media file first");

    const formData = new FormData();
    formData.append("media", file);
    formData.append("type", file.type?.startsWith("video") ? "video" : "image");
    formData.append("userId", authUser._id);

    try {
      setIsUploading(true);
      const res = await apiFetch("/api/stories", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      toast.success("Story uploaded!");
      setMedia(null);
      window.dispatchEvent(new Event("stories:refresh"));
      onUploadSuccess && onUploadSuccess();
    } catch (err) {
      toast.error(err.message || "Failed to upload story");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelect = (file) => {
    if (!file) return;
    setMedia(file);
    handleUpload(file);
  };

  return (
    <div className="relative w-20 h-20 rounded-full overflow-hidden cursor-pointer flex items-center justify-center flex-shrink-0">
      {/* Loading ring overlay */}
      {isUploading && (
        <div className="absolute inset-0 rounded-full border-4 border-pink-500/40 border-t-transparent animate-spin z-10" />
      )}
      <img
        src={authUser?.profileImg || "/avatar-placeholder.png"}
        alt=""
        className={`object-cover w-full h-full rounded-full ${isUploading ? "opacity-70" : ""}`}
      />
      <label
        className={`absolute bottom-0 right-0 w-6 h-6 ${
          isUploading ? "bg-gray-400" : "bg-blue-500"
        } text-white rounded-full flex items-center justify-center ${
          isUploading ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <FaPlus className="text-xs" />
        <input
          type="file"
          className="hidden"
          accept="image/*,video/*"
          disabled={isUploading}
          onChange={(e) => handleSelect(e.target.files[0])}
        />
      </label>
      {media && isUploading && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-gray-600 text-white rounded text-xs">
          Uploading...
        </div>
      )}
    </div>
  );
};

export default StoryUploader;
