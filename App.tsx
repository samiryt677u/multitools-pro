import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, 
  Code2, 
  Download, 
  Copy, 
  ExternalLink, 
  FileCode, 
  Search, 
  X, 
  Check, 
  ChevronRight,
  Info,
  RefreshCw,
  ArrowLeft,
  Settings,
  Shield,
  Wifi,
  Volume2,
  Battery
} from 'lucide-react';
import { androidProjectFiles } from './androidCode';

export default function App() {
  const [splashCompleted, setSplashCompleted] = useState(false);
  const [splashProgress, setSplashProgress] = useState(0);
  const [showCodeDrawer, setShowCodeDrawer] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(1); // Default to MainActivity.kt
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedFileIndex, setCopiedFileIndex] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState('12:00');
  const [iframeError, setIframeError] = useState(false);

  // Time updater for device simulation status bar
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  // 3-second animated splash screen simulation
  useEffect(() => {
    const duration = 3000; // 3 seconds
    const intervalTime = 30;
    const totalSteps = duration / intervalTime;
    let step = 0;

    const timer = setInterval(() => {
      step += 1;
      const progress = Math.min((step / totalSteps) * 100, 100);
      setSplashProgress(Math.round(progress));

      if (step >= totalSteps) {
        clearInterval(timer);
        setTimeout(() => {
          setSplashCompleted(true);
        }, 200);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  const handleCopyCode = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedFileIndex(index);
    setTimeout(() => setCopiedFileIndex(null), 2000);
  };

  const filteredFiles = androidProjectFiles.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    file.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative w-screen h-screen bg-[#090D16] font-sans text-slate-100 overflow-hidden flex flex-col">
      {/* FULL-VIEWPORT APP VIEW CONTAINER */}
      <div className="relative w-full h-full flex-grow overflow-hidden bg-slate-950">
        <AnimatePresence mode="wait">
          {!splashCompleted ? (
            /* SPLASH SCREEN SCENE - TRUE FULL SCREEN */
            <motion.div
              key="splash-screen"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.5 } }}
              className="absolute inset-0 bg-[#090D16] flex flex-col justify-between items-center py-20 px-6 z-40 select-none"
            >
              {/* Decorative backglow */}
              <div className="absolute top-[35%] left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              <div />

              {/* Highly stylized 'Samir' animated display text */}
              <div className="flex flex-col items-center justify-center text-center z-10">
                <motion.h2
                  initial={{ opacity: 0, scale: 0.8, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 1.0, ease: "easeOut" }}
                  className="font-sans text-6xl md:text-7xl font-extrabold tracking-widest text-[#f8fafc] drop-shadow-md"
                >
                  Samir
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className="text-xs md:text-sm text-[#64748b] tracking-wider uppercase font-mono mt-4 font-semibold"
                >
                  MyToolsHub Admin App
                </motion.p>
              </div>

              {/* Progress loader match */}
              <div className="w-full max-w-[280px] flex flex-col items-center gap-3.5 z-10">
                <div className="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${splashProgress}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-[#64748b] tracking-wider uppercase">
                  Initializing WebView Context • {splashProgress}%
                </span>
              </div>
            </motion.div>
          ) : (
            /* THE PURE FULL-SCREEN WEBVIEW APP */
            <motion.div
              key="app-webview-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-white flex flex-col z-30"
            >
              {/* IFrame WebView mimicking actual native full scale view */}
              <div className="flex-grow w-full h-full bg-slate-50 relative overflow-hidden">
                {!iframeError ? (
                  <iframe
                    id="webview-iframe"
                    src="https://mytoolshub.co.in/admin"
                    className="w-full h-full border-none"
                    onError={() => setIframeError(true)}
                    title="Website Preview"
                    allow="camera; microphone; geolocation"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[#090D16] flex flex-col items-center justify-center text-center p-6 text-slate-50 font-sans">
                    <Info className="h-12 w-12 text-blue-400 mb-4" />
                    <h4 className="font-bold text-lg">MyToolsHub WebView Container</h4>
                    <p className="text-sm text-slate-400 mt-2 max-w-sm leading-relaxed">
                      To safeguard session state and security, modern browsers sometimes restrict loading complex dashboards inside nested IFrames on external domains. 
                    </p>
                    <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed font-mono">
                      Rest assured, on your Android smartphone or device, the native app opens this URL directly in full-screen WebKit container with persistent local security cookies.
                    </p>
                    <a
                      href="https://mytoolshub.co.in/admin"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white transition-all flex items-center gap-2"
                    >
                      Open Website Direct
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FIXED FLOATING DEVELOPER ACTION BUTTON BAR */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={() => {
            setIframeError(false);
            const frame = document.getElementById('webview-iframe') as HTMLIFrameElement;
            if (frame) frame.src = "https://mytoolshub.co.in/admin";
          }}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-900/90 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer text-xs"
          title="Refresh App Frame"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
