import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '../api/axios';
import ExcalidrawBackgroundDoodles from '../components/auth/ExcalidrawBackgroundDoodles';
import ExcalidrawShowcaseCarousel from '../components/auth/ExcalidrawShowcaseCarousel';
import '../styles/excalidraw-auth.css';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      return toast.error('Please fill in all fields');
    }
    if (password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const apiUrl = getApiBaseUrl();
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href = `${apiUrl}/api/auth/google?return_to=${returnTo}&t=${Date.now()}`;
  };

  const handleSocialClick = (provider) => {
    toast(`Connecting to ${provider}...`, { icon: '🚀' });
  };

  return (
    <div className="excali-auth-page">
      {/* Floating Background Sketch Doodles */}
      <ExcalidrawBackgroundDoodles />

      {/* Floating Dark / Light Theme Toggle */}
      <button
        className="excali-theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* ── Top Header Logo ── */}
      <header className="excali-header">
        <Link to="/" className="excali-brand" title="Go to home">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="42" height="42">
              <circle cx="6" cy="6" r="4.2" fill="#6366f1" />
              <rect x="13.5" y="2" width="8.5" height="8.5" rx="2" fill="#f43f5e" />
              <path d="M 6 13.5 L 10.5 22 L 1.5 22 Z" fill="#10b981" />
              <circle cx="18" cy="18" r="4.2" fill="#f59e0b" />
            </svg>
          </div>
          <span className="excali-brand-text brand-logo-text" style={{ fontSize: '1.65rem' }}>
            <span className="brand-j-box">
              <span className="brand-j-char">j</span>
              <span className="brand-j-sparkle" aria-hidden="true">✦</span>
            </span>
            <span className="brand-rest-ust">ust</span>
            <span className="brand-rest-draw">draw</span>
          </span>
        </Link>
      </header>

      {/* ── Main Two-Column Stage ── */}
      <main className="excali-main-container">
        {/* Left Side: Hand-drawn Showcase Illustration & Carousel */}
        <ExcalidrawShowcaseCarousel />

        {/* Right Side: Excalidraw Auth Card Column */}
        <div className="excali-card-wrapper">
          <motion.div
            className="excali-auth-card"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="excali-card-header">
              <span className="excali-badge-sub">CREATE AN ACCOUNT</span>
              <h1 className="excali-card-title">Get started!</h1>
              <p className="excali-card-subtitle">Choose how you want to sign up.</p>
            </div>

            {/* Social Login Buttons */}
            <div className="excali-social-section">
              <span className="excali-section-label">CONTINUE WITH</span>
              <div className="excali-social-grid">
                {/* 1. Facebook */}
                <button
                  type="button"
                  className="excali-social-btn"
                  onClick={() => handleSocialClick('Facebook')}
                  aria-label="Sign up with Facebook"
                  title="Sign up with Facebook"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </button>

                {/* 2. GitHub */}
                <button
                  type="button"
                  className="excali-social-btn"
                  onClick={() => handleSocialClick('GitHub')}
                  aria-label="Sign up with GitHub"
                  title="Sign up with GitHub"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                </button>

                {/* 3. Google (Highlighted with "Last used" badge) */}
                <button
                  type="button"
                  className="excali-social-btn highlight-google"
                  onClick={handleGoogleLogin}
                  aria-label="Sign up with Google"
                  title="Sign up with Google (Last used)"
                >
                  <span className="excali-last-used-badge">Last used</span>
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="excali-divider">
              <span>or</span>
            </div>

            {/* Email / Password Sign Up Form */}
            <form onSubmit={handleSubmit} className="excali-auth-form">
              <div className="excali-input-group">
                <div className="excali-input-box">
                  <User size={18} className="excali-input-icon" />
                  <input
                    type="text"
                    className="excali-input"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              <div className="excali-input-group">
                <div className="excali-input-box">
                  <Mail size={18} className="excali-input-icon" />
                  <input
                    type="email"
                    className="excali-input"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="excali-input-group">
                <div className="excali-input-box">
                  <Lock size={18} className="excali-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="excali-input"
                    placeholder="Password (min. 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--excali-text-dim)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="excali-btn-primary accent-purple"
                disabled={loading}
              >
                {loading ? (
                  <span>Creating account...</span>
                ) : (
                  <>
                    Create Account <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Switch to Sign In link */}
            <div className="excali-switch-row">
              <Link to="/login" className="excali-switch-link">
                Already have an account? Sign in
              </Link>
            </div>
          </motion.div>

          {/* Clean Legal Terms Placed Directly Below the Auth Box */}
          <div className="excali-card-footer">
            By continuing you are agreeing to our{' '}
            <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Use</a> and{' '}
            <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
          </div>
        </div>
      </main>
    </div>
  );
}
