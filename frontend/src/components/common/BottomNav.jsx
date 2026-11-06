import { Link, useLocation } from "react-router-dom";
import { MdHomeFilled, MdOutlineHome } from "react-icons/md";
import {
  IoNotifications,
  IoNotificationsOutline,
  IoNewspaper,
  IoNewspaperOutline,
  IoMail,
  IoMailOutline,
  IoCall,
  IoCallOutline,
} from "react-icons/io5";
import { AiOutlineRobot, AiFillRobot } from "react-icons/ai";

const BottomNav = ({ authUser }) => {
  const location = useLocation();
  const pathname = location.pathname;

  const isHome = pathname === "/";
  const isNews = pathname === "/news";
  const isNotifications = pathname === "/notifications";
  const isMessages = pathname.startsWith("/messages");
  const isCalls = pathname.startsWith("/calls");
  const isProfile = authUser?.username && pathname === `/profile/${authUser.username}`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-lg border-t border-stone-800 md:hidden px-3 h-14 flex items-center justify-around">
      {/* Home */}
      <Link
        to="/"
        className="flex flex-col items-center justify-center p-2 text-white hover:text-primary transition"
        title="Home"
      >
        {isHome ? (
          <MdHomeFilled className="w-6 h-6 text-white" />
        ) : (
          <MdOutlineHome className="w-6 h-6 text-stone-400" />
        )}
      </Link>

      {/* Direct Messages (Texting) */}
      <Link
        to="/messages"
        className="flex flex-col items-center justify-center p-2 text-white hover:text-primary transition"
        title="Direct Messages"
      >
        {isMessages ? (
          <IoMail className="w-6 h-6 text-primary" />
        ) : (
          <IoMailOutline className="w-6 h-6 text-stone-400" />
        )}
      </Link>

      {/* Calls (Dedicated Voice & Video calls) */}
      <Link
        to="/calls"
        className="flex flex-col items-center justify-center p-2 text-white hover:text-primary transition"
        title="Calls"
      >
        {isCalls ? (
          <IoCall className="w-6 h-6 text-emerald-400" />
        ) : (
          <IoCallOutline className="w-6 h-6 text-stone-400" />
        )}
      </Link>

      {/* News (India Trending) */}
      <Link
        to="/news"
        className="flex flex-col items-center justify-center p-2 text-white hover:text-primary transition"
        title="News"
      >
        {isNews ? (
          <IoNewspaper className="w-6 h-6 text-primary" />
        ) : (
          <IoNewspaperOutline className="w-6 h-6 text-stone-400" />
        )}
      </Link>

      {/* Notifications */}
      <Link
        to="/notifications"
        className="flex flex-col items-center justify-center p-2 text-white hover:text-primary transition"
        title="Notifications"
      >
        {isNotifications ? (
          <IoNotifications className="w-6 h-6 text-white" />
        ) : (
          <IoNotificationsOutline className="w-6 h-6 text-stone-400" />
        )}
      </Link>

      {/* Profile */}
      <Link
        to={`/profile/${authUser?.username || ""}`}
        className="flex flex-col items-center justify-center p-2 transition"
        title="Profile"
      >
        <div
          className={`w-7 h-7 rounded-full overflow-hidden border-2 ${
            isProfile ? "border-primary" : "border-transparent"
          }`}
        >
          <img
            src={authUser?.profileImg || "/avatar-placeholder.png"}
            alt="Profile"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/avatar-placeholder.png";
            }}
          />
        </div>
      </Link>
    </nav>
  );
};

export default BottomNav;
