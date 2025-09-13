import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import FollowersFollowingSkeleton from "../../components/skeletons/FollowersFollowingSkeleton";

const FollowersFollowingModal = ({ username, type, closeModal }) => {
  const fetchList = async () => {
    const res = await fetch(`/api/users/${type}/${username}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  };

  const { data: users, isLoading, isError, error } = useQuery([type, username], fetchList);

  return (
    <dialog open className='modal border-none outline-none'>
      <div className='modal-box rounded border border-gray-600 max-h-[70vh] overflow-y-auto'>
        <h3 className='font-bold text-lg mb-4'>
          {type === "followers" ? "Followers" : "Following"}
        </h3>

        {isLoading && <FollowersFollowingSkeleton />}
        {isError && <p className="text-red-500">Error: {error.message}</p>}
        {!isLoading && !isError && users?.length === 0 && <p>No users found</p>}

        {!isLoading && !isError &&
          users?.map((user) => (
            <Link
              key={user._id}
              to={`/profile/${user.username}`}
              className='flex items-center gap-3 p-2 hover:bg-gray-700 rounded cursor-pointer'
              onClick={closeModal}
            >
              <img
                src={user.profileImg || "/avatar-placeholder.png"}
                alt=''
                className='w-10 h-10 rounded-full'
              />
              <div className='flex flex-col'>
                <span className='font-bold'>{user.fullName}</span>
                <span className='text-gray-400 text-sm'>@{user.username}</span>
              </div>
            </Link>
          ))}
      </div>
      <form method='dialog' className='modal-backdrop'>
        <button className='outline-none' />
      </form>
    </dialog>
  );
};

export default FollowersFollowingModal;
