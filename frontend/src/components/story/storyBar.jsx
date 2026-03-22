import { useCallback, useEffect, useRef, useState } from "react";
import StoryCard from "./storyCard";
import StoryUploader from "./storyUploader";
import { apiUrl } from "../../lib/api";

const StoryBar = ({ authUser }) => {
  const [stories, setStories] = useState([]);
  const scrollerRef = useRef(null);

  const fetchStories = useCallback(async () => {
    if (!authUser?._id) return;
    try {
      const res = await fetch(apiUrl(`/api/stories/feed/${authUser._id}`), {
        credentials: "include",
      });
      const data = await res.json();
      setStories(data || []);
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

  if (!authUser) return null; // Hide story bar if not logged in

  return (
    <div className="relative">
      <button
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/40 text-white px-2 py-1 rounded disabled:opacity-30"
        onClick={() => scrollerRef.current?.scrollBy({ left: -200, behavior: "smooth" })}
        disabled={!stories.length}
        aria-label="Scroll left"
      >
        ‹
      </button>

      <div ref={scrollerRef} className="flex gap-3 overflow-x-auto py-2 items-center px-8 scrollbar-hide">
        <StoryUploader authUser={authUser} onUploadSuccess={fetchStories} />
        {stories.map((story) => (
          <StoryCard key={story._id} story={story} authUser={authUser} />
        ))}
      </div>

      <button
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/40 text-white px-2 py-1 rounded disabled:opacity-30"
        onClick={() => scrollerRef.current?.scrollBy({ left: 200, behavior: "smooth" })}
        disabled={!stories.length}
        aria-label="Scroll right"
      >
        ›
      </button>
    </div>
  );
};

export default StoryBar;
