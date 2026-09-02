// Paper Playground design: editorial SaaS layout, ink navy type, canvas-violet CTAs, pastel marker accents, and a left-anchored feature timeline.
import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Globe2, Github, Menu, Sparkles, Users, Layers, Clock, Lock, Sun, Moon } from "lucide-react";
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import '../styles/landing.css';

const doodles = ["✦", "◌", "⌁", "◇", "✧", "⌇"];

function Highlight({ children, tone = "mint" }) {
  return <span className={`marker marker-${tone}`}>{children}</span>;
}

function ProductFrame({ variant = "hero", preset = "create" }) {
  const renderCanvasContent = () => {
    switch (preset) {
      case "hero":
        return (
          <div className="board-canvas hero-canvas">
            <svg viewBox="0 0 600 280" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <pattern id="hatch-green-hero" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#22c55e" strokeWidth="1.2" opacity="0.8" />
                </pattern>
              </defs>

              {/* Selection text: Free */}
              <g transform="translate(300, 140)">
                {/* Dashed boundary */}
                <rect x="-95" y="-55" width="190" height="84" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeDasharray="6 6" rx="6" />
                {/* Corner Handles */}
                <rect x="-99" y="-59" width="8" height="8" fill="#fff" stroke="#22c55e" strokeWidth="2" />
                <rect x="91" y="-59" width="8" height="8" fill="#fff" stroke="#22c55e" strokeWidth="2" />
                <rect x="-99" y="25" width="8" height="8" fill="#fff" stroke="#22c55e" strokeWidth="2" />
                <rect x="91" y="25" width="8" height="8" fill="#fff" stroke="#22c55e" strokeWidth="2" />

                {/* Bouncing handwritten Free Text */}
                <text x="0" y="10" textAnchor="middle" fill="#10135f" fontSize="62" fontWeight="800" style={{ fontFamily: "'Fraunces', serif", letterSpacing: '-0.02em' }}>Free</text>
              </g>

              {/* Top Right: A green spiral wave path */}
              <path d="M 400 70 Q 410 55, 420 70 T 440 70 T 460 70" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" className="anim-float" />

              {/* Left: Tag cursor "allosaurus" (pushed right to avoid left tool rail overlapping) */}
              <g transform="translate(155, 170)">
                <g className="anim-float" style={{ animationDelay: '-1s' }}>
                  <rect x="0" y="0" width="76" height="22" rx="5" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5" />
                  <text x="38" y="14" textAnchor="middle" fill="#0284c7" fontSize="9" fontWeight="bold" className="handwritten-tag">allosaurus</text>
                  <polygon points="-6,-3 -1,2 -3,4" fill="#0284c7" />
                </g>
              </g>

              {/* Top Left: Tag cursor "brocketdeer" (pushed right to avoid left tool rail overlapping) */}
              <g transform="translate(205, 55)">
                <g className="anim-float" style={{ animationDelay: '-2.5s' }}>
                  <rect x="0" y="0" width="80" height="22" rx="5" fill="#fffbeb" stroke="#d97706" strokeWidth="1.5" />
                  <text x="40" y="14" textAnchor="middle" fill="#d97706" fontSize="9" fontWeight="bold" className="handwritten-tag">brocketdeer</text>
                  <polygon points="-6,-3 -1,2 -3,4" fill="#d97706" />
                </g>
              </g>

              {/* Floating doodles around */}
              {/* Pink Circle */}
              <circle cx="175" cy="115" r="8" fill="none" stroke="#f43f5e" strokeWidth="1.5" className="anim-pulse" />
              {/* Yellow triangle pointer */}
              <polygon points="340,70 348,82 342,84" fill="#eab308" stroke="#ca8a04" strokeWidth="1.2" className="anim-float" />
              {/* Lavender scribble */}
              <path d="M 370 200 C 390 190, 385 220, 410 205" fill="none" stroke="#a78bfa" strokeWidth="1.5" className="anim-pulse" />

              {/* Bottom Right: Github mascot badge (pushed left to avoid right comment rail overlapping) */}
              <g transform="translate(425, 175)">
                <g className="anim-float" style={{ animationDelay: '-1.8s' }}>
                  <circle cx="20" cy="20" r="16" fill="#f4fbf7" stroke="#15803d" strokeWidth="2" />
                  <path d="M20 9c-5.5 0-10 4.5-10 10 0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1 .6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.7 9.7 0 0 1 5.2 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.7.7 1 1.6 1 2.7 0 3.8-2.3 4.7-4.6 4.9.4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5a10 10 0 0 0 6.8-9.5c0-5.5-4.5-10-10-10z" fill="#15803d" transform="translate(0, 0) scale(0.9)" />
                </g>
              </g>
            </svg>
          </div>
        );
      case "collaborate":
        return (
          <div className="board-canvas collaborate-canvas">
            <svg viewBox="0 0 600 280" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <pattern id="hatch-blue-col" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#3b82f6" strokeWidth="1.2" opacity="0.8" />
                </pattern>
              </defs>

              {/* Tilted square/diamond at center */}
              <polygon points="300,30 440,135 300,240 160,135" fill="#f5f3ff" stroke="#5c5326" strokeWidth="2.5" />

              {/* Selection box at top right of diamond */}
              <g transform="translate(325, 45)">
                {/* Dashed boundary */}
                <rect x="0" y="0" width="70" height="70" fill="url(#hatch-blue-col)" stroke="#3b82f6" strokeWidth="2" strokeDasharray="3 3" />
                {/* Corner Handles */}
                <rect x="-3" y="-3" width="6" height="6" fill="#fff" stroke="#3b82f6" strokeWidth="1.5" />
                <rect x="67" y="-3" width="6" height="6" fill="#fff" stroke="#3b82f6" strokeWidth="1.5" />
                <rect x="-3" y="67" width="6" height="6" fill="#fff" stroke="#3b82f6" strokeWidth="1.5" />
                <rect x="67" y="67" width="6" height="6" fill="#fff" stroke="#3b82f6" strokeWidth="1.5" />
                {/* Rotation handle */}
                <line x1="35" y1="0" x2="35" y2="-15" stroke="#3b82f6" strokeWidth="1.5" />
                <circle cx="35" cy="-15" r="3.5" fill="#fff" stroke="#3b82f6" strokeWidth="1.5" />
              </g>

              {/* Floating Profile tag: allosaurus (top left) */}
              <g transform="translate(145, 95)">
                <g className="anim-float">
                  <rect x="0" y="0" width="78" height="24" rx="6" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2" />
                  <text x="39" y="15" textAnchor="middle" fill="#0284c7" fontSize="10" fontWeight="bold" className="handwritten-tag">allosaurus</text>
                  {/* Small avatar tag on top */}
                  <g transform="translate(28, -22)">
                    <circle cx="10" cy="10" r="9" fill="#fff" stroke="#5c5326" strokeWidth="1.5" />
                    <circle cx="10" cy="8" r="3" fill="none" stroke="#5c5326" strokeWidth="1.5" />
                    <path d="M 5 16 C 5 13, 15 13, 15 16" fill="none" stroke="#5c5326" strokeWidth="1.5" />
                  </g>
                  {/* Blue cursor */}
                  <polygon points="-8,-4 -1,3 -4,6" fill="#0284c7" />
                </g>
              </g>

              {/* Floating Profile tag: brocketdeer (middle right) */}
              <g transform="translate(340, 160)">
                <g className="anim-float" style={{ animationDelay: '-1.5s' }}>
                  <rect x="0" y="0" width="80" height="24" rx="6" fill="#fffbeb" stroke="#d97706" strokeWidth="2" />
                  <text x="40" y="15" textAnchor="middle" fill="#d97706" fontSize="10" fontWeight="bold" className="handwritten-tag">brocketdeer</text>
                  {/* Yellow cursor */}
                  <polygon points="-8,-4 -1,3 -4,6" fill="#d97706" />
                </g>
              </g>

              {/* Floating Profile tag: rainbowlorikeet (bottom center) */}
              <g transform="translate(225, 215)">
                <g className="anim-float" style={{ animationDelay: '-3s' }}>
                  <rect x="0" y="0" width="100" height="24" rx="6" fill="#dcfce7" stroke="#15803d" strokeWidth="2" />
                  <text x="50" y="15" textAnchor="middle" fill="#15803d" fontSize="10" fontWeight="bold" className="handwritten-tag">rainbowlorikeet</text>
                  {/* Green cursor */}
                  <polygon points="-8,-4 -1,3 -4,6" fill="#15803d" />
                </g>
              </g>

              {/* Additional avatars floating */}
              <g transform="translate(216, 172)">
                <g className="anim-pulse">
                  <rect x="0" y="0" width="48" height="20" rx="10" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
                  {/* Three small user circles inside */}
                  <circle cx="12" cy="10" r="4.5" fill="#fff" stroke="#ca8a04" strokeWidth="1" />
                  <circle cx="24" cy="10" r="4.5" fill="#fff" stroke="#ca8a04" strokeWidth="1" />
                  <circle cx="36" cy="10" r="4.5" fill="#fff" stroke="#ca8a04" strokeWidth="1" />
                </g>
              </g>

              {/* Arrow and curly loops at bottom right */}
              <path d="M 315 190 C 310 230, 360 230, 370 200 C 375 180, 395 210, 425 215" fill="none" stroke="#5c5326" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M 416 210 L 425 215 L 420 222" fill="none" stroke="#5c5326" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
        );
      case "usecases":
        return (
          <div className="board-canvas usecases-canvas" style={{ background: '#fdfdfd' }}>
            {/* Database Table 1 Mockup */}
            <div className="er-table-mock" style={{ position: 'absolute', left: '15%', top: '18%', width: '150px', border: '2px solid #10135f', borderRadius: '6px', background: '#fff', boxShadow: '4px 4px 0 rgba(16,19,95,0.1)' }}>
              <div style={{ background: '#6657d9', color: '#fff', fontWeight: 'bold', padding: '5px 8px', fontSize: '10px', borderBottom: '2px solid #10135f', borderRadius: '4px 4px 0 0' }}>users</div>
              <div style={{ padding: '5px', fontSize: '9px', display: 'flex', flexDirection: 'column', gap: '3px', color: '#10135f', fontWeight: '500' }}>
                <div>🔑 id <span style={{ color: '#888', float: 'right' }}>uuid</span></div>
                <div style={{ borderBottom: '1px dashed #eee' }} />
                <div>name <span style={{ color: '#888', float: 'right' }}>varchar</span></div>
                <div style={{ borderBottom: '1px dashed #eee' }} />
                <div>email <span style={{ color: '#888', float: 'right' }}>varchar</span></div>
              </div>
            </div>

            {/* Database Table 2 Mockup */}
            <div className="er-table-mock" style={{ position: 'absolute', right: '15%', top: '22%', width: '150px', border: '2px solid #10135f', borderRadius: '6px', background: '#fff', boxShadow: '4px 4px 0 rgba(16,19,95,0.1)' }}>
              <div style={{ background: '#a78bfa', color: '#10135f', fontWeight: 'bold', padding: '5px 8px', fontSize: '10px', borderBottom: '2px solid #10135f', borderRadius: '4px 4px 0 0' }}>boards</div>
              <div style={{ padding: '5px', fontSize: '9px', display: 'flex', flexDirection: 'column', gap: '3px', color: '#10135f', fontWeight: '500' }}>
                <div>🔑 id <span style={{ color: '#888', float: 'right' }}>uuid</span></div>
                <div style={{ borderBottom: '1px dashed #eee' }} />
                <div>title <span style={{ color: '#888', float: 'right' }}>varchar</span></div>
                <div style={{ borderBottom: '1px dashed #eee' }} />
                <div>🔌 user_id <span style={{ color: '#888', float: 'right' }}>uuid</span></div>
              </div>
            </div>

            {/* Relationship Line */}
            <svg viewBox="0 0 600 280" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <path d="M295 130 C360 130, 340 210, 420 210" fill="none" stroke="#6657d9" strokeWidth="2.5" strokeDasharray="5 5" />
              <circle cx="295" cy="130" r="3.5" fill="#6657d9" />
              <path d="M414 206 L421 210 L414 214" fill="none" stroke="#6657d9" strokeWidth="2.5" />
            </svg>

            <div className="cursor cursor-two" style={{ left: '46%', top: '56%', backgroundColor: '#6657d9' }}>SQL Schema</div>
            <div className="canvas-note" style={{ right: '8%', bottom: '8%', fontSize: '12px' }}>Database modeling</div>
          </div>
        );
      case "ai":
        return (
          <div className="board-canvas ai-canvas" style={{ background: '#fafafd' }}>
            <svg viewBox="0 0 600 280" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <pattern id="hatch-blue-ai" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#3b82f6" strokeWidth="1.2" opacity="0.8" />
                </pattern>
                <pattern id="hatch-green-ai" width="6" height="6" patternTransform="rotate(-45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#10b981" strokeWidth="1.2" opacity="0.8" />
                </pattern>
                <pattern id="hatch-pink-ai" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#f43f5e" strokeWidth="1.2" opacity="0.8" />
                </pattern>
              </defs>

              {/* Squiggly AI text bubble at top */}
              <g transform="translate(120, 20)">
                <g className="anim-float">
                  {/* Speech Bubble path */}
                  <path d="M 10 0 L 260 0 C 265 0, 270 5, 270 10 L 270 44 C 270 49, 265 54, 260 54 L 195 54 L 185 64 L 180 54 L 10 54 C 5 54, 0 49, 0 44 L 0 10 C 0 5, 5 0, 10 0 Z" fill="#fafafa" stroke="#5c5326" strokeWidth="2.2" />
                  {/* Handwritten AI Nemo bubble text and support squiggle */}
                  <text x="18" y="24" fill="#10135f" fontSize="12" fontWeight="800" style={{ fontFamily: "'Comic Sans MS', cursive, sans-serif" }}>Nemo: here's your chart!</text>
                  <path d="M 20 38 C 30 34, 40 42, 50 38 C 60 34, 70 42, 80 38 C 90 34, 100 42, 110 38" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
                  {/* Green badge on right */}
                  <circle cx="230" cy="27" r="11" fill="url(#hatch-green-ai)" stroke="#10b981" strokeWidth="2" />
                </g>
              </g>

              {/* Chart/Graph at bottom */}
              <g transform="translate(120, 100)">
                {/* Axes */}
                <path d="M 40 10 L 40 110 L 220 110" fill="none" stroke="#5c5326" strokeWidth="2.5" strokeLinecap="round" />

                {/* Bar 1 (Pink) */}
                <g className="anim-bar-1">
                  <rect x="62" y="60" width="26" height="50" fill="url(#hatch-pink-ai)" stroke="#f43f5e" strokeWidth="2" />
                </g>
                {/* Bar 2 (Green) */}
                <g className="anim-bar-2">
                  <rect x="108" y="40" width="26" height="70" fill="url(#hatch-green-ai)" stroke="#10b981" strokeWidth="2" />
                </g>
                {/* Bar 3 (Blue) */}
                <g className="anim-bar-3">
                  <rect x="154" y="25" width="26" height="85" fill="url(#hatch-blue-ai)" stroke="#3b82f6" strokeWidth="2" />
                </g>

                {/* Sparkles circle badge on right */}
                <g transform="translate(210, 50)">
                  <g className="anim-pulse">
                    <circle cx="18" cy="18" r="18" fill="#faf5ff" stroke="#5c5326" strokeWidth="2" />
                    <g className="anim-sparkle" style={{ transformOrigin: '18px 18px' }}>
                      <path d="M18 10 L19 15 L24 18 L19 21 L18 26 L17 21 L12 18 L17 15 Z" fill="#f43f5e" />
                      <path d="M25 10 L25.5 12 L27.5 13 L25.5 14 L25 16 L24.5 14 L22.5 13 L24.5 12 Z" fill="#f43f5e" />
                    </g>
                  </g>
                </g>

                {/* Upward arrow at bottom right */}
                <path d="M 200 120 C 215 110, 230 115, 245 95" fill="none" stroke="#5c5326" strokeWidth="2" strokeLinecap="round" />
                <path d="M 238 95 L 245 95 L 243 102" fill="none" stroke="#5c5326" strokeWidth="2" strokeLinecap="round" />
              </g>
            </svg>
          </div>
        );
      case "notes":
        return (
          <div className="board-canvas notes-canvas" style={{ background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '220px', height: '240px', background: '#ffffff', borderRadius: '4px', boxShadow: '0 12px 32px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.08)', position: 'relative', overflow: 'hidden', padding: '16px' }}>
              {/* Red margin line */}
              <div style={{ position: 'absolute', left: '32px', top: 0, bottom: 0, width: '1.5px', background: '#fca5a5' }} />
              {/* Ruled lines */}
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} style={{ width: '100%', height: '1px', background: 'rgba(203, 213, 225, 0.6)', marginTop: '24px' }} />
              ))}
              {/* Handwritten title & notes mockup */}
              <div style={{ position: 'absolute', top: '16px', left: '42px', right: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', fontFamily: "'Comic Sans MS', cursive" }}>Meeting Ideas ✨</div>
                <div style={{ marginTop: '12px', height: '10px', width: '80%', background: 'rgba(253, 224, 71, 0.5)', borderRadius: '2px' }} />
                <div style={{ marginTop: '16px', height: '4px', width: '90%', background: '#64748b', borderRadius: '2px', opacity: 0.7 }} />
                <div style={{ marginTop: '20px', height: '4px', width: '70%', background: '#64748b', borderRadius: '2px', opacity: 0.7 }} />
              </div>
              {/* Mini Sticky Note */}
              <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '64px', height: '64px', background: '#fef08a', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '6px', fontSize: '8px', fontWeight: 'bold', color: '#854d0e', transform: 'rotate(-4deg)' }}>
                📌 Apple Pencil ready!
              </div>
              {/* Stylus indicator */}
              <div style={{ position: 'absolute', bottom: '10px', left: '16px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(15, 23, 42, 0.85)', color: '#fff', padding: '3px 8px', borderRadius: '20px', fontSize: '9px', fontWeight: '600' }}>
                ✏️ iPad Notes
              </div>
            </div>
          </div>
        );
      case "create":
      default:
        return (
          <div className="board-canvas create-canvas">
            <svg viewBox="0 0 600 280" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <defs>
                <pattern id="hatch-blue" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#3b82f6" strokeWidth="1.2" opacity="0.8" />
                </pattern>
                <pattern id="hatch-green" width="8" height="8" patternTransform="rotate(-45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#10b981" strokeWidth="1.2" opacity="0.8" />
                </pattern>
              </defs>

              {/* Back elements (Shapes inside browser) */}
              {/* Green capsule */}
              <rect x="155" y="130" width="80" height="30" rx="15" fill="url(#hatch-green)" stroke="#5c5326" strokeWidth="2.5" transform="rotate(-30 155 130)" />
              {/* Blue circle */}
              <circle cx="225" cy="180" r="26" fill="url(#hatch-blue)" stroke="#3b82f6" strokeWidth="2.5" />
              {/* Small cursor arrow */}
              <polygon points="250,135 262,152 253,155" fill="#f59e0b" stroke="#5c5326" strokeWidth="1.5" />
              {/* Cursor label */}
              <g transform="translate(260, 150)">
                <rect x="0" y="0" width="94" height="24" rx="6" fill="#fffbeb" stroke="#d97706" strokeWidth="2" />
                <text x="47" y="15" textAnchor="middle" fill="#d97706" fontSize="10" fontWeight="bold" className="handwritten-tag">rainbowlorikeet</text>
              </g>

              {/* Hand-drawn arrow at bottom right */}
              <path d="M 350 170 C 390 130, 380 110, 410 120" fill="none" stroke="#5c5326" strokeWidth="2" strokeLinecap="round" />
              <path d="M 402 114 L 410 120 L 406 128" fill="none" stroke="#5c5326" strokeWidth="2" strokeLinecap="round" />

              {/* Center link badge */}
              <circle cx="300" cy="140" r="28" fill="#e0e7ff" stroke="#10135f" strokeWidth="2.5" className="anim-pulse" />
              <g transform="translate(289, 129) scale(0.9)">
                <g className="anim-pulse">
                  <path d="M9 17H7A5 5 0 0 1 7 7h2 M15 7h2a5 5 0 0 1 0 10h-2 M8 12h8" fill="none" stroke="#10135f" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              </g>

              {/* Three pink arrows pointing up */}
              <g stroke="#f43f5e" strokeWidth="1.5" fill="none" strokeLinecap="round">
                {/* Left arrow */}
                <path d="M 275 120 L 225 80" strokeDasharray="4 4" />
                <path d="M 230 78 L 225 80 L 228 85" />
                {/* Center arrow */}
                <path d="M 300 108 L 300 75" strokeDasharray="4 4" />
                <path d="M 296 80 L 300 75 L 304 80" />
                {/* Right arrow */}
                <path d="M 325 120 L 375 80" strokeDasharray="4 4" />
                <path d="M 372 85 L 375 80 L 370 78" />
              </g>

              {/* Three user profile avatars at top */}
              {/* Left avatar */}
              <g transform="translate(190, 35)">
                <g className="anim-float">
                  <circle cx="20" cy="20" r="18" fill="#fff" stroke="#5c5326" strokeWidth="2" />
                  <circle cx="20" cy="15" r="5" fill="none" stroke="#5c5326" strokeWidth="2" />
                  <path d="M 12 28 C 12 23, 28 23, 28 28" fill="none" stroke="#5c5326" strokeWidth="2" />
                  <circle cx="6" cy="6" r="6" fill="#fff" stroke="#5c5326" strokeWidth="1.5" />
                  <path d="M 4 8 L 8 4" stroke="#5c5326" strokeWidth="1.5" />
                </g>
              </g>

              {/* Center avatar */}
              <g transform="translate(280, 15)">
                <g className="anim-float" style={{ animationDelay: '-1s' }}>
                  <circle cx="20" cy="20" r="18" fill="#fff" stroke="#5c5326" strokeWidth="2" />
                  <circle cx="20" cy="15" r="5" fill="none" stroke="#5c5326" strokeWidth="2" />
                  <path d="M 12 28 C 12 23, 28 23, 28 28" fill="none" stroke="#5c5326" strokeWidth="2" />
                  <circle cx="34" cy="6" r="6" fill="#fff" stroke="#5c5326" strokeWidth="1.5" />
                  <polygon points="32,4 37,6 32,8" fill="#5c5326" />
                </g>
              </g>

              {/* Right avatar */}
              <g transform="translate(370, 35)">
                <g className="anim-float" style={{ animationDelay: '-2s' }}>
                  <circle cx="20" cy="20" r="18" fill="#fff" stroke="#5c5326" strokeWidth="2" />
                  <circle cx="20" cy="15" r="5" fill="none" stroke="#5c5326" strokeWidth="2" />
                  <path d="M 12 28 C 12 23, 28 23, 28 28" fill="none" stroke="#5c5326" strokeWidth="2" />
                  <circle cx="34" cy="34" r="6" fill="#fff" stroke="#5c5326" strokeWidth="1.5" />
                  <path d="M 31 32 L 29 34 L 31 36 M 37 32 L 39 34 L 37 36" fill="none" stroke="#5c5326" strokeWidth="1.2" />
                </g>
              </g>
            </svg>
          </div>
        );
    }
  };

  return (
    <div className={`product-frame product-${variant}`}>
      <div className="browser-bar"><span /><span /><span /><b>justdraw</b><i>•••</i></div>
      <div className="product-body">
        <aside className="tool-rail"><div className="rail-icon active">↗</div><div className="rail-icon">□</div><div className="rail-icon">◯</div><div className="rail-icon">T</div><div className="rail-icon">⌁</div><div className="rail-divider" /><div className="swatches"><em /><em /><em /><em /><em /><em /></div></aside>
        {renderCanvasContent()}
        <aside className="comment-rail"><div className="avatar-row"><b>●</b><b>●</b><b>●</b><b>+</b></div><div className="comment-line" /><div className="comment-line short" /><div className="comment-card"><strong>Thoughts?</strong><p>Leave a note for the team.</p></div><div className="comment-line" /><div className="comment-line" /></aside>
      </div>
      <div className="browser-footer"><span>−　100%　＋</span><span>↶　↷</span></div>
    </div>
  );
}

