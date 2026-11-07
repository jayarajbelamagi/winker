import { useState } from "react";
import { IoCloseSharp, IoCheckmark } from "react-icons/io5";
import { toast } from "react-hot-toast";
import { apiFetch } from "../../lib/api";

const WALLPAPER_PRESETS = [
  { id: "default", name: "Default Dark", bg: "bg-[#0B141A]", style: { backgroundColor: "#0B141A" } },
  { id: "doodle", name: "WhatsApp Doodle", bg: "bg-[#0c1317]", pattern: true, style: { backgroundColor: "#0c1317", backgroundImage: "radial-gradient(#1f2c34 1px, transparent 1px)", backgroundSize: "20px 20px" } },
  { id: "navy", name: "Midnight Navy", bg: "bg-[#0A192F]", style: { backgroundColor: "#0A192F" } },
  { id: "emerald", name: "Forest Emerald", bg: "bg-[#062A1F]", style: { backgroundColor: "#062A1F" } },
  { id: "purple", name: "Royal Amethyst", bg: "bg-[#1B0B2E]", style: { backgroundColor: "#1B0B2E" } },
  { id: "carbon", name: "Pure Carbon", bg: "bg-[#121214]", style: { backgroundColor: "#121214" } },
  { id: "slate", name: "Nordic Slate", bg: "bg-[#1E2530]", style: { backgroundColor: "#1E2530" } },
  { id: "wine", name: "Deep Crimson", bg: "bg-[#250914]", style: { backgroundColor: "#250914" } },
];

const ChatWallpaperModal = ({ isOpen, onClose, conversationId, currentWallpaper, onSelectWallpaper }) => {
  const [selectedId, setSelectedId] = useState(currentWallpaper || "default");

  if (!isOpen) return null;

  const handleApply = async (preset) => {
    setSelectedId(preset.id);
    onSelectWallpaper(preset.id);
    localStorage.setItem(`winker_wallpaper_${conversationId}`, preset.id);

    try {
      await apiFetch(`/api/messages/conversation/${conversationId}/wallpaper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallpaper: preset.id }),
      });
      toast.success(`Wallpaper updated to ${preset.name}!`);
    } catch (e) {
      // LocalStorage fallback already set
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#121214] border border-stone-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800 bg-[#16181C]">
          <h3 className="font-bold text-base text-white">Chat Wallpaper</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition"
          >
            <IoCloseSharp className="w-5 h-5" />
          </button>
        </div>

        {/* Wallpaper Grid */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto">
          {WALLPAPER_PRESETS.map((p) => {
            const isSelected = selectedId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleApply(p)}
                style={p.style}
                className={`h-24 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between p-2.5 relative group shadow-md hover:scale-[1.02] ${
                  isSelected ? "border-primary ring-2 ring-primary/40" : "border-stone-800 hover:border-stone-600"
                }`}
              >
                <div className="flex justify-end">
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white">
                      <IoCheckmark className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                <div className="text-[11px] font-semibold text-white/90 drop-shadow truncate">
                  {p.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-800 bg-[#16181C] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export { WALLPAPER_PRESETS };
export default ChatWallpaperModal;
