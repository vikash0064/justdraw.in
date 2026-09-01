import { useState } from 'react';
import { Globe, Link2, X, Youtube, Code2, BookOpen, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WebEmbedModal({ onEmbed, onClose }) {
    const [url, setUrl] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!url.trim()) return;
        let validUrl = url.trim();
        if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
            validUrl = `https://${validUrl}`;
        }
        onEmbed(validUrl);
        onClose();
    };

    const PRESETS = [
        { name: 'YouTube', icon: <Youtube size={13} color="#ef4444" />, url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
        { name: 'CodePen', icon: <Code2 size={13} color="#38bdf8" />, url: 'https://codepen.io' },
        { name: 'Wikipedia', icon: <BookOpen size={13} color="#a1a1aa" />, url: 'https://www.wikipedia.org' },
        { name: 'Figma', icon: <Layers size={13} color="#a855f7" />, url: 'https://www.figma.com' }
    ];

    return (
        <div className="exc-modal-overlay" onClick={onClose}>
            <motion.div 
                className="exc-modal-card glass"
                style={{ 
                    width: 480, 
                    padding: 0,
                    background: '#1a1a24',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 14,
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                    overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ duration: 0.15 }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: 'rgba(99, 102, 241, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(99, 102, 241, 0.3)'
                        }}>
                            <Globe size={16} color="#818cf8" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>Embed Web Page or Media</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Live interactive website or video frame on canvas</div>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: 6,
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.12s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>URL or Share Link</label>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            background: '#121218', 
                            border: '1px solid rgba(255, 255, 255, 0.12)', 
                            borderRadius: 10, 
                            padding: '0 12px',
                            transition: 'border-color 0.15s ease'
                        }}>
                            <Link2 size={16} color="#818cf8" />
                            <input 
                                type="text"
                                autoFocus
                                placeholder="https://youtube.com/watch?v=... or https://figma.com/..."
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '12px 10px',
                                    color: '#ffffff',
                                    fontSize: 13,
                                    outline: 'none',
                                    fontFamily: 'Inter, sans-serif'
                                }}
                            />
                        </div>
                    </div>

                    {/* Supported Badge Indicators */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Quick Presets:</span>
                        {PRESETS.map(preset => (
                            <button
                                key={preset.name}
                                type="button"
                                onClick={() => setUrl(preset.url)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: 6,
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: '#cbd5e1',
                                    cursor: 'pointer',
                                    transition: 'all 0.12s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'; e.currentTarget.style.borderColor = '#818cf8'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                            >
                                {preset.icon}
                                {preset.name}
                            </button>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                        <button 
                            type="button"
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: 8,
                                padding: '9px 16px',
                                color: '#94a3b8',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.12s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={!url.trim()}
                            style={{
                                background: url.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#27273a',
                                border: 'none',
                                borderRadius: 8,
                                padding: '9px 20px',
                                color: url.trim() ? '#ffffff' : '#64748b',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: url.trim() ? 'pointer' : 'not-allowed',
                                boxShadow: url.trim() ? '0 4px 14px rgba(99, 102, 241, 0.4)' : 'none',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Embed Link
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
