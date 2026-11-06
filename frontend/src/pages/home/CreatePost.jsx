import { CiImageOn } from "react-icons/ci";
import { BsEmojiSmileFill } from "react-icons/bs";
import { useRef, useState } from "react";
import { IoCloseSharp } from "react-icons/io5";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { apiFetch } from "../../lib/api";
import EmojiPicker from "../../components/common/EmojiPicker";

const CreatePost = () => {
	const [text, setText] = useState("");
	const [img, setImg] = useState(null);
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
		mutationFn: async ({ text, img }) => {
			try {
				const res = await apiFetch("/api/posts/create", {
					method: "POST",
					body: JSON.stringify({ text, img }),
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
			setShowEmojiPicker(false);
			toast.success("Post created successfully");
			queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
	});

	const handleSubmit = (e) => {
		e.preventDefault();
		createPost({ text, img });
	};

	const handleImgChange = (e) => {
		const file = e.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = () => {
				setImg(reader.result);
			};
			reader.readAsDataURL(file);
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
		<div className='flex p-4 items-start gap-4 border-b border-gray-700 relative'>
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
					placeholder='What is happening?!'
					value={text}
					onChange={(e) => setText(e.target.value)}
				/>
				{img && (
					<div className='relative w-72 mx-auto'>
						<IoCloseSharp
							className='absolute top-0 right-0 text-white bg-gray-800 rounded-full w-5 h-5 cursor-pointer'
							onClick={() => {
								setImg(null);
								if (imgRef.current) imgRef.current.value = null;
							}}
						/>
						<img src={img} className='w-full mx-auto h-72 object-contain rounded' alt='Post preview' />
					</div>
				)}

				<div className='flex justify-between border-t py-2 border-t-gray-700 relative'>
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

						{/* Emoji Picker Popover */}
						{showEmojiPicker && (
							<EmojiPicker
								onSelect={handleEmojiSelect}
								onClose={() => setShowEmojiPicker(false)}
							/>
						)}
					</div>
					<input type='file' accept='image/*' hidden ref={imgRef} onChange={handleImgChange} />
					<button className='btn btn-primary rounded-full btn-sm text-white px-4' disabled={isPending}>
						{isPending ? "Posting..." : "Post"}
					</button>
				</div>
				{isError && <div className='text-red-500 text-sm'>{error.message}</div>}
			</form>
		</div>
	);
};
export default CreatePost;
