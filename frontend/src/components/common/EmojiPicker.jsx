import { useState, useRef, useEffect } from "react";

const EMOJI_CATEGORIES = [
	{
		name: "Smileys",
		icon: "😀",
		emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐"],
	},
	{
		name: "Gestures",
		icon: "👍",
		emojis: ["👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👋", "🤚", "🖐️", "✋", "🖖", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪", "🦾", "🦿"],
	},
	{
		name: "Hearts & Fire",
		icon: "❤️",
		emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "🔥", "✨", "⭐", "🌟", "💫", "💥", "💯", "🎉", "🎊"],
	},
	{
		name: "Activities",
		icon: "⚽",
		emojis: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🏓", "🏸", "🏒", "🏏", "🏑", "🥊", "🥋", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🎫", "🎮", "🎲", "🎯"],
	},
	{
		name: "India & Flags",
		icon: "🇮🇳",
		emojis: ["🇮🇳", "🏏", "🪔", "🕉️", "🛕", "🐅", "🐘", "🦚", "🥭", "🍛", "🫓", "☕", "🚩", "🚀", "💡", "📢", "💬", "👀", "🧠", "🔥"],
	},
];

const EmojiPicker = ({ onSelect, onClose }) => {
	const [activeCategory, setActiveCategory] = useState(0);
	const [search, setSearch] = useState("");
	const pickerRef = useRef(null);

	// Close when clicking outside
	useEffect(() => {
		const handleClickOutside = (e) => {
			if (pickerRef.current && !pickerRef.current.contains(e.target)) {
				onClose && onClose();
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [onClose]);

	const currentEmojis = search.trim()
		? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((e) => e.includes(search.trim()))
		: EMOJI_CATEGORIES[activeCategory].emojis;

	return (
		<div
			ref={pickerRef}
			className="absolute bottom-12 left-0 z-50 bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl p-3 w-72 max-w-[90vw] animate-in fade-in zoom-in-95 duration-150"
			onClick={(e) => e.stopPropagation()}
		>
			{/* Category Bar */}
			<div className="flex justify-between border-b border-gray-700 pb-2 mb-2">
				{EMOJI_CATEGORIES.map((cat, idx) => (
					<button
						key={cat.name}
						type="button"
						onClick={() => {
							setActiveCategory(idx);
							setSearch("");
						}}
						className={`text-lg p-1 rounded hover:bg-gray-700 transition ${
							activeCategory === idx && !search ? "bg-gray-800 scale-110" : ""
						}`}
						title={cat.name}
					>
						{cat.icon}
					</button>
				))}
			</div>

			{/* Search input */}
			<input
				type="text"
				placeholder="Filter emojis..."
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1 text-xs text-white mb-2 focus:outline-none focus:border-primary"
			/>

			{/* Emojis Grid */}
			<div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 p-1">
				{currentEmojis.map((emoji, i) => (
					<button
						key={i}
						type="button"
						onClick={() => onSelect(emoji)}
						className="text-xl p-1 hover:bg-gray-700 rounded hover:scale-125 transition text-center"
					>
						{emoji}
					</button>
				))}
			</div>
		</div>
	);
};

export default EmojiPicker;
