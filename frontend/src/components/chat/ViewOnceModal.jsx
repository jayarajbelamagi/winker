import { IoClose } from "react-icons/io5";

const ViewOnceModal = ({ isOpen, mediaUrl, isVideo = false, onClose }) => {
  if (!isOpen || !mediaUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 animate-in fade-in select-none"
      onClick={onClose}
    >
      {/* Top Header */}
      <div className="flex justify-between items-center z-10">
        <div className="flex items-center gap-2 bg-stone-900/90 border border-stone-800 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white shadow">
          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-xs">
            1
          </span>
          <span>View Once Media</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white transition"
        >
          <IoClose className="w-6 h-6" />
        </button>
      </div>

      {/* Media Center */}
      <div
        className="flex-1 flex items-center justify-center p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={mediaUrl}
            controls
            autoPlay
            playsInline
            className="max-h-[82vh] w-full max-w-xl object-contain rounded-2xl shadow-2xl"
          />
        ) : (
          <img
            src={mediaUrl}
            alt=""
            className="max-h-[82vh] w-full max-w-xl object-contain rounded-2xl shadow-2xl"
          />
        )}
      </div>

      {/* Footer Notice */}
      <div className="text-center text-[11px] text-stone-500 pb-2">
        This media will disappear once closed and cannot be re-opened.
      </div>
    </div>
  );
};

export default ViewOnceModal;
