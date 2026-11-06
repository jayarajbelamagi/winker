import { Link } from "react-router-dom";
import { IoCloseSharp, IoNotifications, IoNewspaperOutline, IoMailOutline } from "react-icons/io5";
import { FaUser } from "react-icons/fa";
import { BsBookmark } from "react-icons/bs";
import { AiOutlineRobot } from "react-icons/ai";
import { BiLogOut } from "react-icons/bi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { apiFetch, clearStoredAuth } from "../../lib/api";

const MobileDrawer = ({ authUser, isOpen, onClose }) => {
  const queryClient = useQueryClient();

  const { mutate: logout } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/auth/logout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Logout failed");
      return data;
    },
    onSuccess: () => {
      clearStoredAuth();
      queryClient.setQueryData(["authUser"], null);
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      onClose();
      toast.success("Logged out");
    },
    onError: () => {
      clearStoredAuth();
      queryClient.setQueryData(["authUser"], null);
      onClose();
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content */}
      <div className="relative w-4/5 max-w-xs bg-stone-950 border-r border-stone-800 h-full p-5 flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
        {/* Header with Close */}
        <div className="flex items-center justify-between mb-4">
          <Link
            to={`/profile/${authUser?.username}`}
            onClick={onClose}
            className="w-12 h-12 rounded-full overflow-hidden block"
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
          </Link>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <IoCloseSharp className="w-6 h-6" />
          </button>
        </div>

        {/* User Info */}
        <div className="mb-4">
          <Link
            to={`/profile/${authUser?.username}`}
            onClick={onClose}
            className="font-bold text-white text-base hover:underline block leading-tight"
          >
            {authUser?.fullName}
          </Link>
          <span className="text-stone-500 text-xs">@{authUser?.username}</span>

          {/* Following / Followers Count */}
          <div className="flex items-center gap-4 mt-3 text-xs">
            <Link
              to={`/${authUser?.username}/following`}
              onClick={onClose}
              className="hover:underline"
            >
              <strong className="text-white font-semibold">
                {authUser?.following?.length || 0}
              </strong>{" "}
              <span className="text-stone-400">Following</span>
            </Link>
            <Link
              to={`/${authUser?.username}/followers`}
              onClick={onClose}
              className="hover:underline"
            >
              <strong className="text-white font-semibold">
                {authUser?.followers?.length || 0}
              </strong>{" "}
              <span className="text-stone-400">Followers</span>
            </Link>
          </div>
        </div>

        <div className="border-t border-stone-800 my-2" />

        {/* Navigation items */}
        <ul className="flex flex-col gap-2 my-2 flex-1 overflow-y-auto">
          <li>
            <Link
              to={`/profile/${authUser?.username}`}
              onClick={onClose}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-stone-900 text-white font-medium text-base transition"
            >
              <FaUser className="w-5 h-5 text-stone-400" />
              <span>Profile</span>
            </Link>
          </li>
          <li>
            <Link
              to="/messages"
              onClick={onClose}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-stone-900 text-white font-medium text-base transition"
            >
              <IoMailOutline className="w-5 h-5 text-stone-400" />
              <span>Direct Messages</span>
            </Link>
          </li>
          <li>
            <Link
              to="/bookmarks"
              onClick={onClose}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-stone-900 text-white font-medium text-base transition"
            >
              <BsBookmark className="w-5 h-5 text-stone-400" />
              <span>Bookmarks</span>
            </Link>
          </li>
          <li>
            <Link
              to="/news"
              onClick={onClose}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-stone-900 text-white font-medium text-base transition"
            >
              <IoNewspaperOutline className="w-5 h-5 text-stone-400" />
              <span>India News</span>
            </Link>
          </li>
          <li>
            <Link
              to="/notifications"
              onClick={onClose}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-stone-900 text-white font-medium text-base transition"
            >
              <IoNotifications className="w-5 h-5 text-stone-400" />
              <span>Notifications</span>
            </Link>
          </li>
          <li>
            <Link
              to="/chat"
              onClick={onClose}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-stone-900 text-white font-medium text-base transition"
            >
              <AiOutlineRobot className="w-5 h-5 text-stone-400" />
              <span>Thook AI</span>
            </Link>
          </li>
        </ul>

        {/* Log Out */}
        <div className="pt-3 border-t border-stone-800">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 w-full p-2.5 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold text-sm transition"
          >
            <BiLogOut className="w-5 h-5" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileDrawer;
