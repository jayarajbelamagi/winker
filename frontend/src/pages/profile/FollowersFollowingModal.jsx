import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import FollowersFollowingSkeleton from "../../components/skeletons/FollowersFollowingSkeleton";
import { apiFetch } from "../../lib/api";

const FollowersFollowingModal = ({ username, type, closeModal }) => {
  const fetchList = async () => {
    const res = await apiFetch(`/api/users/${type}/${username}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  };

  const { data: users, isLoading, isError, error } = useQuery({
    queryKey: [type, username],
    queryFn: fetchList,
    enabled: Boolean(username && type),
  });

  return (
    <dialog open className='modal border-none outline-none'>
      <div className='modal-box rounded border border-gray-600 max-h-[70vh] overflow-y-auto'>
        <div className='flex justify-between items-center mb-4'>
          <h3 className='font-bold text-lg'>
            {type === "followers" ? "Followers" : "Following"}
          </h3>
          <button onClick={closeModal} className='btn btn-sm btn-circle btn-ghost'>✕</button>
        </div>

        {isLoading && <FollowersFollowingSkeleton />}
        {isError && <p className="text-red-500 text-sm">Error: {error.message}</p>}
        {!isLoading && !isError && users?.length === 0 && <p className="text-stone-400">No users found</p>}

        {!isLoading && !isError &&
          users?.map((user) => (
            <Link
              key={user._id}
              to={`/profile/${user.username}`}
              className='flex items-center gap-3 p-2 hover:bg-stone-800 rounded cursor-pointer transition'
              onClick={closeModal}
            >
              <img
                src={user.profileImg || "/avatar-placeholder.png"}
                alt=''
                className='w-10 h-10 rounded-full object-cover'
              />
              <div className='flex flex-col'>
                <span className='font-bold text-white'>{user.fullName}</span>
                <span className='text-gray-400 text-sm'>@{user.username}</span>
              </div>
            </Link>
          ))}
      </div>
      <form method='dialog' className='modal-backdrop'>
        <button onClick={closeModal} className='outline-none'>close</button>
      </form>
    </dialog>
  );
};

export default FollowersFollowingModal;
