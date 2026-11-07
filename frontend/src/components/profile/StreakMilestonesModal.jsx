import { IoClose, IoFlame, IoFlash, IoTrophy } from "react-icons/io5";

const MILESTONES = [
  {
    days: 7,
    title: "7-Day Streak Master",
    icon: "🔥",
    badgeColor: "from-amber-500 to-orange-600",
    description: "Interacted consecutively for a full week without breaking the flame!",
  },
  {
    days: 30,
    title: "30-Day Streak Champion",
    icon: "⚡",
    badgeColor: "from-yellow-400 to-amber-600",
    description: "A whole month of daily interactions. Unstoppable connection!",
  },
  {
    days: 100,
    title: "100-Day Streak Legend",
    icon: "👑",
    badgeColor: "from-purple-500 to-pink-600",
    description: "Centurion status! A legendary bond that stood the test of time.",
  },
];

const StreakMilestonesModal = ({ isOpen, onClose, maxStreak = 0 }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#16181C] border border-stone-800 w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95">
        <div className="flex justify-between items-center pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <h3 className="font-bold text-white text-lg">Streak Milestones</h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white">
            <IoClose className="w-6 h-6" />
          </button>
        </div>

        <div className="py-4 text-center">
          <div className="text-3xl font-extrabold text-orange-400 mb-1">
            🔥 {maxStreak} Days
          </div>
          <p className="text-xs text-stone-400">
            Interact every 24 hours in Texts or Calls to unlock higher badges!
          </p>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {MILESTONES.map((m) => {
            const isUnlocked = maxStreak >= m.days;
            return (
              <div
                key={m.days}
                className={`p-4 rounded-2xl border transition flex items-start gap-3.5 ${
                  isUnlocked
                    ? "bg-stone-900 border-amber-500/40 shadow-md"
                    : "bg-stone-900/40 border-stone-800/60 opacity-60"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-gradient-to-tr ${m.badgeColor} text-white shadow-lg`}
                >
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-sm text-white">{m.title}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isUnlocked
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-stone-800 text-stone-500"
                      }`}
                    >
                      {isUnlocked ? "✓ Unlocked" : `${m.days} Days`}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">{m.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StreakMilestonesModal;
