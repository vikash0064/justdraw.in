import React from 'react';

export default function ExcalidrawBackgroundDoodles() {
  return (
    <div className="excali-doodle-bg" aria-hidden="true">
      {/* ── Top Left: Hourglass / Bowtie Doodle ── */}
      <svg className="excali-doodle doodle-bowtie" width="38" height="38" viewBox="0 0 40 40" fill="none">
        <path
          d="M6 8 C16 18, 24 22, 34 32 M34 8 C24 18, 16 22, 6 32 M6 8 L34 8 M6 32 L34 32"
          stroke="#ff85ea"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="20" r="2.5" fill="#ff85ea" />
      </svg>

      {/* ── Top Left: Yellow Mesh Circle ── */}
      <svg className="excali-doodle doodle-sun-mesh" width="32" height="32" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="14" stroke="#f5c518" strokeWidth="1.8" strokeDasharray="3 3" />
        <path d="M10 10 L26 26 M26 10 L10 26 M6 18 L30 18 M18 6 L18 30" stroke="#f5c518" strokeWidth="1.2" opacity="0.65" />
      </svg>

      {/* ── Mid Left: Padlock Doodle ── */}
      <svg className="excali-doodle doodle-lock" width="46" height="52" viewBox="0 0 50 56" fill="none">
        {/* Shackle */}
        <path
          d="M14 24 V14 C14 8 20 4 25 4 C31 4 36 8 36 14 V24"
          stroke="#4dabf7"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Lock Body */}
        <rect
          x="8"
          y="23"
          width="34"
          height="28"
          rx="5"
          stroke="#4dabf7"
          strokeWidth="2.5"
          fill="rgba(77, 171, 247, 0.08)"
        />
        {/* Keyhole & jagged line */}
        <circle cx="25" cy="34" r="3.5" fill="#4dabf7" />
        <path d="M25 37.5 V43" stroke="#4dabf7" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M4 48 L10 44 L16 49 L22 44 L28 50 L34 44 L44 49" stroke="#4dabf7" strokeWidth="1.8" opacity="0.75" />
      </svg>

      {/* ── Far Left: Mesh Checkered Circle ── */}
      <svg className="excali-doodle doodle-mesh-circle" width="30" height="30" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="13" stroke="#cfd0d8" strokeWidth="1.8" />
        <path d="M8 10 L24 10 M5 16 L27 16 M8 22 L24 22 M10 8 L10 24 M16 5 L16 27 M22 8 L22 24" stroke="#cfd0d8" strokeWidth="1.2" strokeLinecap="round" />
      </svg>

      {/* ── Top Right: Landscape / Picture Frame Doodle ── */}
      <svg className="excali-doodle doodle-landscape" width="48" height="42" viewBox="0 0 52 46" fill="none">
        <rect x="4" y="4" width="44" height="36" rx="4" stroke="#38d9a9" strokeWidth="2.2" strokeDasharray="6 3" />
        <circle cx="15" cy="14" r="4.5" stroke="#38d9a9" strokeWidth="1.8" />
        <path d="M6 34 L18 20 L27 30 L36 18 L46 32" stroke="#38d9a9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* ── Mid Right: Circled Play Button Doodle ── */}
      <svg className="excali-doodle doodle-play" width="36" height="36" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="16" stroke="#a5a6f6" strokeWidth="2.2" />
        <path d="M16 13 L28 20 L16 27 Z" stroke="#a5a6f6" strokeWidth="2" strokeLinejoin="round" fill="none" />
      </svg>

      {/* ── Top Right: Star Mesh ── */}
      <svg className="excali-doodle doodle-star-mesh" width="28" height="28" viewBox="0 0 30 30" fill="none">
        <path d="M15 2 L15 28 M2 15 L28 15 M5 5 L25 25 M25 5 L5 25" stroke="#cfd0d8" strokeWidth="1.6" strokeLinecap="round" />
      </svg>

      {/* ── Mid Right: Diamond Dots ── */}
      <svg className="excali-doodle doodle-dots-diamond" width="24" height="24" viewBox="0 0 26 26" fill="none">
        <polygon points="13,2 24,13 13,24 2,13" stroke="#f5c518" strokeWidth="1.6" strokeDasharray="3 2" />
        <circle cx="13" cy="13" r="2.5" fill="#f5c518" />
      </svg>

      {/* ── Bottom Right/Center: Cute Cat / Smiley Face Doodle ── */}
      <svg className="excali-doodle doodle-cat" width="60" height="52" viewBox="0 0 64 56" fill="none">
        {/* Head */}
        <ellipse cx="32" cy="32" rx="20" ry="16" stroke="#ffd54f" strokeWidth="2.2" strokeDasharray="12 2" />
        {/* Left Ear */}
        <path d="M18 20 L14 8 L26 17" stroke="#ffd54f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Right Ear */}
        <path d="M46 20 L50 8 L38 17" stroke="#ffd54f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Eyes & Nose */}
        <circle cx="25" cy="28" r="2" fill="#ffd54f" />
        <circle cx="39" cy="28" r="2" fill="#ffd54f" />
        <path d="M30 34 L32 36 L34 34" stroke="#ffd54f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Whiskers */}
        <path d="M10 29 L20 31 M11 35 L21 34" stroke="#ffd54f" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M54 29 L44 31 M53 35 L43 34" stroke="#ffd54f" strokeWidth="1.6" strokeLinecap="round" />
      </svg>

      {/* ── Bottom Triangle Doodle ── */}
      <svg className="excali-doodle doodle-triangle" width="26" height="26" viewBox="0 0 30 30" fill="none">
        <polygon points="15,4 26,24 4,24" stroke="#ff85ea" strokeWidth="2" strokeLinejoin="round" fill="none" />
      </svg>

      {/* ── Bottom Wave Silhouette ── */}
      <div className="doodle-bottom-wave" />
    </div>
  );
}
