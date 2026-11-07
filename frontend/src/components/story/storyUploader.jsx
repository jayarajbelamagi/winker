import { useState, useRef, useEffect } from "react";
import { FaPlus, FaTimes } from "react-icons/fa";
import { BsMusicNoteBeamed } from "react-icons/bs";
import { toast } from "react-hot-toast";
import { apiFetch } from "../../lib/api";
import { compressImage, dataURLtoFile } from "../../utils/imageCompressor";
import MusicSearchModal from "./MusicSearchModal";
import StoryViewer from "./storyViewer";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB limit strictly enforced

const StoryUploader = ({ authUser, ownStoryGroup, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileType, setFileType] = useState("image");
  const [caption, setCaption] = useState("");
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isViewingOwnStory, setIsViewingOwnStory] = useState(false);
  const fileInputRef = useRef(null);

  const hasActiveStory = Boolean(ownStoryGroup && ownStoryGroup.stories?.length > 0);

  // Listen for event from StoryViewer or elsewhere to add another story
  useEffect(() => {
    const handleOpenUploader = () => fileInputRef.current?.click();
    window.addEventListener("stories:open-create-modal", handleOpenUploader);
    return () => window.removeEventListener("stories:open-create-modal", handleOpenUploader);
  }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Enforce 8MB limit check
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File exceeds 8MB limit. Please choose a file under 8MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const isVid = file.type?.startsWith("video");
    setFileType(isVid ? "video" : "image");

    let finalFile = file;
    if (!isVid && file.type?.startsWith("image/")) {
      try {
        const compressedBase64 = await compressImage(file, 1600, 0.85);
        finalFile = dataURLtoFile(compressedBase64, file.name);
      } catch (err) {
        console.warn("Story image compression fallback:", err);
      }
    }

    setSelectedFile(finalFile);
    setPreviewUrl(URL.createObjectURL(finalFile));
    setShowCreateModal(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption("");
    setSelectedMusic(null);
  };

  const handleUploadStory = async () => {
    if (!selectedFile || !authUser?._id) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("media", selectedFile);
      formData.append("type", fileType);
      formData.append("caption", caption.trim());
      formData.append("duration", "15"); // strictly 15s
      if (selectedMusic) {
        formData.append("music", JSON.stringify(selectedMusic));
      }

      const res = await apiFetch("/api/stories", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post story");

      toast.success("Story posted! It will disappear in 24 hours.");
      handleCloseModal();
      window.dispatchEvent(new Event("stories:refresh"));
      onUploadSuccess && onUploadSuccess();
    } catch (err) {
      toast.error(err.message || "Failed to upload story");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {/* Circle Icon in Stories Bar */}
      <div className="flex flex-col items-center flex-shrink-0 cursor-pointer group">
        <div
          onClick={() => {
            if (hasActiveStory) {
              setIsViewingOwnStory(true);
            } else {
              fileInputRef.current?.click();
            }
          }}
          className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full transition group-hover:scale-105 ${
            hasActiveStory
              ? "p-[2.5px] bg-gradient-to-tr from-pink-500 via-purple-500 to-amber-400 animate-gradient"
              : "p-[2px] bg-stone-800 hover:bg-stone-700"
          }`}
          title={hasActiveStory ? "View your story" : "Add your story"}
        >
          <div className="w-full h-full rounded-full overflow-hidden bg-black relative p-[1.5px]">
            <img
              src={authUser?.profileImg || "/avatar-placeholder.png"}
              alt="Your Story"
              className="object-cover w-full h-full rounded-full"
            />
            {/* Plus Badge to Add Story directly */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="absolute bottom-0 right-0 w-5 h-5 bg-primary hover:bg-primary/90 text-white rounded-full flex items-center justify-center border-2 border-black hover:scale-125 transition shadow-md z-10"
              title="Add to story"
            >
              <FaPlus className="text-[10px]" />
            </div>
          </div>
        </div>
        <span
          className={`text-[11px] font-medium mt-1 max-w-[70px] truncate text-center ${
            hasActiveStory ? "text-white font-semibold" : "text-stone-300"
          }`}
        >
          Your Story
        </span>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*"
          onChange={handleFileSelect}
        />
      </div>

      {/* Story Viewer for Owner */}
      {isViewingOwnStory && (
        <StoryViewer
          userId={authUser._id}
          authUser={authUser}
          onClose={() => {
            setIsViewingOwnStory(false);
            onUploadSuccess && onUploadSuccess();
          }}
        />
      )}

      {/* Story Creator Modal with Music & 15s Preview */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#16181C] border border-stone-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <span className="text-pink-500 font-bold">📸 Create Story</span>
                <span className="text-[11px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-full">
                  15s
                </span>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={isUploading}
                className="text-stone-400 hover:text-white p-1"
              >
                <FaTimes />
              </button>
            </div>

            {/* Media Preview Box */}
            <div className="relative w-full h-72 sm:h-80 bg-black flex items-center justify-center overflow-hidden">
              {fileType === "video" ? (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Story preview"
                  className="w-full h-full object-contain"
                />
              )}

              {/* Music Tag Overlay on Preview */}
              {selectedMusic && (
                <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md border border-pink-500/40 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg animate-in fade-in">
                  <BsMusicNoteBeamed className="text-pink-400 animate-pulse" />
                  <span className="font-medium truncate max-w-[180px]">
                    {selectedMusic.title} · {selectedMusic.artist}
                  </span>
                  <button
                    onClick={() => setSelectedMusic(null)}
                    className="text-stone-400 hover:text-white ml-1"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Actions & Caption */}
            <div className="p-4 flex flex-col gap-3">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption..."
                maxLength={100}
                className="bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-pink-500 transition"
              />

              {/* Music Selection Button */}
              <button
                type="button"
                onClick={() => setShowMusicModal(true)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                  selectedMusic
                    ? "bg-pink-600/20 border-pink-500/50 text-pink-300"
                    : "bg-stone-900 border-stone-800 text-stone-300 hover:border-pink-500/50 hover:text-white"
                }`}
              >
                <BsMusicNoteBeamed className="w-4 h-4 text-pink-400" />
                <span>{selectedMusic ? "Change Music" : "🎵 Add Music"}</span>
              </button>

              <div className="text-[11px] text-stone-500 text-center">
                Disappears automatically after 24 hours · 15s display
              </div>

              {/* Post Button */}
              <button
                onClick={handleUploadStory}
                disabled={isUploading}
                className="w-full bg-gradient-to-r from-pink-500 to-amber-500 hover:opacity-95 text-white font-bold py-2.5 rounded-full text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    <span>Posting story...</span>
                  </>
                ) : (
                  "Share Story"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Music Search Modal */}
      <MusicSearchModal
        isOpen={showMusicModal}
        onClose={() => setShowMusicModal(false)}
        onSelectMusic={(music) => setSelectedMusic(music)}
      />
    </>
  );
};

export default StoryUploader;
