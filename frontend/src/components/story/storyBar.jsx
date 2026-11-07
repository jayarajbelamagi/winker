import { useCallback, useEffect, useRef, useState } from "react";
import StoryCard from "./storyCard";
import StoryUploader from "./storyUploader";
import { apiFetch } from "../../lib/api";

const StoryBar = ({ authUser }) => {
  const [storyGroups, setStoryGroups] = useState([]);
  const scrollerRef = useRef(null);

  const fetchStories = useCallback(async () => {
    if (!authUser?._id) return;
    try {
      const res = await apiFetch(`/api/stories/feed/${authUser._id}`);
      const data = await res.json();
      setStoryGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch stories", err);
    }
  }, [authUser?._id]);

  useEffect(() => {
    if (!authUser?._id) return;
    fetchStories();
  }, [authUser?._id, fetchStories]);

  useEffect(() => {
    const onRefresh = () => fetchStories();
    window.addEventListener("stories:refresh", onRefresh);
    return () => window.removeEventListener("stories:refresh", onRefresh);
  }, [fetchStories]);

  if (!authUser) return null;

  // Filter groups for others vs own
  const otherStories = storyGroups.filter(
    (g) => (g.user?._id || g.user)?.toString() !== authUser._id.toString()
  );

  return (
    <div className="relative">
      <button
        type="button"
        className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black text-white w-8 h-8 items-center justify-center rounded-full disabled:opacity-20 transition shadow-lg"
        onClick={() => scrollerRef.current?.scrollBy({ left: -220, behavior: "smooth" })}
        disabled={!otherStories.length}
        aria-label="Scroll left"
      >
        ‹
      </button>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto py-2 items-center px-1 sm:px-4 scrollbar-none scroll-smooth"
      >
        <StoryUploader authUser={authUser} onUploadSuccess={fetchStories} />
        {otherStories.map((group, idx) => (
          <StoryCard
            key={group.user?._id || idx}
            storyGroup={group}
            authUser={authUser}
          />
        ))}
      </div>

      <button
        type="button"
        className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black text-white w-8 h-8 items-center justify-center rounded-full disabled:opacity-20 transition shadow-lg"
        onClick={() => scrollerRef.current?.scrollBy({ left: 220, behavior: "smooth" })}
        disabled={!otherStories.length}
        aria-label="Scroll right"
      >
        ›
      </button>
    </div>
  );
};

export default StoryBar;
