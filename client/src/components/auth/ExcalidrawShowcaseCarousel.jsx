import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDES = [
  {
    id: 0,
    title: 'Cloud Workspace Management',
    renderIllustration: () => (
      <svg width="290" height="220" viewBox="0 0 300 230" fill="none" className="sketch-illustration">
        {/* Background Fluffy Hand-Drawn Cloud */}
        <g opacity="0.35">
          <path
            d="M80 70 C70 50, 95 30, 120 40 C135 20, 175 20, 190 40 C215 30, 235 50, 230 70 C245 85, 235 110, 215 115 C220 130, 195 140, 180 130 C165 145, 125 145, 110 130 C90 140, 70 125, 75 110 C60 95, 65 75, 80 70 Z"
            stroke="#6965db"
            strokeWidth="1.8"
            strokeDasharray="5 4"
            fill="none"
          />
        </g>

        {/* Floating Slide Wireframes */}
        <g opacity="0.45">
          {/* Slide 1 Card */}
          <g transform="translate(38, 38) rotate(-6)">
            <rect x="0" y="0" width="58" height="38" rx="4" stroke="#8c8ef8" strokeWidth="1.6" strokeDasharray="4 3" fill="rgba(140, 142, 248, 0.08)" />
            <path d="M10 12 H48 M10 20 H36 M10 28 H42" stroke="#8c8ef8" strokeWidth="1.2" strokeLinecap="round" />
          </g>

          {/* Slide 2 Card */}
          <g transform="translate(204, 34) rotate(8)">
            <rect x="0" y="0" width="58" height="38" rx="4" stroke="#8c8ef8" strokeWidth="1.6" strokeDasharray="4 3" fill="rgba(140, 142, 248, 0.08)" />
            <circle cx="20" cy="19" r="8" stroke="#8c8ef8" strokeWidth="1.2" />
            <path d="M34 14 H50 M34 22 H46" stroke="#8c8ef8" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        </g>

        {/* ── Floating Hand-Drawn Geometric Hatch Shapes ── */}
        {/* 1. Hatch Blue Circle */}
        <g transform="translate(150, 48)">
          {/* Double stroke for authentic hand-drawn feel */}
          <circle cx="0" cy="0" r="21" stroke="#4dabf7" strokeWidth="2.2" fill="rgba(77, 171, 247, 0.12)" />
          <circle cx="0.5" cy="-0.5" r="20.5" stroke="#4dabf7" strokeWidth="1" opacity="0.5" />
          {/* Diagonal Hatching */}
          <path d="M-15 -12 L12 15 M-20 0 L0 20 M-10 -18 L18 10 M-2 -20 L20 2 M-18 -6 L6 18" stroke="#4dabf7" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* 2. Hatch Red / Coral Rotated Diamond */}
        <g transform="translate(85, 96) rotate(-14)">
          <rect x="-16" y="-16" width="32" height="32" rx="4" stroke="#ff6b6b" strokeWidth="2.2" fill="rgba(255, 107, 107, 0.14)" />
          <rect x="-15" y="-15" width="30" height="30" rx="4" stroke="#ff6b6b" strokeWidth="1" opacity="0.4" />
          {/* Hatch lines */}
          <path d="M-12 -12 L12 12 M-14 0 L0 14 M0 -14 L14 0 M-8 -14 L14 8 M-14 8 L8 -14" stroke="#ff6b6b" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* 3. Hatch Golden / Amber Triangle */}
        <g transform="translate(225, 114) rotate(6)">
          <polygon points="0,-22 22,18 -22,18" stroke="#f5c518" strokeWidth="2.4" fill="rgba(245, 197, 24, 0.14)" strokeLinejoin="round" />
          <polygon points="0.5,-21 21,17 -21,17" stroke="#f5c518" strokeWidth="1" opacity="0.4" strokeLinejoin="round" />
          {/* Hatch lines */}
          <path d="M-12 12 L12 -12 M-16 18 L6 -4 M-4 18 L16 -2 M-18 6 L2 -14" stroke="#f5c518" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* ── Main Hand-Drawn Excalidraw Folder ── */}
        <g transform="translate(26, 92)">
          {/* Papers Peeking Out from inside folder */}
          <g transform="translate(22, 14)">
            <rect x="0" y="0" width="180" height="40" rx="4" fill="var(--excali-folder-paper)" stroke="#cfd0d8" strokeWidth="1.4" />
            <path d="M14 12 H90 M14 22 H65" stroke="#909296" strokeWidth="1.5" strokeLinecap="round" />
          </g>

          {/* Back Tab */}
          <path
            d="M18 28 L64 28 C74 28, 78 36, 86 42 L96 46 L226 46 C236 46, 240 54, 240 64 L240 120 C240 130, 230 132, 220 132 L26 132 C16 132, 16 122, 16 112 Z"
            stroke="var(--excali-folder-stroke)"
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Front Folder Pocket with Hand-drawn Fill */}
          <path
            d="M16 54 L238 54 C246 54, 248 62, 248 72 L248 122 C248 132, 238 134, 228 134 L26 134 C16 134, 16 124, 16 114 Z"
            stroke="var(--excali-folder-stroke)"
            strokeWidth="2.8"
            fill="var(--excali-folder-fill)"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Double accent line on folder edge */}
          <path
            d="M18 57 L236 57"
            stroke="var(--excali-yellow-light)"
            strokeWidth="1.2"
            opacity="0.65"
            strokeLinecap="round"
          />

          {/* Inner Folder Label Badge */}
          <g transform="translate(150, 84)">
            <rect x="0" y="0" width="76" height="28" rx="6" stroke="var(--excali-folder-stroke)" strokeWidth="1.8" fill="var(--excali-folder-fill)" />
            <text x="14" y="19" fill="var(--excali-folder-stroke)" fontSize="14" fontWeight="700" fontFamily="'Shantell Sans', 'Caveat', cursive">
              folder
            </text>
          </g>
        </g>

        {/* Gradients */}
        <defs>
          <linearGradient id="folderGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(245, 197, 24, 0.22)" />
            <stop offset="100%" stopColor="rgba(245, 197, 24, 0.08)" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: 1,
    title: 'Real-time Multiplayer Canvas',
    renderIllustration: () => (
      <svg width="290" height="220" viewBox="0 0 300 230" fill="none" className="sketch-illustration">
        {/* Canvas Board Wireframe Frame */}
        <rect x="20" y="20" width="260" height="175" rx="14" stroke="#6965db" strokeWidth="2.2" strokeDasharray="7 5" fill="rgba(105, 101, 219, 0.04)" />

        {/* Window control dots */}
        <circle cx="38" cy="36" r="3.5" fill="#ff6b6b" />
        <circle cx="50" cy="36" r="3.5" fill="#f5c518" />
        <circle cx="62" cy="36" r="3.5" fill="#51cf66" />

        {/* Hand-drawn Sticky Note 1 (Yellow) */}
        <g transform="translate(48, 62) rotate(-4)">
          <rect x="0" y="0" width="76" height="68" rx="4" fill="#fff3bf" stroke="#ffd43b" strokeWidth="1.8" />
          <path d="M12 20 H64 M12 34 H52 M12 48 H40" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          {/* Note Pin */}
          <circle cx="38" cy="6" r="3" fill="#e03131" />
        </g>

        {/* Hand-drawn Sticky Note 2 (Lavender) */}
        <g transform="translate(164, 76) rotate(5)">
          <rect x="0" y="0" width="82" height="74" rx="4" fill="#e5dbff" stroke="#b197fc" strokeWidth="1.8" />
          <path d="M14 22 H68 M14 36 H58 M14 50 H48" stroke="#6741d9" strokeWidth="2" strokeLinecap="round" />
          <circle cx="41" cy="6" r="3" fill="#6741d9" />
        </g>

        {/* Hand-drawn Connecting Sketch Arrow */}
        <path d="M124 100 Q145 70 162 105" stroke="#ff85ea" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="4 3" fill="none" />
        <polygon points="166,108 156,102 163,96" fill="#ff85ea" />

        {/* User 1 Cursor (Cyan) */}
        <g transform="translate(175, 142)">
          <path d="M0 0 L15 18 L8 18 L12 27 L8 29 L4 20 L-4 24 Z" fill="#4dabf7" stroke="#1864ab" strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="14" y="16" width="56" height="20" rx="5" fill="#4dabf7" />
          <text x="21" y="30" fill="#000000" fontSize="11" fontWeight="bold" fontFamily="Inter, sans-serif">Sarah 🎨</text>
        </g>

        {/* User 2 Cursor (Pink) */}
        <g transform="translate(85, 138)">
          <path d="M0 0 L15 18 L8 18 L12 27 L8 29 L4 20 L-4 24 Z" fill="#ff85ea" stroke="#c2255c" strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="14" y="16" width="52" height="20" rx="5" fill="#ff85ea" />
          <text x="21" y="30" fill="#000000" fontSize="11" fontWeight="bold" fontFamily="Inter, sans-serif">Alex ⚡</text>
        </g>
      </svg>
    ),
  },
  {
    id: 2,
    title: 'AI-Powered Diagram Studio',
    renderIllustration: () => (
      <svg width="290" height="220" viewBox="0 0 300 230" fill="none" className="sketch-illustration">
        {/* Magic Wand with Sparkles */}
        <g transform="translate(36, 42) rotate(-28)">
          <line x1="0" y1="0" x2="68" y2="0" stroke="#f5c518" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="68" cy="0" r="7" fill="#f5c518" />
          <line x1="10" y1="-2" x2="10" y2="2" stroke="#ffffff" strokeWidth="1.5" />
        </g>
        {/* Stars */}
        <path d="M85 24 L90 12 L95 24 L107 29 L95 34 L90 46 L85 34 L73 29 Z" fill="#ff85ea" />
        <path d="M32 72 L35 64 L38 72 L46 75 L38 78 L35 86 L32 78 L24 75 Z" fill="#4dabf7" />
        <path d="M245 40 L248 34 L251 40 L257 43 L251 46 L248 52 L245 46 L239 43 Z" fill="#51cf66" />

        {/* Hand-drawn Flowchart Block 1: User Prompt */}
        <g transform="translate(108, 40)">
          <rect x="0" y="0" width="86" height="38" rx="8" stroke="#4dabf7" strokeWidth="2.2" fill="rgba(77, 171, 247, 0.12)" />
          <text x="14" y="24" fill="currentColor" fontSize="13" fontWeight="600" fontFamily="'Shantell Sans', 'Caveat', cursive">
            AI Prompt
          </text>
          
          {/* Animated Flow Arrow */}
          <path d="M43 38 V65" stroke="#f5c518" strokeWidth="2.4" strokeDasharray="4 3" />
          <polygon points="43,72 37,63 49,63" fill="#f5c518" />
        </g>

        {/* Hand-drawn Flowchart Block 2: Architecture Generated */}
        <g transform="translate(85, 114)">
          <rect x="0" y="0" width="132" height="46" rx="8" stroke="#51cf66" strokeWidth="2.4" fill="rgba(81, 207, 102, 0.14)" />
          <text x="16" y="28" fill="currentColor" fontSize="14" fontWeight="700" fontFamily="'Shantell Sans', 'Caveat', cursive">
            Architecture Map
          </text>
        </g>
      </svg>
    ),
  },
  {
    id: 3,
    title: 'Infinite Hand-Drawn Whiteboard',
    renderIllustration: () => (
      <svg width="290" height="220" viewBox="0 0 300 230" fill="none" className="sketch-illustration">
        {/* Infinite Grid Background */}
        <g fill="#6c6d7c" opacity="0.4">
          <circle cx="40" cy="40" r="1.8" /><circle cx="80" cy="40" r="1.8" /><circle cx="120" cy="40" r="1.8" /><circle cx="160" cy="40" r="1.8" /><circle cx="200" cy="40" r="1.8" /><circle cx="240" cy="40" r="1.8" />
          <circle cx="40" cy="80" r="1.8" /><circle cx="80" cy="80" r="1.8" /><circle cx="120" cy="80" r="1.8" /><circle cx="160" cy="80" r="1.8" /><circle cx="200" cy="80" r="1.8" /><circle cx="240" cy="80" r="1.8" />
          <circle cx="40" cy="120" r="1.8" /><circle cx="80" cy="120" r="1.8" /><circle cx="120" cy="120" r="1.8" /><circle cx="160" cy="120" r="1.8" /><circle cx="200" cy="120" r="1.8" /><circle cx="240" cy="120" r="1.8" />
          <circle cx="40" cy="160" r="1.8" /><circle cx="80" cy="160" r="1.8" /><circle cx="120" cy="160" r="1.8" /><circle cx="160" cy="160" r="1.8" /><circle cx="200" cy="160" r="1.8" /><circle cx="240" cy="160" r="1.8" />
        </g>

        {/* Hand-drawn Mock Wireframe Card */}
        <g transform="translate(50, 48) rotate(-4)">
          <rect x="0" y="0" width="100" height="70" rx="8" stroke="#4dabf7" strokeWidth="2" strokeDasharray="5 3" fill="rgba(77, 171, 247, 0.08)" />
          <circle cx="25" cy="25" r="10" stroke="#4dabf7" strokeWidth="1.8" />
          <path d="M46 20 H86 M46 30 H74" stroke="#4dabf7" strokeWidth="2" strokeLinecap="round" />
          <rect x="18" y="44" width="64" height="14" rx="4" fill="#4dabf7" />
        </g>

        {/* Dynamic Curved Pen Stroke */}
        <path d="M50 145 Q110 70 170 125 T255 85" stroke="#f5c518" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        
        {/* Hand-drawn Sketch Pencil */}
        <g transform="translate(252, 60) rotate(42)">
          <rect x="0" y="0" width="14" height="42" fill="#ff6b6b" stroke="#ffffff" strokeWidth="1.2" />
          <polygon points="0,42 14,42 7,56" fill="#ffd43b" stroke="#ffffff" strokeWidth="1.2" />
          <polygon points="5,51 9,51 7,56" fill="#000000" />
          {/* Pencil eraser */}
          <rect x="0" y="-8" width="14" height="8" rx="2" fill="#adb5bd" />
        </g>
      </svg>
    ),
  },
];

export default function ExcalidrawShowcaseCarousel() {
  const [currentIdx, setCurrentIdx] = useState(0);

  // Auto rotate slides every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[currentIdx];

  return (
    <div className="excali-showcase">
      {/* Dynamic Animated Illustration Card */}
      <div className="excali-illustration-card">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {slide.renderIllustration()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Handwritten Caption Title */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          className="excali-showcase-title"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          {slide.title}
        </motion.div>
      </AnimatePresence>

      {/* 4-Dots Indicator Underneath */}
      <div className="excali-pagination-dots" role="tablist" aria-label="Showcase slides">
        {SLIDES.map((s, idx) => (
          <button
            key={s.id}
            className={`excali-dot ${idx === currentIdx ? 'active' : ''}`}
            onClick={() => setCurrentIdx(idx)}
            aria-label={`Go to slide ${idx + 1}: ${s.title}`}
            aria-selected={idx === currentIdx}
            role="tab"
          />
        ))}
      </div>
    </div>
  );
}
