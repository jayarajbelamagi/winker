import { Link } from "react-router-dom";
import XSvg from "../svgs/X";
import { BsBookmark } from "react-icons/bs";
import { AiOutlineRobot } from "react-icons/ai";

const MobileTopBar = ({ authUser, onOpenDrawer }) => {
  return (
    <header className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-stone-800 h-12 px-4 flex items-center justify-between md:hidden">
      {/* Left: Avatar button that opens mobile drawer */}
      <button
        onClick={onOpenDrawer}
        className="w-8 h-8 rounded-full overflow-hidden border border-stone-700 active:scale-95 transition"
        title="Open menu"
      >
        <img
          src={authUser?.profileImg || "/avatar-placeholder.png"}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/avatar-placeholder.png";
          }}
        />
      </button>

      {/* Center: Winker / X Logo */}
      <Link to="/" className="flex items-center justify-center">
        <XSvg className="w-6 h-6 fill-white" />
      </Link>

      {/* Right: Quick link to Bookmarks or Chat */}
      <div className="flex items-center gap-3">
        <Link
          to="/bookmarks"
          className="text-stone-400 hover:text-white transition p-1"
          title="Bookmarks"
        >
          <BsBookmark className="w-5 h-5" />
        </Link>
      </div>
    </header>
  );
};

export default MobileTopBar;
