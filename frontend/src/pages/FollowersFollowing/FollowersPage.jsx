import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";

const FollowersPage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowers = async () => {
      try {
        const res = await apiFetch(`/api/users/${username}/followers`);
        const data = await res.json();
        setFollowers(data || []);
      } catch (error) {
        console.error("Error fetching followers:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFollowers();
  }, [username]);

  if (loading) return <p className="p-4 text-center text-gray-500">Loading followers...</p>;

  return (
    <div className="flex-[4_4_0] min-w-0 max-w-2xl xl:max-w-3xl w-full border-r border-gray-800 min-h-screen p-4">
      <h2 className="text-2xl font-bold mb-4">Followers</h2>
      {followers.length === 0 ? (
        <p className="text-gray-500">No followers found.</p>
      ) : (
        <ul className="divide-y divide-gray-800">
          {followers.map((user) => (
            <li
              key={user._id}
              className="flex items-center justify-between py-3 px-2 hover:bg-stone-900 rounded cursor-pointer transition"
              onClick={() => navigate(`/profile/${user.username}`)}
            >
              <div className="flex items-center gap-3">
                <img
                  src={user.profileImg || "/avatar-placeholder.png"}
                  alt={user.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold text-white">{user.fullName}</p>
                  <p className="text-sm text-gray-400">@{user.username}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FollowersPage;
