// src/skeletons/FollowersFollowingSkeleton.jsx
const FollowersFollowingSkeleton = () => {
  return (
    <div className='flex flex-col gap-3 p-4'>
      {[...Array(5)].map((_, i) => (
        <div key={i} className='flex items-center gap-3'>
          <div className='skeleton w-10 h-10 rounded-full'></div>
          <div className='flex flex-col gap-1 w-full'>
            <div className='skeleton h-3 w-24 rounded-full'></div>
            <div className='skeleton h-2 w-32 rounded-full'></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FollowersFollowingSkeleton;
