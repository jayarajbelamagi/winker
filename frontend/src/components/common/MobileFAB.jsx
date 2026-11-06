import { FaFeatherAlt } from "react-icons/fa";

const MobileFAB = () => {
  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      const textarea = document.querySelector("textarea");
      if (textarea) textarea.focus();
    }, 300);
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-18 right-4 md:hidden z-30 w-13 h-13 rounded-full bg-primary text-white shadow-xl shadow-sky-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition"
      title="Create post"
      aria-label="Create post"
    >
      <FaFeatherAlt className="w-5 h-5" />
    </button>
  );
};

export default MobileFAB;
