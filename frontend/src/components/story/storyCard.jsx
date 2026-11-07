import { useState } from "react";
import StoryViewer from "./storyViewer";

const StoryCard = ({ storyGroup, authUser }) => {
  const [isOpen, setIsOpen] = useState(false);

  const targetUser = storyGroup?.user || storyGroup?.userId || storyGroup;
  if (!targetUser?._id) return null;

  const hasUnviewed = storyGroup?.hasUnviewed ?? true;
  const isSelf = targetUser._id.toString() === authUser?._id?.toString();

  return (
    <>
      <div className="flex flex-col items-center flex-shrink-0 cursor-pointer group">
        <div
          onClick={() => setIsOpen(true)}
          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[2.5px] transition group-hover:scale-105 ${
            hasUnviewed
              ? "bg-gradient-to-tr from-pink-500 via-purple-500 to-amber-400 animate-gradient"
              : "border-2 border-stone-700 bg-stone-900"
          }`}
          title={`View ${targetUser.fullName || targetUser.username}'s story`}
        >
          <div className="w-full h-full rounded-full overflow-hidden bg-black p-[1.5px]">
            <img
              src={targetUser.profileImg || "/avatar-placeholder.png"}
              alt={targetUser.username}
              className="object-cover w-full h-full rounded-full"
            />
          </div>
        </div>

        <span className="text-[11px] font-medium text-stone-300 mt-1 max-w-[70px] truncate text-center">
          {isSelf ? "Your Story" : targetUser.fullName || targetUser.username}
        </span>
      </div>

      {isOpen && (
        <StoryViewer
          userId={targetUser._id}
          authUser={authUser}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default StoryCard;
