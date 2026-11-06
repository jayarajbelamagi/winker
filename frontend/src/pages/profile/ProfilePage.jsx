import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import Posts from "../../components/common/Posts";
import ProfileHeaderSkeleton from "../../components/skeletons/ProfileHeaderSkeleton";
import EditProfileModal from "./EditProfileModal";

import { FaArrowLeft } from "react-icons/fa6";
import { IoCalendarOutline } from "react-icons/io5";
import { FaLink } from "react-icons/fa";
import { MdEdit } from "react-icons/md";

import { formatMemberSinceDate } from "../../utils/date";
import useFollow from "../../hooks/useFollow";
import useUpdateUserProfile from "../../hooks/useUpdateUserProfile";
import { apiFetch } from "../../lib/api";

const ProfilePage = () => {
  const [coverImgPreview, setCoverImgPreview] = useState(null);
  const [profileImgPreview, setProfileImgPreview] = useState(null);
  const [feedType, setFeedType] = useState("posts");

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

  const isMyProfile = authUser?._id === user?._id;
  const amIFollowing = authUser?.following?.includes(user?._id);
  const memberSinceDate = formatMemberSinceDate(user?.createdAt);

  useEffect(() => {
    refetch();
  }, [username, refetch]);

  const handleImgChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (type === "coverImg") setCoverImgPreview(reader.result);
      if (type === "profileImg") setProfileImgPreview(reader.result);
    };
    reader.readAsDataURL(file);
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

  return (
    <div className="flex-[4_4_0] border-r border-gray-700 min-h-screen">
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
                <button
                  className="btn btn-outline rounded-full btn-sm"
                  onClick={() => follow(user._id)}
                >
                  {isPending && "Loading..."}
                  {!isPending && amIFollowing && "Unfollow"}
                  {!isPending && !amIFollowing && "Follow"}
                </button>
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

              {/* FOLLOWERS / FOLLOWING */}
              <div className="flex gap-4 mt-2">
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
              </div>
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
    </div>
  );
};

export default ProfilePage;
