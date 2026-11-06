import { useEffect, useRef, useState } from "react";
import useUpdateUserProfile from "../../hooks/useUpdateUserProfile";
import { MdEdit, MdCameraAlt } from "react-icons/md";

const EditProfileModal = ({ authUser, profileImg, coverImg, setProfileImg, setCoverImg }) => {
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    bio: "",
    link: "",
    newPassword: "",
    currentPassword: "",
  });

  const [modalProfilePreview, setModalProfilePreview] = useState(null);
  const [modalCoverPreview, setModalCoverPreview] = useState(null);

  const profileFileRef = useRef(null);
  const coverFileRef = useRef(null);

  const { updateProfile, isUpdatingProfile } = useUpdateUserProfile();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    if (authUser) {
      setFormData({
        fullName: authUser.fullName || "",
        username: authUser.username || "",
        email: authUser.email || "",
        bio: authUser.bio || "",
        link: authUser.link || "",
        newPassword: "",
        currentPassword: "",
      });
    }
  }, [authUser]);

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (type === "profile") {
        setModalProfilePreview(reader.result);
        setProfileImg && setProfileImg(reader.result);
      } else {
        setModalCoverPreview(reader.result);
        setCoverImg && setCoverImg(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const updatedUser = await updateProfile({
        ...formData,
        profileImg: modalProfilePreview || profileImg || undefined,
        coverImg: modalCoverPreview || coverImg || undefined,
      });
      if (updatedUser) {
        if (updatedUser.profileImg && setProfileImg) setProfileImg(updatedUser.profileImg);
        if (updatedUser.coverImg && setCoverImg) setCoverImg(updatedUser.coverImg);
      }
      setModalProfilePreview(null);
      setModalCoverPreview(null);
      document.getElementById("edit_profile_modal")?.close();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <button
        className="btn btn-outline rounded-full btn-sm"
        onClick={() => document.getElementById("edit_profile_modal").showModal()}
      >
        Edit profile
      </button>
      <dialog id="edit_profile_modal" className="modal">
        <div className="modal-box border rounded-xl border-gray-700 bg-stone-900 shadow-2xl max-w-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-white">Edit Profile</h3>
            <button
              type="button"
              onClick={() => document.getElementById("edit_profile_modal")?.close()}
              className="btn btn-sm btn-circle btn-ghost text-stone-400"
            >
              ✕
            </button>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {/* PHOTO UPLOAD CONTROLS */}
            <div className="flex flex-col gap-2 p-3 bg-black/40 rounded-lg border border-gray-800">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Profile & Cover Photos
              </span>
              <div className="flex items-center gap-4">
                {/* Profile Pic Upload */}
                <div className="flex items-center gap-3">
                  <div className="avatar">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary relative group">
                      <img
                        src={modalProfilePreview || profileImg || authUser?.profileImg || "/avatar-placeholder.png"}
                        alt="Profile avatar"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/avatar-placeholder.png";
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      ref={profileFileRef}
                      onChange={(e) => handleFileChange(e, "profile")}
                    />
                    <button
                      type="button"
                      onClick={() => profileFileRef.current?.click()}
                      className="btn btn-xs btn-outline rounded-full flex items-center gap-1"
                    >
                      <MdCameraAlt />
                      Change Avatar
                    </button>
                  </div>
                </div>

                <div className="divider divider-horizontal my-0" />

                {/* Cover Pic Upload */}
                <div className="flex flex-col gap-1">
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    ref={coverFileRef}
                    onChange={(e) => handleFileChange(e, "cover")}
                  />
                  <button
                    type="button"
                    onClick={() => coverFileRef.current?.click()}
                    className="btn btn-xs btn-outline rounded-full flex items-center gap-1"
                  >
                    <MdEdit />
                    Change Cover
                  </button>
                  {(modalCoverPreview || coverImg) && (
                    <span className="text-[10px] text-green-400">Cover photo selected</span>
                  )}
                </div>
              </div>
            </div>

            {/* TEXT FIELDS */}
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Full Name"
                className="flex-1 input border border-gray-700 bg-black/50 text-white rounded p-2 input-md"
                value={formData.fullName}
                name="fullName"
                onChange={handleInputChange}
                required
              />
              <input
                type="text"
                placeholder="Username"
                className="flex-1 input border border-gray-700 bg-black/50 text-white rounded p-2 input-md"
                value={formData.username}
                name="username"
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <input
                type="email"
                placeholder="Email"
                className="input border border-gray-700 bg-black/50 text-white rounded p-2 input-md"
                value={formData.email}
                name="email"
                onChange={handleInputChange}
                required
              />
              <textarea
                placeholder="Bio"
                className="textarea border border-gray-700 bg-black/50 text-white rounded p-2 text-sm"
                value={formData.bio}
                name="bio"
                onChange={handleInputChange}
                rows={2}
              />
            </div>
            <input
              type="text"
              placeholder="Link / Website"
              className="input border border-gray-700 bg-black/50 text-white rounded p-2 input-md"
              value={formData.link}
              name="link"
              onChange={handleInputChange}
            />

            <div className="border-t border-gray-800 pt-3">
              <span className="text-xs text-stone-400 font-semibold mb-2 block">
                Change Password (optional)
              </span>
              <div className="flex flex-wrap gap-2">
                <input
                  type="password"
                  placeholder="Current Password"
                  className="flex-1 input border border-gray-700 bg-black/50 text-white rounded p-2 input-md"
                  value={formData.currentPassword}
                  name="currentPassword"
                  onChange={handleInputChange}
                />
                <input
                  type="password"
                  placeholder="New Password"
                  className="flex-1 input border border-gray-700 bg-black/50 text-white rounded p-2 input-md"
                  value={formData.newPassword}
                  name="newPassword"
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <button
              className="btn btn-primary rounded-full btn-md text-white mt-2 w-full"
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile ? "Saving Profile..." : "Save Changes"}
            </button>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button className="outline-none">close</button>
        </form>
      </dialog>
    </>
  );
};

export default EditProfileModal;
