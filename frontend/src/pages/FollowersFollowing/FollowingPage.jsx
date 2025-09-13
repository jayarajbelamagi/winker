import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const FollowingPage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowing = async () => {
      try {
        const res = await fetch(`/api/users/${username}/following`);
        const data = await res.json();
        setFollowing(data);
      } catch (error) {
        console.error("Error fetching following:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFollowing();
  }, [username]);

  if (loading) return <p className="p-4 text-center text-gray-500">Loading following...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-6">
      <h2 className="text-2xl font-bold mb-4 px-4">Following</h2>
      {following.length === 0 ? (
        <p className="px-4 text-gray-500">No following found.</p>
      ) : (
        <ul>
          {following.map((user) => (
            <li
              key={user._id}
              className="flex items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b"
            >
              <div
                className="flex items-center"
                onClick={() => navigate(`/profile/${user.username}`)}
              >
                <img
                  src={user.profileImg || "/avatar-placeholder.png"}
                  alt={user.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="ml-4">
                  <p className="font-semibold text-gray-900 dark:text-white">{user.fullName}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">@{user.username}</p>
                  {user.bio && <p className="text-gray-500 dark:text-gray-400 text-sm truncate w-64">{user.bio}</p>}
                </div>
              </div>
              {/* Optional follow/unfollow button */}
              {/* <button className="btn btn-outline btn-sm">Follow</button> */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FollowingPage;
