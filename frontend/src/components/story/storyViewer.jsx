import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  IoClose,
  IoHeart,
  IoHeartOutline,
  IoEyeOutline,
  IoTrashOutline,
  IoSend,
  IoVolumeHighOutline,
  IoVolumeMuteOutline,
} from "react-icons/io5";
import { BsMusicNoteBeamed } from "react-icons/bs";
import { FaPlus } from "react-icons/fa";
import { apiFetch } from "../../lib/api";

const STORY_DURATION_MS = 15000; // 15 seconds per story

const QUICK_STORY_EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "👏"];

const formatStoryTime = (dateStr) => {
  if (!dateStr) return "";
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
};

const StoryViewer = ({ userId, authUser, onClose }) => {
  const [stories, setStories] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0); // 0 to 100%
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [viewersList, setViewersList] = useState([]);
  const [isLoadingViewers, setIsLoadingViewers] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState([]);

  const progressIntervalRef = useRef(null);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  // 1. Fetch stories of the target user
  const fetchStories = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/stories/user/${userId}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setStories(list);
      setActiveIndex(0);
      setProgress(0);

      if (list.length === 0) {
        toast("No active stories found", { icon: "ℹ️" });
        onClose();
      }
    } catch (err) {
      console.error("Failed to load user stories:", err);
      toast.error("Failed to load stories");
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [userId, onClose]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const currentStory = stories[activeIndex];
  const isOwner =
    userId?.toString() === authUser?._id?.toString() ||
    currentStory?.userId?.toString() === authUser?._id?.toString() ||
    currentStory?.userId?._id?.toString() === authUser?._id?.toString() ||
    currentStory?.user?._id?.toString() === authUser?._id?.toString() ||
    currentStory?.user?.toString() === authUser?._id?.toString();
  const isLiked = currentStory?.likes?.some(
    (id) => (id?._id || id)?.toString() === authUser?._id?.toString()
  );

  // 2. Mark current story as viewed
  useEffect(() => {
    if (!currentStory?._id || isOwner) return;
    apiFetch("/api/stories/viewed", {
      method: "POST",
      body: JSON.stringify({ storyId: currentStory._id }),
    }).catch(() => {});
  }, [currentStory?._id, isOwner]);

  // 3. Play background music if track exists
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (currentStory?.music?.previewUrl) {
      const audio = new Audio(currentStory.music.previewUrl);
      audio.muted = isMuted;
      audio.loop = true;
      audio.play().catch(() => {});
      audioRef.current = audio;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [currentStory, isMuted]);

  // 4. Progress bar ticker across 15 seconds
  useEffect(() => {
    if (isLoading || !stories.length || isPaused || showViewersModal) return;

    const stepMs = 50; // update progress every 50ms
    const totalSteps = STORY_DURATION_MS / stepMs;
    const increment = 100 / totalSteps;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => clearInterval(progressIntervalRef.current);
  }, [isLoading, stories.length, isPaused, showViewersModal, activeIndex]);

  const handleNext = () => {
    setProgress(0);
    if (activeIndex < stories.length - 1) {
      setActiveIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    setProgress(0);
    if (activeIndex > 0) {
      setActiveIndex((prev) => prev - 1);
    }
  };

  // 5. Like Story with floating hearts
  const handleLikeStory = async (e) => {
    e?.stopPropagation();
    if (!currentStory?._id) return;

    // Trigger floating heart
    const heartId = Date.now();
    setFloatingHearts((prev) => [...prev, { id: heartId, left: Math.random() * 60 + 20 }]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== heartId));
    }, 1500);

    try {
      const res = await apiFetch(`/api/stories/like/${currentStory._id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setStories((prev) =>
          prev.map((s, idx) => {
            if (idx !== activeIndex) return s;
            const updatedLikes = data.liked
              ? [...s.likes, authUser._id]
              : s.likes.filter((id) => (id?._id || id).toString() !== authUser._id.toString());
            return { ...s, likes: updatedLikes };
          })
        );
      }
    } catch (err) {
      console.error("Like story failed:", err);
    }
  };

  // 6. Reply to Story via DM
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !currentStory?.userId) return;

    const targetUserId = currentStory.userId._id || currentStory.userId;
    try {
      setIsSendingReply(true);
      const res = await apiFetch(`/api/messages/send/${targetUserId}`, {
        method: "POST",
        body: JSON.stringify({
          text: `Replied to your story: "${replyText.trim()}"`,
          img: currentStory.mediaUrl,
        }),
      });
      if (res.ok) {
        toast.success("Reply sent to Messages!");
        setReplyText("");
        setIsPaused(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send reply");
      }
    } catch (err) {
      toast.error("Failed to send reply");
    } finally {
      setIsSendingReply(false);
    }
  };

  // 6b. Quick Emoji Reaction (Instagram style)
  const handleQuickEmoji = async (emoji) => {
    if (!currentStory?.userId) return;
    const heartId = Date.now();
    setFloatingHearts((prev) => [...prev, { id: heartId, left: Math.random() * 60 + 20, emoji }]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== heartId));
    }, 1500);

    const targetUserId = currentStory.userId._id || currentStory.userId;
    try {
      await apiFetch(`/api/messages/send/${targetUserId}`, {
        method: "POST",
        body: JSON.stringify({
          text: `Reacted to your story: ${emoji}`,
          img: currentStory.mediaUrl,
        }),
      });
      toast.success(`Sent ${emoji} to story!`);
    } catch (e) {}
  };

  // 7. Delete Story (for Owner)
  const handleDeleteStory = async () => {
    if (!currentStory?._id || !isOwner) return;
    if (!window.confirm("Are you sure you want to delete this story?")) return;

    try {
      const res = await apiFetch(`/api/stories/${currentStory._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Story deleted");
        window.dispatchEvent(new Event("stories:refresh"));
        if (stories.length <= 1) {
          onClose();
        } else {
          setStories((prev) => prev.filter((_, idx) => idx !== activeIndex));
          setActiveIndex((prev) => Math.max(0, prev - 1));
          setProgress(0);
        }
      }
    } catch (err) {
      toast.error("Failed to delete story");
    }
  };

  // 8. Viewers List Modal (for Owner)
  const handleOpenViewers = async () => {
    setIsPaused(true);
    setShowViewersModal(true);
    try {
      setIsLoadingViewers(true);
      const res = await apiFetch(`/api/stories/viewers/${currentStory._id}`);
      const data = await res.json();
      setViewersList(data.viewers || []);
    } catch (err) {
      console.error("Failed to fetch viewers:", err);
    } finally {
      setIsLoadingViewers(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, stories.length]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-pink-500"></span>
      </div>
    );
  }

  if (!stories.length || !currentStory) return null;

  const storyOwner =
    (currentStory.user && currentStory.user.fullName ? currentStory.user : null) ||
    (currentStory.userId && currentStory.userId.fullName ? currentStory.userId : null) ||
    (isOwner ? authUser : null);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center select-none"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={(e) => {
        setIsPaused(true);
        if (e.touches && e.touches[0]) {
          touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            time: Date.now(),
          };
        }
      }}
      onTouchEnd={(e) => {
        setIsPaused(false);
        if (e.changedTouches && e.changedTouches[0]) {
          const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
          const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
          const deltaTime = Date.now() - touchStartRef.current.time;

          // Swipe down to close story (Instagram gesture)
          if (deltaY > 80 && Math.abs(deltaY) > Math.abs(deltaX) * 1.3 && deltaTime < 400) {
            onClose();
            return;
          }

          // Swipe up: for owner open viewers list
          if (deltaY < -70 && Math.abs(deltaY) > Math.abs(deltaX) * 1.3 && deltaTime < 400) {
            if (isOwner) {
              handleOpenViewers();
            }
            return;
          }
        }
      }}
    >
      {/* Floating Hearts & Reaction Emojis Animation */}
      {floatingHearts.map((heart) => (
        <div
          key={heart.id}
          style={{ left: `${heart.left}%` }}
          className="absolute bottom-20 z-50 pointer-events-none text-3xl animate-floating-heart"
        >
          {heart.emoji || "❤️"}
        </div>
      ))}

      {/* Main Story Container - Edge-to-edge on Mobile (Instagram Style) */}
      <div className="relative w-full h-[100dvh] sm:h-full sm:max-h-[92vh] sm:max-w-md sm:rounded-3xl overflow-hidden bg-black flex flex-col justify-between shadow-2xl">
        {/* Top Progress Segment Bars */}
        <div className="absolute top-2 left-0 right-0 z-30 px-3 flex gap-1.5 items-center">
          {stories.map((s, idx) => (
            <div
              key={s._id || idx}
              className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-75"
                style={{
                  width:
                    idx < activeIndex
                      ? "100%"
                      : idx === activeIndex
                      ? `${progress}%`
                      : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Header: Owner Info, Music, Audio Mute & Close */}
        <div className="absolute top-5 left-0 right-0 z-30 px-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/50">
              <img
                src={storyOwner?.profileImg || "/avatar-placeholder.png"}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-white text-xs font-bold leading-tight">
                  {storyOwner?.fullName || storyOwner?.username || "User"}
                </span>
                <span className="text-stone-400 text-[11px] font-normal">
                  · {formatStoryTime(currentStory.createdAt)}
                </span>
              </div>
              <span className="text-stone-400 text-[10px]">@{storyOwner?.username || "user"}</span>
            </div>

            {/* Music Badge */}
            {currentStory?.music?.title && (
              <div className="hidden sm:flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-pink-500/40 text-pink-300 px-2.5 py-1 rounded-full text-[11px] font-medium ml-2 animate-pulse">
                <BsMusicNoteBeamed className="w-3 h-3 text-pink-400" />
                <span className="truncate max-w-[120px]">
                  {currentStory.music.title}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Add Story Button for Owner */}
            {isOwner && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  window.dispatchEvent(new Event("stories:open-create-modal"));
                }}
                className="flex items-center gap-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-full transition shadow-md"
                title="Add another story"
              >
                <FaPlus className="w-2.5 h-2.5" />
                <span>Add</span>
              </button>
            )}

            {/* Audio Mute/Unmute */}
            {currentStory?.music?.previewUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted((prev) => !prev);
                  if (audioRef.current) audioRef.current.muted = !isMuted;
                }}
                className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 transition"
              >
                {isMuted ? (
                  <IoVolumeMuteOutline className="w-5 h-5" />
                ) : (
                  <IoVolumeHighOutline className="w-5 h-5" />
                )}
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 transition"
            >
              <IoClose className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Media Content (Image or Video) */}
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {currentStory.type === "video" ? (
            <video
              ref={videoRef}
              src={currentStory.mediaUrl}
              autoPlay
              playsInline
              muted={isMuted}
              loop
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt=""
              className="w-full h-full object-contain"
            />
          )}

          {/* Left / Right Invisible Click Zones for navigation */}
          <div
            className="absolute top-16 bottom-20 left-0 w-1/3 z-20 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
          />
          <div
            className="absolute top-16 bottom-20 right-0 w-1/3 z-20 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
          />

          {/* Caption Tag */}
          {currentStory.caption && (
            <div className="absolute bottom-20 left-4 right-4 z-20 bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/10 text-white text-sm text-center">
              {currentStory.caption}
            </div>
          )}
        </div>

        {/* Bottom Bar: Owner Viewers Pill OR Viewer Reply + Quick Emojis (Instagram Style) */}
        <div className="relative z-30 p-3 pb-safe bg-gradient-to-t from-black via-black/85 to-transparent">
          {isOwner ? (
            /* Owner Actions: Viewers count & Delete with swipe up hint */
            <div className="flex flex-col gap-2">
              <div
                onClick={handleOpenViewers}
                className="flex items-center justify-center gap-1.5 text-[11px] text-stone-300 hover:text-white cursor-pointer py-1 font-medium"
              >
                <span className="text-pink-400 animate-bounce">▲</span>
                <span>Swipe up for activity</span>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleOpenViewers}
                  className="flex items-center gap-2 bg-stone-900/90 border border-stone-700/80 hover:border-pink-500 text-white text-xs font-semibold px-4 py-2 rounded-full transition shadow-lg active:scale-95"
                >
                  <IoEyeOutline className="w-4 h-4 text-pink-400" />
                  <span>Seen by {currentStory.viewers?.length || 0}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteStory}
                  className="p-2 rounded-full bg-stone-900/90 border border-stone-800 text-stone-400 hover:text-red-500 transition active:scale-95"
                  title="Delete this story"
                >
                  <IoTrashOutline className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            /* Viewer Actions: Quick Emoji Reaction Bar + Reply input + Like Heart (Instagram Style) */
            <div className="flex flex-col gap-2">
              {/* Quick Emojis */}
              <div className="flex items-center justify-around py-1 px-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                {QUICK_STORY_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleQuickEmoji(emoji)}
                    className="text-xl hover:scale-125 active:scale-90 transition transform p-1"
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  placeholder={`Send message to ${storyOwner?.fullName || "user"}...`}
                  className="flex-1 bg-stone-900/90 border border-stone-700 rounded-full px-4 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-pink-500 transition shadow-inner"
                />

                {replyText.trim() ? (
                  <button
                    type="submit"
                    disabled={isSendingReply}
                    className="bg-primary hover:bg-primary/90 text-white p-2.5 rounded-full transition flex-shrink-0 active:scale-95"
                  >
                    <IoSend className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLikeStory}
                    className="p-2.5 rounded-full bg-stone-900/90 border border-stone-700 text-white hover:scale-110 active:scale-95 transition flex-shrink-0"
                  >
                    {isLiked ? (
                      <IoHeart className="w-6 h-6 text-red-500 fill-red-500" />
                    ) : (
                      <IoHeartOutline className="w-6 h-6" />
                    )}
                  </button>
                )}
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Viewers Slide-up Modal (Owner Only) */}
      {showViewersModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={() => {
            setShowViewersModal(false);
            setIsPaused(false);
          }}
        >
          <div
            className="bg-[#16181C] border border-stone-800 w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-5 max-h-[60vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2 font-bold text-white text-base">
                <IoEyeOutline className="text-pink-500 w-5 h-5" />
                <span>Story Viewers ({viewersList.length})</span>
              </div>
              <button
                onClick={() => {
                  setShowViewersModal(false);
                  setIsPaused(false);
                }}
                className="text-stone-400 hover:text-white"
              >
                <IoClose className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-stone-800/60 mt-2">
              {isLoadingViewers ? (
                <div className="py-8 flex justify-center text-pink-500">
                  <span className="loading loading-spinner loading-md"></span>
                </div>
              ) : viewersList.length === 0 ? (
                <div className="py-8 text-center text-stone-500 text-xs">
                  No views yet. When friends view your story, they will appear here!
                </div>
              ) : (
                viewersList.map((viewer) => (
                  <div
                    key={viewer._id}
                    className="flex items-center gap-3 py-2.5 px-1 hover:bg-stone-900/50 rounded-lg transition"
                  >
                    <img
                      src={viewer.profileImg || "/avatar-placeholder.png"}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-white truncate">
                        {viewer.fullName}
                      </span>
                      <span className="text-xs text-stone-500 truncate">
                        @{viewer.username}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryViewer;
