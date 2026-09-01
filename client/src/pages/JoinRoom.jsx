import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  ArrowRight, 
  Sparkles, 
  Zap, 
  Video, 
  ShieldCheck, 
  ClipboardCopy, 
  Lightbulb 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/common/Sidebar';
import toast from 'react-hot-toast';
import '../styles/join-page.css';

/**
 * JoinRoom — Authentic Excalidraw Collaborative Whiteboard Gateway with Dashboard Sidebar.
 * Route: /join or /join/:code
 */
export default function JoinRoom() {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [roomCode, setRoomCode] = useState(urlCode || '');
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [error, setError] = useState('');

  // Handle quick paste from clipboard
  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // If they copied a full URL like http://localhost:5173/board/123, extract the ID
        const match = text.match(/board\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          setRoomCode(match[1]);
        } else {
          setRoomCode(text.trim());
        }
        toast.success('Room code pasted!');
      }
    } catch (err) {
      toast.error('Please paste code manually (Ctrl+V)');
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError('Please enter a room code or board ID');
      return;
    }

    if (!user) {
      if (!displayName.trim()) {
        setError('Display name is required to identify your cursor');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setError('A valid email address is required');
        return;
      }
      sessionStorage.setItem('guestName', displayName.trim());
      sessionStorage.setItem('guestEmail', email.trim());
    }

    setError('');
    sessionStorage.setItem('guestRoom', roomCode.trim());
    navigate(`/board/${roomCode.trim()}`);
  };

  return (
    <div className="join-dashboard-wrapper">
      {/* ── Left Sidebar Navigation ── */}
      <Sidebar activeTab="join" />

      {/* ── Main Content Area ── */}
      <main className="join-main-content">
        <div className="join-main-container">
          {/* Left Column: Interactive Live Board Teaser */}
          <motion.div 
            className="join-teaser-col"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="join-teaser-card">
              <div className="join-teaser-canvas">
                {/* Infinite grid dots */}
                <div className="canvas-grid-dots" />

                {/* Hand-drawn Sketch Sticky Note 1 */}
                <div className="canvas-note-yellow">
                  <strong>Live Session 🚀</strong>
                  <p style={{ margin: '3px 0 0', opacity: 0.85 }}>Collaborating on whiteboards & architecture</p>
                </div>

                {/* Hand-drawn Sketch Sticky Note 2 */}
                <div className="canvas-note-purple">
                  <strong>Multiplayer ✨</strong>
                  <p style={{ margin: '3px 0 0', opacity: 0.85 }}>Live drawing, audio & video together</p>
                </div>

                {/* Floating Multiplayer Cursors */}
                <div className="join-cursor-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4 L11 21 L14 14 L21 11 Z" fill="#4dabf7" stroke="#1864ab" strokeWidth="1.5" />
                  </svg>
                  <div className="cursor-pill" style={{ background: '#4dabf7' }}>Host 🎨</div>
                </div>

                <div className="join-cursor-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4 L11 21 L14 14 L21 11 Z" fill="#ff85ea" stroke="#c2255c" strokeWidth="1.5" />
                  </svg>
                  <div className="cursor-pill" style={{ background: '#ff85ea' }}>You ⚡</div>
                </div>
              </div>

              {/* Feature Highlights Grid */}
              <div className="join-features-list">
                <div className="join-feature-item">
                  <Zap size={15} />
                  <span>Real-Time Sync</span>
                </div>
                <div className="join-feature-item">
                  <Video size={15} />
                  <span>Audio & Video</span>
                </div>
                <div className="join-feature-item">
                  <Sparkles size={15} />
                  <span>AI Diagram Studio</span>
                </div>
                <div className="join-feature-item">
                  <ShieldCheck size={15} />
                  <span>Encrypted Canvas</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Square Join Session Form Card */}
          <motion.div 
            className="join-form-card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <div className="join-card-eyebrow">PORTAL</div>
            <h1 className="join-card-title">Join Session</h1>
            <p className="join-card-desc">
              Enter the room code or board ID shared by your host to jump straight into the canvas.
            </p>

            <form onSubmit={handleJoin} className="join-form-body">
              {/* Room Code Field with Quick Paste Helper */}
              <div className="join-field-group">
                <label htmlFor="room-code-input">Room Code or Board ID</label>
                <div className="join-input-wrapper">
                  <input
                    id="room-code-input"
                    className="join-input"
                    placeholder="e.g. 64f1a2b3c4d5e6f7 or board link"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    autoFocus={!urlCode}
                    required
                  />
                  <button 
                    type="button" 
                    onClick={handlePasteCode} 
                    className="join-paste-btn"
                    title="Paste from clipboard"
                  >
                    <ClipboardCopy size={13} />
                    Paste
                  </button>
                </div>
              </div>

              {/* Guest Details if not logged in */}
              {!user && (
                <>
                  <div className="join-field-group">
                    <label htmlFor="guest-name-input">Your Display Name</label>
                    <input
                      id="guest-name-input"
                      className="join-input"
                      placeholder="Enter your name (shown on cursor)"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      autoFocus={!!urlCode}
                      required
                    />
                  </div>

                  <div className="join-field-group">
                    <label htmlFor="guest-email-input">Your Email Address</label>
                    <input
                      id="guest-email-input"
                      type="email"
                      className="join-input"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {/* Error Message */}
              {error && (
                <div className="join-error-msg">
                  {error}
                </div>
              )}

              {/* Submit Join Button */}
              <button type="submit" className="join-submit-btn">
                <Users size={17} />
                <span>Enter Whiteboard Canvas</span>
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Helpful Hand-Drawn Sketch Tip */}
            <div className="join-sketch-hint">
              <Lightbulb size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Tip:</strong> The host can copy the board invite link from their canvas top bar <strong>Share</strong> button.
              </span>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
