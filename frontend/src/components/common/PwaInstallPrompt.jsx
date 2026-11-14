import { useState, useEffect } from "react";
import { FiDownload, FiShare, FiPlusSquare } from "react-icons/fi";
import { IoClose } from "react-icons/io5";

const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Check if already running as standalone PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Listen for browser install prompt (Android Chrome, Edge, Brave, etc.)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      window.winkerPwaPrompt = e; // make globally available to MobileDrawer
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  // If already installed or dismissed, hide
  if (isInstalled || isDismissed) return null;

  // Only show if we either have the native prompt or are on iOS
  if (!deferredPrompt && !isIos) return null;

  return (
    <>
      {/* Floating Mobile Install Pill / Banner */}
      <div className="fixed bottom-16 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 z-40 max-w-sm bg-gradient-to-r from-stone-900 to-black border border-primary/40 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="Winker"
              className="w-10 h-10 rounded-xl border border-stone-800 flex-shrink-0 object-cover"
            />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate">Install Winker App</h4>
              <p className="text-[11px] text-stone-400 truncate">
                Full-screen, fast & no downloads
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleInstallClick}
              className="btn btn-primary btn-xs rounded-full px-3 font-bold text-[11px] shadow-md shadow-primary/30 flex items-center gap-1"
            >
              <FiDownload className="w-3 h-3" />
              <span>Install</span>
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 text-stone-500 hover:text-stone-300 rounded-full"
            >
              <IoClose className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Install Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#16181C] border border-stone-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl text-center space-y-4 animate-in slide-in-from-bottom">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mx-auto text-xl">
              <FiShare className="w-6 h-6" />
            </div>

            <h3 className="font-extrabold text-base text-white">
              Install Winker on iPhone
            </h3>

            <div className="text-left text-xs text-stone-300 space-y-2.5 bg-stone-900/60 p-3.5 rounded-2xl border border-stone-800">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>
                  Tap the <strong>Share</strong> button <FiShare className="inline w-3.5 h-3.5" /> at the bottom of Safari.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>
                  Scroll down and tap <strong>"Add to Home Screen"</strong> <FiPlusSquare className="inline w-3.5 h-3.5 text-primary" />.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>
                  Tap <strong>"Add"</strong> in the top right corner.
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PwaInstallPrompt;