function TopNav({ user, navigate, theme, toggleTheme }) {
  return (
    <header className="top-nav">
      <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="34" height="34">
            <circle cx="6" cy="6" r="4.2" fill="#6366f1" />
            <rect x="13.5" y="2" width="8.5" height="8.5" rx="2" fill="#f43f5e" />
            <path d="M 6 13.5 L 10.5 22 L 1.5 22 Z" fill="#10b981" />
            <circle cx="18" cy="18" r="4.2" fill="#f59e0b" />
          </svg>
        </div>
        <span className="brand-logo-text" style={{ fontSize: '23px' }}>
          <span className="brand-j-box">
            <span className="brand-j-char">j</span>
            <span className="brand-j-sparkle" aria-hidden="true">✦</span>
          </span>
          <span className="brand-rest-ust">ust</span>
          <span className="brand-rest-draw">draw</span>
        </span>
      </a>
      <nav>
        <a href="#features">Features</a>
        <a href="#start">Open Source</a>
        <a href="#pricing">Pricing</a>
      </nav>
      <div className="nav-actions">
        <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <a className="icon-link" href="https://github.com/vikash0064/justdraw.in" target="_blank" rel="noreferrer">
          <Github size={17} /> <span>130k</span>
        </a>
        {user ? (
          <a className="primary-btn small" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>Go to Dashboard</a>
        ) : (
          <>
            <a className="signin" onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>Sign in</a>
            <a className="primary-btn small" onClick={() => navigate('/register')} style={{ cursor: 'pointer' }}>Free whiteboard</a>
          </>
        )}
      </div>
    </header>
  );
}

