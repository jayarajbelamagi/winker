import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import Posts from "../../components/common/Posts";
import ProfileHeaderSkeleton from "../../components/skeletons/ProfileHeaderSkeleton";
import EditProfileModal from "./EditProfileModal";

import { FaArrowLeft } from "react-icons/fa6";
import { IoCalendarOutline, IoEyeOutline } from "react-icons/io5";
import { FaLink } from "react-icons/fa";
import { MdEdit } from "react-icons/md";
import { FiSend, FiPhone, FiVideo, FiChevronRight } from "react-icons/fi";
import { useCall } from "../../context/CallContext";
import ProfileViewsModal from "../../components/profile/ProfileViewsModal";
import StreakMilestonesModal from "../../components/profile/StreakMilestonesModal";

import { formatMemberSinceDate } from "../../utils/date";
import useFollow from "../../hooks/useFollow";
import useUpdateUserProfile from "../../hooks/useUpdateUserProfile";
import { apiFetch } from "../../lib/api";
import { compressImage } from "../../utils/imageCompressor";

const ProfilePage = () => {
  const [coverImgPreview, setCoverImgPreview] = useState(null);
  const [profileImgPreview, setProfileImgPreview] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [feedType, setFeedType] = useState("posts");
  const [showProfileViews, setShowProfileViews] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);

  const coverImgRef = useRef(null);
  const profileImgRef = useRef(null);

  const { username } = useParams();
  const navigate = useNavigate();

  const { follow, isPending } = useFollow();
  const { data: authUser } = useQuery({ queryKey: ["authUser"] });
  const { isUpdatingProfile, updateProfile } = useUpdateUserProfile();

  const {
    data: user,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["userProfile", username],
    queryFn: async () => {
      const res = await apiFetch(`/api/users/profile/${username}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      return data;
    },
  });

  const isMyProfile = authUser?._id?.toString() === user?._id?.toString();

  // LinkedIn-style Profile Views query (only active for user's own profile)
  const { data: profileViewsData } = useQuery({
    queryKey: ["profileViews"],
    queryFn: async () => {
      const res = await apiFetch("/api/users/profile-views");
      const data = await res.json();
      if (!res.ok) return null;
      return data;
    },
    enabled: Boolean(isMyProfile),
  });
  const amIFollowing =
    authUser?.following?.some((id) => (id?._id || id)?.toString() === user?._id?.toString()) ||
    user?.followers?.some((id) => (id?._id || id)?.toString() === authUser?._id?.toString());
  const doesUserFollowMe =
    user?.following?.some((id) => (id?._id || id)?.toString() === authUser?._id?.toString()) ||
    authUser?.followers?.some((id) => (id?._id || id)?.toString() === user?._id?.toString());
  const memberSinceDate = formatMemberSinceDate(user?.createdAt);
  const { startCall } = useCall();

  useEffect(() => {
    refetch();
  }, [username, refetch]);

  const handleImgChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const maxDim = type === "profileImg" ? 800 : 1600;
      const compressed = await compressImage(file, maxDim, 0.85);
      if (type === "coverImg") setCoverImgPreview(compressed);
      if (type === "profileImg") setProfileImgPreview(compressed);
    } catch (err) {
      console.warn("Client compression fallback:", err);
      const reader = new FileReader();
      reader.onload = () => {
        if (type === "coverImg") setCoverImgPreview(reader.result);
        if (type === "profileImg") setProfileImgPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSavePhotos = async () => {
    try {
      await updateProfile({
        profileImg: profileImgPreview || undefined,
        coverImg: coverImgPreview || undefined,
      });
      setProfileImgPreview(null);
      setCoverImgPreview(null);
      refetch();
      toast.success("Photos updated successfully!");
    } catch (err) {
      toast.error("Failed to update photos");
    }
  };

  const handleMessageClick = () => {
    if (!amIFollowing || !doesUserFollowMe) {
      if (amIFollowing && !doesUserFollowMe) {
        toast.error(`You follow @${user.username}, but they haven't followed you back yet. You can text once @${user.username} follows you back!`);
      } else {
        toast.error(`You and @${user.username} must both follow each other to start texting.`);
      }
      return;
    }
    navigate(`/messages/${user._id}`);
  };

  const handleCallClick = (callType) => {
    if (!amIFollowing || !doesUserFollowMe) {
      if (amIFollowing && !doesUserFollowMe) {
        toast.error(`You follow @${user.username}, but they haven't followed you back yet. Calling requires mutual follow!`);
      } else {
        toast.error(`You and @${user.username} must both follow each other to start calling.`);
      }
      return;
    }
    startCall({ partner: user, callType });
  };

  return (
    <div className="flex-[4_4_0] min-w-0 max-w-2xl xl:max-w-3xl w-full border-r border-gray-800 min-h-screen">
      {/* Floating Save Bar for Selected Photos */}
      {isMyProfile && (coverImgPreview || profileImgPreview) && (
        <div className="sticky top-2 z-50 bg-sky-600 text-white px-4 py-3 rounded-xl mx-4 my-2 flex justify-between items-center shadow-2xl border border-sky-400 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-lg">📸</span>
            <span className="font-semibold text-sm">You have unsaved photo changes</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCoverImgPreview(null);
                setProfileImgPreview(null);
              }}
              className="btn btn-xs btn-ghost text-white hover:bg-sky-700"
              disabled={isUpdatingProfile}
            >
              Cancel
            </button>
            <button
              onClick={handleSavePhotos}
              className="btn btn-xs bg-white text-sky-900 hover:bg-gray-100 font-bold px-3 shadow"
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile ? "Saving..." : "Save Photos"}
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      {(isLoading || isRefetching) && <ProfileHeaderSkeleton />}
      {!isLoading && !isRefetching && !user && (
        <p className="text-center text-lg mt-4 text-stone-400">User not found</p>
      )}

      <div className="flex flex-col">
        {!isLoading && !isRefetching && user && (
          <>
            <div className="flex gap-10 px-4 py-2 items-center">
              <span onClick={() => navigate(-1)} className="cursor-pointer hover:bg-stone-800 p-2 rounded-full transition">
                <FaArrowLeft className="w-4 h-4" />
              </span>
              <div className="flex flex-col">
                <p className="font-bold text-lg">{user.fullName}</p>
              </div>
            </div>

            {/* COVER IMAGE */}
            <div className="relative group/cover">
              <img
                src={coverImgPreview || user.coverImg || "/cover.png"}
                className="h-52 w-full object-cover"
                alt="cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/cover.png";
                }}
              />
              {isMyProfile && (
                <div
                  className="absolute top-2 right-2 rounded-full p-2 bg-gray-900/80 hover:bg-black cursor-pointer opacity-90 transition duration-200 flex items-center gap-1 text-xs text-white px-3"
                  onClick={() => coverImgRef.current?.click()}
                  title="Update cover photo"
                >
                  <MdEdit className="w-4 h-4" />
                  <span>Edit Cover</span>
                </div>
              )}
              <input
                type="file"
                hidden
                accept="image/*"
                ref={coverImgRef}
                onChange={(e) => handleImgChange(e, "coverImg")}
              />
              <input
                type="file"
                hidden
                accept="image/*"
                ref={profileImgRef}
                onChange={(e) => handleImgChange(e, "profileImg")}
              />

              {/* PROFILE AVATAR */}
              <div className="avatar absolute -bottom-16 left-4">
                <div className="w-32 rounded-full relative group/avatar overflow-hidden border-4 border-black bg-black">
                  <img
                    src={profileImgPreview || user.profileImg || "/avatar-placeholder.png"}
                    alt="avatar"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/avatar-placeholder.png";
                    }}
                  />
                  {isMyProfile && (
                    <div
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 cursor-pointer transition"
                      onClick={() => profileImgRef.current?.click()}
                      title="Update profile picture"
                    >
                      <MdEdit className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex justify-end px-4 mt-5 gap-2">
              {isMyProfile && (
                <EditProfileModal
                  authUser={authUser}
                  profileImg={profileImgPreview}
                  coverImg={coverImgPreview}
                  setProfileImg={setProfileImgPreview}
                  setCoverImg={setCoverImgPreview}
                />
              )}
              {!isMyProfile && (
                <>
                  <button
                    onClick={handleMessageClick}
                    className="btn btn-sm btn-outline rounded-full gap-1.5 hover:bg-primary hover:border-primary hover:text-white transition"
                    title="Send direct message"
                  >
                    <FiSend className="w-3.5 h-3.5" />
                    <span>Message</span>
                  </button>
                  <button
                    onClick={() => handleCallClick("audio")}
                    className="btn btn-sm btn-circle btn-outline hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition"
                    title="Audio Call"
                  >
                    <FiPhone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleCallClick("video")}
                    className="btn btn-sm btn-circle btn-outline hover:bg-sky-500 hover:border-sky-500 hover:text-white transition"
                    title="Video Call"
                  >
                    <FiVideo className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="btn btn-outline rounded-full btn-sm"
                    onClick={() => follow(user._id)}
                  >
                    {isPending && "Loading..."}
                    {!isPending && amIFollowing && "Unfollow"}
                    {!isPending && !amIFollowing && "Follow"}
                  </button>
                </>
              )}
            </div>

            {/* USER INFO */}
            <div className="flex flex-col gap-4 mt-14 px-4">
              <div className="flex flex-col">
                <span className="font-bold text-lg">{user.fullName}</span>
                <span className="text-sm text-slate-500">@{user.username}</span>
                <span className="text-sm my-1">{user.bio}</span>
              </div>

              <div className="flex gap-2 flex-wrap">
                {user.link && (
                  <div className="flex gap-1 items-center">
                    <FaLink className="w-3 h-3 text-slate-500" />
                    <a
                      href={user.link.startsWith("http") ? user.link : `https://${user.link}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-500 hover:underline"
                    >
                      {user.link}
                    </a>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <IoCalendarOutline className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-500">{memberSinceDate}</span>
                </div>
              </div>

              {/* FOLLOWERS / FOLLOWING & PROFILE VIEWS */}
              <div className="flex gap-4 mt-2 flex-wrap items-center">
                <p
                  className="cursor-pointer text-sm text-gray-400 hover:underline"
                  onClick={() => navigate(`/${user.username}/followers`)}
                >
                  <span className="font-bold text-white">{user.followers?.length || 0}</span> Followers
                </p>
                <p
                  className="cursor-pointer text-sm text-gray-400 hover:underline"
                  onClick={() => navigate(`/${user.username}/following`)}
                >
                  <span className="font-bold text-white">{user.following?.length || 0}</span> Following
                </p>
                {isMyProfile && (
                  <button
                    onClick={() => setShowProfileViews(true)}
                    className="flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 hover:underline transition font-medium"
                    title="Who viewed your profile"
                  >
                    <IoEyeOutline className="w-4 h-4 text-sky-400" />
                    <span>
                      <strong className="text-white">
                        {profileViewsData?.uniqueViewersCount ?? user?.profileViewsCount ?? 0}
                      </strong>{" "}
                      Profile Views
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setShowStreakModal(true)}
                  className="flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 hover:underline transition font-medium"
                  title="Streak Milestones"
                >
                  <span>🔥</span>
                  <span>
                    <strong className="text-white">Streak Badges</strong>
                  </span>
                </button>
              </div>

              {/* Who Viewed Your Profile Card (Only for own profile) */}
              {isMyProfile && (
                <div
                  onClick={() => setShowProfileViews(true)}
                  className="mt-3 p-3.5 bg-gradient-to-r from-sky-950/40 via-stone-900 to-sky-950/20 border border-sky-800/40 hover:border-sky-500/60 rounded-2xl cursor-pointer transition flex items-center justify-between group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 text-lg group-hover:scale-110 transition">
                      👁️
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">Who viewed your profile</span>
                      <p className="text-xs text-stone-400 mt-0.5">
                        <strong className="text-sky-400 font-bold">
                          {profileViewsData?.uniqueViewersCount ?? user?.profileViewsCount ?? 0} people
                        </strong>{" "}
                        viewed your profile recently
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-sky-400 font-medium group-hover:translate-x-0.5 transition">
                    <span>See all</span>
                    <FiChevronRight className="w-4 h-4" />
                  </div>
                </div>
              )}
            </div>

            {/* FEED TYPE TABS */}
            <div className="flex w-full border-b border-gray-700 mt-4">
              <div
                className={`flex justify-center flex-1 p-3 hover:bg-secondary transition duration-300 relative cursor-pointer ${
                  feedType === "posts" ? "font-bold text-white" : "text-slate-500"
                }`}
                onClick={() => setFeedType("posts")}
              >
                Posts
                {feedType === "posts" && (
                  <div className="absolute bottom-0 w-10 h-1 rounded-full bg-primary" />
                )}
              </div>
              <div
                className={`flex justify-center flex-1 p-3 hover:bg-secondary transition duration-300 relative cursor-pointer ${
                  feedType === "likes" ? "font-bold text-white" : "text-slate-500"
                }`}
                onClick={() => setFeedType("likes")}
              >
                Likes
                {feedType === "likes" && (
                  <div className="absolute bottom-0 w-10 h-1 rounded-full bg-primary" />
                )}
              </div>
            </div>
          </>
        )}

        <Posts feedType={feedType} username={username} userId={user?._id} />
      </div>

      {/* Who Viewed Your Profile Modal */}
      {isMyProfile && (
        <ProfileViewsModal
          isOpen={showProfileViews}
          onClose={() => setShowProfileViews(false)}
          authUser={authUser}
        />
      )}

      {/* Streak Milestones Modal */}
      <StreakMilestonesModal
        isOpen={showStreakModal}
        onClose={() => setShowStreakModal(false)}
        maxStreak={7}
      />
    </div>
  );
};

export default ProfilePage;
