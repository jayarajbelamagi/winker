import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { apiUrl } from "../../lib/api";

const StoryViewer = ({ userId, authUser, onClose }) => {
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const fetchUserStories = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(apiUrl(`/api/stories/user/${userId}`), {
        credentials: "include",
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setStories(list);
      setActiveIndex(0);
      if (list.length === 0) {
        toast("No stories to show", { icon: "ℹ️" });
        onClose && onClose();
      }
    } catch (err) {
      console.error("Failed to load user stories", err);
      toast.error("Failed to load stories");
      onClose && onClose();
    } finally {
      setIsLoading(false);
    }
  }, [userId, onClose]);

  useEffect(() => {
    if (!userId) return;
    fetchUserStories();
  }, [userId, fetchUserStories]);

  useEffect(() => {
    if (!stories.length) return;
    const timer = setTimeout(() => {
      setActiveIndex((prev) => {
        const next = prev + 1;
        if (next >= stories.length) return prev; // stop at last; don't auto-close
        return next;
      });
    }, 5000); // 5s per story
    return () => clearTimeout(timer);
  }, [stories, activeIndex]);

  const goPrev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const goNext = () => setActiveIndex((i) => Math.min(stories.length - 1, i + 1));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") onClose && onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stories.length, onClose]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
      </div>
    );
  }
  if (!stories.length) return null;

  const story = stories[activeIndex];
  const isVideo = story.type === "video";


  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={onClose}>
      <button
        type="button"
        className="absolute top-4 right-4 text-white text-xl z-50 hover:scale-105 transition"
        onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
        aria-label="Close"
      >
        ✕
      </button>

      <div
        className="absolute top-12 bottom-0 left-0 w-1/5 flex items-center justify-start z-20"
        onClick={(e) => {
          e.stopPropagation();
          goPrev();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goPrev(); } }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="ml-4 text-white/80 text-3xl disabled:opacity-30 z-20"
          disabled={activeIndex === 0}
          aria-label="Previous story"
        >
          ‹
        </button>
      </div>

      <div className="w-full max-w-md aspect-[9/16] bg-black flex items-center justify-center z-10" onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video src={story.mediaUrl} controls autoPlay className="w-full h-full object-contain" />
        ) : (
          <img src={story.mediaUrl} alt="story" className="w-full h-full object-contain" />
        )}
      </div>

      <div
        className="absolute top-12 bottom-0 right-0 w-1/5 flex items-center justify-end z-20"
        onClick={(e) => {
          e.stopPropagation();
          goNext();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goNext(); } }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="mr-4 text-white/80 text-3xl disabled:opacity-30 z-20"
          disabled={activeIndex === stories.length - 1}
          aria-label="Next story"
        >
          ›
        </button>
      </div>

      {story.caption && (
        <div className="absolute bottom-10 text-white text-center w-full px-6">
          {story.caption}
        </div>
      )}

      {/* View count removed per request */}

      {authUser?._id && story?.user && String(authUser._id) === String(story.user._id) && (
        <button
          onClick={async () => {
            try {
              const res = await fetch(apiUrl(`/api/stories/${story._id}`), {
                method: "DELETE",
                credentials: "include",
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Failed to delete story");
              toast.success("Story deleted");
              // remove from local list and notify home to refresh
              setStories((prev) => {
                const next = prev.filter((s) => s._id !== story._id);
                if (next.length === 0) {
                  onClose && onClose();
                  return next;
                }
                setActiveIndex((idx) => Math.min(idx, next.length - 1));
                return next;
              });
              // trigger home StoryBar to refresh feed without full page reload
              window.dispatchEvent(new Event("stories:refresh"));
            } catch (err) {
              toast.error(err.message);
            }
          }}
          className="absolute top-4 left-4 text-white text-sm bg-red-600/90 hover:bg-red-600 px-3 py-1 rounded-full shadow-lg flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M9 3.75A2.25 2.25 0 0111.25 1.5h1.5A2.25 2.25 0 0115 3.75V6h4.5a.75.75 0 010 1.5h-.708l-1.18 12.025A2.25 2.25 0 0115.37 21.75H8.63a2.25 2.25 0 01-2.243-2.225L5.206 7.5H4.5a.75.75 0 010-1.5H9V3.75zm1.5 0A.75.75 0 0011.25 3h1.5a.75.75 0 00.75.75V6h-3V3.75zM8.03 7.5l1.06 12h5.82l1.06-12H8.03z" clipRule="evenodd" /></svg>
          Delete
        </button>
      )}
    </div>
  );
};

export default StoryViewer;
