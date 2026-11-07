import { useState } from "react";
import { IoClose, IoSearch } from "react-icons/io5";

// Curated high-quality popular GIFs for instant reactivity
const POPULAR_GIFS = [
  { id: "1", title: "Excited", url: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif" },
  { id: "2", title: "Laughing", url: "https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif" },
  { id: "3", title: "Applause", url: "https://media.giphy.com/media/nbvFVPiEiJH6JOGIok/giphy.gif" },
  { id: "4", title: "Thumbs Up", url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif" },
  { id: "5", title: "Mind Blown", url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif" },
  { id: "6", title: "Party", url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif" },
  { id: "7", title: "Dance", url: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif" },
  { id: "8", title: "Love", url: "https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif" },
  { id: "9", title: "Confused", url: "https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/giphy.gif" },
  { id: "10", title: "Wow", url: "https://media.giphy.com/media/udmx3pgdiD7gKgcFsO/giphy.gif" },
  { id: "11", title: "Facepalm", url: "https://media.giphy.com/media/3oEjI67Egb8G9jNUGI/giphy.gif" },
  { id: "12", title: "Cool", url: "https://media.giphy.com/media/62PP2yEIAZF6g/giphy.gif" },
];

const GifPicker = ({ isOpen, onClose, onSelectGif }) => {
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  const filteredGifs = POPULAR_GIFS.filter((g) =>
    g.title.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#16181C] border border-stone-800 w-full max-w-sm rounded-2xl p-4 shadow-2xl flex flex-col max-h-[75vh] animate-in zoom-in-95">
        <div className="flex justify-between items-center pb-2 border-b border-stone-800">
          <span className="font-bold text-white text-sm">Select a GIF</span>
          <button onClick={onClose} className="text-stone-400 hover:text-white">
            <IoClose className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative my-2.5">
          <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 w-4 h-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search GIFs..."
            className="w-full bg-stone-900 border border-stone-800 rounded-full pl-9 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-primary"
            autoFocus
          />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 pr-1 scrollbar-thin">
          {filteredGifs.map((gif) => (
            <div
              key={gif.id}
              onClick={() => {
                onSelectGif(gif.url);
                onClose();
              }}
              className="relative rounded-xl overflow-hidden cursor-pointer group bg-stone-900 aspect-video border border-transparent hover:border-primary transition"
            >
              <img
                src={gif.url}
                alt={gif.title}
                className="w-full h-full object-cover group-hover:scale-105 transition"
                loading="lazy"
              />
              <span className="absolute bottom-1 left-2 text-[10px] bg-black/70 px-1.5 py-0.5 rounded text-white font-medium">
                {gif.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GifPicker;
