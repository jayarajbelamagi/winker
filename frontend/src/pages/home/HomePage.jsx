import { useState } from "react";
import StoryBar from "../../components/story/storyBar";
import Posts from "../../components/common/Posts";
import CreatePost from "./CreatePost";

const Home = ({ authUser }) => {
  const [feedType, setFeedType] = useState("forYou");

  return (
    <div className="flex-[4_4_0] min-w-0 w-full border-r border-gray-700 min-h-screen">
      {/* Feed Type Tabs (Sticky like X) */}
      <div className="flex w-full border-b border-gray-700 sticky top-12 md:top-0 bg-black/85 backdrop-blur-md z-20 font-semibold text-sm">
        <div
          className="flex justify-center flex-1 py-3.5 hover:bg-stone-900/40 transition duration-200 cursor-pointer relative"
          onClick={() => setFeedType("forYou")}
        >
          <span className={feedType === "forYou" ? "text-white font-bold" : "text-stone-400"}>
            For you
          </span>
          {feedType === "forYou" && (
            <div className="absolute bottom-0 w-14 h-1 rounded-full bg-primary"></div>
          )}
        </div>
        <div
          className="flex justify-center flex-1 py-3.5 hover:bg-stone-900/40 transition duration-200 cursor-pointer relative"
          onClick={() => setFeedType("following")}
        >
          <span className={feedType === "following" ? "text-white font-bold" : "text-stone-400"}>
            Following
          </span>
          {feedType === "following" && (
            <div className="absolute bottom-0 w-14 h-1 rounded-full bg-primary"></div>
          )}
        </div>
      </div>

      {/* Story Section */}
      <div className="p-3 sm:p-4 border-b border-gray-700 overflow-x-auto">
        {/* Stories from followed users */}
        <StoryBar authUser={authUser} />
      </div>

      {/* Create Post Input */}
      <CreatePost />

      {/* Posts */}
      <Posts feedType={feedType} />
    </div>
  );
};

export default Home;
