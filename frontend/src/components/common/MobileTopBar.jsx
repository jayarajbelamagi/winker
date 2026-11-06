import { Link } from "react-router-dom";
import XSvg from "../svgs/X";

const MobileTopBar = ({ authUser, onOpenDrawer }) => {
  return (
    <header className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-stone-800 h-13 px-4 flex items-center justify-between md:hidden">
      {/* Left: Avatar button that opens mobile drawer */}
      <button
        onClick={onOpenDrawer}
        className="w-9 h-9 rounded-full overflow-hidden border border-stone-700 active:scale-95 transition flex-shrink-0"
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

      {/* Center: Winker / X Logo (Bold & Prominent) */}
      <Link to="/" className="flex items-center justify-center" title="Winker Home">
        <XSvg className="w-9 h-9 fill-white hover:opacity-90 transition" />
      </Link>

      {/* Right: Balanced empty spacer to keep logo perfectly centered */}
      <div className="w-9 h-9" />
    </header>
  );
};

export default MobileTopBar;
