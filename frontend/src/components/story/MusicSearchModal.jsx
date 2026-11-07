import { useState, useRef, useEffect } from "react";
import { IoClose, IoPlay, IoPause, IoSearch } from "react-icons/io5";
import { BsMusicNoteBeamed } from "react-icons/bs";

const MusicSearchModal = ({ isOpen, onClose, onSelectMusic }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playingPreview, setPlayingPreview] = useState(null);
  const audioRef = useRef(null);

  // Pre-load popular tracks on open
  useEffect(() => {
    if (isOpen && results.length === 0) {
      searchMusic("top hits 2026");
    }
  }, [isOpen]);

  // Stop audio on close
  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      setPlayingPreview(null);
    }
  }, [isOpen]);

  const searchMusic = async (searchTerm) => {
    if (!searchTerm?.trim()) return;
    try {
      setIsLoading(true);
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(
          searchTerm.trim()
        )}&entity=song&limit=15`
      );
      const data = await res.json();
      setResults(data?.results || []);
    } catch (err) {
      console.error("Failed to search music:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePlay = (previewUrl) => {
    if (playingPreview === previewUrl) {
      audioRef.current?.pause();
      setPlayingPreview(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(previewUrl);
      audioRef.current.play().catch(() => {});
      audioRef.current.onended = () => setPlayingPreview(null);
      setPlayingPreview(previewUrl);
    }
  };

  const handleSelect = (track) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onSelectMusic({
      title: track.trackName,
      artist: track.artistName,
      previewUrl: track.previewUrl,
      artwork: track.artworkUrl100 || track.artworkUrl60,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#16181C] border border-stone-800 w-full max-w-md rounded-2xl p-5 flex flex-col max-h-[85vh] shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <BsMusicNoteBeamed className="text-pink-500 w-5 h-5" />
            <h3 className="text-lg font-bold text-white">Add Music to Story</h3>
          </div>
          <button
            onClick={() => {
              if (audioRef.current) audioRef.current.pause();
              onClose();
            }}
            className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-stone-800"
          >
            <IoClose className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative my-3">
          <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 w-5 h-5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchMusic(query)}
            placeholder="Search songs or artists..."
            className="w-full bg-stone-900 border border-stone-700/80 rounded-full pl-10 pr-20 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 transition"
            autoFocus
          />
          <button
            onClick={() => searchMusic(query)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-pink-600 hover:bg-pink-700 text-white text-xs px-3 py-1.5 rounded-full font-medium transition"
          >
            Search
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-stone-400 gap-2">
              <span className="loading loading-spinner loading-md text-pink-500"></span>
              <span className="text-xs">Searching tracks...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-stone-500 text-sm">
              No tracks found. Try searching another song or artist.
            </div>
          ) : (
            results.map((track) => (
              <div
                key={track.trackId}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-900/80 border border-transparent hover:border-stone-800 transition group cursor-pointer"
                onClick={() => handleSelect(track)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-stone-800">
                    <img
                      src={track.artworkUrl100 || track.artworkUrl60}
                      alt={track.trackName}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePlay(track.previewUrl);
                      }}
                      className="absolute inset-0 bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition"
                    >
                      {playingPreview === track.previewUrl ? (
                        <IoPause className="w-5 h-5 text-pink-400" />
                      ) : (
                        <IoPlay className="w-5 h-5 ml-0.5" />
                      )}
                    </button>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 pr-2">
                    <span className="font-semibold text-white text-sm truncate">
                      {track.trackName}
                    </span>
                    <span className="text-xs text-stone-400 truncate">
                      {track.artistName}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(track);
                  }}
                  className="bg-stone-800 group-hover:bg-pink-600 text-stone-200 group-hover:text-white px-3 py-1.5 rounded-full text-xs font-semibold transition"
                >
                  Select
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MusicSearchModal;