function Feature({ number, label, title, copy, children, preset = "create", tint = "lavender" }) {
  return (
    <section className="feature reveal" id={title.toLowerCase().replaceAll(" ", "-")}>
      <div className="timeline-marker"><span>{number}</span></div>
      <div className="feature-copy">
        <span className={`eyebrow ${tint}`}>{label}</span>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      <ProductFrame variant="feature" preset={preset} />
      {children}
    </section>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithToken, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const hasAttemptedLogin = useRef(false);

  // Intercept Google OAuth JWT token from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (token && !hasAttemptedLogin.current) {
      hasAttemptedLogin.current = true;

      const authenticateWithGoogleToken = async () => {
        window.history.replaceState({}, document.title, '/');
        await loginWithToken(token);
        navigate('/dashboard');
      };

      authenticateWithGoogleToken();
    }
  }, [location.search, loginWithToken, navigate]);

  useEffect(() => {
    const items = document.querySelectorAll(".reveal, .reveal-scale");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    }, { threshold: 0.12 });

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <div id="top" className="site-shell landing-body">
      <TopNav user={user} navigate={navigate} theme={theme} toggleTheme={toggleTheme} />
      <main>
        {/* Hero */}
        <section className="hero section-wrap reveal-scale">
          <div className="doodle-cloud" style={{ zIndex: 1 }}>
            <svg viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {/* Star doodle (top left) */}
              <g transform="translate(100, 60)">
                <g className="anim-float">
                  <path d="M 0 -10 L 3 -3 L 10 0 L 3 3 L 0 10 L -3 3 L -10 0 L -3 -3 Z" fill="none" stroke="#f472b6" strokeWidth="2" />
                </g>
              </g>

              {/* Brocketdeer Cursor Tag (top left-center) */}
              <g transform="translate(260, 65)">
                <g className="anim-float" style={{ animationDelay: '-1.5s' }}>
                  {/* Cursor Arrow */}
                  <polygon points="0,0 6,18 12,12" fill="#f59e0b" stroke="#ca8a04" strokeWidth="1.5" transform="rotate(-15)" />
                  {/* Cursor Label Box */}
                  <g transform="translate(10, 8)">
                    <rect x="0" y="0" width="76" height="20" rx="4" fill="#fffbeb" stroke="#d97706" strokeWidth="1.5" />
                    <text x="38" y="13" textAnchor="middle" fill="#d97706" fontSize="8" fontWeight="bold" style={{ fontFamily: "'Comic Sans MS', cursive" }}>brocketdeer</text>
                  </g>
                </g>
              </g>

              {/* Loop spiral (mid left) */}
              <g transform="translate(90, 160)">
                <g className="anim-pulse">
                  <path d="M 0 0 C 20 -15, 30 15, 50 0 C 60 -10, 50 -30, 30 -20 C 20 -10, 40 10, 60 0" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
                </g>
              </g>

              {/* Allosaurus Cursor Tag (mid left) */}
              <g transform="translate(60, 270)">
                <g className="anim-float" style={{ animationDelay: '-0.5s' }}>
                  {/* Cursor Arrow */}
                  <polygon points="0,0 6,18 12,12" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1.5" transform="rotate(-5)" />
                  {/* Cursor Label Box */}
                  <g transform="translate(14, 8)">
                    <rect x="0" y="0" width="74" height="20" rx="4" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5" />
                    <text x="37" y="13" textAnchor="middle" fill="#0284c7" fontSize="8" fontWeight="bold" style={{ fontFamily: "'Comic Sans MS', cursive" }}>allosaurus</text>
                  </g>
                </g>
              </g>

              {/* Yellow crescent scribble (bottom left) */}
              <g transform="translate(180, 380)">
                <g className="anim-float">
                  <path d="M 0 0 A 20 20 0 0 0 35 15" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                </g>
              </g>

              {/* Right Side Doodles */}

              {/* Wavy blue spiral (top right) */}
              <g transform="translate(960, 70)">
                <g className="anim-float">
                  <path d="M 0 0 C 10 10, -10 20, 0 30 C 10 40, -10 50, 0 60 C 10 70, -10 80, 0 90" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                </g>
              </g>

              {/* Circle outline (top far right) */}
              <g transform="translate(1080, 90)">
                <g className="anim-pulse">
                  <circle cx="0" cy="0" r="10" fill="none" stroke="#fb923c" strokeWidth="2" />
                </g>
              </g>

              {/* Rainbowlorikeet Cursor Tag (mid right) */}
              <g transform="translate(990, 200)">
                <g className="anim-float" style={{ animationDelay: '-2s' }}>
                  {/* Cursor Arrow */}
                  <polygon points="0,0 6,18 12,12" fill="#10b981" stroke="#047857" strokeWidth="1.5" transform="rotate(-25)" />
                  {/* Cursor Label Box */}
                  <g transform="translate(10, 8)">
                    <rect x="0" y="0" width="94" height="20" rx="4" fill="#dcfce7" stroke="#15803d" strokeWidth="1.5" />
                    <text x="47" y="13" textAnchor="middle" fill="#15803d" fontSize="8" fontWeight="bold" style={{ fontFamily: "'Comic Sans MS', cursive" }}>rainbowlorikeet</text>
                  </g>
                </g>
              </g>

              {/* Green scribble zigzag (mid bottom right) */}
              <g transform="translate(930, 330)">
                <g className="anim-pulse">
                  <path d="M 0 0 L 15 15 L 0 30 L 15 45 L 0 60" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" />
                </g>
              </g>

              {/* Allosaurus Cursor Tag (bottom right) */}
              <g transform="translate(1030, 380)">
                <g className="anim-float" style={{ animationDelay: '-1s' }}>
                  {/* Cursor Arrow */}
                  <polygon points="0,0 6,18 12,12" fill="#ec4899" stroke="#be185d" strokeWidth="1.5" transform="rotate(-10)" />
                  {/* Cursor Label Box */}
                  <g transform="translate(10, 8)">
                    <rect x="0" y="0" width="74" height="20" rx="4" fill="#fce7f3" stroke="#db2777" strokeWidth="1.5" />
                    <text x="37" y="13" textAnchor="middle" fill="#db2777" fontSize="8" fontWeight="bold" style={{ fontFamily: "'Comic Sans MS', cursive" }}>allosaurus</text>
                  </g>
                </g>
              </g>

              {/* Bottom stylus pen pointing down */}
              <g transform="translate(600, 430)">
                <g className="anim-float" style={{ animationDelay: '-0.7s' }}>
                  {/* Marker pen body */}
                  <path d="M -8 -80 L 8 -80 L 8 0 L 0 15 L -8 0 Z" fill="#e0e7ff" stroke="#5c5326" strokeWidth="2.2" />
                  {/* Cap clip line */}
                  <path d="M 0 -80 L 0 -50" stroke="#5c5326" strokeWidth="1.5" />
                  {/* Small pointer circle below tip */}
                  <circle cx="0" cy="24" r="3.5" fill="#5c5326" />
                </g>
              </g>
            </svg>
          </div>
          <p className="kicker">A canvas for the way ideas actually happen.</p>
          <h1>Online <Highlight>whiteboard</Highlight><br />made simple.</h1>
          <p className="hero-copy">Ideate, collaborate, and share your best thinking—without getting lost in the tools.</p>

          <div className="hero-actions">
            {user ? (
              <a className="primary-btn" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
                Go to Dashboard <ArrowRight size={17} />
              </a>
            ) : (
              <>
                <a className="primary-btn" onClick={() => navigate('/register')} style={{ cursor: 'pointer' }}>
                  Start drawing <ArrowRight size={17} />
                </a>
                <a className="secondary-btn" onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>
                  Sign In
                </a>
              </>
            )}
            <a className="secondary-btn" href="#features">See how it works</a>
          </div>

          <div className="trust-badge" onClick={() => window.open('https://github.com/vikash0064/justdraw.in', '_blank')} style={{ cursor: 'pointer' }}>
            <Github size={17} /> Loved by 130k makers
          </div>

          <ProductFrame preset="hero" />
        </section>

        {/* Logo strip */}
        <section className="logo-strip">
          <p>Trusted by teams who think out loud</p>
          <div>
            <span>BLUEBEAM</span>
            <span>ROKT</span>
            <span>odoo</span>
            <span>intel</span>
            <span>stripe</span>
            <span>supabase</span>
            <span>NETFLIX</span>
            <span>Meta</span>
          </div>
        </section>

        {/* Intro */}
        <section className="intro section-wrap" id="start">
          <div className="doodle-cloud compact">
            {doodles.slice(0, 4).map((d, i) => <span key={i} className={`doodle d${i}`}>{d}</span>)}
          </div>
          <h2>Say hi to <Highlight>justdraw</Highlight></h2>
          <span className="intro-highlight"><Highlight tone="yellow">Free & open source</Highlight></span>
          <p>No account needed. Just start drawing.</p>
          <div className="hero-actions" style={{ justifyContent: 'flex-start' }}>
            <a className="primary-btn" onClick={() => navigate(user ? '/dashboard' : '/register')} style={{ cursor: 'pointer' }}>
              Start drawing
            </a>
            <a className="secondary-btn" onClick={() => navigate('/join')} style={{ cursor: 'pointer' }}>
              Join Room
            </a>
          </div>
        </section>

        {/* Timeline Features */}
        <div className="timeline-wrap" id="features">
          <Feature
            number="01"
            label="open canvas"
            title="Create"
            copy="Make the first move quickly. Simple tools, advanced features, and endless room to turn a rough thought into something real."
            preset="create"
          />
          <Feature
            number="02"
            label="easy to use"
            title="Collaborate"
            copy="Send a link, get feedback, and finish the idea together. Everyone can add their perspective without stepping on the work."
            preset="collaborate"
            tint="yellow"
          />
          <Feature
            number="03"
            label="real-time collaboration"
            title="Common usecases"
            copy="Meetings, brainstorming, diagrams, SQL/ER models, architecture planning, and all the in-between moments."
            preset="usecases"
            tint="mint"
          />
          <Feature
            number="04"
            label="quietly powerful"
            title="Generative AI"
            copy="Turn scattered notes into a clear starting point. Keep the human direction; let the assistant handle the blank page."
            preset="ai"
            tint="coral"
          />
          <Feature
            number="05"
            label="digital paper & infinite canvas"
            title="Notes Board"
            copy="Pick up your Apple Pencil or stylus. Write, highlight, organize unlimited A4 paper pages, and export publication-ready PDF documents."
            preset="notes"
            tint="yellow"
          />
        </div>

        {/* Closing */}
        <section className="closing section-wrap" id="teams">
          <span className="eyebrow lavender">the easiest way to get thoughts on screen</span>
          <h2>Quick enough for a meeting.<br /><Highlight tone="yellow">Human enough for a workshop.</Highlight></h2>
          <p>Sketch the thing, share the thing, keep the momentum.</p>
          <div className="closing-board">
            <ProductFrame variant="closing" preset="usecases" />
            <div className="closing-sticker"><Sparkles size={18} /> Ready when the idea is.</div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="social-proof reveal">
          <div className="section-wrap">
            <span className="eyebrow mint">Loved by individuals</span>
            <h2>Small teams, big blank canvases.</h2>
            <div className="quote-row">
              <article>
                <div className="quote-avatar">AL</div>
                <p>“It feels like the room is still there, even when our team is remote.”</p>
                <strong>Alex · product designer</strong>
              </article>
              <article>
                <div className="quote-avatar coral">RK</div>
                <p>“The fastest way we’ve found to go from a messy thought to a shared plan.”</p>
                <strong>Rina · founder</strong>
              </article>
              <article>
                <div className="quote-avatar yellow">JM</div>
                <p>“Open the board, add the first line, and the meeting gets better.”</p>
                <strong>Jamie · researcher</strong>
              </article>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="pricing section-wrap reveal" id="pricing">
          <span className="eyebrow yellow">a plan for every pace</span>
          <h2>Start free.<br /><Highlight>Keep the good stuff.</Highlight></h2>
          <p>Bring your ideas into one calm, flexible workspace.</p>

          <a className="primary-btn" onClick={() => navigate(user ? '/dashboard' : '/register')} style={{ cursor: 'pointer' }}>
            {user ? 'Go to Dashboard' : 'Open a free whiteboard'} <ArrowRight size={17} />
          </a>

          <div className="pricing-note">
            <span><Check size={16} /> No credit card needed</span>
            <span><Check size={16} /> Export anytime</span>
            <span><Check size={16} /> Your canvas, your way</span>
          </div>
        </section>
      </main>

      <footer>
        <div className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="34" height="34">
              <circle cx="6" cy="6" r="4.2" fill="#6366f1" />
              <rect x="13.5" y="2" width="8.5" height="8.5" rx="2" fill="#f43f5e" />
              <path d="M 6 13.5 L 10.5 22 L 1.5 22 Z" fill="#10b981" />
              <circle cx="18" cy="18" r="4.2" fill="#f59e0b" />
            </svg>
          </div>
          <span className="brand-logo-text" style={{ fontSize: '23px' }}>
            <span className="brand-j-box">
              <span className="brand-j-char">j</span>
              <span className="brand-j-sparkle" aria-hidden="true">✦</span>
            </span>
            <span className="brand-rest-ust">ust</span>
            <span className="brand-rest-draw">draw</span>
          </span>
        </div>
        <span>Made for the wonderfully unfinished.</span>
        <div>
          <a href="#features">Features</a>
          <a href="https://github.com/vikash0064/justdraw.in" target="_blank" rel="noreferrer">Community</a>
          <a onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>Sign In</a>
        </div>
      </footer>
    </div>
  );
}
