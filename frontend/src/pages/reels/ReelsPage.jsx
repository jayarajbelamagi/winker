import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  FaHeart,
  FaRegHeart,
  FaComment,
  FaShare,
  FaVolumeMute,
  FaVolumeUp,
  FaPlus,
  FaPlay,
} from "react-icons/fa";
import { IoClose, IoSend } from "react-icons/io5";
import { MdVideoCall, MdSlowMotionVideo } from "react-icons/md";
import { RiMovie2Line } from "react-icons/ri";
import { apiFetch } from "../../lib/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import useFollow from "../../hooks/useFollow";
import { renderFormattedText } from "../../components/common/Post";

// Curated high-res sample reels if user-created video count is low
const CURATED_SAMPLE_REELS = [
  {
    _id: "sample-reel-1",
    isSample: true,
    user: {
      _id: "sample_user_1",
      fullName: "Winker Creators",
      username: "winker",
      profileImg: "https://api.dicebear.com/7.x/bottts/svg?seed=winker",
    },
    text: "Welcome to Winker Reels! 🚀 Share your best 15-30s moments, thoughts, and creativity with the world. Double tap to like! #Winker #Reels #Creators",
    img: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    mediaType: "video",
    likes: ["sample_user_1"],
    comments: [
      {
        _id: "sc-1",
        user: { fullName: "Jayaraj U B", username: "iamjay" },
        text: "The new Reels player looks amazing! 🔥",
        createdAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    _id: "sample-reel-2",
    isSample: true,
    user: {
      _id: "sample_user_2",
      fullName: "Nature & Tech",
      username: "tech_nature",
      profileImg: "https://api.dicebear.com/7.x/bottts/svg?seed=nature",
    },
    text: "Building the future of social networking in 2026. Fast, beautiful, and decentralized vibes. What feature do you want next? #Tech #AI #Coding",
    img: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    mediaType: "video",
    likes: [],
    comments: [],
    createdAt: new Date().toISOString(),
  },
];

const ReelsPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: authUser } = useQuery({ queryKey: ["authUser"] });
  const { follow, isPending: isFollowPending } = useFollow();

  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [commentDrawerReel, setCommentDrawerReel] = useState(null);
  const [commentInput, setCommentInput] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Upload Reel State
  const [uploadText, setUploadText] = useState("");
  const [uploadVideo, setUploadVideo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const videoInputRef = useRef(null);

  // Fetch real posts that are videos
  const { data: posts, isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const res = await apiFetch("/api/posts/all");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch posts");
      return data;
    },
  });

  // Extract all video posts from the database
  const userVideoReels = (posts || []).filter(
    (p) =>
      p.mediaType === "video" ||
      (p.img &&
        (p.img.includes("/video/upload/") ||
          p.img.endsWith(".mp4") ||
          p.img.endsWith(".webm") ||
          p.img.endsWith(".mov")))
  );

  const allReels = userVideoReels.length > 0 ? userVideoReels : CURATED_SAMPLE_REELS;

  // Like mutation
  const { mutate: likePost } = useMutation({
    mutationFn: async (postId) => {
      const res = await apiFetch(`/api/posts/like/${postId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to like");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  // Comment mutation
  const { mutate: submitComment, isPending: isCommenting } = useMutation({
    mutationFn: async ({ postId, text }) => {
      const res = await apiFetch(`/api/posts/comment/${postId}`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post comment");
      return data;
    },
    onSuccess: (updatedComments) => {
      setCommentInput("");
      if (commentDrawerReel) {
        setCommentDrawerReel({ ...commentDrawerReel, comments: updatedComments });
      }
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Comment added!");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleUploadReel = async (e) => {
    e.preventDefault();
    if (!uploadVideo) {
      toast.error("Please select a video file");
      return;
    }

    try {
      setIsUploading(true);
      const res = await apiFetch("/api/posts/create", {
        method: "POST",
        body: JSON.stringify({
          text: uploadText.trim(),
          img: uploadVideo,
          mediaType: "video",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      toast.success("Reel published successfully! 🎉");
      setShowUploadModal(false);
      setUploadText("");
      setUploadVideo(null);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    } catch (err) {
      toast.error(err.message || "Failed to upload reel");
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Video exceeds 8MB limit. Please choose a shorter or smaller clip.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setUploadVideo(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-[4_4_0] min-w-0 max-w-2xl xl:max-w-3xl w-full border-r border-stone-800 min-h-screen bg-black flex flex-col relative">
      {/* Top Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-md border-b border-stone-800/80">
        <div className="flex items-center gap-2">
          <RiMovie2Line className="w-5 h-5 text-primary" />
          <h1 className="font-extrabold text-base sm:text-lg text-white tracking-wide">
            Winker Reels
          </h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold uppercase tracking-wider animate-pulse">
            Live
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted((prev) => !prev)}
            className="p-2 rounded-full bg-stone-900 border border-stone-800 text-stone-300 hover:text-white transition"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <FaVolumeMute className="w-4 h-4" /> : <FaVolumeUp className="w-4 h-4 text-primary" />}
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="btn btn-primary btn-sm rounded-full text-xs font-bold shadow-lg shadow-primary/30 flex items-center gap-1.5"
          >
            <FaPlus className="w-3 h-3" />
            <span>Post Reel</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        /* Vertical Snap Scroll Reels Container */
        <div className="flex-1 overflow-y-scroll snap-y snap-mandatory h-[calc(100vh-7.5rem)] scrollbar-none">
          {allReels.map((reel, index) => (
            <SingleReelCard
              key={reel._id}
              reel={reel}
              isActive={index === activeReelIndex}
              isMuted={isMuted}
              authUser={authUser}
              onLike={() => {
                if (!reel.isSample) likePost(reel._id);
                else toast.success("Liked reel!");
              }}
              onOpenComments={() => setCommentDrawerReel(reel)}
              onFollow={(userId) => follow(userId)}
              isFollowPending={isFollowPending}
            />
          ))}
        </div>
      )}

      {/* Comments Drawer / Bottom Sheet */}
      {commentDrawerReel && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#16181C] border border-stone-800 w-full max-w-lg rounded-t-3xl sm:rounded-2xl p-4 shadow-2xl flex flex-col max-h-[75vh] h-[550px] animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <FaComment className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm text-white">
                  Comments ({commentDrawerReel.comments?.length || 0})
                </span>
              </div>
              <button
                onClick={() => setCommentDrawerReel(null)}
                className="p-1 rounded-full text-stone-400 hover:text-white"
              >
                <IoClose className="w-5 h-5" />
              </button>
            </div>

            {/* Comment List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
              {!commentDrawerReel.comments || commentDrawerReel.comments.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs">
                  No comments yet. Be the first to say something!
                </div>
              ) : (
                commentDrawerReel.comments.map((c, i) => (
                  <div key={c._id || i} className="flex items-start gap-2.5">
                    <img
                      src={c.user?.profileImg || "/avatar-placeholder.png"}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover border border-stone-700 mt-0.5"
                    />
                    <div className="flex-1 bg-stone-900/60 p-2.5 rounded-xl border border-stone-800/60">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">
                          {c.user?.fullName}
                        </span>
                        <span className="text-[10px] text-stone-500">
                          @{c.user?.username}
                        </span>
                      </div>
                      <p className="text-xs text-stone-200 mt-1 whitespace-pre-wrap">
                        {renderFormattedText(c.text)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Post Comment Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!commentInput.trim()) return;
                if (!commentDrawerReel.isSample) {
                  submitComment({ postId: commentDrawerReel._id, text: commentInput });
                } else {
                  toast.success("Comment posted!");
                  setCommentInput("");
                }
              }}
              className="flex items-center gap-2 pt-3 border-t border-stone-800"
            >
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-black border border-stone-800 rounded-full px-4 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!commentInput.trim() || isCommenting}
                className="p-2 rounded-full bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition"
              >
                <IoSend className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Post Reel Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16181C] border border-stone-800 w-full max-w-md rounded-2xl p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <MdSlowMotionVideo className="w-5 h-5 text-primary" />
                <span className="font-bold text-white text-base">Create Winker Reel</span>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-stone-400 hover:text-white"
              >
                <IoClose className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadReel} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-400 block mb-1.5">
                  Caption / Description
                </label>
                <textarea
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  placeholder="Describe your reel, add tags like #Trending #Vibes @friend..."
                  rows={3}
                  className="w-full bg-black border border-stone-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary placeholder-stone-600 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-400 block mb-1.5">
                  Upload Video (MP4 / WebM up to 8MB)
                </label>
                <input
                  type="file"
                  ref={videoInputRef}
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />

                {uploadVideo ? (
                  <div className="relative rounded-xl overflow-hidden bg-black max-h-52 flex items-center justify-center border border-stone-800">
                    <video
                      src={uploadVideo}
                      className="w-full max-h-52 object-contain"
                      controls
                    />
                    <button
                      type="button"
                      onClick={() => setUploadVideo(null)}
                      className="absolute top-2 right-2 bg-black/80 p-1.5 rounded-full text-white hover:text-red-400"
                    >
                      <IoClose className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => videoInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-800 hover:border-primary rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center gap-2 bg-stone-900/30"
                  >
                    <MdVideoCall className="w-8 h-8 text-primary/80" />
                    <span className="text-xs font-medium text-stone-300">
                      Tap to select a short video from your device
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Max size: 8MB · 15s to 60s clips
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isUploading || !uploadVideo}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-primary/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUploading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <RiMovie2Line className="w-4 h-4" />
                    <span>Publish Reel</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ================= SINGLE REEL CARD WITH GESTURES =================
const SingleReelCard = ({
  reel,
  isActive,
  isMuted,
  authUser,
  onLike,
  onOpenComments,
  onFollow,
  isFollowPending,
}) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const lastTapRef = useRef(0);

  const isLiked = reel.likes?.includes(authUser?._id);
  const isFollowing = authUser?.following?.includes(reel.user?._id);
  const isMine = authUser?._id === reel.user?._id;

  // Auto-play when active
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isActive]);

  // Sync mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Double tap to heart gesture
  const handleTouchOrClick = (e) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      setShowHeartPop(true);
      setTimeout(() => setShowHeartPop(false), 900);
      if (!isLiked) {
        onLike();
      }
    } else {
      togglePlay();
    }
    lastTapRef.current = now;
  };

  return (
    <div className="snap-start relative w-full h-[calc(100vh-7.5rem)] flex items-center justify-center bg-black overflow-hidden border-b border-stone-900">
      {/* Video Element */}
      <video
        ref={videoRef}
        src={reel.img}
        className="w-full h-full object-contain cursor-pointer"
        loop
        playsInline
        muted={isMuted}
        onClick={handleTouchOrClick}
      />

      {/* Floating Center Pause Indicator */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-auto cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white text-2xl shadow-xl">
            <FaPlay className="ml-1 text-white/90" />
          </div>
        </div>
      )}

      {/* Instagram Double-Tap Heart Pop Animation */}
      {showHeartPop && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <FaHeart className="w-24 h-24 text-rose-500 drop-shadow-2xl animate-bounce scale-125 transition duration-300" />
        </div>
      )}

      {/* Right Column Action Buttons */}
      <div className="absolute right-3 bottom-20 z-20 flex flex-col items-center gap-5">
        {/* Creator Avatar with Follow Plus Badge */}
        <div className="relative">
          <Link
            to={`/profile/${reel.user?.username}`}
            className="w-11 h-11 rounded-full overflow-hidden block border-2 border-white shadow-lg"
          >
            <img
              src={reel.user?.profileImg || "/avatar-placeholder.png"}
              alt=""
              className="w-full h-full object-cover"
            />
          </Link>
          {!isFollowing && !isMine && (
            <button
              onClick={() => onFollow(reel.user?._id)}
              disabled={isFollowPending}
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow transition"
              title="Follow creator"
            >
              <FaPlus className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        {/* Like Button */}
        <button
          onClick={onLike}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white group-hover:scale-110 transition">
            {isLiked ? (
              <FaHeart className="w-6 h-6 text-rose-500" />
            ) : (
              <FaRegHeart className="w-6 h-6 text-white" />
            )}
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow">
            {reel.likes?.length || 0}
          </span>
        </button>

        {/* Comment Button */}
        <button
          onClick={onOpenComments}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white group-hover:scale-110 transition">
            <FaComment className="w-5 h-5 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow">
            {reel.comments?.length || 0}
          </span>
        </button>

        {/* Share Button */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.origin + `/post/${reel._id}`);
            toast.success("Reel link copied to clipboard!");
          }}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white group-hover:scale-110 transition">
            <FaShare className="w-5 h-5 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow">
            Share
          </span>
        </button>

        {/* Rotating Sound Disc Animation */}
        <div className="w-9 h-9 rounded-full bg-stone-900 border-2 border-stone-700 flex items-center justify-center animate-spin text-[10px] text-white shadow-xl">
          🎵
        </div>
      </div>

      {/* Bottom Information Overlay */}
      <div className="absolute left-0 bottom-0 right-16 p-4 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Link
            to={`/profile/${reel.user?.username}`}
            className="font-extrabold text-sm text-white hover:underline drop-shadow"
          >
            @{reel.user?.username}
          </Link>
          <span className="text-white/60 text-xs">·</span>
          <span className="text-xs text-white/80 font-medium">
            {reel.user?.fullName}
          </span>
        </div>

        {reel.text && (
          <p className="text-xs sm:text-sm text-white drop-shadow leading-relaxed line-clamp-3">
            {renderFormattedText(reel.text)}
          </p>
        )}

        <div className="flex items-center gap-2 text-[11px] text-white/80">
          <span>🎵</span>
          <span className="truncate max-w-[200px]">
            Original Sound · {reel.user?.fullName || "Winker"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReelsPage;
