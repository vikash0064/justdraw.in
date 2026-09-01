import { useState, useEffect } from 'react';
import {
    Plus, MoreHorizontal, Copy, Trash2, ArrowUp, ArrowDown,
    Edit3, Check, FileText, X
} from 'lucide-react';

export default function NotesPageStrip({
    pages,
    activePageId,
    onSelectPage,
    onCreatePage,
    onDuplicatePage,
    onDeletePage,
    onRenamePage,
    onReorderPage,
    paperPattern = 'lined',
    isOpen,
    onClose,
}) {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuAnchor, setMenuAnchor] = useState(null);

    // Close context menu when clicking outside or pressing Escape
    useEffect(() => {
        const handleOutside = () => setOpenMenuId(null);
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setOpenMenuId(null);
        };
        if (openMenuId) {
            window.addEventListener('click', handleOutside);
            window.addEventListener('keydown', handleKeyDown);
            return () => {
                window.removeEventListener('click', handleOutside);
                window.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [openMenuId]);

    const startEditing = (p) => {
        setEditingId(p._id);
        setEditName(p.name || `Page ${pages.findIndex(x => x._id === p._id) + 1}`);
        setOpenMenuId(null);
    };

    const handleSaveName = (id) => {
        if (editName.trim()) {
            onRenamePage(id, editName.trim());
        }
        setEditingId(null);
    };

    if (!isOpen) return null;

    return (
        <aside className="notes-page-strip">
            <div className="notes-strip-header">
                <div className="notes-strip-title">
                    <FileText size={14} color="#f59e0b" />
                    <span>Pages ({pages.length})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                        className="notes-add-page-btn"
                        onClick={onCreatePage}
                        title="Add New A4 Page"
                    >
                        <Plus size={16} />
                    </button>
                    <button
                        className="btn btn-ghost btn-icon sm"
                        onClick={onClose}
                        style={{ width: 22, height: 22, padding: 0 }}
                        title="Close page gallery"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            <div className="notes-strip-list">
                {pages.map((p, idx) => {
                    const isActive = p._id === activePageId;
                    const isEditing = editingId === p._id;
                    const isMenuOpen = openMenuId === p._id;

                    return (
                        <div
                            key={p._id}
                            className={`notes-thumb-card ${isActive ? 'active' : ''}`}
                            onClick={() => onSelectPage(p._id, idx)}
                        >
                            {/* Miniature A4 Sheet Preview */}
                            <div className={`notes-thumb-paper ${paperPattern === 'lined' ? 'lined-preview' : ''}`}>
                                <div className="thumb-scribble" style={{ width: '70%' }} />
                                <div className="thumb-highlighter" style={{ width: '85%' }} />
                                <div className="thumb-scribble" style={{ width: '50%' }} />
                                <div className="thumb-scribble" style={{ width: '65%' }} />
                                {idx % 2 === 0 && <div className="thumb-sticky" />}
                            </div>

                            {/* Page Name or Edit Input */}
                            {isEditing ? (
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', marginTop: 4 }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <input
                                        className="input sm"
                                        style={{ fontSize: '10px', padding: '2px 4px', height: 22 }}
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName(p._id)}
                                        autoFocus
                                    />
                                    <button
                                        className="btn btn-primary sm"
                                        style={{ padding: '2px 6px', height: 22 }}
                                        onClick={() => handleSaveName(p._id)}
                                    >
                                        <Check size={10} />
                                    </button>
                                </div>
                            ) : (
                                <span className="notes-thumb-label" title={p.name || `Page ${idx + 1}`}>
                                    {p.name || `Page ${idx + 1}`}
                                </span>
                            )}

                            {/* 3-Dots Menu Button */}
                            <div className="notes-thumb-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                    className="notes-thumb-menu-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (openMenuId === p._id) {
                                            setOpenMenuId(null);
                                        } else {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setMenuAnchor({
                                                top: Math.max(12, Math.min(window.innerHeight - 165, rect.top - 4)),
                                                left: rect.right + 8
                                            });
                                            setOpenMenuId(p._id);
                                        }
                                    }}
                                    title="Page Options"
                                >
                                    <MoreHorizontal size={13} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Context Action Menu (Flies out to the SIDE, never on top of thumbnail) */}
            {openMenuId && menuAnchor && (
                <div
                    className="notes-page-context-menu"
                    style={{
                        position: 'fixed',
                        top: menuAnchor.top,
                        left: menuAnchor.left,
                        zIndex: 999999,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {(() => {
                        const pIdx = pages.findIndex(x => x._id === openMenuId);
                        const p = pages[pIdx];
                        if (!p) return null;
                        return (
                            <>
                                <button
                                    className="notes-context-item"
                                    onClick={() => startEditing(p)}
                                >
                                    <Edit3 size={12} />
                                    <span>Rename</span>
                                </button>
                                <button
                                    className="notes-context-item"
                                    onClick={() => {
                                        onDuplicatePage(p._id);
                                        setOpenMenuId(null);
                                    }}
                                >
                                    <Copy size={12} />
                                    <span>Duplicate</span>
                                </button>
                                {pIdx > 0 && (
                                    <button
                                        className="notes-context-item"
                                        onClick={() => {
                                            onReorderPage(p._id, 'up');
                                            setOpenMenuId(null);
                                        }}
                                    >
                                        <ArrowUp size={12} />
                                        <span>Move Up</span>
                                    </button>
                                )}
                                {pIdx < pages.length - 1 && (
                                    <button
                                        className="notes-context-item"
                                        onClick={() => {
                                            onReorderPage(p._id, 'down');
                                            setOpenMenuId(null);
                                        }}
                                    >
                                        <ArrowDown size={12} />
                                        <span>Move Down</span>
                                    </button>
                                )}
                                {pages.length > 1 && (
                                    <button
                                        className="notes-context-item danger"
                                        onClick={() => {
                                            onDeletePage(p._id);
                                            setOpenMenuId(null);
                                        }}
                                    >
                                        <Trash2 size={12} />
                                        <span>Delete</span>
                                    </button>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}
        </aside>
    );
}
