import { useState } from "react";
import StoryViewer from "./storyViewer";

const StoryCard = ({ story, authUser }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!story?.user?._id) return null;

  return (
    <div className="flex flex-col items-center w-24">
      <div
        onClick={() => setIsOpen(true)}
        className="w-24 h-24 rounded-full p-[3px] bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 cursor-pointer"
        aria-label={`View ${story.user.username || "user"}'s stories`}
        title={`View ${story.user.username || "user"}'s stories`}
      >
        <div className="w-full h-full rounded-full overflow-hidden bg-black">
          <img
            src={story.user.profileImg || "/avatar-placeholder.png"}
            alt={story.user.username || "user"}
            className="object-cover w-full h-full"
          />
        </div>
      </div>
      <div className="text-center text-xs mt-1 w-24 truncate">
        {story.user.username || "user"}
      </div>

      {isOpen && (
        <StoryViewer
          userId={story.user._id}
          authUser={authUser}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default StoryCard;
