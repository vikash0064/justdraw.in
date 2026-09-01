import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Layout, Search, LogOut, Settings, Clock,
    ChevronRight, Layers, Users, Sun, Moon, Sparkles,
    Paintbrush, Database, LayoutGrid, ArrowRight, Folder,
    Check, Trash2, Shield, Sliders, Cpu, Save, RefreshCw,
    NotebookPen, BookOpen, StickyNote, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/common/Sidebar';
import { getWorkspaces, createWorkspace, deleteWorkspace } from '../api/workspace.api';
import { getBoards, createBoard, getRecentBoards } from '../api/board.api';
import { getInitials, getAvatarColor, formatDate } from '../utils/helpers';
import ExcalidrawLoader from '../components/common/ExcalidrawLoader';
import toast from 'react-hot-toast';

const MODE_META = {
    whiteboard: { icon: Paintbrush, color: '#6366f1', label: 'Whiteboard' },
    architecture: { icon: LayoutGrid, color: '#06b6d4', label: 'Architecture' },
    er: { icon: Database, color: '#8b5cf6', label: 'ER Diagram' },
    notes: { icon: NotebookPen, color: '#f59e0b', label: 'Notes Board' },
};

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

export default function Dashboard() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme, setTheme } = useTheme();
    const navigate = useNavigate();

    // Active Navigation Tab: 'workspaces' | 'recent' | 'settings'
    const [activeTab, setActiveTab] = useState('workspaces');

    const [workspaces, setWorkspaces] = useState(() => {
        try {
            const cached = sessionStorage.getItem('centrio_workspaces_cache');
            return cached ? JSON.parse(cached) : [];
        } catch { return []; }
    });
    const [loading, setLoading] = useState(() => {
        try {
            return !sessionStorage.getItem('centrio_workspaces_cache');
        } catch { return true; }
    });
    const [showCreate, setShowCreate] = useState(false);
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [notesTitle, setNotesTitle] = useState('My Notes');
    const [notesPaperStyle, setNotesPaperStyle] = useState('lined');
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [creating, setCreating] = useState(false);
    const [search, setSearch] = useState('');

    // Recent boards data
    const [allBoardsList, setAllBoardsList] = useState([]);
    const [recentBoards, setRecentBoards] = useState([]);
    const [boardCounts, setBoardCounts] = useState(() => {
        try {
            const cached = sessionStorage.getItem('centrio_board_counts_cache');
            return cached ? JSON.parse(cached) : {};
        } catch { return {}; }
    });
    const [recentFilterMode, setRecentFilterMode] = useState('all');
    const [recentSearch, setRecentSearch] = useState('');

    // Settings tab state (backed by localStorage)
    const [profileName, setProfileName] = useState(user?.name || 'User');
    const [canvasGridStyle, setCanvasGridStyle] = useState(localStorage.getItem('justdraw_grid') || 'dots');
    const [sketchRoughness, setSketchRoughness] = useState(localStorage.getItem('justdraw_roughness') || 'architect');
    const [autoSaveFreq, setAutoSaveFreq] = useState(localStorage.getItem('justdraw_autosave') || 'instant');
    const [aiEngine, setAiEngine] = useState(localStorage.getItem('justdraw_ai_engine') || 'gemini');

    const location = useLocation();

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    useEffect(() => {
        if (location.state?.tab) {
            setActiveTab(location.state.tab);
        }
    }, [location.state]);

    const fetchWorkspaces = async () => {
        try {
            const [wsRes, recentRes] = await Promise.all([
                getWorkspaces(),
                getRecentBoards().catch(() => ({ data: [] })),
            ]);

            const wsData = wsRes.data || [];
            setWorkspaces(wsData);
            try { sessionStorage.setItem('centrio_workspaces_cache', JSON.stringify(wsData)); } catch (e) {}

            const counts = {};
            wsData.forEach(ws => {
                counts[ws._id] = ws.boardCount ?? 0;
            });
            setBoardCounts(counts);
            try { sessionStorage.setItem('centrio_board_counts_cache', JSON.stringify(counts)); } catch (e) {}

            const recentData = recentRes.data || [];
            setAllBoardsList(recentData);
            setRecentBoards(recentData.slice(0, 6));
        } catch (err) {
            console.error('Failed to load workspaces:', err);
            toast.error(err.response?.data?.message || 'Failed to load workspaces');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return toast.error('Name is required');
        setCreating(true);
        try {
            const { data } = await createWorkspace({ name: newName, description: newDesc });
            setWorkspaces([data, ...workspaces]);
            setBoardCounts(prev => ({ ...prev, [data._id]: 0 }));
            setShowCreate(false);
            setNewName('');
            setNewDesc('');
            toast.success('Workspace created!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create workspace');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this workspace and all its boards?')) return;
        try {
            await deleteWorkspace(id);
            setWorkspaces(workspaces.filter((w) => w._id !== id));
            toast.success('Workspace deleted');
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    const handleSaveSettings = (e) => {
        e.preventDefault();
        localStorage.setItem('justdraw_grid', canvasGridStyle);
        localStorage.setItem('justdraw_roughness', sketchRoughness);
        localStorage.setItem('justdraw_autosave', autoSaveFreq);
        localStorage.setItem('justdraw_ai_engine', aiEngine);
        toast.success('Preferences saved successfully!');
    };

    const handleClearLocalCache = () => {
        if (confirm('Clear local canvas offline cache and history?')) {
            localStorage.removeItem('excalidraw');
            localStorage.removeItem('excalidraw-state');
            toast.success('Offline cache cleared');
        }
    };

    const handleQuickCreate = async (mode, defaultTitle) => {
        try {
            let wsId = workspaces[0]?._id;
            if (!wsId) {
                const wsRes = await createWorkspace({ name: 'Personal Workspace', description: 'Default workspace' });
                wsId = wsRes.data._id;
                setWorkspaces([wsRes.data]);
            }
            const { data } = await createBoard(wsId, {
                title: defaultTitle || (mode === 'notes' ? 'Notes Document' : 'New Board'),
                mode
            });
            toast.success(`${MODE_META[mode]?.label || 'Board'} created!`);
            navigate(`/board/${data._id}`);
        } catch (err) {
            toast.error('Failed to create board');
        }
    };

    const handleCreateNotesDoc = async (e) => {
        e?.preventDefault();
        try {
            let wsId = workspaces[0]?._id;
            if (!wsId) {
                const wsRes = await createWorkspace({ name: 'Personal Workspace', description: 'Default workspace' });
                wsId = wsRes.data._id;
                setWorkspaces([wsRes.data]);
            }
            const { data } = await createBoard(wsId, {
                title: notesTitle.trim() || 'My Notes',
                mode: 'notes'
            });
            toast.success('Notes Document created!');
            setShowNotesModal(false);
            navigate(`/board/${data._id}?pattern=${notesPaperStyle}`);
        } catch {
            toast.error('Failed to create Notes board');
        }
    };

    const filteredWorkspaces = workspaces.filter((w) =>
        (w?.name || '').toLowerCase().includes((search || '').toLowerCase())
    );

    const filteredRecentBoards = allBoardsList.filter((b) => {
        const matchesMode = recentFilterMode === 'all' || b?.mode === recentFilterMode;
        const matchesSearch = (b?.name || '').toLowerCase().includes((recentSearch || '').toLowerCase()) ||
            ((b?.workspaceName || '').toLowerCase().includes((recentSearch || '').toLowerCase()));
        return matchesMode && matchesSearch;
    });

    const totalBoards = useMemo(() => Object.values(boardCounts).reduce((s, c) => s + c, 0), [boardCounts]);
    const totalMembers = useMemo(() => {
        const unique = new Set();
        workspaces.forEach(ws => (ws.members || []).forEach(m => unique.add(typeof m === 'string' ? m : m._id || m)));
        return unique.size || 1;
    }, [workspaces]);

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
    const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

    return (
        <motion.div className="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            {/* ── Sidebar Navigation ── */}
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

            {/* ── Main Content Area ── */}
            <main className="dashboard-main">
                {/* ══════════════════════════════════════════
                   TAB 1: WORKSPACES (DEFAULT HOME)
                   ══════════════════════════════════════════ */}
                {activeTab === 'workspaces' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                        {/* Welcome Hero */}
                        <section className="dash-welcome">
                            <div className="dash-welcome-text">
                                <div className="dash-eyebrow-row">
                                    <span className="eyebrow lavender"><Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} /> Workspace Studio</span>
                                </div>
                                <h1 className="dash-greeting">
                                    {getGreeting()}, <span className="marker marker-mint">{user?.name?.split(' ')[0] || 'Creator'}</span>
                                </h1>
                                <p className="dash-welcome-sub">
                                    Ideate, collaborate, and bring your team's best visual thinking to life.
                                </p>
                            </div>
                            <div className="dash-quick-actions">
                                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                                    <Plus size={16} /> New Workspace
                                </button>
                                <button className="btn btn-secondary" onClick={() => navigate('/join')}>
                                    <Users size={16} /> Join Room
                                </button>
                            </div>
                        </section>

                        {/* Stats Row */}
                        <section className="dash-stats-row">
                            <div className="dash-stat-card">
                                <div className="dash-stat-icon stat-lavender">
                                    <Folder size={22} />
                                </div>
                                <div className="dash-stat-info">
                                    <span className="dash-stat-value">{workspaces.length}</span>
                                    <span className="dash-stat-label">Workspaces</span>
                                </div>
                            </div>
                            <div className="dash-stat-card">
                                <div className="dash-stat-icon stat-sky">
                                    <Layers size={22} />
                                </div>
                                <div className="dash-stat-info">
                                    <span className="dash-stat-value">{totalBoards}</span>
                                    <span className="dash-stat-label">Boards</span>
                                </div>
                            </div>
                            <div className="dash-stat-card">
                                <div className="dash-stat-icon stat-mint">
                                    <Users size={22} />
                                </div>
                                <div className="dash-stat-info">
                                    <span className="dash-stat-value">{totalMembers}</span>
                                    <span className="dash-stat-label">Members</span>
                                </div>
                            </div>
                        </section>

                        {/* ── Studio Boards / Quick Start Posters (4 Boards Grid) ── */}
                        <section className="dash-studios-section" style={{ marginBottom: '2.25rem' }}>
                            <div className="dash-section-header" style={{ marginBottom: '1rem' }}>
                                <h2><Sparkles size={16} color="var(--violet)" /> Canvas Studios</h2>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pick a studio or start an infinite notes document</span>
                            </div>
                            <div className="dash-studios-grid">
                                {/* 1. Whiteboard Studio */}
                                <motion.div
                                    className="board-poster-card"
                                    whileHover={{ y: -4 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleQuickCreate('whiteboard', 'Whiteboard Session')}
                                >
                                    <div className="board-poster-accent" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
                                    <div className="poster-preview-box">
                                        <div style={{ width: 108, height: 140, background: '#ffffff', borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.06)', padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                            <div style={{ width: '60%', height: 6, background: '#6366f1', borderRadius: 2, opacity: 0.8 }} />
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <div style={{ width: 28, height: 28, border: '2px solid #6366f1', borderRadius: 3 }} />
                                                <div style={{ width: 28, height: 28, border: '2px solid #ec4899', borderRadius: '50%' }} />
                                            </div>
                                            <div style={{ width: 44, height: 44, background: '#fef08a', borderRadius: 2, padding: 4, fontSize: 7, fontWeight: 700, color: '#854d0e' }}>📌 Note</div>
                                        </div>
                                    </div>
                                    <h3 className="poster-title"><Paintbrush size={16} color="#6366f1" /> Whiteboard</h3>
                                    <p className="poster-desc">Infinite canvas for sketches, sticky notes, wireframes, and team brainstorming.</p>
                                    <span className="poster-tag" style={{ color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)' }}>Board 1 • Freehand</span>
                                </motion.div>

                                {/* 2. System Architecture */}
                                <motion.div
                                    className="board-poster-card"
                                    whileHover={{ y: -4 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleQuickCreate('architecture', 'System Architecture')}
                                >
                                    <div className="board-poster-accent" style={{ background: 'linear-gradient(90deg, #06b6d4, #3b82f6)' }} />
                                    <div className="poster-preview-box">
                                        <div style={{ width: 108, height: 140, background: '#0f172a', borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center' }}>
                                            <div style={{ width: 68, height: 20, border: '1px solid #06b6d4', borderRadius: 4, background: 'rgba(6, 182, 212, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4', fontSize: 7, fontWeight: 700 }}>API Gateway</div>
                                            <div style={{ width: 2, height: 14, background: '#06b6d4' }} />
                                            <div style={{ width: 68, height: 20, border: '1px solid #3b82f6', borderRadius: 4, background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: 7, fontWeight: 700 }}>Microservice</div>
                                            <div style={{ width: 2, height: 14, background: '#3b82f6' }} />
                                            <div style={{ width: 44, height: 22, border: '1px solid #10b981', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: 7, fontWeight: 700 }}>Database</div>
                                        </div>
                                    </div>
                                    <h3 className="poster-title"><LayoutGrid size={16} color="#06b6d4" /> Architecture</h3>
                                    <p className="poster-desc">Cloud infrastructure blueprints, microservice topologies, and network flows.</p>
                                    <span className="poster-tag" style={{ color: '#06b6d4', background: 'rgba(6, 182, 212, 0.1)' }}>Board 2 • System Design</span>
                                </motion.div>

                                {/* 3. Database & ERD */}
                                <motion.div
                                    className="board-poster-card"
                                    whileHover={{ y: -4 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleQuickCreate('er', 'Database Schema')}
                                >
                                    <div className="board-poster-accent" style={{ background: 'linear-gradient(90deg, #8b5cf6, #d946ef)' }} />
                                    <div className="poster-preview-box">
                                        <div style={{ width: 108, height: 140, background: '#171530', borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <div style={{ border: '1px solid #8b5cf6', borderRadius: 3, background: 'rgba(139, 92, 246, 0.15)', overflow: 'hidden' }}>
                                                <div style={{ background: '#8b5cf6', color: '#fff', fontSize: 7, fontWeight: 700, padding: '2px 4px' }}>users_table</div>
                                                <div style={{ padding: '3px 4px', fontSize: 6, color: '#cbd5e1', lineHeight: 1.4 }}>🔑 id: uuid<br />name: varchar<br />email: varchar</div>
                                            </div>
                                            <div style={{ width: '100%', height: 1, borderTop: '1px dashed #8b5cf6' }} />
                                            <div style={{ border: '1px solid #a78bfa', borderRadius: 3, background: 'rgba(167, 139, 250, 0.15)', overflow: 'hidden' }}>
                                                <div style={{ background: '#a78bfa', color: '#171530', fontSize: 7, fontWeight: 700, padding: '2px 4px' }}>orders_table</div>
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className="poster-title"><Database size={16} color="#8b5cf6" /> ER Diagram</h3>
                                    <p className="poster-desc">Interactive SQL tables, entity-relationship models, foreign keys, and schemas.</p>
                                    <span className="poster-tag" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)' }}>Board 3 • SQL Models</span>
                                </motion.div>

                                {/* 4. Notes Board (Apple Notes / iPad Style) — BOARD 4 POSTER */}
                                <motion.div
                                    className="board-poster-card"
                                    whileHover={{ y: -4 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowNotesModal(true)}
                                >
                                    <div className="board-poster-accent" style={{ background: 'linear-gradient(90deg, #f59e0b, #ec4899, #6366f1)' }} />
                                    <div className="poster-preview-box">
                                        {/* Miniature A4 Sheet with Lined Paper, Highlighter, Sticky Note & Pencil */}
                                        <div style={{
                                            width: 108,
                                            height: 140,
                                            background: '#ffffff',
                                            borderRadius: 3,
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                            border: '1px solid rgba(0,0,0,0.06)',
                                            padding: '10px 8px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            {/* Ruled lined paper background */}
                                            <div style={{
                                                position: 'absolute',
                                                inset: 0,
                                                backgroundImage: 'linear-gradient(90deg, transparent 14px, #fca5a5 14px, #fca5a5 15px, transparent 15px), linear-gradient(rgba(203, 213, 225, 0.45) 1px, transparent 1px)',
                                                backgroundSize: '100% 100%, 100% 12px',
                                                backgroundPosition: '0 0, 0 6px',
                                                pointerEvents: 'none'
                                            }} />

                                            {/* Header Lines & Highlighter */}
                                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <div style={{ width: '45%', height: 4, background: '#f59e0b', borderRadius: 2 }} />
                                                <div style={{ width: '75%', height: 6, background: 'rgba(253, 224, 71, 0.75)', borderRadius: 2 }} />
                                                <div style={{ width: '60%', height: 2.5, background: '#94a3b8', borderRadius: 1 }} />
                                                <div style={{ width: '70%', height: 2.5, background: '#94a3b8', borderRadius: 1 }} />
                                            </div>

                                            {/* Mini Yellow Sticky Note */}
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 10,
                                                right: 8,
                                                width: 38,
                                                height: 38,
                                                background: '#fef08a',
                                                borderRadius: 2,
                                                boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
                                                padding: 3,
                                                fontSize: 6.5,
                                                fontWeight: 800,
                                                color: '#854d0e',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                lineHeight: 1.1,
                                                zIndex: 2,
                                                transform: 'rotate(4deg)'
                                            }}>
                                                <span>iPad</span>
                                                <span>Notes</span>
                                            </div>

                                            {/* Mini Apple Pencil Illustration */}
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 12,
                                                left: 6,
                                                width: 44,
                                                height: 6,
                                                background: 'linear-gradient(90deg, #f1f5f9 0%, #ffffff 70%, #f59e0b 100%)',
                                                borderRadius: 3,
                                                border: '1px solid #cbd5e1',
                                                boxShadow: '0 2px 5px rgba(0,0,0,0.18)',
                                                transform: 'rotate(-32deg)',
                                                zIndex: 2
                                            }} />
                                        </div>
                                    </div>
                                    <h3 className="poster-title"><NotebookPen size={16} color="#f59e0b" /> Notes Board</h3>
                                    <p className="poster-desc">Digital A4 paper notebook with Apple Pencil markup, highlighters, gallery strip, and PDF export.</p>
                                    <span className="poster-tag" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)' }}>Board 4 • Apple Notes</span>
                                </motion.div>
                            </div>
                        </section>

                        {/* Recent Boards Teaser */}
                        {recentBoards.length > 0 && (
                            <section className="dash-recent-section">
                                <div className="dash-section-header">
                                    <h2><Clock size={16} /> Recent Boards</h2>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setActiveTab('recent')}
                                        style={{ fontSize: '0.8rem', color: 'var(--violet)', fontWeight: 700 }}
                                    >
                                        View all ({allBoardsList.length}) →
                                    </button>
                                </div>
                                <div className="dash-recent-grid">
                                    {recentBoards.map((b) => {
                                        const meta = MODE_META[b.mode] || MODE_META.whiteboard;
                                        const ModeIcon = meta.icon;
                                        return (
                                            <motion.div key={b._id} className="dash-recent-card"
                                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                onClick={() => navigate(`/board/${b._id}`)}
                                            >
                                                <div className="dash-recent-card-top" style={{ borderLeftColor: meta.color }}>
                                                    <ModeIcon size={14} style={{ color: meta.color }} />
                                                    <span className="dash-recent-mode" style={{ color: meta.color }}>{meta.label}</span>
                                                </div>
                                                <h4>{b.name}</h4>
                                                <span className="dash-recent-ws">{b.workspaceName}</span>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Workspaces Section */}
                        <section className="dash-workspaces-section">
                            <div className="dash-section-header">
                                <h2><Layout size={16} /> Workspaces</h2>
                                <div className="dashboard-actions">
                                    <div className="search-box">
                                        <Search size={16} />
                                        <input type="text" placeholder="Search workspaces..." value={search} onChange={(e) => setSearch(e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            {loading ? (
                                <div style={{ padding: '30px 0' }}>
                                    <ExcalidrawLoader fullScreen={false} />
                                </div>
                            ) : filteredWorkspaces.length === 0 ? (
                                <div className="empty-state">
                                    <Layers size={64} />
                                    <h3>{search ? 'No results found' : 'No workspaces yet'}</h3>
                                    <p>{search ? 'Try a different search term' : 'Create your first workspace to get started'}</p>
                                    {!search && (
                                        <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ marginTop: 'var(--space-md)' }}>
                                            <Plus size={16} /> Create Workspace
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <motion.div className="workspace-grid" variants={container} initial="hidden" animate="show">
                                    {filteredWorkspaces.map((ws) => {
                                        const count = boardCounts[ws._id] || 0;
                                        return (
                                            <motion.div
                                                key={ws._id}
                                                className="workspace-card"
                                                variants={item}
                                                whileHover={{ y: -4 }}
                                                onClick={() => navigate(`/workspace/${ws._id}`)}
                                            >
                                                <div className="ws-card-top-bar" style={{ background: `linear-gradient(90deg, ${getAvatarColor(ws.name)}, transparent)` }} />
                                                <div className="workspace-card-top">
                                                    <div className="workspace-card-icon" style={{ background: getAvatarColor(ws.name) }}>
                                                        {getInitials(ws.name)}
                                                    </div>
                                                    <button
                                                        className="workspace-card-delete-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(ws._id);
                                                        }}
                                                        title="Delete workspace"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                                <h3 className="workspace-card-name">{ws.name}</h3>
                                                <p className="workspace-card-desc">
                                                    {ws.description || 'Collaborative whiteboard and diagramming workspace.'}
                                                </p>
                                                <div className="workspace-card-footer">
                                                    <span className="workspace-card-meta">
                                                        <Layers size={13} /> {count} {count === 1 ? 'board' : 'boards'}
                                                    </span>
                                                    <span className="workspace-card-meta">
                                                        <Users size={13} /> {ws.members?.length || 1} {ws.members?.length === 1 ? 'member' : 'members'}
                                                    </span>
                                                    <span className="workspace-card-meta">
                                                        <Clock size={13} /> {formatDate(ws.createdAt)}
                                                    </span>
                                                </div>
                                                <div className="workspace-card-action">
                                                    <span>Open</span>
                                                    <ChevronRight size={15} />
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </section>
                    </motion.div>
                )}

                {/* ══════════════════════════════════════════
                   TAB 2: RECENT BOARDS FULL VIEW
                   ══════════════════════════════════════════ */}
                {activeTab === 'recent' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                        <div className="dashboard-header">
                            <div>
                                <h1 className="dashboard-title">Recent Activity</h1>
                                <p className="dashboard-subtitle">Jump back into your recently edited whiteboards, diagrams, and wireframes.</p>
                            </div>
                            <div className="dashboard-actions">
                                <div className="search-box">
                                    <Search size={16} />
                                    <input
                                        type="text"
                                        placeholder="Filter recent boards..."
                                        value={recentSearch}
                                        onChange={(e) => setRecentSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Mode Filter Pills */}
                        <div className="dash-filter-row">
                            <button
                                className={`dash-filter-pill ${recentFilterMode === 'all' ? 'active' : ''}`}
                                onClick={() => setRecentFilterMode('all')}
                            >
                                All Boards ({allBoardsList.length})
                            </button>
                            <button
                                className={`dash-filter-pill ${recentFilterMode === 'whiteboard' ? 'active' : ''}`}
                                onClick={() => setRecentFilterMode('whiteboard')}
                            >
                                🎨 Whiteboard
                            </button>
                            <button
                                className={`dash-filter-pill ${recentFilterMode === 'architecture' ? 'active' : ''}`}
                                onClick={() => setRecentFilterMode('architecture')}
                            >
                                📱 Wireframe & System
                            </button>
                            <button
                                className={`dash-filter-pill ${recentFilterMode === 'er' ? 'active' : ''}`}
                                onClick={() => setRecentFilterMode('er')}
                            >
                                🗄️ ER Diagram
                            </button>
                            <button
                                className={`dash-filter-pill ${recentFilterMode === 'notes' ? 'active' : ''}`}
                                onClick={() => setRecentFilterMode('notes')}
                            >
                                📝 Notes Board
                            </button>
                        </div>

                        {/* Recent Boards Grid */}
                        {filteredRecentBoards.length === 0 ? (
                            <div className="empty-state">
                                <Clock size={64} />
                                <h3>No matching recent boards</h3>
                                <p>Open a workspace or create a new board to start drawing.</p>
                                <button className="btn btn-primary" onClick={() => setActiveTab('workspaces')} style={{ marginTop: 'var(--space-md)' }}>
                                    Go to Workspaces
                                </button>
                            </div>
                        ) : (
                            <div className="dash-recent-full-grid">
                                {filteredRecentBoards.map((b) => {
                                    const meta = MODE_META[b.mode] || MODE_META.whiteboard;
                                    const ModeIcon = meta.icon;
                                    return (
                                        <div
                                            key={b._id}
                                            className="dash-board-card"
                                            onClick={() => navigate(`/board/${b._id}`)}
                                        >
                                            <div>
                                                <div className="dash-board-card-top">
                                                    <span
                                                        className="dash-board-mode-badge"
                                                        style={{ background: `${meta.color}20`, color: meta.color }}
                                                    >
                                                        <ModeIcon size={13} /> {meta.label}
                                                    </span>
                                                    <span className="dash-board-ws-tag">{b.workspaceName}</span>
                                                </div>
                                                <h3 className="dash-board-title">{b.name}</h3>
                                            </div>

                                            <div className="dash-board-card-footer">
                                                <span>Edited {formatDate(b.updatedAt || b.createdAt)}</span>
                                                <span style={{ color: 'var(--violet)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    Open <ArrowRight size={13} />
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ══════════════════════════════════════════
                   TAB 3: SETTINGS & PREFERENCES
                   ══════════════════════════════════════════ */}
                {activeTab === 'settings' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                        <div className="dashboard-header">
                            <div>
                                <h1 className="dashboard-title">Settings & Preferences</h1>
                                <p className="dashboard-subtitle">Manage your profile, canvas behavior, appearance, and AI configurations.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveSettings} className="settings-grid">
                            {/* Card 1: User Profile */}
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <Users size={20} />
                                    <h3>User Profile</h3>
                                </div>
                                <div className="avatar-preview-row">
                                    <div className="avatar-preview-badge" style={{ background: getAvatarColor(profileName) }}>
                                        {getInitials(profileName)}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink)' }}>{user?.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{user?.email}</div>
                                    </div>
                                </div>

                                <div className="settings-field">
                                    <label>Display Name</label>
                                    <input
                                        className="settings-input"
                                        value={profileName}
                                        onChange={(e) => setProfileName(e.target.value)}
                                        placeholder="Your name"
                                    />
                                </div>

                                <div className="settings-field">
                                    <label>Registered Email</label>
                                    <input
                                        className="settings-input"
                                        value={user?.email || ''}
                                        disabled
                                        style={{ opacity: 0.65, cursor: 'not-allowed' }}
                                    />
                                </div>
                            </div>

                            {/* Card 2: Canvas Preferences */}
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <Sliders size={20} />
                                    <h3>Canvas & Drawing</h3>
                                </div>

                                <div className="settings-field">
                                    <label>Canvas Grid Background</label>
                                    <select
                                        className="settings-select"
                                        value={canvasGridStyle}
                                        onChange={(e) => setCanvasGridStyle(e.target.value)}
                                    >
                                        <option value="dots">Subtle Dot Matrix (Excalidraw Default)</option>
                                        <option value="grid">Engineering Graph Paper</option>
                                        <option value="blank">Clean Blank Canvas</option>
                                    </select>
                                </div>

                                <div className="settings-field">
                                    <label>Sketch Stroke Style</label>
                                    <select
                                        className="settings-select"
                                        value={sketchRoughness}
                                        onChange={(e) => setSketchRoughness(e.target.value)}
                                    >
                                        <option value="architect">Architect (Clean Precision)</option>
                                        <option value="sloppy">Excalidraw Classic (Playful Hand-drawn)</option>
                                        <option value="cartoonist">Cartoonist (Bold Organic Strokes)</option>
                                    </select>
                                </div>

                                <div className="settings-field">
                                    <label>Auto-Save Sync Rate</label>
                                    <select
                                        className="settings-select"
                                        value={autoSaveFreq}
                                        onChange={(e) => setAutoSaveFreq(e.target.value)}
                                    >
                                        <option value="instant">Real-Time Instant (Multiplayer sync)</option>
                                        <option value="3s">Every 3 Seconds</option>
                                        <option value="10s">Every 10 Seconds</option>
                                    </select>
                                </div>
                            </div>

                            {/* Card 3: AI Assistant Engine */}
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <Cpu size={20} />
                                    <h3>AI Diagram Studio</h3>
                                </div>

                                <div className="settings-field">
                                    <label>Active AI Model Engine</label>
                                    <select
                                        className="settings-select"
                                        value={aiEngine}
                                        onChange={(e) => setAiEngine(e.target.value)}
                                    >
                                        <option value="gemini">Google Gemini 2.0 Flash (Recommended)</option>
                                        <option value="openai">OpenAI GPT-4o Mini</option>
                                    </select>
                                </div>

                                <div style={{ background: 'rgba(102, 87, 217, 0.08)', padding: '12px 14px', borderRadius: 4, border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                                    <strong style={{ color: 'var(--ink)' }}>AI Diagram Capabilities:</strong> Prompts typed in whiteboard are automatically transformed into Excalidraw flowcharts, system architectures, and wireframes.
                                </div>
                            </div>

                            {/* Card 4: Security & Cache */}
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <Shield size={20} />
                                    <h3>Storage & Security</h3>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)' }}>Offline Canvas Cache</div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Clear local storage drafts & cache</div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={handleClearLocalCache}
                                        >
                                            <RefreshCw size={13} /> Clear Cache
                                        </button>
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)' }}>Active Session</div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Connected with JWT authentication</div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={logout}
                                            style={{ color: '#ef4444', fontWeight: 700 }}
                                        >
                                            <LogOut size={13} /> Sign Out
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Save Settings Action Bar */}
                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button type="submit" className="settings-btn-save">
                                    <Save size={16} />
                                    <span>Save All Preferences</span>
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </main>

            {/* ── Create Workspace Modal ── */}
            <AnimatePresence>
                {showCreate && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowCreate(false)}
                    >
                        <motion.div
                            className="modal"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2>Create Workspace</h2>
                            <form onSubmit={handleCreate} className="modal-form">
                                <div className="input-group">
                                    <label>Workspace Name</label>
                                    <input
                                        className="input"
                                        placeholder="My Team Workspace"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Description (optional)</label>
                                    <textarea
                                        className="input"
                                        rows={3}
                                        placeholder="A brief description..."
                                        value={newDesc}
                                        onChange={(e) => setNewDesc(e.target.value)}
                                    />
                                </div>
                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={creating}>
                                        {creating ? 'Creating...' : 'Create'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Notes Document (Paper Style Prompt) Modal */}
            <AnimatePresence>
                {showNotesModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowNotesModal(false)}
                    >
                        <motion.div
                            className="modal"
                            style={{ maxWidth: '520px' }}
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <div style={{ width: 40, height: 40, borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <NotebookPen size={22} color="#f59e0b" />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', margin: 0 }}>New Notes Document</h2>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Choose your digital paper template (Apple Notes / iPad style)</p>
                                </div>
                            </div>

                            <form onSubmit={handleCreateNotesDoc} className="modal-form">
                                <div className="input-group">
                                    <label>Document Title</label>
                                    <input
                                        className="input"
                                        placeholder="e.g. Physics Notes, Architecture Ideas, Sketchbook"
                                        value={notesTitle}
                                        onChange={(e) => setNotesTitle(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="input-group">
                                    <label>Choose Paper Style</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: 4 }}>
                                        {[
                                            { id: 'lined', label: '📝 Line wala Page (Ruled)', desc: 'Apple Notes ruled lines with red margin' },
                                            { id: 'plain', label: '📄 Plain Page (Blank)', desc: 'Clean white unlined A4 paper for free sketching' },
                                            { id: 'dots', label: '⚬ Dotted Grid', desc: 'Bullet journal dot matrix layout' },
                                            { id: 'grid', label: '▦ Graph Grid', desc: 'Engineering & math square grid' }
                                        ].map(item => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setNotesPaperStyle(item.id)}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'flex-start',
                                                    gap: 4,
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    border: notesPaperStyle === item.id ? '2px solid #f59e0b' : '1px solid var(--border)',
                                                    background: notesPaperStyle === item.id ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-secondary)',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: notesPaperStyle === item.id ? '#f59e0b' : 'var(--text)' }}>
                                                    {item.label}
                                                </span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                                                    {item.desc}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="modal-actions" style={{ marginTop: 16 }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowNotesModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" style={{ background: '#f59e0b', borderColor: '#d97706' }}>
                                        <NotebookPen size={15} /> Start Taking Notes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
