import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Check, Trash2, X, Plus } from 'lucide-react';
import { getComments, createComment, resolveComment, deleteComment, updateComment } from '../../api/comment.api';
import toast from 'react-hot-toast';
import '../../styles/comments.css';

export default function CommentsOverlay({ 
    boardId, 
    pageId, 
    stageScale, 
    stagePos, 
    effectiveUser, 
    activeTool, 
    draftCommentPos,
    onCancelDraft,
    onCommentCreated,
    socket
}) {
    const [comments, setComments] = useState([]);
    const [activeCommentId, setActiveCommentId] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [draftText, setDraftText] = useState('');
    const [dragInfo, setDragInfo] = useState(null);
    const popoverRef = useRef(null);

    const loadComments = async () => {
        try {
            const res = await getComments(boardId);
            setComments(res.data || []);
        } catch (err) {
            console.error('Failed to load comments:', err);
        }
    };

    useEffect(() => {
        if (boardId) loadComments();
    }, [boardId]);

    // Socket real-time comment synchronization
    useEffect(() => {
        if (!socket) return;

        const handleCommentCreated = (newComment) => {
            if (newComment.boardId === boardId) {
                setComments(prev => [...prev.filter(c => String(c._id) !== String(newComment._id)), newComment]);
            }
        };

        const handleCommentResolved = ({ commentId, resolved }) => {
            setComments(prev => prev.map(c => String(c._id) === String(commentId) ? { ...c, resolved } : c));
        };

        const handleCommentDeleted = ({ commentId }) => {
            setComments(prev => prev.filter(c => String(c._id) !== String(commentId) && String(c.parentComment) !== String(commentId)));
        };

        const handleCommentMoved = ({ commentId, x, y }) => {
            setComments(prev => prev.map(c => String(c._id) === String(commentId) ? { ...c, x, y } : c));
        };

        socket.on('comment:create', handleCommentCreated);
        socket.on('comment:resolve', handleCommentResolved);
        socket.on('comment:delete', handleCommentDeleted);
        socket.on('comment:move', handleCommentMoved);

        return () => {
            socket.off('comment:create', handleCommentCreated);
            socket.off('comment:resolve', handleCommentResolved);
            socket.off('comment:delete', handleCommentDeleted);
            socket.off('comment:move', handleCommentMoved);
        };
    }, [socket, boardId]);

    // Mouse drag listener for smooth comment pin repositioning
    useEffect(() => {
        if (!dragInfo) return;

        const handleMouseMove = (e) => {
            const dx = (e.clientX - dragInfo.startMouseX) / stageScale;
            const dy = (e.clientY - dragInfo.startMouseY) / stageScale;

            if (Math.hypot(dx, dy) > 3) {
                dragInfo.isMoved = true;
            }

            const newX = Math.round(dragInfo.initX + dx);
            const newY = Math.round(dragInfo.initY + dy);

            setComments(prev => prev.map(c => String(c._id) === String(dragInfo.id) ? { ...c, x: newX, y: newY } : c));
            socket?.emit('comment:move', { commentId: dragInfo.id, x: newX, y: newY });
        };

        const handleMouseUp = async (e) => {
            const dx = (e.clientX - dragInfo.startMouseX) / stageScale;
            const dy = (e.clientY - dragInfo.startMouseY) / stageScale;
            const finalX = Math.round(dragInfo.initX + dx);
            const finalY = Math.round(dragInfo.initY + dy);

            const targetId = dragInfo.id;
            const moved = dragInfo.isMoved;
            setDragInfo(null);

            if (moved) {
                try {
                    await updateComment(targetId, { x: finalX, y: finalY });
                } catch (err) {
                    console.error('Failed to update comment pos:', err);
                }
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragInfo, stageScale, socket]);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target) && !e.target.closest('.comment-pin-marker')) {
                setActiveCommentId(null);
                setReplyText('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCreateDraftComment = async () => {
        if (!draftText.trim() || !draftCommentPos) return;

        try {
            const res = await createComment({
                boardId,
                pageId,
                text: draftText.trim(),
                x: draftCommentPos.x,
                y: draftCommentPos.y,
            });

            const newComment = res.data;
            setComments(prev => [...prev, newComment]);
            socket?.emit('comment:create', newComment);

            setDraftText('');
            toast.success('Comment pinned!');
            if (onCommentCreated) onCommentCreated(newComment);
        } catch {
            toast.error('Failed to pin comment');
        }
    };

    const handleAddReply = async (parentComment) => {
        if (!replyText.trim()) return;

        try {
            const res = await createComment({
                boardId,
                pageId,
                text: replyText.trim(),
                parentComment: parentComment._id,
                elementId: parentComment.elementId,
                x: parentComment.x,
                y: parentComment.y,
            });

            const reply = res.data;
            setComments(prev => [...prev, reply]);
            socket?.emit('comment:create', reply);

            setReplyText('');
            toast.success('Reply added!');
        } catch {
            toast.error('Failed to send reply');
        }
    };

    const handleResolve = async (commentId) => {
        try {
            const res = await resolveComment(commentId);
            const resolvedState = res.data?.resolved ?? true;
            setComments(prev => prev.map(c => c._id === commentId ? { ...c, resolved: resolvedState } : c));
            socket?.emit('comment:resolve', { commentId, resolved: resolvedState });
            toast.success('Comment updated!');
        } catch {
            toast.error('Failed to update comment');
        }
    };

    const handleDelete = async (commentId) => {
        // Optimistically remove thread from UI state immediately
        setComments(prev => prev.filter(c => String(c._id) !== String(commentId) && String(c.parentComment) !== String(commentId)));
        setActiveCommentId(null);

        // Broadcast socket delete
        socket?.emit('comment:delete', { commentId });

        try {
            await deleteComment(commentId);
            toast.success('Comment deleted!');
        } catch (err) {
            console.error('Delete comment error:', err);
        }
    };

    const topLevelComments = comments.filter(c => !c.parentComment && (!c.pageId || c.pageId === pageId || c.page === pageId));

    return (
        <div className="comments-canvas-overlay">
            {/* Draft comment pin creation popover */}
            {draftCommentPos && activeTool === 'comment' && (
                <div 
                    className="comment-pin-container draft"
                    style={{ left: draftCommentPos.x * stageScale + stagePos.x, top: draftCommentPos.y * stageScale + stagePos.y }}
                >
                    <div className="comment-pin-marker active">
                        <MessageSquare size={16} fill="#ffffff" color="#ffffff" />
                    </div>

                    <div ref={popoverRef} className="comment-thread-popover glass draft-card">
                        <div className="popover-header">
                            <span className="popover-author">New Comment</span>
                            <button className="popover-btn" onClick={onCancelDraft}>
                                <X size={13} />
                            </button>
                        </div>
                        <div className="popover-content" style={{ padding: '8px 12px' }}>
                            <textarea
                                className="draft-comment-input"
                                placeholder="Type your comment..."
                                value={draftText}
                                onChange={(e) => setDraftText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleCreateDraftComment();
                                    }
                                }}
                                autoFocus
                                rows={2}
                                style={{
                                    width: '100%',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 6,
                                    color: '#fff',
                                    padding: '6px 8px',
                                    fontSize: 12,
                                    resize: 'none',
                                    outline: 'none'
                                }}
                            />
                        </div>
                        <div className="popover-footer" style={{ padding: '6px 12px', justifyContent: 'flex-end', gap: 6 }}>
                            <button className="exc-sel-btn" onClick={onCancelDraft} style={{ width: 'auto', height: 26, fontSize: 11 }}>
                                Cancel
                            </button>
                            <button 
                                className="exc-sel-btn"
                                onClick={handleCreateDraftComment}
                                disabled={!draftText.trim()}
                                style={{
                                    width: 'auto',
                                    height: 26,
                                    fontSize: 11,
                                    background: '#3b388e',
                                    color: '#fff'
                                }}
                            >
                                Post
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Pinned Comment Markers */}
            {topLevelComments.map((comment) => {
                const isPopoverOpen = activeCommentId === comment._id;
                const left = comment.x * stageScale + stagePos.x;
                const top = comment.y * stageScale + stagePos.y;
                const replies = comments.filter(c => c.parentComment === comment._id);

                return (
                    <div 
                        key={comment._id}
                        className="comment-pin-container"
                        style={{ left, top }}
                    >
                        <button 
                            className={`comment-pin-marker ${comment.resolved ? 'resolved' : ''} ${isPopoverOpen ? 'active' : ''}`}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setDragInfo({
                                    id: comment._id,
                                    startMouseX: e.clientX,
                                    startMouseY: e.clientY,
                                    initX: comment.x,
                                    initY: comment.y,
                                    isMoved: false
                                });
                            }}
                            onClick={() => {
                                if (!dragInfo?.isMoved) {
                                    setActiveCommentId(isPopoverOpen ? null : comment._id);
                                    setReplyText('');
                                }
                            }}
                            title={comment.text}
                        >
                            <MessageSquare size={16} fill="#ffffff" color="#ffffff" />
                            {replies.length > 0 && <span className="reply-count">{replies.length}</span>}
                        </button>

                        {isPopoverOpen && (
                            <div ref={popoverRef} className="comment-thread-popover glass">
                                <div className="popover-header">
                                    <span className="popover-author">{comment.user?.name || 'User'}</span>
                                    <div className="popover-actions">
                                        <button 
                                            className={`popover-btn resolve-btn ${comment.resolved ? 'active' : ''}`}
                                            onClick={() => handleResolve(comment._id)}
                                            title={comment.resolved ? 'Unresolve' : 'Mark as Resolved'}
                                        >
                                            <Check size={12} />
                                        </button>
                                        {(effectiveUser?._id === comment.user?._id || effectiveUser?.role === 'admin') && (
                                            <button 
                                                className="popover-btn delete-btn"
                                                onClick={() => handleDelete(comment._id)}
                                                title="Delete Thread"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                        <button className="popover-btn" onClick={() => setActiveCommentId(null)}>
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>

                                <div className="popover-content">
                                    <div className="comment-bubble main">
                                        <p>{comment.text}</p>
                                        <span className="comment-time">{comment.createdAt ? new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                    </div>

                                    {replies.map((reply) => (
                                        <div key={reply._id} className="comment-bubble reply">
                                            <div className="reply-meta">
                                                <span className="reply-author">{reply.user?.name || 'User'}</span>
                                                <span className="reply-time">{reply.createdAt ? new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                            </div>
                                            <p>{reply.text}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="popover-footer">
                                    <input 
                                        type="text"
                                        placeholder="Reply to thread..."
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddReply(comment)}
                                        className="reply-input"
                                    />
                                    <button 
                                        disabled={!replyText.trim()}
                                        onClick={() => handleAddReply(comment)}
                                        className="reply-send-btn"
                                    >
                                        <Send size={12} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Comment Tool Hint Banner */}
            {activeTool === 'comment' && !draftCommentPos && (
                <div className="comment-tool-hint">
                    <Plus size={14} /> Click anywhere on the canvas to pin a comment.
                </div>
            )}
        </div>
    );
}
