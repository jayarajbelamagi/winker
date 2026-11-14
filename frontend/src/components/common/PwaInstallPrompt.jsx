import { useState, useEffect } from "react";
import { FiDownload, FiShare, FiPlusSquare, FiMoreVertical } from "react-icons/fi";
import { IoClose } from "react-icons/io5";

const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    // Check if already running in standalone PWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
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
      window.winkerPwaPrompt = e;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    // Make trigger function globally available for TopBar and Drawer
    window.triggerWinkerInstall = () => {
      handleInstallAction();
    };

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, [deferredPrompt, isIos]);

  const handleInstallAction = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        setShowGuideModal(true);
      }
    } else {
      // If browser hasn't fired beforeinstallprompt or is on iOS / Samsung / Firefox
      setShowGuideModal(true);
    }
  };

  // If already installed, hide
  if (isInstalled) return null;

  return (
    <>
      {/* 1. Floating Banner (Always visible until dismissed) */}
      {!isDismissed && (
        <div className="fixed bottom-16 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 z-40 max-w-sm bg-gradient-to-r from-stone-950 via-stone-900 to-black border border-primary/50 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/pwa-192x192.png"
                alt="Winker"
                className="w-10 h-10 rounded-xl border border-stone-800 flex-shrink-0 object-cover shadow"
              />
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white truncate">Install Winker App</h4>
                <p className="text-[11px] text-stone-400 truncate">
                  Full-screen & faster on your phone
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={handleInstallAction}
                className="btn btn-primary btn-xs rounded-full px-3.5 font-bold text-[11px] shadow-md shadow-primary/30 flex items-center gap-1"
              >
                <FiDownload className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>

              <button
                onClick={() => setIsDismissed(true)}
                className="p-1 text-stone-500 hover:text-stone-300 rounded-full"
                title="Dismiss"
              >
                <IoClose className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Visual Step-by-Step Installation Modal (For all browsers & iOS) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-[#16181C] border border-stone-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl text-center space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <img
                  src="/pwa-192x192.png"
                  alt="Winker"
                  className="w-6 h-6 rounded-lg object-cover"
                />
                <span className="font-extrabold text-sm text-white">
                  Add Winker to Home Screen
                </span>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-stone-400 hover:text-white"
              >
                <IoClose className="w-5 h-5" />
              </button>
            </div>

            {/* If iPhone / iPad */}
            {isIos ? (
              <div className="text-left text-xs text-stone-300 space-y-3 bg-stone-900/60 p-4 rounded-2xl border border-stone-800">
                <p className="text-stone-400 font-medium text-[11px]">
                  Follow these 2 quick steps in Safari:
                </p>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Tap the <strong>Share</strong> button <FiShare className="inline w-3.5 h-3.5 text-primary" /> at the bottom bar of Safari.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Scroll down and tap <strong>"Add to Home Screen"</strong> <FiPlusSquare className="inline w-3.5 h-3.5 text-primary" />.
                  </span>
                </div>
              </div>
            ) : (
              /* If Android / Chrome / Brave / Edge / Samsung */
              <div className="text-left text-xs text-stone-300 space-y-3 bg-stone-900/60 p-4 rounded-2xl border border-stone-800">
                <p className="text-stone-400 font-medium text-[11px]">
                  To install Winker directly to your home screen:
                </p>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Tap the <strong>browser menu (⋮)</strong> <FiMoreVertical className="inline w-3.5 h-3.5 text-primary" /> in the top right corner.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong> <FiDownload className="inline w-3.5 h-3.5 text-primary" />.
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-wider transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PwaInstallPrompt;
