import { CiImageOn } from "react-icons/ci";
import { BsEmojiSmileFill } from "react-icons/bs";
import { useRef, useState } from "react";
import { IoCloseSharp } from "react-icons/io5";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { apiFetch } from "../../lib/api";
import EmojiPicker from "../../components/common/EmojiPicker";
import { compressImage } from "../../utils/imageCompressor";

const CreatePost = () => {
	const [text, setText] = useState("");
	const [img, setImg] = useState(null);
	const [is24hStory, setIs24hStory] = useState(false);
	const [isCompressing, setIsCompressing] = useState(false);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const imgRef = useRef(null);
	const textareaRef = useRef(null);

	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const queryClient = useQueryClient();

	const {
		mutate: createPost,
		isPending,
		isError,
		error,
	} = useMutation({
		mutationFn: async ({ text, img, is24hStory }) => {
			try {
				const res = await apiFetch("/api/posts/create", {
					method: "POST",
					body: JSON.stringify({ text, img, is24hStory }),
				});
				const data = await res.json();
				if (!res.ok) {
					throw new Error(data.error || "Something went wrong");
				}
				return data;
			} catch (error) {
				throw new Error(error.message || error);
			}
		},

		onSuccess: () => {
			setText("");
			setImg(null);
			setIs24hStory(false);
			setShowEmojiPicker(false);
			toast.success(is24hStory ? "24h Story post published! It will expire in 24 hours." : "Post created successfully");
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
	});

	const handleSubmit = (e) => {
		e.preventDefault();
		if (!text.trim() && !img) {
			toast.error("Please provide text or an image");
			return;
		}
		createPost({ text, img, is24hStory });
	};

	const handleImgChange = async (e) => {
		const file = e.target.files[0];
		if (file) {
			try {
				setIsCompressing(true);
				const compressed = await compressImage(file, 1600, 0.85);
				setImg(compressed);
			} catch (err) {
				console.error("Image compression error:", err);
				const reader = new FileReader();
				reader.onload = () => {
					setImg(reader.result);
				};
				reader.readAsDataURL(file);
			} finally {
				setIsCompressing(false);
			}
		}
	};

	const handleEmojiSelect = (emoji) => {
		const textarea = textareaRef.current;
		if (textarea) {
			const start = textarea.selectionStart || text.length;
			const end = textarea.selectionEnd || text.length;
			const newText = text.substring(0, start) + emoji + text.substring(end);
			setText(newText);
			setTimeout(() => {
				textarea.focus();
				textarea.setSelectionRange(start + emoji.length, start + emoji.length);
			}, 0);
		} else {
			setText((prev) => prev + emoji);
		}
	};

	return (
		<div className='flex p-3 sm:p-4 items-start gap-3 sm:gap-4 border-b border-gray-700 relative'>
			<div className='avatar'>
				<div className='w-8 rounded-full overflow-hidden'>
					<img
						src={authUser?.profileImg || "/avatar-placeholder.png"}
						alt='User avatar'
						onError={(e) => {
							e.target.onerror = null;
							e.target.src = "/avatar-placeholder.png";
						}}
					/>
				</div>
			</div>
			<form className='flex flex-col gap-2 w-full relative' onSubmit={handleSubmit}>
				<textarea
					ref={textareaRef}
					className='textarea w-full p-0 text-lg resize-none border-none focus:outline-none border-gray-800'
					placeholder={is24hStory ? "Share a 24-hour story post..." : "What is happening?!"}
					value={text}
					onChange={(e) => setText(e.target.value)}
				/>

				{isCompressing && (
					<div className='text-xs text-sky-400 flex items-center gap-1.5 py-1'>
						<span className='loading loading-spinner loading-xs'></span>
						<span>Optimizing image for fast upload...</span>
					</div>
				)}

				{img && (
					<div className='relative w-72 mx-auto'>
						<IoCloseSharp
							className='absolute top-0 right-0 text-white bg-gray-800 rounded-full w-5 h-5 cursor-pointer z-10'
							onClick={() => {
								setImg(null);
								if (imgRef.current) imgRef.current.value = null;
							}}
						/>
						<img src={img} className='w-full mx-auto h-72 object-contain rounded border border-gray-800' alt='Post preview' />
					</div>
				)}

				{is24hStory && (
					<div className='flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-lg transition-all animate-in fade-in'>
						<span className='text-base'>⏳</span>
						<span>
							<strong>24-Hour Story Post:</strong> This post will automatically disappear from all feeds after 24 hours.
						</span>
					</div>
				)}

				<div className='flex justify-between border-t py-2 border-t-gray-700 relative items-center flex-wrap gap-2'>
					<div className='flex gap-2 items-center relative'>
						<button
							type='button'
							onClick={() => imgRef.current?.click()}
							className='p-1 rounded-full hover:bg-primary/20 transition'
							title='Upload image'
						>
							<CiImageOn className='fill-primary w-6 h-6 cursor-pointer' />
						</button>

						<button
							type='button'
							onClick={() => setShowEmojiPicker((prev) => !prev)}
							className='p-1 rounded-full hover:bg-primary/20 transition'
							title='Add emoji'
						>
							<BsEmojiSmileFill className='fill-primary w-5 h-5 cursor-pointer' />
						</button>

						{/* 24-Hour Story Toggle Button */}
						<button
							type='button'
							onClick={() => setIs24hStory((prev) => !prev)}
							className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${
								is24hStory
									? "bg-amber-500/20 text-amber-300 border-amber-400 shadow-sm"
									: "bg-transparent text-gray-400 border-gray-700 hover:text-white hover:border-gray-500"
							}`}
							title='Make this a disappearing 24-hour post'
						>
							<span>⏳</span>
							<span>{is24hStory ? "24h Story (ON)" : "24h Story"}</span>
						</button>

						{/* Emoji Picker Popover */}
						{showEmojiPicker && (
							<EmojiPicker
								onSelect={handleEmojiSelect}
								onClose={() => setShowEmojiPicker(false)}
							/>
						)}
					</div>
					<input type='file' accept='image/*' hidden ref={imgRef} onChange={handleImgChange} />
					<button
						className='btn btn-primary rounded-full btn-sm text-white px-5'
						disabled={isPending || isCompressing}
					>
						{isPending ? "Posting..." : isCompressing ? "Processing..." : is24hStory ? "Post Story" : "Post"}
					</button>
				</div>
				{isError && <div className='text-red-500 text-sm'>{error.message}</div>}
			</form>
		</div>
	);
};
export default CreatePost;
