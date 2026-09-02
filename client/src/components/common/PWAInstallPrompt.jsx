import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share, PlusSquare, X, Smartphone, Check } from 'lucide-react';

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        // Check if running in standalone mode (already installed as PWA)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                             window.navigator.standalone === true;
        if (isStandalone) {
            setInstalled(true);
            return;
        }

        // Check if user dismissed prompt recently (within 7 days)
        const dismissedAt = localStorage.getItem('justdraw_pwa_dismissed');
        if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 7 * 24 * 60 * 60 * 1000) {
            return;
        }

        // Detect iOS / iPadOS
        const isAppleDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        setIsIOS(isAppleDevice);

        if (isAppleDevice) {
            // Show iOS prompt after a short pleasant delay
            const timer = setTimeout(() => {
                setShowPrompt(true);
            }, 2500);
            return () => clearTimeout(timer);
        }

        // Android / Chrome / Edge beforeinstallprompt
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setTimeout(() => {
                setShowPrompt(true);
            }, 2000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', () => {
            setInstalled(true);
            setShowPrompt(false);
            setDeferredPrompt(null);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setInstalled(true);
            setShowPrompt(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('justdraw_pwa_dismissed', Date.now().toString());
    };

    if (installed || !showPrompt) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                style={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    maxWidth: 380,
                    width: 'calc(100vw - 32px)',
                    zIndex: 9999,
                    background: 'rgba(24, 24, 32, 0.95)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: 16,
                    padding: 16,
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(99, 102, 241, 0.25)',
                    color: '#f8fafc',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img
                            src="/app-logo.png"
                            alt="justdraw app logo"
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                objectFit: 'cover',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
                                border: '1px solid rgba(255, 255, 255, 0.15)'
                            }}
                        />
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                                Install justdraw App
                            </div>
                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                                {isIOS ? 'Add to iPad / iPhone Home Screen' : 'Standalone Fullscreen App'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 6
                        }}
                        title="Dismiss"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div style={{ marginTop: 12, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.45 }}>
                    {isIOS ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(255, 255, 255, 0.05)', padding: '8px 10px', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>1. Tap Safari's <strong>Share</strong> button</span>
                                <Share size={13} color="#60a5fa" />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>2. Select <strong>Add to Home Screen</strong></span>
                                <PlusSquare size={13} color="#34d399" />
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: 11.5 }}>
                                Open from Home Screen for 100% full-screen iPad mode!
                            </div>
                        </div>
                    ) : (
                        <span>Install on your device for a 100% distraction-free full-screen whiteboard with home screen app icon.</span>
                    )}
                </div>

                {!isIOS && deferredPrompt && (
                    <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleInstallClick}
                            style={{
                                flex: 1,
                                height: 36,
                                background: '#6366f1',
                                border: 'none',
                                borderRadius: 8,
                                color: '#ffffff',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                            }}
                        >
                            <Download size={15} />
                            Add to Home Screen
                        </button>
                        <button
                            onClick={handleDismiss}
                            style={{
                                padding: '0 12px',
                                height: 36,
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: 8,
                                color: '#cbd5e1',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer'
                            }}
                        >
                            Later
                        </button>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
