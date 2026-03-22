import { useState } from "react";
import { FaPlus } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { apiUrl } from "../../lib/api";

const StoryUploader = ({ authUser, onUploadSuccess }) => {
  const [media, setMedia] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!authUser?._id) return toast.error("You must be logged in to upload stories");
    if (!media) return toast.error("Select a media file first");

    const formData = new FormData();
    formData.append("media", media);
    formData.append("type", media.type.startsWith("video") ? "video" : "image");
    formData.append("userId", authUser._id);

    try {
      setIsUploading(true);
      const res = await fetch(apiUrl("/api/stories"), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      toast.success("Story uploaded!");
      setMedia(null);
      // Notify listeners to refresh and refetch locally
      window.dispatchEvent(new Event("stories:refresh"));
      onUploadSuccess && onUploadSuccess();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelect = (file) => {
    setMedia(file);
    if (file) {
      // Auto-start upload on selection
      setTimeout(() => {
        handleUpload();
      }, 0);
    }
  };

  return (
    <div className="relative w-20 h-20 rounded-full overflow-hidden cursor-pointer flex items-center justify-center">
      {/* Loading ring overlay */}
      {isUploading && (
        <div className="absolute inset-0 rounded-full border-4 border-pink-500/40 border-t-transparent animate-spin z-10" />
      )}
      <img
        src={authUser?.profileImg || "/avatar-placeholder.png"}
        alt=""
        className={`object-cover w-full h-full rounded-full ${isUploading ? "opacity-70" : ""}`}
      />
      <label className={`absolute bottom-0 right-0 w-6 h-6 ${isUploading ? "bg-gray-400" : "bg-blue-500"} text-white rounded-full flex items-center justify-center ${isUploading ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <FaPlus />
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
