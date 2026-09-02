import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Stage, Layer, Line, Rect, Circle, Text, Arrow, Transformer, Group, Path, Shape, Image as KonvaImage } from 'react-konva';
import rough from 'roughjs';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Pencil, Eraser, Square, Circle as CircleIcon,
    Type, MousePointer, ArrowUpRight, Undo2, Redo2,
    Download, FileImage, Plus, Trash2, MessageSquareText,
    Send, X, Move, Users, ZoomIn, ZoomOut, Video,
    Database, Link2, StickyNote, Paintbrush, GitBranch,
    LayoutGrid, Copy, Paperclip, Sun, Moon, Share2, Sparkles, Code,
    Diamond, Minus, MoreHorizontal, HelpCircle, Maximize2, Minimize2,
    ShieldCheck, Sliders, Library, PanelRight, Pin, Radio, FolderKanban, Search,
    Folder, Zap, LogIn, LogOut, Globe, ChevronRight, Monitor, Presentation,
    AlignLeft, AlignCenter, AlignRight, ArrowDownToLine, ArrowDown, ArrowUp, ArrowUpToLine, Home,
    FileText, ChevronDown, Hand, GripVertical, Palette
} from 'lucide-react';
import { getBoard, getBoards } from '../api/board.api';
import { getPages, createPage, updatePage, deletePage } from '../api/page.api';
import { uploadFile } from '../api/upload.api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getInitials, getAvatarColor, formatTime } from '../utils/helpers';
import ShapeLibrary from '../components/canvas/ShapeLibrary';
import EREntity from '../components/canvas/EREntity';
import CommentsOverlay from '../components/canvas/CommentsOverlay';
import MoreToolsMenu from '../components/canvas/MoreToolsMenu';
import LaserPointerOverlay from '../components/canvas/LaserPointerOverlay';

// Helper for lazy loading with automatic retry/reload on new deployment
const lazyWithRetry = (componentImport) =>
    lazy(async () => {
        try {
            return await componentImport();
        } catch (error) {
            const hasReloaded = sessionStorage.getItem('chunk_reload_lock');
            if (!hasReloaded) {
                sessionStorage.setItem('chunk_reload_lock', '1');
                console.warn('[BoardPage] Stale chunk detected due to new deploy. Reloading page...');
                window.location.reload();
                return new Promise(() => {}); // pause execution until page reloads
            }
            throw error;
        }
    });

// Lazy-loaded heavy components for ultra-fast initial board render with deploy auto-recovery
const EREditModal = lazyWithRetry(() => import('../components/canvas/EREditModal'));
const VideoCall = lazyWithRetry(() => import('../components/canvas/VideoCall'));
const AIChatPanel = lazyWithRetry(() => import('../components/canvas/AIChatPanel'));
const PresentationMode = lazyWithRetry(() => import('../components/canvas/PresentationMode'));
const WireframeToCodeModal = lazyWithRetry(() => import('../components/canvas/WireframeToCodeModal'));
const MermaidModal = lazyWithRetry(() => import('../components/canvas/MermaidModal'));
const AIDiagramModal = lazyWithRetry(() => import('../components/canvas/AIDiagramModal'));
const WebEmbedModal = lazyWithRetry(() => import('../components/canvas/WebEmbedModal'));

import { recognizeShapeFromPoints } from '../utils/shapeRecognizer';
import { createComment } from '../api/comment.api';

import '../styles/presentation.css';
import '../styles/comments.css';
import '../styles/wireframe-modal.css';
import '../styles/board-excalidraw.css';
import ExcalidrawLoader from '../components/common/ExcalidrawLoader';
import { ARCH_ICONS } from '../utils/archIcons';
import toast from 'react-hot-toast';
import NotesMarkupToolbar from '../components/canvas/NotesMarkupToolbar';
import NotesPageStrip from '../components/canvas/NotesPageStrip';
import '../styles/notes-board.css';

/* ─── Tool definitions ─── */
const TOOLS = [
    { id: 'pan', label: 'Hand', key: 'H' },
    { id: 'select', label: 'Selection', key: '1' },
    { id: 'rect', label: 'Rectangle', key: '2' },
    { id: 'diamond', label: 'Diamond', key: '3' },
    { id: 'circle', label: 'Ellipse', key: '4' },
    { id: 'arrow', label: 'Arrow', key: '5' },
    { id: 'line', label: 'Line', key: '6' },
    { id: 'pencil', label: 'Draw', key: '7' },
    { id: 'text', label: 'Text', key: '8' },
    { id: 'image', label: 'Image', key: '9' },
    { id: 'eraser', label: 'Eraser', key: '0' }
];

const COLORS = ['#f1f5f9', '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const SIZES = [2, 4, 6, 10, 16];

const genId = () => 'shape_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);

function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// Custom shapes logo icon replacing standard book-shelf icon
const ShapesLogoIcon = ({ size = 16, className, style }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={className}
        style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 0, ...style }}
    >
        <circle cx="6" cy="6" r="4.2" fill="currentColor" />
        <rect x="13.5" y="2" width="8.5" height="8.5" rx="2" fill="currentColor" />
        <path d="M 6 13.5 L 10.5 22 L 1.5 22 Z" fill="currentColor" />
        <circle cx="18" cy="18" r="4.2" fill="currentColor" />
    </svg>
);


const roughGenerator = rough.generator();

function renderRoughPath(ctx, svgPath, options = {}) {
    if (!svgPath || !ctx) return;
    try {
        const drawable = roughGenerator.path(svgPath, {
            stroke: options.stroke || '#ffffff',
            strokeWidth: options.strokeWidth || 2,
            roughness: options.roughness !== undefined ? options.roughness : 1.2,
            bowing: 1.5,
            seed: options.seed || 1,
            strokeLineDash: options.strokeLineDash
        });
        ctx.save();
        ctx.strokeStyle = options.stroke || '#ffffff';
        ctx.lineWidth = options.strokeWidth || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (options.strokeLineDash && ctx.setLineDash) {
            ctx.setLineDash(options.strokeLineDash);
        }
        for (const set of drawable.sets) {
            if (set.type === 'path') {
                ctx.beginPath();
                for (const op of set.ops) {
                    if (op.op === 'move') ctx.moveTo(op.data[0], op.data[1]);
                    else if (op.op === 'lineTo') ctx.lineTo(op.data[0], op.data[1]);
                    else if (op.op === 'bcurveTo') ctx.bezierCurveTo(op.data[0], op.data[1], op.data[2], op.data[3], op.data[4], op.data[5]);
                    else if (op.op === 'qcurveTo') ctx.quadraticCurveTo(op.data[0], op.data[1], op.data[2], op.data[3]);
                }
                ctx.stroke();
            }
        }
        ctx.restore();
    } catch (e) {
        // Fallback
    }
}

function getArrowheadPath(tipX, tipY, angle, size = 18) {
    const angle1 = angle + Math.PI - 0.44;
    const angle2 = angle + Math.PI + 0.44;
    const p1x = tipX + size * Math.cos(angle1);
    const p1y = tipY + size * Math.sin(angle1);
    const p2x = tipX + size * Math.cos(angle2);
    const p2y = tipY + size * Math.sin(angle2);
    return `M ${p1x} ${p1y} L ${tipX} ${tipY} L ${p2x} ${p2y}`;
}

function getArrowData(points, arrowType, customMidX, bendPoint, customSeg1Y, customSeg2Y) {
    if (!points || points.length < 4) return { path: '', arrowheadPath: '', midHandles: [], x1: 0, y1: 0, x2: 0, y2: 0 };
    const x1 = points[0], y1 = points[1];
    const x2 = points[points.length - 2], y2 = points[points.length - 1];
    const type = arrowType || 'straight';

    if (type === 'elbow') {
        const midX = customMidX !== undefined ? customMidX : ((x1 + x2) / 2);
        const seg1Y = customSeg1Y !== undefined ? customSeg1Y : y1;
        const seg2Y = customSeg2Y !== undefined ? customSeg2Y : y2;

        const pts = [];
        pts.push({ x: x1, y: y1 });
        if (Math.abs(seg1Y - y1) > 4) {
            pts.push({ x: x1, y: seg1Y });
        }
        pts.push({ x: midX, y: seg1Y });
        pts.push({ x: midX, y: seg2Y });
        if (Math.abs(seg2Y - y2) > 4) {
            pts.push({ x: x2, y: seg2Y });
        }
        pts.push({ x: x2, y: y2 });

        // Build smooth rounded corner path
        let path = `M ${pts[0].x} ${pts[0].y}`;
        const r = 16;
        for (let i = 1; i < pts.length - 1; i++) {
            const pPrev = pts[i - 1];
            const pCurr = pts[i];
            const pNext = pts[i + 1];

            const d1 = Math.hypot(pCurr.x - pPrev.x, pCurr.y - pPrev.y);
            const d2 = Math.hypot(pNext.x - pCurr.x, pNext.y - pCurr.y);
            const cornerR = Math.max(0, Math.min(r, d1 / 2, d2 / 2));

            if (cornerR < 2) {
                path += ` L ${pCurr.x} ${pCurr.y}`;
            } else {
                const v1x = (pPrev.x - pCurr.x) / (d1 || 1);
                const v1y = (pPrev.y - pCurr.y) / (d1 || 1);
                const v2x = (pNext.x - pCurr.x) / (d2 || 1);
                const v2y = (pNext.y - pCurr.y) / (d2 || 1);

                const startX = pCurr.x + v1x * cornerR;
                const startY = pCurr.y + v1y * cornerR;
                const endX = pCurr.x + v2x * cornerR;
                const endY = pCurr.y + v2y * cornerR;

                path += ` L ${startX} ${startY} Q ${pCurr.x} ${pCurr.y} ${endX} ${endY}`;
            }
        }
        path += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;

        const lastP = pts[pts.length - 1];
        const prevP = pts[pts.length - 2];
        const angle = Math.atan2(lastP.y - prevP.y, lastP.x - prevP.x);
        const arrowheadPath = getArrowheadPath(x2, y2, angle, 16);

        const midHandles = [
            { x: (x1 + midX) / 2, y: seg1Y, id: 'h1', isSegment: true, type: 'seg1' },
            { x: midX, y: (seg1Y + seg2Y) / 2, id: 'mid', isMain: true, type: 'elbowMid' },
            { x: (midX + x2) / 2, y: seg2Y, id: 'h2', isSegment: true, type: 'seg2' }
        ];

        return { path, arrowheadPath, midHandles, x1, y1, x2, y2, angle, midX };
    }

    if (type === 'curved' || bendPoint) {
        let hx, hy, cx, cy;
        if (bendPoint && bendPoint.x !== undefined) {
            hx = bendPoint.x;
            hy = bendPoint.y;
            cx = 2 * hx - 0.5 * (x1 + x2);
            cy = 2 * hy - 0.5 * (y1 + y2);
        } else {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy);
            const nx = -dy / (len || 1);
            const ny = dx / (len || 1);
            const defaultOffset = type === 'curved' ? (len * 0.18) : 0;
            cx = (x1 + x2) / 2 + nx * defaultOffset;
            cy = (y1 + y2) / 2 + ny * defaultOffset;
            hx = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
            hy = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
        }

        const path = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
        const angle = Math.atan2(y2 - cy, x2 - cx);
        const arrowheadPath = getArrowheadPath(x2, y2, angle, 16);

        const midHandles = [
            { x: hx, y: hy, id: 'bend', isMain: true, type: 'bend', cx, cy }
        ];

        return { path, arrowheadPath, midHandles, x1, y1, x2, y2, angle, cx, cy };
    }

    // Straight: middle handle in center that allows immediate bending
    const path = `M ${x1} ${y1} L ${x2} ${y2}`;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowheadPath = getArrowheadPath(x2, y2, angle, 16);
    const midHandles = [
        { x: (x1 + x2) / 2, y: (y1 + y2) / 2, id: 'bend', isMain: true, type: 'bend' }
    ];

    return { path, arrowheadPath, midHandles, x1, y1, x2, y2, angle };
}

const URLImage = ({ shape, isSelected, onSelect, onDragEnd }) => {
    const [image, setImage] = useState(null);
    useEffect(() => {
        const img = new window.Image();
        img.src = shape.url;
        img.onload = () => setImage(img);
    }, [shape.url]);

    return (
        <Group x={shape.x} y={shape.y} draggable={true} onClick={onSelect} onTap={onSelect} onDragEnd={onDragEnd}>
            {isSelected && <Rect x={-4} y={-4} width={(shape.width || 100) + 8} height={(shape.height || 100) + 8} stroke="#6965db" strokeWidth={2} dash={[4, 2]} />}
            {image && <KonvaImage image={image} width={shape.width || image.width} height={shape.height || image.height} />}
        </Group>
    );
};

export default function BoardPage() {
    const { id: boardId } = useParams();
    const navigate = useNavigate();
    const socket = useSocket();
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();

    // Guest fallback — anonymous users who joined via room code
    const guestName = sessionStorage.getItem('guestName');
    const guestEmail = sessionStorage.getItem('guestEmail');
    // Unique guest ID persisted in sessionStorage so it stays consistent across re-renders
    const getGuestId = () => {
        let gid = sessionStorage.getItem('guestId');
        if (!gid) {
            gid = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
            sessionStorage.setItem('guestId', gid);
        }
        return gid;
    };
    const effectiveUser = user || (guestName ? { _id: getGuestId(), name: guestName, email: guestEmail || '' } : null);

    const [board, setBoard] = useState(null);
    const isArchMode = board?.mode === 'architecture';
    const isERMode = board?.mode === 'er';
    const isNotesMode = board?.mode === 'notes';
    const isWhiteboard = !isArchMode && !isERMode && !isNotesMode;
    const [workspaceBoards, setWorkspaceBoards] = useState([]);
    const [pages, setPages] = useState([]);
    const [activePageId, setActivePageId] = useState(null);
    const activePageIdRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [isArchLibOpen, setIsArchLibOpen] = useState(true);

    // Canvas state
    const [tool, setTool] = useState('pencil');
    const [color, setColor] = useState(() => board?.mode === 'notes' ? '#0f172a' : '#ffffff');
    const [bgColor, setBgColor] = useState('transparent');
    const [brushSize, setBrushSize] = useState(4);

    useEffect(() => {
        if (isNotesMode) {
            setColor('#0f172a');
            setTool('pencil');
        }
    }, [isNotesMode]);
    const [pressure, setPressure] = useState('constant');
    const [opacity, setOpacity] = useState(100);
    const [palmRejection, setPalmRejection] = useState(true);
    const [usePressure, setUsePressure] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [activeRightTab, setActiveRightTab] = useState(null); // 'search' | 'library' | 'chat' | 'studio' | 'ai' | 'export' | null
    const [canvasSearchQuery, setCanvasSearchQuery] = useState('');
    const [isDockPinned, setIsDockPinned] = useState(false);
    const [strokeStyle, setStrokeStyle] = useState('solid');
    const [fillStyle, setFillStyle] = useState('solid');
    const [sloppiness, setSloppiness] = useState('artist');
    const [edges, setEdges] = useState('round');
    const [arrowType, setArrowType] = useState('straight'); // 'straight' | 'curved' | 'elbow'
    const [arrowhead, setArrowhead] = useState('arrow'); // 'none' | 'arrow'
    const [fontSize, setFontSize] = useState(20);
    const [fontFamily, setFontFamily] = useState('Virgil');
    const [textAlign, setTextAlign] = useState('left');
    const [toolLock, setToolLock] = useState(false);
    const [eraserTrail, setEraserTrail] = useState([]);
    const [laserTrail, setLaserTrail] = useState([]);
    const [laserDot, setLaserDot] = useState(null);
    const [remoteLasers, setRemoteLasers] = useState({});
    const [lassoPoints, setLassoPoints] = useState([]);
    const [eraserPos, setEraserPos] = useState(null);
    const [eraserSize, setEraserSize] = useState(24); // 12 (S), 24 (M), 44 (L), 72 (XL)
    const [showEraserMenu, setShowEraserMenu] = useState(false);
    const [showNotesPages, setShowNotesPages] = useState(false);
    const [draftCommentPos, setDraftCommentPos] = useState(null);
    const [showMoreTools, setShowMoreTools] = useState(false);
    const [showMermaidModal, setShowMermaidModal] = useState(false);
    const [showAIDiagramModal, setShowAIDiagramModal] = useState(false);
    const [showWebEmbedModal, setShowWebEmbedModal] = useState(false);
    const [canvasBg, setCanvasBg] = useState('#121212');
    const [showMainMenu, setShowMainMenu] = useState(false);
    const [activePicker, setActivePicker] = useState(null); // 'stroke' | 'background' | null
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [language, setLanguage] = useState('English');
    const [themeMode, setThemeMode] = useState('dark');
    const [showPreferences, setShowPreferences] = useState(false);
    const [isDockFullscreen, setIsDockFullscreen] = useState(false);
    const [cmdQuery, setCmdQuery] = useState('');
    const [showMobileSheet, setShowMobileSheet] = useState(false);
    const [isPropsPanelMinimized, setIsPropsPanelMinimized] = useState(false);
    const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
    const [isTabletOrMobile, setIsTabletOrMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 1023);
    const pickerTimeoutRef = useRef(null);
    const touchStateRef = useRef({ dist: 0, scale: 1, pos: { x: 0, y: 0 }, center: { x: 0, y: 0 } });
    const activePenPointerIdRef = useRef(null);
    const lastPenTimeRef = useRef(0);
    const lastPointerDownTimeRef = useRef(0);

    const toggleFullscreen = useCallback(() => {
        const docEl = document.documentElement;
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        if (!fsEl) {
            const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.webkitRequestFullScreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
            if (req) {
                req.call(docEl).then(() => {
                    setIsFullscreen(true);
                    toast.success('Entered Full Screen Mode', { duration: 1800 });
                }).catch(err => {
                    toast.error('Fullscreen not available: ' + err.message);
                });
            } else {
                toast.error('Fullscreen not supported on this browser');
            }
        } else {
            const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (exit) {
                exit.call(document).then(() => {
                    setIsFullscreen(false);
                });
            }
        }
    }, []);

    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalOverflow;
            document.documentElement.style.overflow = '';
        };
    }, []);

    useEffect(() => {
        const handleFSChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
            setIsTabletOrMobile(window.innerWidth <= 1023);
            setStageSize({
                width: window.innerWidth,
                height: window.innerHeight - 56
            });
        };
        document.addEventListener('fullscreenchange', handleFSChange);
        window.addEventListener('resize', handleFSChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFSChange);
            window.removeEventListener('resize', handleFSChange);
        };
    }, []);

    const handlePickerMouseEnter = (type) => {
        if (pickerTimeoutRef.current) clearTimeout(pickerTimeoutRef.current);
        setActivePicker(type);
    };

    const handlePickerMouseLeave = () => {
        if (pickerTimeoutRef.current) clearTimeout(pickerTimeoutRef.current);
        pickerTimeoutRef.current = setTimeout(() => {
            setActivePicker(null);
        }, 300);
    };
    const [lines, setLines] = useState([]);
    const [shapes, setShapes] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [searchParams] = useSearchParams();
    const urlPattern = searchParams.get('pattern');
    const [paperPattern, setPaperPattern] = useState(() => urlPattern || 'lined');

    useEffect(() => {
        if (urlPattern) setPaperPattern(urlPattern);
    }, [urlPattern]);

    // Dynamically adjust primary ink color for light mode contrast
    const activeColors = [
        theme === 'light' ? '#0f172a' : '#f1f5f9',
        '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'
    ];

    // Migrate brush color on theme swap to prevent drawing with invisible ink
    useEffect(() => {
        if (isNotesMode) return; // Keep black ink on white A4 paper
        if (theme === 'light' && color === '#f1f5f9') setColor('#0f172a');
        if (theme === 'dark' && color === '#0f172a') setColor('#f1f5f9');
    }, [theme, color, isNotesMode]);

    // ── History (undo/redo) — ref-based to avoid stale closures ──
    const [historyLen, setHistoryLen] = useState(0); // trigger re-renders
    const [historyIdx, setHistoryIdx] = useState(-1);
    const historyRef = useRef([]);
    const linesRef = useRef([]);
    const shapesRef = useRef([]);

    // Keep refs in sync with state
    useEffect(() => { linesRef.current = lines; }, [lines]);
    useEffect(() => { shapesRef.current = shapes; }, [shapes]);
    useEffect(() => { activePageIdRef.current = activePageId; }, [activePageId]);

    // Shape creation by dragging
    const [drawingShape, setDrawingShape] = useState(null);

    // ── Multi-select: Set of IDs ──
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Determine if the selected shape is a card type (ER table or Architecture component)
    const isCardSelected = useMemo(() => {
        if (selectedIds.size !== 1) return false;
        const selectedId = [...selectedIds][0];
        const shape = shapes.find(s => s.id === selectedId);
        return shape && (shape.type === 'er-entity' || shape.type === 'er-table' || shape.type === 'arch-icon');
    }, [selectedIds, shapes]);

    // ── Inline text editing (no more prompt!) ──
    const [editingText, setEditingText] = useState(null); // { id, x, y, width, height, value, type }
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

    // ER edit modal
    const [editingERShape, setEditingERShape] = useState(null);

    // Stage transform
    const [stageScale, setStageScale] = useState(1);
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

    // Chat
    const [showChat, setShowChat] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');

    const [showVideo, setShowVideo] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [showWireframeModal, setShowWireframeModal] = useState(false);
    const [isPresentationActive, setIsPresentationActive] = useState(false);
    const [commentsVersion, setCommentsVersion] = useState(0);

    const handleAddCanvasComment = async (x, y) => {
        const text = prompt('Enter your comment:');
        if (!text?.trim()) return;

        try {
            await createComment({
                boardId,
                pageId: activePageId,
                x,
                y,
                text: text.trim(),
            });
            toast.success('Comment pinned!');
            setCommentsVersion(prev => prev + 1);
            setTool('select');
        } catch (err) {
            console.error(err);
            toast.error('Failed to create comment');
        }
    };

    // Recording
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    // Presence
    const [remoteCursors, setRemoteCursors] = useState({});
    const [onlineUsers, setOnlineUsers] = useState([]);

    // Track remote user strokes by userId → line index for multi-user drawing
    const remoteStrokesRef = useRef({});

    const stageRef = useRef(null);
    const containerRef = useRef(null);
    const trRef = useRef(null);
    const [stageSize, setStageSize] = useState(() => ({
        width: typeof window !== 'undefined' ? window.innerWidth : 800,
        height: typeof window !== 'undefined' ? window.innerHeight - 56 : 600
    }));

    // Horizontally center A4 paper sheet in viewport (tablet and desktop)
    const notesPageX = useMemo(() => {
        return Math.max(20, Math.round((stageSize.width - 800) / 2));
    }, [stageSize.width]);

    // Auto-fit A4 sheet scale on compact tablet screens
    useEffect(() => {
        if (isNotesMode && typeof window !== 'undefined' && window.innerWidth < 850) {
            const fitScale = Math.min(1, Math.max(0.65, (window.innerWidth - 32) / 800));
            setStageScale(Number(fitScale.toFixed(2)));
        }
    }, [isNotesMode]);

    // ── BUG FIX 1: Page data ref-map — avoids stale closure issues ──
    const pageDataRef = useRef({}); // { pageId: { drawings, elements } }

    // ── History (undo/redo) actions — declared early to avoid TDZ ReferenceErrors ──
    const pushHistory = useCallback(() => {
        const state = {
            lines: JSON.parse(JSON.stringify(linesRef.current)),
            shapes: JSON.parse(JSON.stringify(shapesRef.current)),
        };
        const currentIdx = historyRef.current.length > 0 ? historyRef.current._idx ?? historyRef.current.length - 1 : -1;
        const newHistory = historyRef.current.slice(0, currentIdx + 1);
        newHistory.push(state);
        // Limit history to 50 entries
        if (newHistory.length > 50) newHistory.shift();
        historyRef.current = newHistory;
        historyRef.current._idx = newHistory.length - 1;
        setHistoryIdx(newHistory.length - 1);
        setHistoryLen(newHistory.length);
    }, []);

    const undo = useCallback(() => {
        const idx = historyRef.current._idx ?? historyRef.current.length - 1;
        if (idx <= 0) return;
        const prevIdx = idx - 1;
        const prev = historyRef.current[prevIdx];
        if (!prev) return;
        setLines(prev.lines);
        setShapes(prev.shapes);
        historyRef.current._idx = prevIdx;
        setHistoryIdx(prevIdx);
    }, []);

    const redo = useCallback(() => {
        const idx = historyRef.current._idx ?? historyRef.current.length - 1;
        if (idx >= historyRef.current.length - 1) return;
        const nextIdx = idx + 1;
        const next = historyRef.current[nextIdx];
        if (!next) return;
        setLines(next.lines);
        setShapes(next.shapes);
        historyRef.current._idx = nextIdx;
        setHistoryIdx(nextIdx);
    }, []);

    // ── Helper to update properties of all selected shapes ──
    const updateSelectedShapes = useCallback((updates) => {
        if (selectedIds.size === 0) return;
        setShapes(prev => prev.map(s => {
            if (selectedIds.has(s.id)) {
                const resolvedUpdates = typeof updates === 'function' ? updates(s) : updates;
                const updated = { ...s, ...resolvedUpdates };
                socket?.emit('shape:update', { boardId, pageId: activePageId, shapeId: s.id, updates: resolvedUpdates });
                return updated;
            }
            return s;
        }));
        setTimeout(() => pushHistory(), 0);
    }, [selectedIds, boardId, activePageId, socket, pushHistory]);

    // ── Update Arrow & Line Handles (Start, Middle Bend, End) ──
    const handleUpdateArrowHandle = useCallback((id, updates) => {
        setShapes(prev => prev.map(s => {
            if (s.id === id) {
                const updated = { ...s, ...updates };
                socket?.emit('shape:update', { boardId, pageId: activePageId, shapeId: id, updates });
                return updated;
            }
            return s;
        }));
    }, [boardId, activePageId, socket]);

    // ── Layer Z-Index controls ──
    const sendToBack = () => {
        if (selectedIds.size === 0) return;
        setShapes(prev => {
            const sel = prev.filter(s => selectedIds.has(s.id));
            const unsel = prev.filter(s => !selectedIds.has(s.id));
            return [...sel, ...unsel];
        });
        setTimeout(() => pushHistory(), 0);
    };

    const sendBackward = () => {
        if (selectedIds.size === 0) return;
        setShapes(prev => {
            const arr = [...prev];
            selectedIds.forEach(id => {
                const idx = arr.findIndex(s => s.id === id);
                if (idx > 0) {
                    const temp = arr[idx];
                    arr[idx] = arr[idx - 1];
                    arr[idx - 1] = temp;
                }
            });
            return arr;
        });
        setTimeout(() => pushHistory(), 0);
    };

    const bringForward = () => {
        if (selectedIds.size === 0) return;
        setShapes(prev => {
            const arr = [...prev];
            for (let i = arr.length - 1; i >= 0; i--) {
                if (selectedIds.has(arr[i].id) && i < arr.length - 1) {
                    const temp = arr[i];
                    arr[i] = arr[i + 1];
                    arr[i + 1] = temp;
                }
            }
            return arr;
        });
        setTimeout(() => pushHistory(), 0);
    };

    const bringToFront = () => {
        if (selectedIds.size === 0) return;
        setShapes(prev => {
            const sel = prev.filter(s => selectedIds.has(s.id));
            const unsel = prev.filter(s => !selectedIds.has(s.id));
            return [...unsel, ...sel];
        });
        setTimeout(() => pushHistory(), 0);
    };

    const clearPage = useCallback(async () => {
        setLines([]);
        setShapes([]);
        setSelectedIds(new Set());
        setEraserTrail([]);
        setLaserTrail([]);
        setEditingText(null);
        setEditingERShape(null);

        if (activePageId) {
            pageDataRef.current[activePageId] = { drawings: [], elements: [] };
            try {
                await updatePage(activePageId, { drawings: [], elements: [] });
            } catch { }
        }

        socket?.emit('draw:clear', { boardId, pageId: activePageId });

        setTimeout(() => {
            const snap = { lines: [], shapes: [] };
            historyRef.current = [snap];
            historyRef.current._idx = 0;
            setHistoryIdx(0);
            setHistoryLen(1);
        }, 0);

        toast.success('Canvas cleared!');
    }, [activePageId, boardId, socket]);

    const saveBoardJSON = () => {
        const data = JSON.stringify({ board, lines, shapes, pages }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${board?.title || 'board'}.excalidraw`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Board saved as JSON');
    };

    const loadBoardJSON = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const json = JSON.parse(evt.target.result);
                if (json.lines) setLines(json.lines);
                if (json.shapes) setShapes(json.shapes);
                toast.success('Loaded canvas from file!');
            } catch {
                toast.error('Invalid board file');
            }
        };
        reader.readAsText(file);
    };
    useEffect(() => {
        if (selectedIds.size === 1) {
            const selectedId = [...selectedIds][0];
            const shape = shapes.find(s => s.id === selectedId);
            if (shape) {
                if (shape.stroke) setColor(shape.stroke);
                if (shape.fill) setBgColor(shape.fill);
                if (shape.strokeWidth) setBrushSize(shape.strokeWidth);
                if (shape.opacity !== undefined) setOpacity(Math.round(shape.opacity * 100));
            }
        }
    }, [selectedIds, shapes]);

    // Initialize background color depending on board mode
    useEffect(() => {
        if (board) {
            if (board.mode === 'architecture') {
                setCanvasBg('#0f172a');
            } else if (board.mode === 'er') {
                setCanvasBg('#171530');
            } else if (board.mode === 'notes') {
                setCanvasBg(theme === 'light' ? '#f8fafc' : '#0f172a');
            } else {
                setCanvasBg('#121212');
            }
        }
    }, [board?.mode, theme]);

    // ── Load board and pages (with Instant Cache / SWR for 0ms load) ──
    useEffect(() => {
        // 1. Instant Cache: If board was opened before, display it immediately in 0ms!
        try {
            const cachedBoard = sessionStorage.getItem(`cache_board_${boardId}`);
            const cachedPages = sessionStorage.getItem(`cache_pages_${boardId}`);
            if (cachedBoard && cachedPages) {
                const b = JSON.parse(cachedBoard);
                const pgs = JSON.parse(cachedPages);
                setBoard(b);
                setPages(pgs);
                pgs.forEach(p => {
                    pageDataRef.current[p._id] = {
                        drawings: p.drawings || [],
                        elements: p.elements || [],
                    };
                });
                if (pgs.length > 0) {
                    setActivePageId(pgs[0]._id);
                    const firstData = pageDataRef.current[pgs[0]._id];
                    setLines(firstData.drawings || []);
                    setShapes(firstData.elements || []);
                }
                setLoading(false); // Render immediately!
            }
        } catch { }

        // 2. Fresh Network Sync in background
        const load = async () => {
            try {
                const [boardRes, pagesRes] = await Promise.all([
                    getBoard(boardId),
                    getPages(boardId),
                ]);
                const b = boardRes.data;
                const pgs = pagesRes.data;

                // Save to instant cache for next visit
                try {
                    sessionStorage.setItem(`cache_board_${boardId}`, JSON.stringify(b));
                    sessionStorage.setItem(`cache_pages_${boardId}`, JSON.stringify(pgs));
                } catch { }

                setBoard(b);

                // Fetch other boards in the same workspace for the switcher (only for auth users)
                if (user && b.workspace) {
                    try {
                        const wsId = typeof b.workspace === 'object' ? b.workspace._id : b.workspace;
                        const wsBoards = await getBoards(wsId);
                        setWorkspaceBoards(wsBoards.data);
                    } catch (err) {
                        console.error('Failed to load workspace boards', err);
                    }
                }

                setPages(pgs);
                // Populate page data ref
                pgs.forEach(p => {
                    pageDataRef.current[p._id] = {
                        drawings: p.drawings || [],
                        elements: p.elements || [],
                    };
                });
                if (pgs.length > 0) {
                    setActivePageId(pgs[0]._id);
                    const firstData = pageDataRef.current[pgs[0]._id];
                    setLines(firstData.drawings || []);
                    setShapes(firstData.elements || []);
                    // Init history with first snapshot
                    const snap = { lines: [...(firstData.drawings || [])], shapes: [...(firstData.elements || [])] };
                    historyRef.current = [snap];
                    setHistoryIdx(0);
                    setHistoryLen(1);
                }

                // Force default tool depending on board type
                const bMode = boardRes.data.mode;
                if (bMode === 'architecture' || bMode === 'er') {
                    setTool('select');
                }
            } catch {
                if (!sessionStorage.getItem(`cache_board_${boardId}`)) {
                    toast.error('Failed to load board');
                    navigate('/dashboard');
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [boardId]);

    // ── Resize — use ResizeObserver so stage resizes when panels toggle ──
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const obs = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        });
        obs.observe(container);
        return () => obs.disconnect();
    }, [loading]);

    // ── Transformer attach — supports multi-select (excludes arrows/lines which have custom vertex handles) ──
    useEffect(() => {
        if (!trRef.current) return;
        const stage = stageRef.current;
        if (!stage) return;
        if (editingText) {
            trRef.current.nodes([]);
        } else if (selectedIds.size > 0) {
            const nodes = [];
            selectedIds.forEach(id => {
                const s = shapes.find(shape => shape.id === id);
                if (s && (s.type === 'arrow' || s.type === 'line')) return; // Arrows/lines have direct handle controls
                const node = stage.findOne('#' + id);
                if (node) nodes.push(node);
            });
            trRef.current.nodes(nodes);
        } else {
            trRef.current.nodes([]);
        }
        trRef.current.getLayer()?.batchDraw();
    }, [selectedIds, shapes, editingText]);

    // ── Socket room ──
    useEffect(() => {
        if (!socket || !boardId) return;
        // Send workspaceId along with board join for workspace-scoped chat/video
        const wsId = board?.workspace;
        socket.emit('room:join', { boardId, workspaceId: wsId });

        socket.on('room:user-joined', (data) => {
            setOnlineUsers((prev) => {
                if (prev.find(u => u.userId === data.userId)) return prev;
                return [...prev, data];
            });
        });

        socket.on('laser:point', (data) => {
            if (!data || !data.point) return;
            const uid = data.userId || 'remote';
            setRemoteLasers(prev => ({
                ...prev,
                [uid]: {
                    points: [...(prev[uid]?.points || []).slice(-35), data.point],
                    time: Date.now(),
                    color: data.color || '#ff1144'
                }
            }));
        });

        socket.on('room:user-left', (data) => {
            setOnlineUsers((prev) => prev.filter((u) => u.userId !== data.userId));
            setRemoteCursors((prev) => {
                const next = { ...prev };
                delete next[data.userId];
                return next;
            });
            // Clean up stroke tracking for this user
            delete remoteStrokesRef.current[data.userId];
        });

        // Remote drawing — per-userId stroke tracking for multi-user support
        socket.on('draw:start', (data) => {
            if (data.pageId && data.pageId !== activePageIdRef.current) return;
            setLines((prev) => {
                const newLine = { points: data.stroke?.points || [], color: data.stroke?.color || '#fff', width: data.stroke?.width || 4, tool: data.stroke?.tool || 'pencil', userId: data.userId };
                const newLines = [...prev, newLine];
                // Record this user's line index
                remoteStrokesRef.current[data.userId] = newLines.length - 1;
                return newLines;
            });
        });
        socket.on('draw:move', (data) => {
            if (data.pageId && data.pageId !== activePageIdRef.current) return;
            const lineIdx = remoteStrokesRef.current[data.userId];
            if (lineIdx === undefined) return;
            setLines((prev) => {
                if (lineIdx >= prev.length) return prev;
                const updated = [...prev];
                updated[lineIdx] = { ...updated[lineIdx], points: [...updated[lineIdx].points, ...(data.points || [])] };
                return updated;
            });
        });
        socket.on('draw:end', (data) => {
            if (data?.userId) delete remoteStrokesRef.current[data.userId];
        });
        socket.on('draw:clear', (data) => {
            if (data.pageId === activePageIdRef.current) {
                setLines([]);
                setShapes([]);
            }
        });

        // Remote shapes — only apply if on same page
        socket.on('shape:add', (data) => {
            if (data.pageId && data.pageId !== activePageIdRef.current) return;
            setShapes((prev) => [...prev, data.shape]);
        });
        socket.on('shape:move', (data) => {
            if (data.pageId && data.pageId !== activePageIdRef.current) return;
            setShapes((prev) => prev.map(s => s.id === data.shapeId ? { ...s, x: data.x, y: data.y } : s));
        });
        socket.on('shape:update', (data) => {
            if (data.pageId && data.pageId !== activePageIdRef.current) return;
            setShapes((prev) => prev.map(s => s.id === data.shapeId ? { ...s, ...data.updates } : s));
        });
        socket.on('shape:delete', (data) => {
            if (data.pageId && data.pageId !== activePageIdRef.current) return;
            setShapes((prev) => prev.filter(s => s.id !== data.shapeId));
        });

        // Cursor presence
        socket.on('cursor:move', (data) => {
            if (data.pageId === activePageIdRef.current) {
                setRemoteCursors((prev) => ({ ...prev, [data.userId]: data }));
            }
        });

        // Chat
        socket.on('chat:message', (msg) => {
            setChatMessages((prev) => [...prev, msg]);
        });

        // Page sync — new page created by another user
        socket.on('page:create', (data) => {
            if (data.page) {
                setPages(prev => {
                    if (prev.find(p => p._id === data.page._id)) return prev;
                    return [...prev, data.page];
                });
            }
        });

        // AI action synchronization - trigger history pushes for undo/redo
        socket.on('ai:action:start', () => {
            pushHistory();
        });
        socket.on('ai:action:complete', () => {
            setTimeout(() => pushHistory(), 100);
        });

        return () => {
            socket.emit('room:leave', { boardId });
            socket.off('room:user-joined');
            socket.off('room:user-left');
            socket.off('draw:start');
            socket.off('draw:move');
            socket.off('draw:end');
            socket.off('draw:clear');
            socket.off('shape:add');
            socket.off('shape:move');
            socket.off('shape:update');
            socket.off('shape:delete');
            socket.off('cursor:move');
            socket.off('chat:message');
            socket.off('page:create');
            socket.off('laser:point');
            socket.off('ai:action:start');
            socket.off('ai:action:complete');
        };
    }, [socket, boardId, board?.workspace, pushHistory]);

    // Laser Pointer ultra-smooth auto-fade animation loop (60fps)
    useEffect(() => {
        if (laserTrail.length === 0 && Object.keys(remoteLasers).length === 0) return;

        let animationFrameId;
        const animate = () => {
            const now = Date.now();
            setLaserTrail(prev => {
                const filtered = prev.filter(p => now - p.time < 750);
                return filtered.length === prev.length ? prev : filtered;
            });
            setRemoteLasers(prev => {
                const next = {};
                let changed = false;
                Object.entries(prev).forEach(([uid, laser]) => {
                    const validPoints = (laser.points || []).filter(p => now - p.time < 750);
                    if (validPoints.length > 0) {
                        if (validPoints.length !== laser.points.length) changed = true;
                        next[uid] = { ...laser, points: validPoints };
                    } else {
                        changed = true;
                    }
                });
                return changed || Object.keys(next).length !== Object.keys(prev).length ? next : prev;
            });
            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [laserTrail.length, remoteLasers]);
    const handleTouchStart = (e) => {
        const evt = e.evt || e.nativeEvent;
        // Two or more fingers: smooth pinch-zoom and pan
        if (evt && evt.touches && evt.touches.length >= 2) {
            const t1 = evt.touches[0];
            const t2 = evt.touches[1];
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const center = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
            touchStateRef.current = {
                dist,
                scale: stageScale,
                pos: { ...stagePos },
                center
            };
            return;
        }

        // Single touch:
        // Check if this is an Apple Pencil / Stylus (touchType === 'stylus')
        const isStylus = evt?.touches && evt.touches[0]?.touchType === 'stylus';
        if (isStylus) {
            handleMouseDown(e);
            return;
        }

        // Palm Rejection: If enabled and on a drawing tool, drop touch (it's palm or finger)
        if (palmRejection && (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser' || tool === 'laser' || tool === 'draw-to-shape')) {
            return; // Hand resting on screen -> completely safe!
        }

        handleMouseDown(e);
    };

    const handleTouchMove = (e) => {
        const evt = e.evt || e.nativeEvent;
        if (evt && evt.touches && evt.touches.length >= 2) {
            if (evt.cancelable) evt.preventDefault();
            const t1 = evt.touches[0];
            const t2 = evt.touches[1];
            const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const newCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };

            const { dist: initialDist, scale: initialScale, pos: initialPos, center: initialCenter } = touchStateRef.current;
            if (!initialDist) return;

            const scaleRatio = newDist / initialDist;
            const newScale = Math.max(0.1, Math.min(5, initialScale * scaleRatio));

            const deltaX = newCenter.x - initialCenter.x;
            const deltaY = newCenter.y - initialCenter.y;

            const mousePointTo = {
                x: (initialCenter.x - initialPos.x) / initialScale,
                y: (initialCenter.y - initialPos.y) / initialScale,
            };

            const newPos = {
                x: initialCenter.x + deltaX - mousePointTo.x * newScale,
                y: initialCenter.y + deltaY - mousePointTo.y * newScale,
            };

            setStageScale(newScale);
            setStagePos(newPos);
            return;
        }

        // Single touch:
        const isStylus = evt?.touches && evt.touches[0]?.touchType === 'stylus';
        if (isStylus) {
            handleMouseMove(e);
            return;
        }

        if (palmRejection && (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser' || tool === 'laser' || tool === 'draw-to-shape')) {
            return; // Drop palm move!
        }

        handleMouseMove(e);
    };

    const handleTouchEnd = (e) => {
        const evt = e.evt || e.nativeEvent;
        if (evt && evt.touches && evt.touches.length < 2) {
            touchStateRef.current = { dist: 0, scale: 1, pos: { x: 0, y: 0 }, center: { x: 0, y: 0 } };
        }
        handleMouseUp(e);
    };

    // ── Drawing handlers — drag-to-size for shapes ──
    const handleMouseDown = (e) => {
        // Don't process canvas clicks while inline text editor is open
        if (editingText) return;

        const evt = e.evt || e.nativeEvent;
        let pointerType = 'mouse';
        if (evt?.pointerType) {
            pointerType = evt.pointerType;
        } else if (evt?.touches && evt.touches.length > 0) {
            pointerType = evt.touches[0].touchType === 'stylus' ? 'pen' : 'touch';
        } else if (evt?.changedTouches && evt.changedTouches.length > 0) {
            pointerType = evt.changedTouches[0].touchType === 'stylus' ? 'pen' : 'touch';
        }

        const rawPressure = evt?.pressure || 0.5;

        // Auto-detect Apple Pencil / Stylus usage
        if (pointerType === 'pen') {
            lastPenTimeRef.current = Date.now();
            activePenPointerIdRef.current = evt?.pointerId ?? null;
        }

        // Drop synthetic mouse events generated by touch/pen
        if (evt?.type === 'mousedown') {
            if (Date.now() - lastPointerDownTimeRef.current < 500) {
                return;
            }
            if (evt?.sourceCapabilities?.firesTouchEvents || evt?.pointerType === 'pen' || evt?.pointerType === 'touch') {
                return;
            }
            if (Date.now() - lastPenTimeRef.current < 2000) {
                return; // Pen was used; ignore simulated mouse
            }
        }
        lastPointerDownTimeRef.current = Date.now();

        // Touch Resistance / Palm Rejection check for iPad / Tablet drawing
        // If palmRejection is ON: only 'pen' (Apple Pencil) or desktop 'mouse' can draw
        if (palmRejection) {
            const isDrawingTool = tool === 'pencil' || tool === 'highlighter' || tool === 'eraser' || tool === 'laser' || tool === 'draw-to-shape';
            const isTouch = pointerType === 'touch' || (evt?.touches && evt.touches[0]?.touchType === 'direct');
            const isPalmArea = (evt?.width && evt.width > 24) || (evt?.height && evt.height > 24) ||
                               (evt?.touches && (evt.touches[0]?.radiusX > 20 || evt.touches[0]?.radiusY > 20));

            if (isDrawingTool && (isTouch || isPalmArea)) {
                return; // Palm resting on screen -> 100% blocked!
            }

            // If an Apple Pencil is already drawing, reject any other pointerId (e.g. palm contact)
            if (activePenPointerIdRef.current !== null && evt?.pointerId !== undefined && evt.pointerId !== activePenPointerIdRef.current) {
                return;
            }
        }

        // Click on empty stage → deselect
        if (e.target === e.target.getStage()) {
            setSelectedIds(new Set());
        }
        if (tool === 'select' || tool === 'pan') return;

        const stage = e.target.getStage();
        if (!stage) return;
        const pointerPos = stage.getPointerPosition();
        if (!pointerPos) return;
        const pos = {
            x: (pointerPos.x - stagePos.x) / stageScale,
            y: (pointerPos.y - stagePos.y) / stageScale
        };

        // Notes Mode: Do not allow drawing outside A4 paper sheets
        if (isNotesMode && (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser' || tool === 'draw-to-shape')) {
            const a4X = notesPageX;
            const a4Width = 800;
            const a4Height = 1131;
            const gap = 48;
            const numPages = pages.length || 1;
            let insidePage = false;
            if (pos.x >= a4X && pos.x <= a4X + a4Width) {
                for (let k = 0; k < numPages; k++) {
                    const pageY = 60 + k * (a4Height + gap);
                    if (pos.y >= pageY && pos.y <= pageY + a4Height) {
                        insidePage = true;
                        break;
                    }
                }
            }
            if (!insidePage) return; // Ignore clicks outside paper boundaries
        }

        if (tool === 'comment') {
            setDraftCommentPos({ x: pos.x, y: pos.y });
            return;
        }

        if (tool === 'bucket') {
            const activeFillColor = bgColor === 'transparent' ? (color || '#6366f1') : bgColor;
            const clickedShape = shapes.find(s => {
                const w = Math.abs(s.width || (s.radius ? s.radius * 2 : 100));
                const h = Math.abs(s.height || (s.radius ? s.radius * 2 : 100));
                if (s.type === 'rect' || s.type === 'diamond' || s.type === 'sticky' || s.type === 'frame') {
                    return pos.x >= s.x - 10 && pos.x <= s.x + w + 10 && pos.y >= s.y - 10 && pos.y <= s.y + h + 10;
                } else if (s.type === 'circle') {
                    const r = s.radius || 35;
                    return Math.hypot(pos.x - s.x, pos.y - s.y) <= r + 10;
                }
                return false;
            });

            if (clickedShape) {
                const updated = { fill: activeFillColor, fillStyle: fillStyle || 'solid' };
                setShapes(prev => prev.map(s => s.id === clickedShape.id ? { ...s, ...updated } : s));
                socket?.emit('shape:update', { boardId, pageId: activePageId, shapeId: clickedShape.id, updates: updated });
                toast.success('Shape color filled!');
            }
            return;
        }

        if (tool === 'laser') {
            setIsDrawing(true);
            setLaserTrail([{ x: pos.x, y: pos.y, time: Date.now() }]);
            setLaserDot({ x: pos.x, y: pos.y });
            socket?.emit('laser:point', { boardId, pageId: activePageId, point: { x: pos.x, y: pos.y, time: Date.now() } });
            return;
        }

        if (tool === 'lasso') {
            setIsDrawing(true);
            setLassoPoints([pos.x, pos.y]);
            return;
        }

        if (tool === 'web-embed') {
            setShowWebEmbedModal(true);
            return;
        }

        if (tool === 'eraser') {
            setIsDrawing(true);
            const eRadius = Math.max(eraserSize || 20, 24);

            setShapes(prev => {
                let hitAny = false;
                const next = prev.filter(s => {
                    let hit = false;
                    const w = Math.abs(s.width || 100);
                    const h = Math.abs(s.height || 100);
                    const sx = s.width < 0 ? s.x + s.width : (s.x || 0);
                    const sy = s.height < 0 ? s.y + s.height : (s.y || 0);

                    if (s.type === 'rect' || s.type === 'sticky' || s.type === 'frame' || s.type === 'diamond' || s.type === 'image' || s.type === 'er-entity' || s.type === 'arch-icon' || s.type === 'er-table') {
                        hit = pos.x >= sx - eRadius && pos.x <= sx + w + eRadius && pos.y >= sy - eRadius && pos.y <= sy + h + eRadius;
                    } else if (s.type === 'circle') {
                        const r = s.radius || (s.width ? Math.abs(s.width) / 2 : 35);
                        hit = Math.hypot(pos.x - (s.x || 0), pos.y - (s.y || 0)) <= r + eRadius + 10;
                    } else if (s.type === 'text') {
                        const tw = Math.max((s.text || s.label || '').length * (s.fontSize || 18) * 0.7 + 30, 80);
                        const th = (s.fontSize || 18) * 2 + 20;
                        hit = pos.x >= (s.x || 0) - eRadius && pos.x <= (s.x || 0) + tw + eRadius && pos.y >= (s.y || 0) - eRadius && pos.y <= (s.y || 0) + th + eRadius;
                    } else if ((s.type === 'arrow' || s.type === 'line') && s.points) {
                        const p = s.points;
                        const x1 = p[0], y1 = p[1], x2 = p[p.length - 2], y2 = p[p.length - 1];
                        const dLine = distToSegment(pos.x, pos.y, x1, y1, x2, y2);
                        if (dLine <= eRadius + 16) {
                            hit = true;
                        } else {
                            const { midHandles } = getArrowData(s.points, s.arrowType, s.customMidX, s.bendPoint);
                            if (midHandles && midHandles.length > 0) {
                                for (const h of midHandles) {
                                    if (Math.hypot(pos.x - h.x, pos.y - h.y) <= eRadius + 20) {
                                        hit = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (hit) {
                        hitAny = true;
                        socket?.emit('shape:delete', { boardId, pageId: activePageId, shapeId: s.id });
                    }
                    return !hit;
                });
                if (hitAny) setTimeout(() => pushHistory(), 0);
                return next;
            });

            setLines(prev => {
                let hitAny = false;
                const next = prev.filter(line => {
                    if (!line.points || line.points.length < 2) return false;
                    for (let i = 0; i < line.points.length - 2; i += 2) {
                        const d = distToSegment(pos.x, pos.y, line.points[i], line.points[i + 1], line.points[i + 2], line.points[i + 3]);
                        if (d <= eRadius + 14) {
                            hitAny = true;
                            return false;
                        }
                    }
                    return true;
                });
                if (hitAny) setTimeout(() => pushHistory(), 0);
                return next;
            });
            return;
        }

        if (tool === 'pencil' || tool === 'highlighter' || tool === 'draw-to-shape') {
            setIsDrawing(true);
            const dynamicWidth = tool === 'highlighter'
                ? 18
                : ((usePressure && pointerType === 'pen' && rawPressure > 0)
                    ? Math.max(1, Math.round(brushSize * (0.3 + rawPressure * 1.4)))
                    : brushSize);

            const newLine = {
                points: [pos.x, pos.y],
                color: color,
                width: dynamicWidth,
                tool: tool === 'draw-to-shape' ? 'pencil' : tool,
                opacity: tool === 'highlighter' ? 0.38 : (opacity / 100),
            };
            setLines(prev => [...prev, newLine]);
            if (tool !== 'draw-to-shape') {
                socket?.emit('draw:start', { boardId, pageId: activePageId, stroke: newLine });
            }
        } else if (tool === 'rect' || tool === 'frame') {
            const initialFill = tool === 'frame' ? 'transparent' : ((fillStyle === 'cross-hatch' || fillStyle === 'hachure') && bgColor === 'transparent' ? color : bgColor);
            setDrawingShape({
                id: genId(),
                type: tool,
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0,
                label: tool === 'frame' ? 'Frame' : undefined,
                fill: initialFill,
                stroke: tool === 'frame' ? '#6366f1' : color,
                strokeWidth: brushSize,
                strokeStyle: tool === 'frame' ? 'dashed' : strokeStyle,
                fillStyle,
                sloppiness,
                edges,
                opacity: opacity / 100
            });
            setIsDrawing(true);
        } else if (tool === 'circle') {
            const initialFill = (fillStyle === 'cross-hatch' || fillStyle === 'hachure') && bgColor === 'transparent' ? color : bgColor;
            setDrawingShape({ id: genId(), type: 'circle', x: pos.x, y: pos.y, radius: 0, fill: initialFill, stroke: color, strokeWidth: brushSize, strokeStyle, fillStyle, sloppiness, edges, opacity: opacity / 100 });
            setIsDrawing(true);
        } else if (tool === 'diamond') {
            const initialFill = (fillStyle === 'cross-hatch' || fillStyle === 'hachure') && bgColor === 'transparent' ? color : bgColor;
            setDrawingShape({ id: genId(), type: 'diamond', x: pos.x, y: pos.y, width: 0, height: 0, fill: initialFill, stroke: color, strokeWidth: brushSize, strokeStyle, fillStyle, sloppiness, edges, opacity: opacity / 100 });
            setIsDrawing(true);
        } else if (tool === 'arrow' || tool === 'line') {
            setDrawingShape({
                id: genId(),
                type: tool,
                points: [pos.x, pos.y, pos.x, pos.y],
                arrowType: arrowType || 'straight',
                arrowhead: tool === 'line' ? 'none' : (arrowhead || 'arrow'),
                fill: color || '#ffffff',
                stroke: color || '#ffffff',
                strokeWidth: brushSize,
                strokeStyle,
                fillStyle,
                sloppiness,
                edges,
                opacity: opacity / 100
            });
            setIsDrawing(true);
        } else if (tool === 'sticky') {
            const id = genId();
            const shape = { id, type: 'sticky', x: pos.x, y: pos.y, width: 180, height: 140, text: '', fill: bgColor === 'transparent' ? '#f59e0b' : bgColor, fontSize: 14, opacity: opacity / 100 };
            setShapes(prev => [...prev, shape]);
            socket?.emit('shape:add', { boardId, pageId: activePageId, shape });
            pushHistory();
        } else if (tool === 'text') {
            const id = genId();
            const shape = {
                id,
                type: 'text',
                x: pos.x,
                y: pos.y,
                text: 'Text',
                fill: color || '#ffffff',
                fontSize: fontSize || 18,
                fontFamily: fontFamily || 'Virgil',
                align: textAlign || 'left',
                opacity: opacity / 100
            };
            setShapes(prev => [...prev, shape]);
            socket?.emit('shape:add', { boardId, pageId: activePageId, shape });

            const stageBox = containerRef.current?.getBoundingClientRect();
            if (stageBox) {
                const absX = stageBox.left + pos.x * stageScale + stagePos.x;
                const absY = stageBox.top + pos.y * stageScale + stagePos.y;
                setEditingText({
                    id,
                    x: absX,
                    y: absY,
                    width: 200,
                    height: 32,
                    value: 'Text',
                    type: 'text',
                    fill: color || '#ffffff',
                    fontSize: fontSize || 18,
                    fontFamily: fontFamily || 'Virgil',
                    align: textAlign || 'left'
                });
            }
        }
    };


    const handleInsertDiagram = (newShapes) => {
        if (!newShapes || !Array.isArray(newShapes)) return;
        setShapes(prev => [...prev, ...newShapes]);
        pushHistory();
        if (socket && boardId) {
            newShapes.forEach(shape => {
                socket.emit('shape:add', { boardId, pageId: activePageId, shape });
            });
        }
    };

    const handleMouseMove = (e) => {
        const evt = e.evt || e.nativeEvent;
        let pointerType = 'mouse';
        if (evt?.pointerType) {
            pointerType = evt.pointerType;
        } else if (evt?.touches && evt.touches.length > 0) {
            pointerType = evt.touches[0].touchType === 'stylus' ? 'pen' : 'touch';
        } else if (evt?.changedTouches && evt.changedTouches.length > 0) {
            pointerType = evt.changedTouches[0].touchType === 'stylus' ? 'pen' : 'touch';
        }

        // Drop synthetic mousemove generated from touch
        if (evt?.type === 'mousemove') {
            if (Date.now() - lastPenTimeRef.current < 1500) {
                return; // Pen is active, reject simulated mousemove
            }
            if (evt?.sourceCapabilities?.firesTouchEvents) {
                return;
            }
        }

        // If Apple Pencil is currently drawing, only accept points from the pen pointer
        if (activePenPointerIdRef.current !== null && evt?.pointerId !== undefined) {
            if (evt.pointerId !== activePenPointerIdRef.current) {
                return; // Palm movement while pen writes -> rejected!
            }
        }

        if (palmRejection) {
            const isDrawingTool = tool === 'pencil' || tool === 'highlighter' || tool === 'eraser' || tool === 'laser' || tool === 'draw-to-shape';
            const isTouch = pointerType === 'touch' || (evt?.touches && evt.touches[0]?.touchType === 'direct');
            const isPalmArea = (evt?.width && evt.width > 24) || (evt?.height && evt.height > 24) ||
                               (evt?.touches && (evt.touches[0]?.radiusX > 20 || evt.touches[0]?.radiusY > 20));

            if (isDrawingTool && (isTouch || isPalmArea)) {
                return;
            }
        }

        const stage = e.target.getStage();
        if (!stage) return;
        const pointerPos = stage.getPointerPosition();
        if (!pointerPos) return;
        const pos = {
            x: (pointerPos.x - stagePos.x) / stageScale,
            y: (pointerPos.y - stagePos.y) / stageScale
        };

        if (tool === 'eraser') {
            setEraserPos({ x: pos.x, y: pos.y });
            if (isDrawing) {
                setEraserTrail(prev => [...prev, pos.x, pos.y]);
            }
        } else if (eraserPos) {
            setEraserPos(null);
        }

        // Emit cursor
        if (socket && boardId) {
            socket.emit('cursor:move', { boardId, x: pos.x, y: pos.y, pageId: activePageId });
        }

        if (tool === 'laser') {
            setLaserDot({ x: pos.x, y: pos.y });
            if (isDrawing) {
                // Keep all points within the time window; no arbitrary slice restriction which causes tail clipping
                setLaserTrail(prev => {
                    const now = Date.now();
                    return [...prev.filter(p => now - p.time < 750), { x: pos.x, y: pos.y, time: now }];
                });
                socket?.emit('laser:point', { boardId, pageId: activePageId, point: { x: pos.x, y: pos.y, time: Date.now() } });
            }
            return;
        }

        if (!isDrawing) return;

        if (tool === 'lasso') {
            setLassoPoints(prev => [...prev, pos.x, pos.y]);
            return;
        }

        if (tool === 'eraser') {
            const eRadius = Math.max(eraserSize || 20, 24);
            // Delete any shape touched by eraser cursor
            setShapes(prev => {
                let hitAny = false;
                const next = prev.filter(s => {
                    let hit = false;
                    const w = Math.abs(s.width || 100);
                    const h = Math.abs(s.height || 100);
                    const sx = s.width < 0 ? s.x + s.width : (s.x || 0);
                    const sy = s.height < 0 ? s.y + s.height : (s.y || 0);

                    if (s.type === 'rect' || s.type === 'sticky' || s.type === 'frame' || s.type === 'diamond' || s.type === 'image' || s.type === 'er-entity' || s.type === 'arch-icon' || s.type === 'er-table') {
                        hit = pos.x >= sx - eRadius && pos.x <= sx + w + eRadius && pos.y >= sy - eRadius && pos.y <= sy + h + eRadius;
                    } else if (s.type === 'circle') {
                        const r = s.radius || (s.width ? Math.abs(s.width) / 2 : 35);
                        hit = Math.hypot(pos.x - (s.x || 0), pos.y - (s.y || 0)) <= r + eRadius + 10;
                    } else if (s.type === 'text') {
                        const tw = Math.max((s.text || s.label || '').length * (s.fontSize || 18) * 0.7 + 30, 80);
                        const th = (s.fontSize || 18) * 2 + 20;
                        hit = pos.x >= (s.x || 0) - eRadius && pos.x <= (s.x || 0) + tw + eRadius && pos.y >= (s.y || 0) - eRadius && pos.y <= (s.y || 0) + th + eRadius;
                    } else if ((s.type === 'arrow' || s.type === 'line') && s.points) {
                        const p = s.points;
                        const x1 = p[0], y1 = p[1], x2 = p[p.length - 2], y2 = p[p.length - 1];
                        const dLine = distToSegment(pos.x, pos.y, x1, y1, x2, y2);
                        if (dLine <= eRadius + 16) {
                            hit = true;
                        } else {
                            const { midHandles } = getArrowData(s.points, s.arrowType, s.customMidX, s.bendPoint);
                            if (midHandles && midHandles.length > 0) {
                                for (const h of midHandles) {
                                    if (Math.hypot(pos.x - h.x, pos.y - h.y) <= eRadius + 20) {
                                        hit = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (hit) {
                        hitAny = true;
                        socket?.emit('shape:delete', { boardId, pageId: activePageId, shapeId: s.id });
                    }
                    return !hit;
                });
                if (hitAny) setTimeout(() => pushHistory(), 0);
                return next;
            });

            // Delete freehand lines touched by eraser cursor
            setLines(prev => {
                let hitAny = false;
                const next = prev.filter(line => {
                    if (!line.points || line.points.length < 2) return false;
                    for (let i = 0; i < line.points.length - 2; i += 2) {
                        const d = distToSegment(pos.x, pos.y, line.points[i], line.points[i + 1], line.points[i + 2], line.points[i + 3]);
                        if (d <= eRadius + 14) {
                            hitAny = true;
                            return false;
                        }
                    }
                    return true;
                });
                if (hitAny) setTimeout(() => pushHistory(), 0);
                return next;
            });
            return;
        } else if (tool === 'pencil' || tool === 'highlighter' || tool === 'draw-to-shape') {
            const px = isNotesMode ? Math.max(notesPageX, Math.min(notesPageX + 800, pos.x)) : pos.x;
            setLines(prev => {
                if (prev.length === 0) return prev;
                const updated = [...prev];
                const last = { ...updated[updated.length - 1] };
                last.points = [...last.points, px, pos.y];
                updated[updated.length - 1] = last;
                return updated;
            });
            if (tool !== 'draw-to-shape') {
                socket?.emit('draw:move', { boardId, pageId: activePageId, points: [px, pos.y] });
            }
        } else if (drawingShape) {
            if (drawingShape.type === 'rect' || drawingShape.type === 'diamond' || drawingShape.type === 'frame') {
                setDrawingShape(prev => ({ ...prev, width: pos.x - prev.x, height: pos.y - prev.y }));
            } else if (drawingShape.type === 'circle') {
                const dx = pos.x - drawingShape.x;
                const dy = pos.y - drawingShape.y;
                setDrawingShape(prev => ({ ...prev, radius: Math.sqrt(dx * dx + dy * dy) }));
            } else if (drawingShape.type === 'arrow' || drawingShape.type === 'line') {
                setDrawingShape(prev => ({ ...prev, points: [prev.points[0], prev.points[1], pos.x, pos.y] }));
            }
        }
    };

    const handleMouseUp = (e) => {
        const evt = e?.evt || e?.nativeEvent;
        if (evt?.pointerId !== undefined && activePenPointerIdRef.current !== null) {
            if (evt.pointerId === activePenPointerIdRef.current) {
                activePenPointerIdRef.current = null;
            }
        } else {
            activePenPointerIdRef.current = null;
        }

        if (tool === 'eraser') {
            setTimeout(() => {
                setEraserTrail([]);
            }, 200);
        }
        if (tool === 'laser') {
            setIsDrawing(false);
            return;
        }
        if (isDrawing && tool === 'lasso') {
            setIsDrawing(false);
            if (lassoPoints.length >= 4) {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                for (let i = 0; i < lassoPoints.length; i += 2) {
                    minX = Math.min(minX, lassoPoints[i]);
                    maxX = Math.max(maxX, lassoPoints[i]);
                    minY = Math.min(minY, lassoPoints[i + 1]);
                    maxY = Math.max(maxY, lassoPoints[i + 1]);
                }
                const selected = shapes.filter(s => {
                    const x = s.x || 0;
                    const y = s.y || 0;
                    return x >= minX && x <= maxX && y >= minY && y <= maxY;
                }).map(s => s.id);
                if (selected.length > 0) {
                    setSelectedIds(new Set(selected));
                    toast.success(`Selected ${selected.length} element(s) with lasso!`);
                }
            }
            setLassoPoints([]);
            setTool('select');
            return;
        }
        if (isDrawing && tool === 'draw-to-shape') {
            setIsDrawing(false);
            setLines(prev => {
                const lastLine = prev[prev.length - 1];
                if (lastLine && lastLine.points && lastLine.points.length >= 6) {
                    const recognized = recognizeShapeFromPoints(lastLine.points);
                    if (recognized) {
                        const newShape = {
                            id: genId(),
                            fill: bgColor === 'transparent' ? '#6366f1' : bgColor,
                            stroke: color,
                            strokeWidth: brushSize,
                            fillStyle,
                            strokeStyle,
                            sloppiness,
                            edges,
                            opacity: opacity / 100,
                            ...recognized
                        };
                        setShapes(shapesPrev => [...shapesPrev, newShape]);
                        socket?.emit('shape:add', { boardId, pageId: activePageId, shape: newShape });
                        toast.success(`Smart shape recognized: ${newShape.type}!`);
                        return prev.slice(0, -1);
                    }
                }
                return prev;
            });
            setTimeout(() => pushHistory(), 0);
        } else if (isDrawing && (tool === 'pencil' || tool === 'eraser')) {
            setIsDrawing(false);
            socket?.emit('draw:end', { boardId, pageId: activePageId });
            // Defer pushHistory so state has updated
            setTimeout(() => pushHistory(), 0);
        } else if (isDrawing && drawingShape) {
            setIsDrawing(false);
            let commitShape = { ...drawingShape };
            let shouldCommit = true;

            if (commitShape.type === 'rect' || commitShape.type === 'diamond' || commitShape.type === 'frame') {
                if (commitShape.width < 0) { commitShape.x += commitShape.width; commitShape.width = Math.abs(commitShape.width); }
                if (commitShape.height < 0) { commitShape.y += commitShape.height; commitShape.height = Math.abs(commitShape.height); }
                if (commitShape.width < 5 && commitShape.height < 5) shouldCommit = false;
            } else if (commitShape.type === 'circle') {
                if (commitShape.radius < 3) shouldCommit = false;
            } else if (commitShape.type === 'arrow' || commitShape.type === 'line') {
                const dx = commitShape.points[2] - commitShape.points[0];
                const dy = commitShape.points[3] - commitShape.points[1];
                if (Math.sqrt(dx * dx + dy * dy) < 5) shouldCommit = false;
            }

            if (shouldCommit) {
                // In ER mode, auto-set default cardinality on arrows
                if (isERMode && commitShape.type === 'arrow') {
                    commitShape.cardinality = '1:N';
                }
                setShapes(prev => [...prev, commitShape]);
                socket?.emit('shape:add', { boardId, pageId: activePageId, shape: commitShape });
                setTimeout(() => pushHistory(), 0);
                // In ER mode, auto-select the arrow and switch back to select tool
                if (isERMode && commitShape.type === 'arrow') {
                    setSelectedIds(new Set([commitShape.id]));
                    setTool('select');
                } else if (!toolLock) {
                    setTool('select');
                }
            }
            setDrawingShape(null);
        }
    };

    const handleInsertWebEmbed = (url) => {
        const shape = {
            id: genId(),
            type: 'web-embed',
            x: Math.round((stageSize.width / 2 - stagePos.x) / stageScale - 240),
            y: Math.round((stageSize.height / 2 - stagePos.y) / stageScale - 160),
            width: 480,
            height: 320,
            url,
            stroke: color,
            strokeWidth: 2
        };
        setShapes(prev => [...prev, shape]);
        socket?.emit('shape:add', { boardId, pageId: activePageId, shape });
        setTimeout(() => pushHistory(), 0);
        toast.success('Web embed added!');
        setTool('select');
    };

    // ── BUG FIX 2: Multi-select — Shift+Click adds/removes, plain click sets single ──
    const handleShapeClick = (e, shapeId) => {
        // Eraser tool: click shape to delete it
        if (tool === 'eraser') {
            e.cancelBubble = true;
            setShapes(prev => prev.filter(s => s.id !== shapeId));
            socket?.emit('shape:delete', { boardId, pageId: activePageId, shapeId });
            setTimeout(() => pushHistory(), 0);
            return;
        }
        // Bucket fill tool: click shape to fill it
        if (tool === 'bucket') {
            e.cancelBubble = true;
            const fillCol = bgColor === 'transparent' ? (color || '#6366f1') : bgColor;
            setShapes(prev => prev.map(s => s.id === shapeId ? { ...s, fill: fillCol, fillStyle: 'solid' } : s));
            socket?.emit('shape:update', { boardId, pageId: activePageId, shapeId, updates: { fill: fillCol, fillStyle: 'solid' } });
            setTimeout(() => pushHistory(), 0);
            toast.success('Shape filled with color!');
            return;
        }
        if (tool !== 'select') return;
        e.cancelBubble = true;

        if (e.evt?.shiftKey) {
            // Toggle this shape in the selection set
            setSelectedIds(prev => {
                const next = new Set(prev);
                if (next.has(shapeId)) next.delete(shapeId);
                else next.add(shapeId);
                return next;
            });
        } else {
            setSelectedIds(new Set([shapeId]));
        }
    };

    // ── Handle shape transform end (resize) ──
    const handleTransformEnd = (e, shape) => {
        const node = e.target;
        const updates = {};
        if (shape.type === 'rect' || shape.type === 'sticky' || shape.type === 'frame' || shape.type === 'diamond' || shape.type === 'image') {
            updates.x = node.x();
            updates.y = node.y();
            updates.width = Math.max(10, Math.round((shape.width || node.width() || 200) * node.scaleX()));
            updates.height = Math.max(10, Math.round((shape.height || node.height() || 150) * node.scaleY()));
            node.scaleX(1);
            node.scaleY(1);
        } else if (shape.type === 'circle') {
            updates.x = node.x();
            updates.y = node.y();
            updates.radius = Math.max(5, Math.round(shape.radius * Math.max(node.scaleX(), node.scaleY())));
            node.scaleX(1);
            node.scaleY(1);
        } else if (shape.type === 'text') {
            updates.x = node.x();
            updates.y = node.y();
            updates.fontSize = Math.max(8, Math.round(shape.fontSize * node.scaleY()));
            node.scaleX(1);
            node.scaleY(1);
        }
        setShapes(prev => prev.map(s => s.id === shape.id ? { ...s, ...updates } : s));
        socket?.emit('shape:update', { boardId, pageId: activePageId, shapeId: shape.id, updates });
        setTimeout(() => pushHistory(), 0);
    };

    // ── Handle drag end for shapes — supports multi-drag ──
    const handleShapeDragEnd = (e, shape) => {
        const node = e.target;
        const isPointShape = (shape.type === 'arrow' || shape.type === 'line') && shape.points;

        if (isPointShape) {
            const ddx = node.x() - (shape.points ? shape.points[0] : 0);
            const ddy = node.y() - (shape.points ? shape.points[1] : 0);
            const newPoints = shape.points.map((p, i) => i % 2 === 0 ? p + ddx : p + ddy);
            node.x(0);
            node.y(0);
            setShapes(prev => prev.map(s => s.id === shape.id ? { ...s, points: newPoints } : s));
            socket?.emit('shape:update', { boardId, pageId: activePageId, shapeId: shape.id, updates: { points: newPoints } });
            setTimeout(() => pushHistory(), 0);
            return;
        }

        const dx = node.x() - shape.x;
        const dy = node.y() - shape.y;

        if (selectedIds.size > 1 && selectedIds.has(shape.id)) {
            setShapes(prev => prev.map(s => {
                if (selectedIds.has(s.id)) {
                    const newPos = s.id === shape.id
                        ? { x: node.x(), y: node.y() }
                        : { x: (s.x || 0) + dx, y: (s.y || 0) + dy };
                    socket?.emit('shape:move', { boardId, pageId: activePageId, shapeId: s.id, ...newPos });
                    return { ...s, ...newPos };
                }
                return s;
            }));
        } else {
            const pos = { x: node.x(), y: node.y() };
            setShapes(prev => prev.map(s => s.id === shape.id ? { ...s, ...pos } : s));
            socket?.emit('shape:move', { boardId, pageId: activePageId, shapeId: shape.id, ...pos });
        }
        setTimeout(() => pushHistory(), 0);
    };

    // ── Delete selected shapes ──
    const deleteSelected = useCallback(() => {
        if (selectedIds.size === 0) return;
        setShapes(prev => prev.filter(s => !selectedIds.has(s.id)));
        selectedIds.forEach(id => {
            socket?.emit('shape:delete', { boardId, pageId: activePageId, shapeId: id });
        });
        setSelectedIds(new Set());
        setTimeout(() => pushHistory(), 0);
    }, [selectedIds, boardId, activePageId, socket, pushHistory]);

    // ── Duplicate selected shapes ──
    const duplicateSelected = useCallback(() => {
        if (selectedIds.size === 0) return;
        const newShapes = [];
        shapesRef.current.forEach(s => {
            if (selectedIds.has(s.id)) {
                const clone = { ...s, id: genId(), x: (s.x || 0) + 20, y: (s.y || 0) + 20 };
                newShapes.push(clone);
            }
        });
        setShapes(prev => [...prev, ...newShapes]);
        newShapes.forEach(shape => {
            socket?.emit('shape:add', { boardId, pageId: activePageId, shape });
        });
        setSelectedIds(new Set(newShapes.map(s => s.id)));
        setTimeout(() => pushHistory(), 0);
    }, [selectedIds, boardId, activePageId, socket, pushHistory]);

    // Keyboard handler — tool shortcuts + actions
    useEffect(() => {
        const handleKey = (e) => {
            // Don't capture keys when editing text or ER modal
            if (editingERShape || editingText) return;
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            // Shift+X: Toggle Draw to Shape
            if (e.shiftKey && (e.key === 'X' || e.key === 'x')) {
                e.preventDefault();
                setTool(prev => prev === 'draw-to-shape' ? 'pencil' : 'draw-to-shape');
                toast.success('Draw to shape tool toggled');
                return;
            }

            // Tool shortcuts (no modifiers)
            if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                const key = e.key.toLowerCase();
                const bType = board?.type;
                const isArch = bType === 'architecture';
                const isER = bType === 'er';

                let allowed = true;
                if (isER && ['p', 'e', 'r', 'o', 't', 'a', 'n'].includes(key)) allowed = false;
                if (isArch && ['p', 'e', 'r', 'o', 'n'].includes(key)) allowed = false;

                if (allowed) {
                    switch (key) {
                        case 'v': setTool('select'); break;
                        case 'p': setTool('pencil'); break;
                        case 'e': setTool('eraser'); break;
                        case 'r': setTool('rect'); break;
                        case 'o': setTool('circle'); break;
                        case 't': setTool('text'); break;
                        case 'a': setTool('arrow'); break;
                        case 'd': setTool('diamond'); break;
                        case 'h': setTool('pan'); break;
                        case 'n': setTool('sticky'); break;
                        case 'k': setTool('laser'); break;
                        case 'b': setTool('bucket'); break;
                        case 'f': setTool('frame'); break;
                        case '1': setBrushSize(2); break;
                        case '2': setBrushSize(4); break;
                        case '3': setBrushSize(6); break;
                        case '4': setBrushSize(10); break;
                        case '5': setBrushSize(16); break;
                        case '[': setEraserSize(s => Math.max(8, s - 4)); break;
                        case ']': setEraserSize(s => Math.min(100, s + 4)); break;
                        case '+': case '=': setStageScale(s => Math.min(5, s * 1.2)); break;
                        case '-': setStageScale(s => Math.max(0.1, s / 1.2)); break;
                        default: break;
                    }
                }
            }

            // Action shortcuts
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedIds.size > 0) { e.preventDefault(); deleteSelected(); }
            }
            if (e.key === 'Escape') setSelectedIds(new Set());
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateSelected(); }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); navigate('/dashboard'); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [selectedIds, editingERShape, editingText, deleteSelected, duplicateSelected, undo, redo, board?.type]);

    // ── BUG FIX 1: Page switching — save current to ref-map, load new from ref-map ──
    const switchPage = useCallback(async (pageId, pageObj) => {
        if (board?.mode === 'notes') {
            setActivePageId(pageId);
            const pIdx = pages.findIndex(p => p._id === pageId);
            if (pIdx !== -1) {
                const targetY = 60 + pIdx * 1179;
                setStagePos(prev => ({
                    ...prev,
                    y: -(targetY - 50) * stageScale
                }));
            }
            return;
        }

        // Save current page data to ref-map AND backend
        const currentId = activePageId;
        if (currentId) {
            const currentDrawings = linesRef.current;
            const currentElements = shapesRef.current;
            pageDataRef.current[currentId] = { drawings: currentDrawings, elements: currentElements };
            try {
                await updatePage(currentId, { drawings: currentDrawings, elements: currentElements });
            } catch { }
        }

        // Load new page data from ref-map
        const data = pageObj
            ? { drawings: pageObj.drawings || [], elements: pageObj.elements || [] }
            : pageDataRef.current[pageId] || { drawings: [], elements: [] };

        setActivePageId(pageId);
        setLines(data.drawings);
        setShapes(data.elements);
        setSelectedIds(new Set());

        // Reset history for new page
        const snap = { lines: [...data.drawings], shapes: [...data.elements] };
        historyRef.current = [snap];
        historyRef.current._idx = 0;
        setHistoryIdx(0);
        setHistoryLen(1);

        socket?.emit('page:switch', { boardId, pageId });
    }, [activePageId, boardId, socket, board?.mode, pages, stageScale]);

    const addPage = async () => {
        try {
            const { data } = await createPage(boardId, { title: `Page ${pages.length + 1}` });
            pageDataRef.current[data._id] = { drawings: [], elements: [] };
            const nextPages = [...pages, data];
            setPages(nextPages);
            socket?.emit('page:create', { boardId, page: data });

            if (board?.mode === 'notes') {
                setActivePageId(data._id);
                const targetY = 60 + (nextPages.length - 1) * 1179;
                setStagePos(prev => ({
                    ...prev,
                    y: -(targetY - 50) * stageScale
                }));
                toast.success(`Page ${nextPages.length} added below!`);
                return;
            }

            switchPage(data._id, data);
            toast.success('Page added');
        } catch {
            toast.error('Failed to add page');
        }
    };

    const duplicatePage = async (pageId) => {
        const pageToDup = pages.find(p => p._id === pageId);
        const dataToDup = pageDataRef.current[pageId] || { drawings: [], elements: [] };
        try {
            const { data } = await createPage(boardId, {
                title: `${pageToDup?.title || pageToDup?.name || 'Page'} (Copy)`,
                drawings: dataToDup.drawings || [],
                elements: dataToDup.elements || [],
            });
            pageDataRef.current[data._id] = { drawings: [...(dataToDup.drawings || [])], elements: [...(dataToDup.elements || [])] };
            setPages(prev => [...prev, data]);
            switchPage(data._id, data);
            socket?.emit('page:create', { boardId, page: data });
            toast.success('Page duplicated');
        } catch {
            toast.error('Failed to duplicate page');
        }
    };

    const deletePageHandler = async (pageId) => {
        if (pages.length <= 1) return toast.error('Notes must have at least one page');
        try {
            await deletePage(pageId);
            const remaining = pages.filter(p => p._id !== pageId);
            setPages(remaining);
            delete pageDataRef.current[pageId];
            if (activePageId === pageId) {
                switchPage(remaining[0]._id, remaining[0]);
            }
            toast.success('Page deleted');
        } catch {
            toast.error('Failed to delete page');
        }
    };

    const renamePageHandler = async (pageId, newName) => {
        try {
            await updatePage(pageId, { title: newName, name: newName });
            setPages(prev => prev.map(p => p._id === pageId ? { ...p, title: newName, name: newName } : p));
            toast.success('Page renamed');
        } catch {
            toast.error('Failed to rename page');
        }
    };

    const reorderPageHandler = (pageId, direction) => {
        const idx = pages.findIndex(p => p._id === pageId);
        if (idx === -1) return;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= pages.length) return;
        const nextPages = [...pages];
        const temp = nextPages[idx];
        nextPages[idx] = nextPages[targetIdx];
        nextPages[targetIdx] = temp;
        setPages(nextPages);
    };

    const insertImageFromFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new window.Image();
            img.onload = () => {
                const maxWidth = 420;
                const maxHeight = 380;
                let w = img.width;
                let h = img.height;
                if (w > maxWidth || h > maxHeight) {
                    const ratio = Math.min(maxWidth / w, maxHeight / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                const stageCenterX = (-stagePos.x + stageSize.width / 2) / stageScale - w / 2;
                const stageCenterY = (-stagePos.y + stageSize.height / 2) / stageScale - h / 2;

                const shape = {
                    id: genId(),
                    type: 'image',
                    src: event.target.result,
                    x: Math.round(stageCenterX),
                    y: Math.round(stageCenterY),
                    width: w,
                    height: h,
                    opacity: 1
                };
                setShapes(prev => [...prev, shape]);
                setSelectedIds(new Set([shape.id]));
                socket?.emit('shape:add', { boardId, pageId: activePageId, shape });
                pushHistory();
                toast.success('Image placed on page!');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Clipboard paste for images (Ctrl+V / Cmd+V)
    useEffect(() => {
        const handlePaste = (e) => {
            if (editingText || editingERShape) return;
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        e.preventDefault();
                        insertImageFromFile(file);
                        break;
                    }
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [editingText, editingERShape, stagePos, stageScale, stageSize, activePageId]);

    const exportToA4PDF = async () => {
        const stage = stageRef.current;
        if (!stage) return;
        const uri = stage.toDataURL({ pixelRatio: 2 });
        const { default: jsPDF } = await import('jspdf');
        const pdf = new jsPDF('portrait', 'pt', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(uri, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${board?.title || 'Notes'}.pdf`);
        toast.success('A4 Notes PDF exported!');
    };

    // ── Autosave (updates ref-map too) ──
    useEffect(() => {
        if (!activePageId) return;
        const timer = setTimeout(async () => {
            const currentDrawings = linesRef.current;
            const currentElements = shapesRef.current;
            pageDataRef.current[activePageId] = { drawings: currentDrawings, elements: currentElements };
            try {
                await updatePage(activePageId, { drawings: currentDrawings, elements: currentElements });
            } catch { }
        }, 3000);
        return () => clearTimeout(timer);
    }, [lines, shapes, activePageId]);

    // ── Chat ──
    const sendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim() || !socket) return;
        // Add local echo since server now uses socket.to() (excludes sender)
        setChatMessages(prev => [...prev, {
            userId: effectiveUser?._id,
            userName: effectiveUser?.name || 'You',
            message: chatInput,
            timestamp: new Date().toISOString(),
        }]);
        socket.emit('chat:message', { boardId, workspaceId: board?.workspace, message: chatInput });
        setChatInput('');
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        e.target.value = ''; // Reset input
        const formData = new FormData();
        formData.append('file', file);
        const wsId = board?.workspace
            ? (typeof board.workspace === 'object' ? board.workspace._id : board.workspace)
            : null;
        if (wsId) formData.append('workspaceId', wsId);

        try {
            const { data } = await uploadFile(formData);
            if (data.url) {
                // Determine base URL dynamically based on axios baseURL
                const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');
                const fileUrl = `${baseUrl}${data.url}`;
                socket.emit('chat:message', {
                    boardId,
                    workspaceId: wsId,
                    message: `Shared a file: ${fileUrl}`
                });
            } else {
                toast.error(data.message || 'File upload failed');
            }
        } catch (err) {
            console.error('Upload Error:', err);
            toast.error('Failed to upload file');
        }
    };

    // ── Export ──
    const exportPNG = () => {
        const stage = stageRef.current;
        if (!stage) return;
        const uri = stage.toDataURL({ pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `${board?.title || 'board'}-page.png`;
        link.href = uri;
        link.click();
        toast.success('PNG exported!');
    };

    const exportPDF = async () => {
        const stage = stageRef.current;
        if (!stage) return;
        const uri = stage.toDataURL({ pixelRatio: 2 });
        const { default: jsPDF } = await import('jspdf');
        const pdf = new jsPDF('landscape', 'px', [stageSize.width, stageSize.height]);
        pdf.addImage(uri, 'PNG', 0, 0, stageSize.width, stageSize.height);
        pdf.save(`${board?.title || 'board'}.pdf`);
        toast.success('PDF exported!');
    };

    const copyShareLink = () => {
        const joinLink = `${window.location.origin}/join/${boardId}`;
        const textToCopy = `Join my room on justdraw!\nRoom Code: ${boardId}\nLink: ${joinLink}`;
        navigator.clipboard.writeText(textToCopy);
        toast.success('Room code and link copied!');
    };

    // ── Recording ──
    const toggleRecording = () => {
        if (isRecording) {
            // Stop recording
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            toast.success('Recording stopped. Downloading...');
        } else {
            // Start recording
            try {
                // Grab the correct Konva canvas (the last/top canvas in the container)
                const canvases = containerRef.current?.querySelectorAll('canvas');
                const canvas = canvases?.[canvases.length - 1];
                if (!canvas) throw new Error('Canvas not found');
                const stream = canvas.captureStream(30); // 30 fps
                const options = { mimeType: 'video/webm' };
                // Fallback to simpler options if webm is not supported by the browser
                const mediaRecorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? { mimeType: 'video/webm;codecs=vp9' } : undefined);

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        recordedChunksRef.current.push(e.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `${board?.title || 'session'}-recording.webm`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 100);
                    recordedChunksRef.current = [];
                };

                mediaRecorder.start(1000); // gather chunks every 1s
                mediaRecorderRef.current = mediaRecorder;
                setIsRecording(true);
                toast.success('Recording started');
            } catch (err) {
                console.error(err);
                toast.error('Failed to start recording');
            }
        }
    };

    // ── Zoom & Pan Wheel Handler ──
    const handleWheel = (e) => {
        e.evt.preventDefault();

        // Plain scroll / trackpad gesture pans the canvas
        if (!e.evt.ctrlKey && !e.evt.metaKey) {
            setStagePos(prev => ({
                x: prev.x - e.evt.deltaX,
                y: prev.y - e.evt.deltaY
            }));
            return;
        }

        // Ctrl + Scroll or Pinch gesture zooms in/out centered at cursor
        const scaleBy = 1.06;
        const stage = e.target.getStage();
        if (!stage) return;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
        const clampedScale = Math.max(0.1, Math.min(5, newScale));
        setStageScale(clampedScale);
        setStagePos({
            x: pointer.x - mousePointTo.x * clampedScale,
            y: pointer.y - mousePointTo.y * clampedScale,
        });
    };



    // ── Drag-drop from ShapeLibrary or Image Files ──
    const handleCanvasDrop = (e) => {
        e.preventDefault();
        // Check if user dropped an image file
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                insertImageFromFile(file);
                return;
            }
        }
        try {
            const iconData = JSON.parse(e.dataTransfer.getData('application/json'));
            const stage = stageRef.current;
            if (!stage) return;
            stage.setPointersPositions(e);
            const pos = stage.getRelativePointerPosition();
            const id = genId();
            const shape = {
                id, type: 'arch-icon', archId: iconData.id,
                x: pos.x - 40, y: pos.y - 40, width: 80, height: 80,
                label: iconData.label, iconPath: iconData.path,
                iconViewBox: iconData.viewBox, iconColor: iconData.color,
                stroke: '#2a2a3e', strokeWidth: 1,
            };
            setShapes(prev => [...prev, shape]);
            socket?.emit('shape:add', { boardId, pageId: activePageId, shape });
            setTimeout(() => pushHistory(), 0);
        } catch { }
    };

    const handleCanvasDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };

    // ── ER Diagram: Add Table ──
    const addERTable = () => {
        const id = genId();
        const shape = {
            id, type: 'er-table',
            x: (stageSize.width / 2) / stageScale - stagePos.x / stageScale,
            y: (stageSize.height / 2) / stageScale - stagePos.y / stageScale,
            tableName: 'new_table',
            fields: [{ name: 'id', type: 'uuid', pk: true, fk: false }],
        };
        setShapes(prev => [...prev, shape]);
        socket?.emit('shape:add', { boardId, pageId: activePageId, shape });
        setTimeout(() => pushHistory(), 0);
    };

    const addRelationship = () => { setTool('arrow'); toast('Draw an arrow between two tables', { icon: '↗️' }); };

    const handleERSave = (updatedShape) => {
        setShapes(prev => prev.map(s => s.id === updatedShape.id ? updatedShape : s));
        socket?.emit('shape:update', { boardId, pageId: activePageId, shapeId: updatedShape.id, updates: updatedShape });
        setTimeout(() => pushHistory(), 0);
    };

    // ── Commit inline text edit ──
    const commitTextEdit = useCallback((value) => {
        if (!editingText) return;
        const finalText = ((value !== undefined ? value : editingText.value) || '').trim();

        if (editingText.type === 'arch-label' || editingText.type === 'frame') {
            const labelToSave = finalText || editingText.value || 'Frame';
            setShapes(prev => prev.map(s => s.id === editingText.id ? { ...s, label: labelToSave, text: labelToSave } : s));
            socket?.emit('shape:update', { boardId, pageId: activePageId, shapeId: editingText.id, updates: { label: labelToSave, text: labelToSave } });
        } else {
            const textToSave = finalText || 'Text';
            setShapes(prev => prev.map(s => s.id === editingText.id ? {
                ...s,
                text: textToSave,
                label: textToSave,
                fill: editingText.fill || s.fill || color || '#ffffff',
                fontSize: editingText.fontSize || s.fontSize || fontSize || 18,
                fontFamily: editingText.fontFamily || s.fontFamily || fontFamily || 'Virgil',
                align: editingText.align || s.align || textAlign || 'left'
            } : s));
            socket?.emit('shape:update', { boardId, pageId: activePageId, shapeId: editingText.id, updates: { text: textToSave, label: textToSave } });
        }
        setTimeout(() => pushHistory(), 0);
        setEditingText(null);
        if (!toolLock) setTool('select');
    }, [editingText, socket, boardId, activePageId, pushHistory, color, fontSize, fontFamily, textAlign, toolLock]);

    // Auto-focus textarea when editing starts
    useEffect(() => {
        if (editingText && textareaRef.current) {
            textareaRef.current.focus();
            // Move cursor to the end instead of selecting all, OR just select all initially once
            textareaRef.current.select();
        }
    }, [editingText?.id]); // BUG FIX: Only run when the editing ID changes, NOT on every keystroke

    // Mode-specific tools
    const modeTools = [];
    if (isERMode) {
        modeTools.push(
            { id: 'er-table', icon: Database, label: 'Add Table', action: addERTable },
            { id: 'er-rel', icon: Link2, label: 'Relationship', action: addRelationship },
        );
    }
    if (isWhiteboard || isNotesMode) {
        modeTools.push(
            { id: 'sticky', icon: StickyNote, label: 'Sticky Note', action: () => setTool('sticky') },
        );
    }

    if (loading) {
        return (
            <ExcalidrawLoader fullScreen={true} />
        );
    }

    const modeLabel = isNotesMode ? 'Notes Board' : isArchMode ? 'Architecture' : isERMode ? 'ER Diagram' : 'Whiteboard';
    const modeColor = isNotesMode ? '#f59e0b' : isArchMode ? '#06b6d4' : isERMode ? '#8b5cf6' : '#6965db';

    // ── Role-based Permissions ──
    const isHost = board?.createdBy && effectiveUser?._id === board.createdBy.toString();

    let availableTools = TOOLS;
    if (isArchMode) {
        availableTools = TOOLS.filter(t => ['select', 'pan', 'arrow', 'text', 'eraser'].includes(t.id));
    } else if (isERMode) {
        availableTools = TOOLS.filter(t => ['select', 'pan', 'arrow', 'text', 'eraser'].includes(t.id));
    }

    // Properties panel — show when a drawing tool is active or shapes are selected
    const hasSelection = selectedIds.size > 0;
    const selectedShape = shapes.find(s => selectedIds.has(s.id));
    const isDrawingTool = tool !== 'select' && tool !== 'pan' && tool !== 'laser' && tool !== 'comment';
    const showPropertiesPanel = hasSelection || isDrawingTool || tool === 'eraser';



    // Stroke color options (Excalidraw palette top picks)
    const strokeColors = ['#ffffff', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];
    const bgColors = ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'];
    const PALETTE_COLORS = [
        '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da',
        '#adb5bd', '#6c757d', '#495057', '#343a40', '#212529',
        '#ffc9c9', '#ff8787', '#ff6b6b', '#fa5252', '#f03e3e',
        '#d6336c', '#ae3ec9', '#7048e8', '#4263eb', '#1c7ed6',
        '#1098ad', '#0ca678', '#37b24d', '#74b816', '#f59f00',
        '#f76707'
    ];

    return (
        <div className={`excalidraw-board${theme === 'light' ? ' light-mode' : ''}`}>

            {/* ══ CANVAS AREA ══ */}
            <div
                className={`exc-canvas-area ${isNotesMode ? 'bg-notes-board' : isArchMode ? 'bg-architecture' : isERMode ? 'bg-er-diagram' : 'bg-whiteboard'}`}
                style={{
                    backgroundColor: canvasBg,
                    left: isArchMode && isArchLibOpen ? 300 : 0,
                    width: isArchMode && isArchLibOpen ? 'calc(100% - 300px)' : '100%',
                    transition: 'left 0.22s cubic-bezier(0.16, 1, 0.3, 1), width 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                ref={containerRef}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
            >
                <CommentsOverlay
                    boardId={boardId}
                    pageId={activePageId}
                    stageScale={stageScale}
                    stagePos={stagePos}
                    effectiveUser={effectiveUser}
                    activeTool={tool}
                    key={commentsVersion}
                />
                <Stage
                    ref={stageRef}
                    width={stageSize.width} height={stageSize.height}
                    scaleX={stageScale} scaleY={stageScale}
                    x={stagePos.x} y={stagePos.y}
                    draggable={tool === 'pan'}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown} onMousemove={handleMouseMove} onMouseup={handleMouseUp}
                    onPointerDown={handleMouseDown} onPointermove={handleMouseMove} onPointerup={handleMouseUp}
                    onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                    onDragEnd={(e) => { if (tool === 'pan') setStagePos({ x: e.target.x(), y: e.target.y() }); }}
                    style={{
                        cursor: tool === 'pan'
                            ? 'grab'
                            : tool === 'select'
                                ? 'default'
                                : isNotesMode
                                    ? (tool === 'pencil' || tool === 'pen'
                                        ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z\' fill=\'%23f59e0b\' stroke=\'%230f172a\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3Cpolygon points=\'2 22 4 17 7 20\' fill=\'%230f172a\'/%3E%3C/svg%3E") 2 22, default'
                                        : tool === 'highlighter'
                                            ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'m9 11-6 6v3h3l6-6\' fill=\'%23facc15\' stroke=\'%23d97706\' stroke-width=\'1.5\'/%3E%3Cpath d=\'m22 7-4.5-4.5a2.12 2.12 0 0 0-3 0L11 6l7 7 3.5-3.5a2.12 2.12 0 0 0 0-3\' fill=\'%23fde047\' stroke=\'%23ca8a04\' stroke-width=\'1.5\'/%3E%3C/svg%3E") 3 20, default'
                                            : tool === 'eraser'
                                                ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' viewBox=\'0 0 20 20\'%3E%3Ccircle cx=\'10\' cy=\'10\' r=\'8\' fill=\'none\' stroke=\'%23f59e0b\' stroke-width=\'2\' stroke-dasharray=\'3 3\'/%3E%3Ccircle cx=\'10\' cy=\'10\' r=\'2\' fill=\'%23f59e0b\'/%3E%3C/svg%3E") 10 10, default'
                                                : 'default')
                                    : 'crosshair'
                    }}
                >
                    <Layer>
                        {/* A4 Paper Sheets for Notes Mode (Vertical continuous pages) */}
                        {isNotesMode && (
                            <Group listening={false}>
                                {(pages.length > 0 ? pages : [{ _id: 'page_1', title: 'Page 1' }]).map((p, pIdx) => {
                                    const pageY = 60 + pIdx * 1179;
                                    const a4X = notesPageX;
                                    return (
                                        <Group key={p._id || pIdx} x={a4X} y={pageY}>
                                            {/* Realistic Paper Drop Shadow */}
                                            <Rect x={4} y={8} width={800} height={1131} fill="rgba(0, 0, 0, 0.12)" cornerRadius={4} />
                                            {/* Clean Paper Sheet */}
                                            <Rect x={0} y={0} width={800} height={1131} fill="#ffffff" stroke="rgba(0, 0, 0, 0.1)" strokeWidth={1} cornerRadius={4} />

                                            {/* Lined / Ruled Paper */}
                                            {paperPattern === 'lined' && (
                                                <Group>
                                                    {/* Red vertical margin line */}
                                                    <Line points={[68, 30, 68, 1100]} stroke="#fca5a5" strokeWidth={1.5} />
                                                    {/* Horizontal ruled lines */}
                                                    {Array.from({ length: 33 }).map((_, rIdx) => (
                                                        <Line
                                                            key={rIdx}
                                                            points={[20, 64 + rIdx * 32, 780, 64 + rIdx * 32]}
                                                            stroke="rgba(203, 213, 225, 0.55)"
                                                            strokeWidth={1}
                                                        />
                                                    ))}
                                                </Group>
                                            )}

                                            {/* Dotted Paper Grid */}
                                            {paperPattern === 'dots' && (
                                                <Group>
                                                    {Array.from({ length: 27 }).map((_, cIdx) => (
                                                        <Group key={`dc_${cIdx}`}>
                                                            {Array.from({ length: 39 }).map((_, rIdx) => (
                                                                <Circle
                                                                    key={`d_${cIdx}_${rIdx}`}
                                                                    x={28 + cIdx * 28}
                                                                    y={28 + rIdx * 28}
                                                                    radius={1.2}
                                                                    fill="#94a3b8"
                                                                />
                                                            ))}
                                                        </Group>
                                                    ))}
                                                </Group>
                                            )}

                                            {/* Graph / Math Grid */}
                                            {paperPattern === 'grid' && (
                                                <Group>
                                                    {Array.from({ length: 28 }).map((_, cIdx) => (
                                                        <Line key={`vg_${cIdx}`} points={[20 + cIdx * 28, 20, 20 + cIdx * 28, 1110]} stroke="rgba(203, 213, 225, 0.45)" strokeWidth={1} />
                                                    ))}
                                                    {Array.from({ length: 40 }).map((_, rIdx) => (
                                                        <Line key={`hg_${rIdx}`} points={[20, 20 + rIdx * 28, 776, 20 + rIdx * 28]} stroke="rgba(203, 213, 225, 0.45)" strokeWidth={1} />
                                                    ))}
                                                </Group>
                                            )}

                                            {/* Plain / Blank paper: Pure clean white surface with no lines */}

                                            {/* Sheet Header Title & Badge */}
                                            <Group x={24} y={18}>
                                                <Rect width={150} height={22} fill="#f1f5f9" cornerRadius={4} />
                                                <Text x={10} y={6} text={`${p.title || `Page ${pIdx + 1}`} • Page ${pIdx + 1} of ${pages.length || 1}`} fill="#475569" fontSize={11} fontFamily="Inter" fontStyle="600" />
                                            </Group>

                                            {/* Page bottom footer */}
                                            <Group x={720} y={1098}>
                                                <Text text={`P. ${pIdx + 1}`} fill="#94a3b8" fontSize={10} fontFamily="Inter" fontStyle="600" />
                                            </Group>

                                            {/* Page break divider between sheets */}
                                            {pIdx < (pages.length || 1) - 1 && (
                                                <Group y={1131 + 24}>
                                                    <Line points={[0, 0, 800, 0]} stroke="#cbd5e1" strokeWidth={1} dash={[6, 6]} />
                                                    <Text x={340} y={-6} text="— Page Break —" fill="#94a3b8" fontSize={10} fontFamily="Inter" />
                                                </Group>
                                            )}
                                        </Group>
                                    );
                                })}
                            </Group>
                        )}

                        {/* Shapes */}
                        {shapes.map((s) => {
                            const isSelected = selectedIds.has(s.id);

                            if (s.type === 'frame') {
                                const fw = s.width || 400;
                                const fh = s.height || 300;
                                return (
                                    <Group key={s.id} id={s.id} x={s.x} y={s.y}
                                        draggable={tool === 'select'}
                                        opacity={s.opacity !== undefined ? s.opacity : 1}
                                        onClick={(e) => handleShapeClick(e, s.id)} onTap={(e) => handleShapeClick(e, s.id)}
                                        onDragEnd={(e) => handleShapeDragEnd(e, s)}
                                        onTransformEnd={(e) => handleTransformEnd(e, s)}
                                        onDblClick={() => {
                                            const stageBox = containerRef.current?.getBoundingClientRect();
                                            if (stageBox) {
                                                const absX = stageBox.left + s.x * stageScale + stagePos.x;
                                                const absY = stageBox.top + s.y * stageScale + stagePos.y;
                                                setEditingText({ id: s.id, x: absX + 8, y: absY - 24, width: 200, height: 20, value: s.label || s.text || 'Frame', type: 'frame' });
                                            }
                                        }}
                                    >
                                        <Rect width={fw} height={fh}
                                            fill="rgba(255, 255, 255, 0.01)"
                                            stroke={isSelected ? '#6366f1' : 'rgba(148, 163, 184, 0.45)'}
                                            strokeWidth={isSelected ? 1.5 : 1}
                                            dash={[6, 4]}
                                            cornerRadius={6}
                                        />
                                        <Rect x={0} y={-26} width={Math.max(90, ((s.label || s.text || 'Frame').length * 8 + 20))} height={26}
                                            fill={isSelected ? '#4f46e5' : '#27273a'}
                                            cornerRadius={[6, 6, 0, 0]}
                                        />
                                        <Text x={10} y={-19}
                                            text={s.label || s.text || 'Frame'}
                                            fill="#ffffff"
                                            fontSize={12}
                                            fontFamily="Inter, sans-serif"
                                            fontStyle="600"
                                        />
                                    </Group>
                                );
                            }

                            if (s.type === 'rect') {
                                const rw = Math.abs(s.width || 100);
                                const rh = Math.abs(s.height || 60);
                                return (
                                    <Group key={s.id} id={s.id} x={s.x} y={s.y}
                                        draggable={tool === 'select'}
                                        opacity={s.opacity !== undefined ? s.opacity : 1}
                                        onClick={(e) => handleShapeClick(e, s.id)} onTap={(e) => handleShapeClick(e, s.id)}
                                        onDragEnd={(e) => handleShapeDragEnd(e, s)}
                                        onTransformEnd={(e) => handleTransformEnd(e, s)}
                                        onDblClick={() => {
                                            const stageBox = containerRef.current?.getBoundingClientRect();
                                            if (stageBox) {
                                                const absX = stageBox.left + s.x * stageScale + stagePos.x;
                                                const absY = stageBox.top + s.y * stageScale + stagePos.y;
                                                setEditingText({ id: s.id, x: absX + 8, y: absY + rh / 2 - 12, width: Math.max(rw - 16, 120), height: 28, value: s.text || s.label || '', type: 'rect' });
                                            }
                                        }}
                                    >
                                        <Rect
                                            width={rw} height={rh}
                                            fill={s.fill === 'transparent' ? undefined : s.fill}
                                            stroke={isSelected ? '#6965db' : (s.stroke || '#ffffff')}
                                            strokeWidth={isSelected ? (s.strokeWidth || 2) + 1.5 : (s.strokeWidth || 2)}
                                            cornerRadius={s.edges === 'sharp' ? 0 : 8}
                                            dash={s.strokeStyle === 'dashed' ? [10, 6] : s.strokeStyle === 'dotted' ? [3, 5] : undefined}
                                            shadowColor={isSelected ? 'rgba(105, 101, 219, 0.4)' : undefined}
                                            shadowBlur={isSelected ? 12 : 0}
                                        />
                                        {(s.text || s.label) && editingText?.id !== s.id && (
                                            <Text
                                                x={8} y={rh / 2 - (s.fontSize || 14) * 0.7}
                                                width={rw - 16}
                                                text={s.text || s.label}
                                                fill={s.stroke || '#ffffff'}
                                                fontSize={s.fontSize || 14}
                                                fontFamily={s.fontFamily === 'Code' ? 'Cascadia Code, monospace' : s.fontFamily === 'Helvetica' ? 'Inter, sans-serif' : 'Virgil, Caveat, cursive'}
                                                align={s.align || 'center'}
                                            />
                                        )}
                                    </Group>
                                );
                            }

                            if (s.type === 'circle') {
                                const cr = Math.abs(s.radius || 35);
                                return (
                                    <Group key={s.id} id={s.id} x={s.x} y={s.y}
                                        draggable={tool === 'select'}
                                        opacity={s.opacity !== undefined ? s.opacity : 1}
                                        onClick={(e) => handleShapeClick(e, s.id)} onTap={(e) => handleShapeClick(e, s.id)}
                                        onDragEnd={(e) => handleShapeDragEnd(e, s)}
                                        onTransformEnd={(e) => handleTransformEnd(e, s)}
                                        onDblClick={() => {
                                            const stageBox = containerRef.current?.getBoundingClientRect();
                                            if (stageBox) {
                                                const absX = stageBox.left + (s.x - cr) * stageScale + stagePos.x;
                                                const absY = stageBox.top + (s.y - cr) * stageScale + stagePos.y;
                                                setEditingText({ id: s.id, x: absX + 8, y: absY + cr - 12, width: Math.max(cr * 2 - 16, 100), height: 28, value: s.text || s.label || '', type: 'circle' });
                                            }
                                        }}
                                    >
                                        <Circle
                                            radius={cr}
                                            fill={s.fill === 'transparent' ? undefined : s.fill}
                                            stroke={isSelected ? '#6965db' : (s.stroke || '#ffffff')}
                                            strokeWidth={isSelected ? (s.strokeWidth || 2) + 1.5 : (s.strokeWidth || 2)}
                                            dash={s.strokeStyle === 'dashed' ? [10, 6] : s.strokeStyle === 'dotted' ? [3, 5] : undefined}
                                            shadowColor={isSelected ? 'rgba(105, 101, 219, 0.4)' : undefined}
                                            shadowBlur={isSelected ? 12 : 0}
                                        />
                                        {(s.text || s.label) && editingText?.id !== s.id && (
                                            <Text
                                                x={-cr + 8} y={-(s.fontSize || 14) * 0.7}
                                                width={cr * 2 - 16}
                                                text={s.text || s.label}
                                                fill={s.stroke || '#ffffff'}
                                                fontSize={s.fontSize || 14}
                                                fontFamily={s.fontFamily === 'Code' ? 'Cascadia Code, monospace' : s.fontFamily === 'Helvetica' ? 'Inter, sans-serif' : 'Virgil, Caveat, cursive'}
                                                align={s.align || 'center'}
                                            />
                                        )}
                                    </Group>
                                );
                            }

                            if (s.type === 'diamond') {
                                const dw = Math.abs(s.width || 120);
                                const dh = Math.abs(s.height || 80);
                                return (
                                    <Group key={s.id} id={s.id} x={s.x} y={s.y}
                                        draggable={tool === 'select'}
                                        opacity={s.opacity !== undefined ? s.opacity : 1}
                                        onClick={(e) => handleShapeClick(e, s.id)} onTap={(e) => handleShapeClick(e, s.id)}
                                        onDragEnd={(e) => handleShapeDragEnd(e, s)}
                                        onTransformEnd={(e) => handleTransformEnd(e, s)}
                                        onDblClick={() => {
                                            const stageBox = containerRef.current?.getBoundingClientRect();
                                            if (stageBox) {
                                                const absX = stageBox.left + s.x * stageScale + stagePos.x;
                                                const absY = stageBox.top + s.y * stageScale + stagePos.y;
                                                setEditingText({ id: s.id, x: absX + 8, y: absY + dh / 2 - 12, width: Math.max(dw - 16, 100), height: 28, value: s.text || s.label || '', type: 'diamond' });
                                            }
                                        }}
                                    >
                                        <Line
                                            points={[dw / 2, 0, dw, dh / 2, dw / 2, dh, 0, dh / 2]}
                                            closed={true}
                                            fill={s.fill === 'transparent' ? undefined : s.fill}
                                            stroke={isSelected ? '#6965db' : (s.stroke || '#ffffff')}
                                            strokeWidth={isSelected ? (s.strokeWidth || 2) + 1.5 : (s.strokeWidth || 2)}
                                            dash={s.strokeStyle === 'dashed' ? [10, 6] : s.strokeStyle === 'dotted' ? [3, 5] : undefined}
                                            shadowColor={isSelected ? 'rgba(105, 101, 219, 0.4)' : undefined}
                                            shadowBlur={isSelected ? 12 : 0}
                                        />
                                        {(s.text || s.label) && (
                                            <Text
                                                x={8} y={dh / 2 - (s.fontSize || 14) * 0.7}
                                                width={dw - 16}
                                                text={s.text || s.label}
                                                fill={s.stroke || '#ffffff'}
                                                fontSize={s.fontSize || 14}
                                                fontFamily={s.fontFamily === 'Code' ? 'Cascadia Code, monospace' : s.fontFamily === 'Helvetica' ? 'Inter, sans-serif' : 'Virgil, Caveat, cursive'}
                                                align={s.align || 'center'}
                                            />
                                        )}
                                    </Group>
                                );
                            }

                            if ((s.type === 'arrow' || s.type === 'line') && s.points) {
                                const isSelected = selectedIds.has(s.id);
                                const arrColor = isSelected ? '#6965db' : (s.stroke || '#ffffff');
                                const strokeW = isSelected ? (s.strokeWidth || 2) + 1 : (s.strokeWidth || 2);
                                const isArrow = s.type === 'arrow' || (s.arrowhead && s.arrowhead !== 'none');
                                const currType = s.arrowType || arrowType || 'straight';
                                const { path, arrowheadPath, midHandles, x1, y1, x2, y2 } = getArrowData(s.points, currType, s.customMidX, s.bendPoint, s.customSeg1Y, s.customSeg2Y);
                                const midX = (x1 + x2) / 2;
                                const midY = (y1 + y2) / 2;
                                const dashPattern = s.strokeStyle === 'dashed' ? [10, 6] : s.strokeStyle === 'dotted' ? [3, 5] : undefined;
                                const roughness = s.sloppiness === 'architect' ? 0.1 : s.sloppiness === 'cartoonist' ? 2.5 : 1.2;

                                return (
                                    <Group key={s.id} id={s.id}
                                        draggable={tool === 'select' && !isSelected}
                                        opacity={s.opacity !== undefined ? s.opacity : 1}
                                        onClick={(e) => handleShapeClick(e, s.id)} onTap={(e) => handleShapeClick(e, s.id)}
                                        onDragEnd={(e) => handleShapeDragEnd(e, s)}
                                        onDblClick={() => {
                                            const stageBox = containerRef.current?.getBoundingClientRect();
                                            if (stageBox) {
                                                const absX = stageBox.left + midX * stageScale + stagePos.x;
                                                const absY = stageBox.top + midY * stageScale + stagePos.y;
                                                setEditingText({ id: s.id, x: absX - 60, y: absY - 12, width: 120, height: 28, value: s.text || s.label || '', type: s.type });
                                            }
                                        }}
                                    >
                                        {/* Hand-Drawn Excalidraw Sketch Arrow & Line */}
                                        <Shape
                                            hitStrokeWidth={20}
                                            stroke={arrColor}
                                            strokeWidth={strokeW}
                                            sceneFunc={(context, shape) => {
                                                const ctx = context._context || context;
                                                renderRoughPath(ctx, path, {
                                                    stroke: arrColor,
                                                    strokeWidth: strokeW,
                                                    roughness,
                                                    seed: s.seed || 1,
                                                    strokeLineDash: dashPattern
                                                });
                                                if (isArrow && arrowheadPath) {
                                                    renderRoughPath(ctx, arrowheadPath, {
                                                        stroke: arrColor,
                                                        strokeWidth: strokeW,
                                                        roughness,
                                                        seed: (s.seed || 1) + 1
                                                    });
                                                }
                                                context.fillStrokeShape(shape);
                                            }}
                                        />

                                        {/* Optional Label */}
                                        {(s.text || s.label) && (
                                            <Group x={midX} y={midY}>
                                                <Rect offsetX={(s.text || s.label).length * 3.5 + 8} offsetY={10} width={(s.text || s.label).length * 7 + 16} height={20} fill="#181824" cornerRadius={6} stroke={arrColor} strokeWidth={1} />
                                                <Text offsetX={(s.text || s.label).length * 3.5 + 8} offsetY={10} width={(s.text || s.label).length * 7 + 16} height={20} align="center" verticalAlign="middle" text={s.text || s.label} fill="#ffffff" fontSize={11} fontFamily="Virgil, Caveat, cursive" />
                                            </Group>
                                        )}

                                        {/* Excalidraw Selection Control Handles (1:1 with excalidraw.com) */}
                                        {isSelected && (
                                            <Group>
                                                {/* Start handle (ring) */}
                                                <Circle
                                                    x={x1}
                                                    y={y1}
                                                    radius={6}
                                                    stroke="#818cf8"
                                                    strokeWidth={1.5}
                                                    fill="#181824"
                                                    draggable={true}
                                                    onDragStart={(e) => { e.cancelBubble = true; }}
                                                    onDragMove={(e) => {
                                                        e.cancelBubble = true;
                                                        const nx = e.target.x();
                                                        const ny = e.target.y();
                                                        handleUpdateArrowHandle(s.id, { points: [nx, ny, x2, y2] });
                                                    }}
                                                    onDragEnd={(e) => { e.cancelBubble = true; pushHistory(); }}
                                                />

                                                {/* Intermediate handles (purple filled circles) */}
                                                {midHandles.map(h => {
                                                    if (h.type === 'elbowMid') {
                                                        return (
                                                            <Circle
                                                                key={h.id}
                                                                x={h.x}
                                                                y={h.y}
                                                                radius={7}
                                                                hitStrokeWidth={24}
                                                                fill="#818cf8"
                                                                stroke="#ffffff"
                                                                strokeWidth={2}
                                                                shadowColor="rgba(0,0,0,0.5)"
                                                                shadowBlur={6}
                                                                draggable={true}
                                                                onMouseEnter={(e) => {
                                                                    const stage = e.target.getStage();
                                                                    if (stage) stage.container().style.cursor = 'ew-resize';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    const stage = e.target.getStage();
                                                                    if (stage) stage.container().style.cursor = 'default';
                                                                }}
                                                                onDragStart={(e) => { e.cancelBubble = true; }}
                                                                onDragMove={(e) => {
                                                                    e.cancelBubble = true;
                                                                    handleUpdateArrowHandle(s.id, { customMidX: e.target.x() });
                                                                }}
                                                                onDragEnd={(e) => { e.cancelBubble = true; pushHistory(); }}
                                                            />
                                                        );
                                                    }
                                                    if (h.type === 'seg1') {
                                                        return (
                                                            <Circle
                                                                key={h.id}
                                                                x={h.x}
                                                                y={h.y}
                                                                radius={7}
                                                                hitStrokeWidth={24}
                                                                fill="#818cf8"
                                                                stroke="#ffffff"
                                                                strokeWidth={2}
                                                                shadowColor="rgba(0,0,0,0.5)"
                                                                shadowBlur={6}
                                                                draggable={true}
                                                                onMouseEnter={(e) => {
                                                                    const stage = e.target.getStage();
                                                                    if (stage) stage.container().style.cursor = 'ns-resize';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    const stage = e.target.getStage();
                                                                    if (stage) stage.container().style.cursor = 'default';
                                                                }}
                                                                onDragStart={(e) => { e.cancelBubble = true; }}
                                                                onDragMove={(e) => {
                                                                    e.cancelBubble = true;
                                                                    handleUpdateArrowHandle(s.id, { customSeg1Y: e.target.y() });
                                                                }}
                                                                onDragEnd={(e) => { e.cancelBubble = true; pushHistory(); }}
                                                            />
                                                        );
                                                    }
                                                    if (h.type === 'seg2') {
                                                        return (
                                                            <Circle
                                                                key={h.id}
                                                                x={h.x}
                                                                y={h.y}
                                                                radius={7}
                                                                hitStrokeWidth={24}
                                                                fill="#818cf8"
                                                                stroke="#ffffff"
                                                                strokeWidth={2}
                                                                shadowColor="rgba(0,0,0,0.5)"
                                                                shadowBlur={6}
                                                                draggable={true}
                                                                onMouseEnter={(e) => {
                                                                    const stage = e.target.getStage();
                                                                    if (stage) stage.container().style.cursor = 'ns-resize';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    const stage = e.target.getStage();
                                                                    if (stage) stage.container().style.cursor = 'default';
                                                                }}
                                                                onDragStart={(e) => { e.cancelBubble = true; }}
                                                                onDragMove={(e) => {
                                                                    e.cancelBubble = true;
                                                                    handleUpdateArrowHandle(s.id, { customSeg2Y: e.target.y() });
                                                                }}
                                                                onDragEnd={(e) => { e.cancelBubble = true; pushHistory(); }}
                                                            />
                                                        );
                                                    }
                                                    if (h.type === 'bend') {
                                                        return (
                                                            <Circle
                                                                key={h.id}
                                                                x={h.x}
                                                                y={h.y}
                                                                radius={7}
                                                                hitStrokeWidth={24}
                                                                fill="#818cf8"
                                                                stroke="#ffffff"
                                                                strokeWidth={2}
                                                                shadowColor="rgba(0,0,0,0.5)"
                                                                shadowBlur={6}
                                                                draggable={true}
                                                                onMouseEnter={(e) => {
                                                                    const stage = e.target.getStage();
                                                                    if (stage) stage.container().style.cursor = 'grab';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    const stage = e.target.getStage();
                                                                    if (stage) stage.container().style.cursor = 'default';
                                                                }}
                                                                onDragStart={(e) => {
                                                                    e.cancelBubble = true;
                                                                    const stage = e.target.getStage();
                                                                    if (stage) stage.container().style.cursor = 'grabbing';
                                                                }}
                                                                onDragMove={(e) => {
                                                                    e.cancelBubble = true;
                                                                    const hx = e.target.x();
                                                                    const hy = e.target.y();
                                                                    handleUpdateArrowHandle(s.id, {
                                                                        arrowType: 'curved',
                                                                        bendPoint: { x: hx, y: hy }
                                                                    });
                                                                }}
                                                                onDragEnd={(e) => {
                                                                    e.cancelBubble = true;
                                                                    const stage = e.target.getStage();
                                                                    if (stage) stage.container().style.cursor = 'grab';
                                                                    pushHistory();
                                                                }}
                                                            />
                                                        );
                                                    }
                                                    return (
                                                        <Circle
                                                            key={h.id}
                                                            x={h.x}
                                                            y={h.y}
                                                            radius={5}
                                                            fill="#818cf8"
                                                            stroke="#a5b4fc"
                                                            strokeWidth={1}
                                                        />
                                                    );
                                                })}

                                                {/* End handle (ring) */}
                                                <Circle
                                                    x={x2}
                                                    y={y2}
                                                    radius={6}
                                                    stroke="#818cf8"
                                                    strokeWidth={1.5}
                                                    fill="#181824"
                                                    draggable={true}
                                                    onDragStart={(e) => { e.cancelBubble = true; }}
                                                    onDragMove={(e) => {
                                                        e.cancelBubble = true;
                                                        const nx = e.target.x();
                                                        const ny = e.target.y();
                                                        handleUpdateArrowHandle(s.id, { points: [x1, y1, nx, ny] });
                                                    }}
                                                    onDragEnd={(e) => { e.cancelBubble = true; pushHistory(); }}
                                                />
                                            </Group>
                                        )}
                                    </Group>
                                );
                            }

                            if (s.type === 'text') {
                                if (editingText?.id === s.id) return null;
                                const fontMap = {
                                    'Virgil': 'Virgil, Caveat, cursive',
                                    'Helvetica': 'Inter, sans-serif',
                                    'Code': 'Cascadia Code, monospace'
                                };
                                return (
                                    <Text key={s.id} id={s.id} x={s.x} y={s.y} text={s.text || 'Type text...'}
                                        fill={s.fill || color || '#ffffff'} fontSize={s.fontSize || 20}
                                        fontFamily={fontMap[s.fontFamily] || fontMap['Virgil']}
                                        align={s.align || 'left'}
                                        draggable={tool === 'select'}
                                        opacity={s.opacity !== undefined ? s.opacity : 1}
                                        onClick={(e) => handleShapeClick(e, s.id)} onTap={(e) => handleShapeClick(e, s.id)}
                                        onDragEnd={(e) => handleShapeDragEnd(e, s)}
                                        onTransformEnd={(e) => handleTransformEnd(e, s)}
                                        onDblClick={() => {
                                            const stageBox = containerRef.current?.getBoundingClientRect();
                                            if (stageBox) {
                                                const absX = stageBox.left + s.x * stageScale + stagePos.x;
                                                const absY = stageBox.top + s.y * stageScale + stagePos.y;
                                                setEditingText({
                                                    id: s.id,
                                                    x: absX,
                                                    y: absY,
                                                    width: 250,
                                                    height: 36,
                                                    value: s.text || '',
                                                    type: 'text',
                                                    fill: s.fill,
                                                    fontSize: s.fontSize,
                                                    fontFamily: s.fontFamily,
                                                    align: s.align
                                                });
                                            }
                                        }}
                                    />
                                );
                            }

                            if (s.type === 'sticky') {
                                const sw = s.width || 180;
                                const sh = s.height || 140;
                                const stickyColors = {
                                    '#f59e0b': { bg: '#fef3c7', text: '#78350f', fold: '#fbbf24' },
                                    '#22c55e': { bg: '#dcfce7', text: '#14532d', fold: '#4ade80' },
                                    '#6366f1': { bg: '#e0e7ff', text: '#312e81', fold: '#818cf8' },
                                    '#ec4899': { bg: '#fce7f3', text: '#831843', fold: '#f472b6' },
                                    '#06b6d4': { bg: '#cffafe', text: '#164e63', fold: '#22d3ee' },
                                };
                                const stickyTheme = stickyColors[s.fill] || { bg: s.fill || '#fef3c7', text: '#78350f', fold: '#fbbf24' };
                                return (
                                    <Group key={s.id} id={s.id} x={s.x} y={s.y}
                                        draggable={tool === 'select'}
                                        opacity={s.opacity !== undefined ? s.opacity : 1}
                                        onClick={(e) => handleShapeClick(e, s.id)} onTap={(e) => handleShapeClick(e, s.id)}
                                        onDragEnd={(e) => handleShapeDragEnd(e, s)}
                                        onTransformEnd={(e) => handleTransformEnd(e, s)}
                                        onDblClick={() => {
                                            const stageBox = containerRef.current?.getBoundingClientRect();
                                            if (stageBox) {
                                                const absX = stageBox.left + s.x * stageScale + stagePos.x;
                                                const absY = stageBox.top + s.y * stageScale + stagePos.y;
                                                setEditingText({ id: s.id, x: absX + 12, y: absY + 12, width: sw - 24, height: sh - 24, value: s.text || '', type: 'sticky' });
                                            }
                                        }}
                                    >
                                        <Rect x={3} y={4} width={sw} height={sh} fill="rgba(0,0,0,0.08)" cornerRadius={4} />
                                        <Rect width={sw} height={sh} fill={stickyTheme.bg} cornerRadius={4}
                                            stroke={isSelected ? '#6965db' : 'transparent'} strokeWidth={2}
                                        />
                                        <Line points={[sw - 16, 0, sw, 0, sw, 16]} fill={stickyTheme.fold} closed />
                                        <Rect x={0} y={0} width={sw} height={28} fill={`${stickyTheme.fold}40`} cornerRadius={[4, 4, 0, 0]} />
                                        <Text x={8} y={7} width={sw - 16} text="📌 Note" fill={stickyTheme.text} fontSize={11} fontFamily="Inter" fontStyle="600" opacity={0.6} />
                                        <Text x={12} y={34} width={sw - 24} height={sh - 46}
                                            text={s.text || 'Double-click to edit'} fill={s.text ? stickyTheme.text : `${stickyTheme.text}80`}
                                            fontSize={s.fontSize || 14} fontFamily="Inter" fontStyle="500" lineHeight={1.4}
                                        />
                                    </Group>
                                );
                            }

                            if (s.type === 'arch-icon') {
                                const iw = s.width || 80; const ih = s.height || 80;
                                const iconDef = ARCH_ICONS.find(ic => ic.id === s.archId);
                                const iconPath = iconDef?.path || s.iconPath;
                                const iconColor = iconDef?.color || s.iconColor || '#6365f1';
                                const viewBoxStr = iconDef?.viewBox || s.iconViewBox || '0 0 24 24';
                                const vbParts = viewBoxStr.split(' ');
                                const vbWidth = parseFloat(vbParts[2]) || 24;
                                const vbHeight = parseFloat(vbParts[3]) || 24;

                                // Icon sizing (inner padded)
                                const iconSize = Math.min(iw, ih) * 0.6;
                                const scaleX = iconSize / vbWidth;
                                const scaleY = iconSize / vbHeight;
                                const iconX = (iw - iconSize) / 2;
                                const iconY = (ih - iconSize) / 2;

                                return (
                                    <Group key={s.id} id={s.id} x={s.x} y={s.y}
                                        draggable={tool === 'select'}
                                        onClick={(e) => handleShapeClick(e, s.id)} onTap={(e) => handleShapeClick(e, s.id)}
                                        onDragEnd={(e) => handleShapeDragEnd(e, s)}
                                        onDblClick={() => {
                                            const stageBox = containerRef.current?.getBoundingClientRect();
                                            if (stageBox) {
                                                const absX = stageBox.left + s.x * stageScale + stagePos.x;
                                                const absY = stageBox.top + (s.y + ih + 4) * stageScale + stagePos.y;
                                                setEditingText({ id: s.id, x: absX, y: absY, width: iw, height: 20, value: s.label || '', type: 'arch-label' });
                                            }
                                        }}
                                    >
                                        {isSelected && <Rect x={-4} y={-4} width={iw + 8} height={ih + 28} fill="transparent" stroke="#6965db" strokeWidth={2} cornerRadius={14} dash={[4, 2]} />}
                                        <Rect width={iw} height={ih} fill={iconColor} opacity={0.15} cornerRadius={12} />
                                        <Rect width={iw} height={ih} stroke={iconColor} strokeWidth={1} opacity={0.3} cornerRadius={12} />
                                        {iconPath && (
                                            <Path x={iconX} y={iconY} data={iconPath} fill={iconColor} scaleX={scaleX} scaleY={scaleY} />
                                        )}
                                        <Text x={0} y={ih + 8} width={iw} text={s.label || iconDef?.label || ''} fill="#cbd5e1" fontSize={12} fontFamily="Inter" align="center" />
                                    </Group>
                                );
                            }

                            if (s.type === 'er-entity' || s.type === 'er-table') {
                                return (
                                    <EREntity key={s.id} shape={s} isSelected={isSelected}
                                        tool={tool}
                                        onSelect={(e) => handleShapeClick(e, s.id)}
                                        onDragEnd={(e) => handleShapeDragEnd(e, s)}
                                        onDoubleClick={() => setEditingERShape(s)}
                                    />
                                );
                            }

                            if (s.type === 'image') {
                                return (
                                    <KonvaImageShape
                                        key={s.id}
                                        shape={s}
                                        isSelected={isSelected}
                                        tool={tool}
                                        onClick={(e) => handleShapeClick(e, s.id)}
                                        onTap={(e) => handleShapeClick(e, s.id)}
                                        onDragEnd={(e) => handleShapeDragEnd(e, s)}
                                        onTransformEnd={(e) => handleTransformEnd(e, s)}
                                    />
                                );
                            }

                            return null;
                        })}

                        {/* Real-time Shape Creation Preview */}
                        {drawingShape && (
                            <>
                                {drawingShape.type === 'rect' && (
                                    <Rect
                                        x={drawingShape.width < 0 ? drawingShape.x + drawingShape.width : drawingShape.x}
                                        y={drawingShape.height < 0 ? drawingShape.y + drawingShape.height : drawingShape.y}
                                        width={Math.abs(drawingShape.width)}
                                        height={Math.abs(drawingShape.height)}
                                        fill={drawingShape.fill === 'transparent' ? undefined : drawingShape.fill}
                                        stroke={drawingShape.stroke || '#ffffff'}
                                        strokeWidth={drawingShape.strokeWidth || 2}
                                        cornerRadius={drawingShape.edges === 'sharp' ? 0 : 8}
                                        dash={drawingShape.strokeStyle === 'dashed' ? [10, 6] : drawingShape.strokeStyle === 'dotted' ? [3, 5] : undefined}
                                    />
                                )}
                                {drawingShape.type === 'circle' && (
                                    <Circle
                                        x={drawingShape.x}
                                        y={drawingShape.y}
                                        radius={drawingShape.radius}
                                        fill={drawingShape.fill === 'transparent' ? undefined : drawingShape.fill}
                                        stroke={drawingShape.stroke || '#ffffff'}
                                        strokeWidth={drawingShape.strokeWidth || 2}
                                        dash={drawingShape.strokeStyle === 'dashed' ? [10, 6] : drawingShape.strokeStyle === 'dotted' ? [3, 5] : undefined}
                                    />
                                )}
                                {drawingShape.type === 'diamond' && (
                                    <Line
                                        points={[
                                            (drawingShape.width < 0 ? drawingShape.x + drawingShape.width : drawingShape.x) + Math.abs(drawingShape.width) / 2,
                                            drawingShape.height < 0 ? drawingShape.y + drawingShape.height : drawingShape.y,
                                            (drawingShape.width < 0 ? drawingShape.x + drawingShape.width : drawingShape.x) + Math.abs(drawingShape.width),
                                            (drawingShape.height < 0 ? drawingShape.y + drawingShape.height : drawingShape.y) + Math.abs(drawingShape.height) / 2,
                                            (drawingShape.width < 0 ? drawingShape.x + drawingShape.width : drawingShape.x) + Math.abs(drawingShape.width) / 2,
                                            (drawingShape.height < 0 ? drawingShape.y + drawingShape.height : drawingShape.y) + Math.abs(drawingShape.height),
                                            drawingShape.width < 0 ? drawingShape.x + drawingShape.width : drawingShape.x,
                                            (drawingShape.height < 0 ? drawingShape.y + drawingShape.height : drawingShape.y) + Math.abs(drawingShape.height) / 2,
                                        ]}
                                        closed={true}
                                        fill={drawingShape.fill === 'transparent' ? undefined : drawingShape.fill}
                                        stroke={drawingShape.stroke || '#ffffff'}
                                        strokeWidth={drawingShape.strokeWidth || 2}
                                        dash={drawingShape.strokeStyle === 'dashed' ? [10, 6] : drawingShape.strokeStyle === 'dotted' ? [3, 5] : undefined}
                                    />
                                )}
                                {drawingShape.type === 'arrow' && (
                                    (() => {
                                        const { path, arrowheadPath } = getArrowData(drawingShape.points, drawingShape.arrowType || arrowType, 0, drawingShape.bendPoint);
                                        return (
                                            <Shape
                                                sceneFunc={(context, shape) => {
                                                    const ctx = context._context || context;
                                                    renderRoughPath(ctx, path, {
                                                        stroke: drawingShape.stroke || '#ffffff',
                                                        strokeWidth: drawingShape.strokeWidth || 2,
                                                        roughness: drawingShape.sloppiness === 'architect' ? 0.1 : 1.2,
                                                        seed: 9999
                                                    });
                                                    if (arrowheadPath) {
                                                        renderRoughPath(ctx, arrowheadPath, {
                                                            stroke: drawingShape.stroke || '#ffffff',
                                                            strokeWidth: drawingShape.strokeWidth || 2,
                                                            roughness: drawingShape.sloppiness === 'architect' ? 0.1 : 1.2,
                                                            seed: 9998
                                                        });
                                                    }
                                                    context.fillStrokeShape(shape);
                                                }}
                                            />
                                        );
                                    })()
                                )}
                                {drawingShape.type === 'line' && (
                                    (() => {
                                        const { path } = getArrowData(drawingShape.points, drawingShape.arrowType || arrowType, 0, drawingShape.bendPoint);
                                        return (
                                            <Shape
                                                sceneFunc={(context, shape) => {
                                                    const ctx = context._context || context;
                                                    renderRoughPath(ctx, path, {
                                                        stroke: drawingShape.stroke || '#ffffff',
                                                        strokeWidth: drawingShape.strokeWidth || 2,
                                                        roughness: drawingShape.sloppiness === 'architect' ? 0.1 : 1.2,
                                                        seed: 9999
                                                    });
                                                    context.fillStrokeShape(shape);
                                                }}
                                            />
                                        );
                                    })()
                                )}
                                {drawingShape.type === 'frame' && (
                                    <Rect
                                        x={drawingShape.width < 0 ? drawingShape.x + drawingShape.width : drawingShape.x}
                                        y={drawingShape.height < 0 ? drawingShape.y + drawingShape.height : drawingShape.y}
                                        width={Math.abs(drawingShape.width)}
                                        height={Math.abs(drawingShape.height)}
                                        stroke="#6366f1"
                                        strokeWidth={1.5}
                                        dash={[6, 4]}
                                        cornerRadius={6}
                                    />
                                )}
                            </>
                        )}

                        {/* ══ FREEHAND DRAWING / ANNOTATION LINES (Rendered ON TOP of shapes & images) ══ */}
                        {isNotesMode ? (
                            <Group>
                                {(pages.length > 0 ? pages : [{ _id: 'page_1' }]).map((_, pIdx) => {
                                    const pageY = 60 + pIdx * 1179;
                                    return (
                                        <Group
                                            key={`clip_page_${pIdx}`}
                                            clip={{ x: notesPageX, y: pageY, width: 800, height: 1131 }}
                                        >
                                            {lines.map((line, i) => (
                                                <Line
                                                    key={i}
                                                    points={line.points}
                                                    stroke={line.color}
                                                    strokeWidth={line.width}
                                                    tension={line.tool === 'highlighter' ? 0.2 : 0.4}
                                                    lineCap={line.tool === 'highlighter' ? 'square' : 'round'}
                                                    lineJoin="round"
                                                    opacity={line.tool === 'highlighter' ? 0.36 : (line.opacity !== undefined ? line.opacity : (line.tool === 'pencil' ? 0.92 : 1))}
                                                    globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : (line.tool === 'highlighter' ? 'multiply' : 'source-over')}
                                                />
                                            ))}
                                        </Group>
                                    );
                                })}
                            </Group>
                        ) : (
                            lines.map((line, i) => (
                                <Line
                                    key={i}
                                    points={line.points}
                                    stroke={line.color}
                                    strokeWidth={line.width}
                                    tension={0.4}
                                    lineCap="round"
                                    lineJoin="round"
                                    opacity={line.tool === 'highlighter' ? 0.38 : (line.opacity !== undefined ? line.opacity : 1)}
                                    globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : 'source-over'}
                                />
                            ))
                        )}
                        {/* Lasso Selection Polygon */}
                        {tool === 'lasso' && lassoPoints.length >= 4 && (
                            <Line
                                points={lassoPoints}
                                stroke="#6366f1"
                                strokeWidth={1.5}
                                dash={[4, 4]}
                                closed={true}
                                fill="rgba(99, 102, 241, 0.1)"
                                tension={0.3}
                            />
                        )}

                        {/* Dark Smooth Eraser Trail & Sleek Cursor Animation */}
                        {tool === 'eraser' && eraserTrail.length >= 4 && (
                            <Line
                                points={eraserTrail}
                                stroke="rgba(55, 55, 60, 0.85)"
                                strokeWidth={eraserSize * 1.5}
                                tension={0.4}
                                lineCap="round"
                                lineJoin="round"
                                shadowColor="rgba(0,0,0,0.6)"
                                shadowBlur={8}
                            />
                        )}
                        {tool === 'eraser' && eraserPos && (
                            <Group x={eraserPos.x} y={eraserPos.y}>
                                <Circle
                                    radius={eraserSize + 4}
                                    fill="rgba(24, 24, 32, 0.25)"
                                    stroke="rgba(255, 255, 255, 0.2)"
                                    strokeWidth={1}
                                />
                                <Circle
                                    radius={eraserSize}
                                    fill="rgba(60, 60, 67, 0.35)"
                                    stroke="#a1a1aa"
                                    strokeWidth={2}
                                    dash={[5, 4]}
                                    shadowColor="rgba(0,0,0,0.5)"
                                    shadowBlur={6}
                                />
                                <Circle
                                    radius={3}
                                    fill="#ffffff"
                                />
                            </Group>
                        )}

                        {/* Laser Pointer Glowing Trail & Hot Cursor Point */}
                        {laserTrail.length >= 2 && (
                            <Line
                                points={laserTrail.flatMap(p => [p.x, p.y])}
                                stroke="#ff1144"
                                strokeWidth={5}
                                tension={0.35}
                                lineCap="round"
                                lineJoin="round"
                                shadowColor="#ff0033"
                                shadowBlur={18}
                                opacity={0.95}
                            />
                        )}
                        {(tool === 'laser' && (laserDot || (laserTrail.length > 0 && laserTrail[laserTrail.length - 1]))) && (
                            <Group x={(laserDot || laserTrail[laserTrail.length - 1]).x} y={(laserDot || laserTrail[laserTrail.length - 1]).y}>
                                <Circle radius={10} fill="rgba(255, 0, 50, 0.25)" />
                                <Circle radius={6} fill="#ff1144" shadowColor="#ff0033" shadowBlur={16} />
                                <Circle radius={2.5} fill="#ffffff" />
                            </Group>
                        )}
                        {/* Remote User Laser Pointers */}
                        {Object.entries(remoteLasers).map(([uid, rLaser]) => (
                            rLaser.points && rLaser.points.length >= 2 ? (
                                <Group key={uid}>
                                    <Line
                                        points={rLaser.points.flatMap(p => [p.x, p.y])}
                                        stroke={rLaser.color || '#ff1144'}
                                        strokeWidth={5}
                                        tension={0.35}
                                        lineCap="round"
                                        lineJoin="round"
                                        shadowColor="#ff0033"
                                        shadowBlur={18}
                                        opacity={0.9}
                                    />
                                    <Circle
                                        x={rLaser.points[rLaser.points.length - 1].x}
                                        y={rLaser.points[rLaser.points.length - 1].y}
                                        radius={6}
                                        fill={rLaser.color || '#ff1144'}
                                        shadowColor="#ff0033"
                                        shadowBlur={16}
                                    />
                                </Group>
                            ) : null
                        ))}

                        {/* Transformer for selection */}
                        <Transformer
                            ref={trRef}
                            rotateEnabled={!isCardSelected}
                            resizeEnabled={!isCardSelected}
                            enabledAnchors={isCardSelected ? [] : ['top-left', 'top-center', 'top-right', 'middle-right', 'bottom-right', 'bottom-center', 'bottom-left', 'middle-left']}
                            borderStroke={isCardSelected ? '#8b5cf6' : '#6965db'}
                            borderStrokeWidth={1.5}
                            borderCornerRadius={isCardSelected ? 8 : 0}
                            borderDash={isCardSelected ? [4, 4] : undefined}
                            anchorStroke="#6965db"
                            anchorFill="#fff"
                            anchorSize={8}
                            anchorCornerRadius={2}
                        />

                        {/* Remote cursors */}
                        {Object.values(remoteCursors).map(cursor => (
                            <Group key={cursor.userId} x={cursor.x} y={cursor.y}>
                                <Path data="M 0 0 L 0 16 L 5 12 L 9 20 L 11 19 L 7 11 L 13 11 Z" fill={getAvatarColor(cursor.userName)} opacity={0.9} />
                                <Text x={14} y={4} text={cursor.userName} fill={getAvatarColor(cursor.userName)} fontSize={11} fontFamily="Inter" fontStyle="bold"
                                    shadowColor="rgba(0,0,0,0.8)" shadowBlur={3} shadowOffsetX={1} shadowOffsetY={1}
                                />
                            </Group>
                        ))}
                    </Layer>
                </Stage>

                {/* Inline text editor */}
                {editingText && (
                    <textarea
                        ref={textareaRef}
                        className="exc-text-editor inline-text-editor"
                        style={{
                            position: 'fixed',
                            left: editingText.x,
                            top: editingText.y,
                            minWidth: 60,
                            width: Math.max(editingText.width || 180, 100),
                            fontSize: `${(editingText.fontSize || fontSize || 18) * stageScale}px`,
                            fontFamily: editingText.fontFamily === 'Code' ? 'Cascadia Code, monospace' : editingText.fontFamily === 'Helvetica' ? 'Inter, Helvetica, sans-serif' : 'Virgil, Caveat, cursive',
                            color: editingText.type === 'sticky' ? '#78350f' : (editingText.fill || color || '#ffffff'),
                            textAlign: editingText.align || textAlign || (editingText.type === 'text' ? 'left' : 'center'),
                            lineHeight: 1.3,
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '0',
                            padding: '0',
                            margin: '0',
                            outline: 'none',
                            boxShadow: 'none',
                            zIndex: 1000,
                            resize: 'none',
                            caretColor: editingText.type === 'sticky' ? '#78350f' : '#ffffff',
                        }}
                        value={editingText.value}
                        onChange={(e) => {
                            const val = e.target.value;
                            setEditingText(prev => ({ ...prev, value: val }));
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onBlur={() => commitTextEdit()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                commitTextEdit();
                            }
                            if (e.key === 'Escape') {
                                setEditingText(null);
                            }
                        }}
                        placeholder={editingText.type === 'sticky' ? 'Type your note...' : 'Type here...'}
                        autoFocus
                    />
                )}


                {/* Video Call Panel */}
                <Suspense fallback={null}>
                    <AnimatePresence>
                        {showVideo && <VideoCall socket={socket} roomId={board?.workspace || boardId} user={effectiveUser} onClose={() => setShowVideo(false)} />}
                    </AnimatePresence>
                </Suspense>
            </div>

            {/* ══ TOP BAR ══ */}
            <div className="exc-topbar" style={{ zIndex: showMainMenu ? 120 : 50 }}>
                {/* Left: Hamburger Main Menu + Home + Back + Board Name */}
                <div className="exc-topbar-left" style={{ position: 'relative', zIndex: showMainMenu ? 125 : undefined }}>
                    <button className="exc-back-btn" onClick={() => setShowMainMenu(!showMainMenu)} data-exc-tooltip="Main Menu">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
                    </button>
                    <button className="exc-back-btn" onClick={() => navigate('/dashboard')} data-exc-tooltip="Home / Dashboard">
                        <Home size={16} />
                    </button>
                    <span className="exc-board-title">{board?.title || 'Board'}</span>

                    {/* Notes Mode: Topbar Pages Pill Button (Tablet & Desktop) */}
                    {isNotesMode && (
                        <button
                            type="button"
                            className={`notes-topbar-pages-pill${showNotesPages ? ' active' : ''}`}
                            onClick={() => setShowNotesPages(!showNotesPages)}
                            title="Notes Page Gallery (Thumbnails & Add Page)"
                        >
                            <FileText size={14} color="#f59e0b" />
                            <span className="notes-pages-pill-label">Pages</span>
                            <span className="notes-pages-pill-badge">{pages.length}</span>
                            <ChevronDown
                                size={13}
                                style={{
                                    transform: showNotesPages ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.18s ease'
                                }}
                            />
                        </button>
                    )}

                    {isArchMode && (
                        <button
                            className={`exc-top-btn${isArchLibOpen ? ' active' : ''}`}
                            style={{
                                width: 36,
                                height: 36,
                                marginLeft: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 8,
                                color: isArchLibOpen ? '#fff' : '#c084fc',
                                backgroundColor: isArchLibOpen ? '#8b5cf6' : 'rgba(168, 85, 247, 0.18)',
                                border: isArchLibOpen ? '1px solid #8b5cf6' : '1px solid rgba(168, 85, 247, 0.45)',
                                boxShadow: isArchLibOpen ? '0 0 14px rgba(139, 92, 246, 0.55)' : '0 0 8px rgba(168, 85, 247, 0.25)',
                                transition: 'all 0.15s ease'
                            }}
                            onClick={() => setIsArchLibOpen(!isArchLibOpen)}
                            data-exc-tooltip="Toggle Components Library"
                        >
                            <ShapesLogoIcon size={24} />
                        </button>
                    )}

                    {/* Main Menu Dropdown (Excalidraw 1:1) */}
                    {showMainMenu && (
                        <>
                            {/* Backdrop to close menu automatically on outside click */}
                            <div
                                className="dropdown-menu-backdrop"
                                style={{
                                    position: 'fixed',
                                    inset: 0,
                                    zIndex: 115,
                                    background: 'transparent'
                                }}
                                onClick={() => setShowMainMenu(false)}
                            />
                            <div className="dropdown-menu-container" style={{ zIndex: 120 }} onClick={(e) => e.stopPropagation()}>
                            {/* Home / Dashboard */}
                            <button className="dropdown-menu-item" onClick={() => { navigate('/dashboard'); setShowMainMenu(false); }}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <Home size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text">Home / Dashboard</span>
                                </div>
                                <span className="dropdown-menu-item__shortcut">Ctrl+H</span>
                            </button>
                            {/* Open */}
                            <label className="dropdown-menu-item" style={{ cursor: 'pointer' }}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <Folder size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text">Open</span>
                                </div>
                                <span className="dropdown-menu-item__shortcut">Ctrl+O</span>
                                <input type="file" accept=".json,.excalidraw" onChange={loadBoardJSON} style={{ display: 'none' }} />
                            </label>

                            {/* Save to... */}
                            <button className="dropdown-menu-item" onClick={() => { saveBoardJSON(); setShowMainMenu(false); }}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <Download size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text">Save to...</span>
                                </div>
                            </button>

                            {/* Export image... */}
                            <button className="dropdown-menu-item" onClick={() => { exportPNG(); setShowMainMenu(false); }}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <FileImage size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text">Export image...</span>
                                </div>
                                <span className="dropdown-menu-item__shortcut">Ctrl+Shift+E</span>
                            </button>

                            {/* Live collaboration... */}
                            <button className="dropdown-menu-item" onClick={() => { copyShareLink(); setShowMainMenu(false); }}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <Users size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text">Live collaboration...</span>
                                </div>
                            </button>

                            {/* Command palette */}
                            <button className="dropdown-menu-item purple-text" onClick={() => { setShowCommandPalette(true); setShowMainMenu(false); }}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <Zap size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text" style={{ fontWeight: 600 }}>Command palette</span>
                                </div>
                                <span className="dropdown-menu-item__shortcut" style={{ color: '#a5b4fc' }}>Ctrl+/</span>
                            </button>

                            {/* Find on canvas */}
                            <button className="dropdown-menu-item" onClick={() => { setActiveRightTab('search'); setShowMainMenu(false); }}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <Search size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text">Find on canvas</span>
                                </div>
                                <span className="dropdown-menu-item__shortcut">Ctrl+F</span>
                            </button>

                            {/* Help */}
                            <button className="dropdown-menu-item" onClick={() => { setShowHelpModal(true); setShowMainMenu(false); }}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <HelpCircle size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text">Help</span>
                                </div>
                                <span className="dropdown-menu-item__shortcut">?</span>
                            </button>

                            {/* Reset the canvas */}
                            <button className="dropdown-menu-item" onClick={() => { clearPage(); setShowMainMenu(false); }}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <Trash2 size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text">Reset the canvas</span>
                                </div>
                            </button>

                            <div className="dropdown-menu-sep" />

                            {/* Excalidraw+ / justdraw+ */}
                            <button className="dropdown-menu-item" onClick={() => { toast.success('justdraw+ AI Features Active'); setShowMainMenu(false); }}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <Sparkles size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text">Excalidraw+</span>
                                </div>
                            </button>

                            {/* GitHub */}
                            <a className="dropdown-menu-item" href="https://github.com/vikash0064/justdraw.in" target="_blank" rel="noreferrer" onClick={() => setShowMainMenu(false)}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <Code size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text">GitHub</span>
                                </div>
                            </a>

                            {/* Follow us */}
                            <a className="dropdown-menu-item" href="https://twitter.com" target="_blank" rel="noreferrer" onClick={() => setShowMainMenu(false)}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <Share2 size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text">Follow us</span>
                                </div>
                            </a>

                            {/* Discord chat */}
                            <a className="dropdown-menu-item" href="https://discord.com" target="_blank" rel="noreferrer" onClick={() => setShowMainMenu(false)}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <MessageSquareText size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text">Discord chat</span>
                                </div>
                            </a>

                            {/* Sign in / Sign out */}
                            <button className="dropdown-menu-item purple-text" onClick={() => {
                                if (user) {
                                    navigate('/login');
                                } else {
                                    navigate('/login');
                                }
                                setShowMainMenu(false);
                            }}>
                                <div className="dropdown-menu-item__left">
                                    <div className="dropdown-menu-item__icon">
                                        <LogIn size={15} />
                                    </div>
                                    <span className="dropdown-menu-item__text" style={{ fontWeight: 600 }}>{user ? `Sign out (${user.name})` : 'Sign in'}</span>
                                </div>
                            </button>

                            <div className="dropdown-menu-sep" />

                            {/* Canvas background section directly in Main Menu */}
                            <div className="dropdown-canvas-bg-section" style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span className="dropdown-section-label" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--exc-text-dim, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Canvas Background</span>
                                <div className="dropdown-bg-swatches" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                    {['#121212', '#0d0d14', '#0f172a', '#171530'].map(bg => (
                                        <button
                                            key={bg}
                                            className={`dropdown-bg-swatch${canvasBg === bg ? ' active' : ''}`}
                                            type="button"
                                            style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: '50%',
                                                backgroundColor: bg,
                                                border: canvasBg === bg ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.15)',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => setCanvasBg(bg)}
                                        />
                                    ))}
                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                        <button
                                            type="button"
                                            className={`dropdown-bg-swatch active-color${activePicker === 'background' ? ' active' : ''}`}
                                            title="Custom canvas background color"
                                            style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: '50%',
                                                backgroundColor: canvasBg,
                                                border: activePicker === 'background' ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.15)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: 0
                                            }}
                                            onClick={() => setActivePicker(activePicker === 'background' ? null : 'background')}
                                        >
                                            <Paintbrush size={9} style={{ color: '#fff' }} />
                                        </button>

                                        {activePicker === 'background' && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    left: '100%',
                                                    bottom: 0,
                                                    marginLeft: 8,
                                                    zIndex: 100,
                                                    background: '#1e1e2d',
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    borderRadius: 8,
                                                    padding: 8,
                                                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
                                                }}
                                                onMouseLeave={handlePickerMouseLeave}
                                            >
                                                <input
                                                    type="color"
                                                    value={canvasBg}
                                                    onChange={(e) => setCanvasBg(e.target.value)}
                                                    style={{ border: 'none', background: 'transparent', width: 44, height: 32, cursor: 'pointer' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="dropdown-menu-sep" />

                            {/* Preferences header */}
                            <div className="dropdown-menu-pref-header" onClick={() => setShowPreferences(!showPreferences)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Sliders size={14} />
                                    <span>Preferences</span>
                                </div>
                                <ChevronRight size={14} style={{ transform: showPreferences ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                            </div>

                            {showPreferences && (
                                <>
                                    {/* Theme section */}
                                    <div className="dropdown-menu-theme-row">
                                        <span className="dropdown-menu-item__text">Theme</span>
                                        <div className="dropdown-theme-toggle">
                                            <button
                                                type="button"
                                                className={`dropdown-theme-btn${themeMode === 'light' ? ' active' : ''}`}
                                                onClick={() => { setThemeMode('light'); if (theme === 'dark') toggleTheme(); }}
                                                title="Light theme"
                                            >
                                                <Sun size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`dropdown-theme-btn${themeMode === 'dark' ? ' active' : ''}`}
                                                onClick={() => { setThemeMode('dark'); if (theme === 'light') toggleTheme(); }}
                                                title="Dark theme"
                                            >
                                                <Moon size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`dropdown-theme-btn${themeMode === 'system' ? ' active' : ''}`}
                                                onClick={() => { setThemeMode('system'); toast.info('System Theme Applied'); }}
                                                title="System theme"
                                            >
                                                <Monitor size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Language select dropdown */}
                                    <div className="dropdown-language-select-wrapper">
                                        <select
                                            className="dropdown-language-select"
                                            value={language}
                                            onChange={(e) => {
                                                setLanguage(e.target.value);
                                                toast.success(`Language set to ${e.target.value}`);
                                            }}
                                        >
                                            <option value="English">English</option>
                                            <option value="Hindi">हिंदी (Hindi)</option>
                                            <option value="Spanish">Español (Spanish)</option>
                                            <option value="French">Français (French)</option>
                                            <option value="German">Deutsch (German)</option>
                                        </select>
                                    </div>

                                    {/* Removed duplicated canvas background section */}
                                </>
                            )}
                        </div>
                        </>
                    )}
                </div>

                {/* Center: TOOL TOOLBAR (bottom dock on tablet, centered topbar on desktop) */}
                {!isNotesMode && (
                    <>
                        {(isToolbarCollapsed && isTabletOrMobile) ? (
                            <motion.div
                                drag
                                dragMomentum={false}
                                whileDrag={{ scale: 1.05 }}
                                className="exc-toolbar-expand-pill"
                                onClick={() => setIsToolbarCollapsed(false)}
                                title="Show Drawing Tools (Tap to expand, drag to move)"
                            >
                                <GripVertical size={13} style={{ opacity: 0.5, cursor: 'grab' }} />
                                <Pencil size={15} />
                                <span>Tools</span>
                                <span className="exc-props-color-dot" style={{ backgroundColor: color || '#8178e8' }} />
                            </motion.div>
                        ) : (
                            <motion.div
                                drag={isTabletOrMobile}
                                dragMomentum={false}
                                dragElastic={0.05}
                                whileDrag={isTabletOrMobile ? { scale: 1.01, boxShadow: '0 16px 48px rgba(0,0,0,0.65)' } : undefined}
                                className="exc-toolbar"
                            >
                                {/* Drag Handle for Tablet Movement (Hidden on Desktop) */}
                                <div
                                    className="exc-toolbar-drag-handle hide-on-desktop"
                                    style={{
                                        alignItems: 'center',
                                        padding: '0 3px',
                                        cursor: 'grab',
                                        opacity: 0.6,
                                        touchAction: 'none'
                                    }}
                                    title="Drag toolbar anywhere"
                                >
                                    <GripVertical size={14} />
                                </div>
                                <div className="exc-toolbar-sep hide-on-desktop" style={{ margin: '0 2px' }} />

                                <button
                                    className={`exc-tool-btn${toolLock ? ' active' : ''}`}
                                    onClick={() => setToolLock(!toolLock)}
                                    data-exc-tooltip="Keep tool active after drawing (Q)"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><rect x="5" y="11" width="14" height="10" rx="2"></rect><circle cx="12" cy="16" r="1"></circle><path d="M8 11v-4a4 4 0 0 1 8 0v4"></path></svg>
                                </button>
                                <div className="exc-toolbar-sep" style={{ margin: '0 4px' }} />
                                {availableTools.filter(t => t.id !== 'lock').map((t) => (
                                    <button key={t.id} className={`exc-tool-btn${tool === t.id ? ' active' : ''}`}
                                        onClick={() => {
                                            if (t.id === 'image') {
                                                document.getElementById('image-upload-input')?.click();
                                            } else {
                                                setTool(t.id);
                                            }
                                        }} data-exc-tooltip={`${t.label} (${t.key})`}>
                                        {t.id === 'select' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M15 15l7 7"></path><path d="M4 4l14.899 5.352a.51 .51 0 0 1 .114 .96l-7.394 2.87l-2.87 7.394a.51 .51 0 0 1 -.96 -.114z"></path></svg>}
                                        {t.id === 'pan' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M8 13v-7.5a1.5 1.5 0 0 1 3 0v6.5"></path><path d="M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5"></path><path d="M14 5.5a1.5 1.5 0 0 1 3 0v6.5"></path><path d="M17 7.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47"></path></svg>}
                                        {t.id === 'pencil' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"></path><path d="M13.5 6.5l4 4"></path></svg>}
                                        {t.id === 'rect' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"></path></svg>}
                                        {t.id === 'diamond' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M12 3l9 9l-9 9l-9 -9z"></path></svg>}
                                        {t.id === 'circle' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path></svg>}
                                        {t.id === 'arrow' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M5 12l14 0"></path><path d="M13 18l6 -6"></path><path d="M13 6l6 6"></path></svg>}
                                        {t.id === 'line' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 12l16 0"></path></svg>}
                                        {t.id === 'text' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 20l3 0"></path><path d="M17 20l3 0"></path><path d="M6 9v-4h12v4"></path><path d="M12 5v15"></path></svg>}
                                        {t.id === 'image' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M15 8h.01"></path><path d="M4 4m0 3a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3h-10a3 3 0 0 1 -3 -3z"></path><path d="M4 15l4 -4a3 5 0 0 1 3 0l5 5"></path><path d="M14 14l1 -1a3 5 0 0 1 3 0l2 2"></path></svg>}
                                        {t.id === 'eraser' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M19 20h-10.5l-4.22 -4.22a2 2 0 0 1 0 -2.83l9.54 -9.54a2 2 0 0 1 2.83 0l4.24 4.24a2 2 0 0 1 0 2.83l-8 8"></path><path d="M18 15l-6 -6"></path></svg>}
                                        {t.id !== 'pan' && t.id !== 'lock' && <span className="exc-shortcut">{t.key}</span>}
                                    </button>
                                ))}
                                {modeTools.length > 0 && (
                                    <>
                                        <div className="exc-toolbar-sep" style={{ margin: '0 4px' }} />
                                        {modeTools.map((t) => (
                                            <button
                                                key={t.id}
                                                className="exc-tool-btn"
                                                onClick={t.action}
                                                data-exc-tooltip={t.label}
                                                style={{ color: '#a78bfa' }}
                                            >
                                                <t.icon size={18} />
                                            </button>
                                        ))}
                                    </>
                                )}
                                <div className="exc-toolbar-sep" style={{ margin: '0 4px' }} />
                                <div style={{ position: 'relative', display: 'inline-flex' }}>
                                    <button
                                        className={`exc-tool-btn exc-more-tools-trigger${showMoreTools ? ' active' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); setShowMoreTools(!showMoreTools); }}
                                        data-exc-tooltip="More tools"
                                        style={{ background: showMoreTools ? '#3b388e' : undefined, color: showMoreTools ? '#fff' : undefined }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                                    </button>

                                    {showMoreTools && (
                                        <MoreToolsMenu
                                            activeTool={tool}
                                            onSelectTool={(t) => { setTool(t); setShowMoreTools(false); }}
                                            onOpenWebEmbed={() => setShowWebEmbedModal(true)}
                                            onOpenTextToDiagram={() => setShowAIDiagramModal(true)}
                                            onOpenMermaid={() => setShowMermaidModal(true)}
                                            onOpenWireframeToCode={() => setShowWireframeModal(true)}
                                            onClose={() => setShowMoreTools(false)}
                                        />
                                    )}
                                </div>

                                <div className="exc-toolbar-sep" style={{ margin: '0 4px' }} />

                                {/* Floating Styles & Color Panel Toggle Button (Tablet & Desktop) */}
                                <button
                                    className={`exc-tool-btn exc-props-toggle-btn${!isPropsPanelMinimized ? ' active' : ''}`}
                                    onClick={() => setIsPropsPanelMinimized(!isPropsPanelMinimized)}
                                    data-exc-tooltip={isPropsPanelMinimized ? "Open Styles & Colors" : "Minimize Styles & Colors"}
                                    title="Styles & Colors"
                                    style={{
                                        position: 'relative',
                                        backgroundColor: !isPropsPanelMinimized ? 'rgba(129, 120, 232, 0.22)' : undefined,
                                        color: !isPropsPanelMinimized ? '#a5b4fc' : undefined
                                    }}
                                >
                                    <Palette size={18} />
                                    <span
                                        style={{
                                            position: 'absolute',
                                            bottom: 3,
                                            right: 3,
                                            width: 7,
                                            height: 7,
                                            borderRadius: '50%',
                                            backgroundColor: color || '#8178e8',
                                            border: '1.5px solid #1e1e2d'
                                        }}
                                    />
                                </button>

                                <div className="exc-toolbar-sep hide-on-desktop" style={{ margin: '0 4px' }} />

                                {/* Minimize Toolbar Button (Tablet only - hidden on desktop) */}
                                <button
                                    type="button"
                                    className="exc-tool-btn exc-toolbar-minimize-btn hide-on-desktop"
                                    onClick={() => setIsToolbarCollapsed(true)}
                                    data-exc-tooltip="Minimize Toolbar"
                                    title="Minimize Toolbar (Chhota karein)"
                                    style={{ opacity: 0.8 }}
                                >
                                    <Minus size={15} />
                                </button>
                                <input
                                    type="file"
                                    id="image-upload-input"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => {
                                                const img = new Image();
                                                img.onload = () => {
                                                    const newShape = {
                                                        id: genId(),
                                                        type: 'image',
                                                        x: Math.round((stageSize.width / 2 - stagePos.x) / stageScale - img.width / 2),
                                                        y: Math.round((stageSize.height / 2 - stagePos.y) / stageScale - img.height / 2),
                                                        width: img.width,
                                                        height: img.height,
                                                        url: ev.target.result
                                                    };
                                                    setShapes(prev => [...prev, newShape]);
                                                    socket?.emit('shape:add', { boardId, pageId: activePageId, shape: newShape });
                                                    setTimeout(() => pushHistory(), 0);
                                                };
                                                img.src = ev.target.result;
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                />
                            </motion.div>
                        )}
                    </>
                )}

                {/* Right: Presence + Actions */}
                <div className="exc-topbar-right">
                    {/* Presence avatars (hidden on tablets/mobiles to prevent overflow) */}
                    <div className="exc-presence">
                        {onlineUsers.slice(0, 3).map(u => (
                            <div key={u.userId} className="exc-avatar" style={{ background: getAvatarColor(u.userName) }} data-exc-tooltip={u.userName}>
                                {getInitials(u.userName)}
                            </div>
                        ))}
                        {onlineUsers.length > 3 && <div className="exc-avatar" style={{ background: '#444' }}>+{onlineUsers.length - 3}</div>}
                    </div>

                    {/* Notes Mode: Quick Topbar Undo & Redo for Tablets */}
                    {isNotesMode && (
                        <div className="notes-topbar-history-group hide-on-mobile">
                            <button
                                className="exc-top-btn"
                                onClick={undo}
                                disabled={historyIdx <= 0}
                                style={{ opacity: historyIdx > 0 ? 1 : 0.4, padding: '0 8px' }}
                                title="Undo (Ctrl+Z)"
                            >
                                <Undo2 size={14} />
                            </button>
                            <button
                                className="exc-top-btn"
                                onClick={redo}
                                disabled={historyIdx >= historyLen - 1}
                                style={{ opacity: historyIdx < historyLen - 1 ? 1 : 0.4, padding: '0 8px' }}
                                title="Redo (Ctrl+Y)"
                            >
                                <Redo2 size={14} />
                            </button>
                        </div>
                    )}

                    {/* Palm Rejection Toggle Button — Compact Icon-Only to prevent topbar overlap */}
                    <button
                        className={`exc-top-btn exc-palm-btn${palmRejection ? ' active' : ''}`}
                        onClick={() => {
                            const next = !palmRejection;
                            setPalmRejection(next);
                            toast.success(next ? 'Palm Rejection: ON' : 'Touch Drawing: ON', {
                                duration: 1800,
                                style: { background: '#1e1e2d', color: '#f1f5f9', border: '1px solid #6366f1', fontSize: '12px', fontWeight: 600 }
                            });
                        }}
                        title={palmRejection ? "Palm Rejection: ON (Stylus only). Click to allow finger drawing." : "Palm Rejection: OFF (Finger drawing on). Click to reject palm touches."}
                        style={{ width: 34, height: 34, minWidth: 34, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Hand size={16} strokeWidth={2.2} style={{ color: palmRejection ? '#fbbf24' : 'currentColor' }} />
                    </button>

                    {/* Fullscreen Button — ALWAYS VISIBLE on Tablet, Desktop & Mobile */}
                    <button
                        className={`exc-top-btn exc-fullscreen-btn${isFullscreen ? ' active' : ''}`}
                        onClick={toggleFullscreen}
                        data-exc-tooltip={isFullscreen ? "Exit Fullscreen" : "Full Screen Mode"}
                        title={isFullscreen ? "Exit Fullscreen" : "Full Screen Mode"}
                    >
                        {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        <span className="hide-on-mobile hide-on-tablet" style={{ fontSize: 11 }}>
                            {isFullscreen ? 'Exit' : 'Full'}
                        </span>
                    </button>

                    {/* Share Button */}
                    <button className="exc-top-btn exc-share-btn" onClick={copyShareLink} data-exc-tooltip="Copy join link">
                        <Share2 size={14} /> <span className="hide-on-mobile hide-on-tablet">Share</span>
                    </button>

                    {/* AI Assistant Button */}
                    <button
                        className={`exc-top-btn exc-ai-btn${activeRightTab === 'ai' ? ' active' : ''}`}
                        onClick={() => setActiveRightTab(activeRightTab === 'ai' ? null : 'ai')}
                        data-exc-tooltip="Nemo AI Assistant"
                    >
                        <Sparkles size={14} /> <span className="hide-on-mobile hide-on-tablet">AI</span>
                    </button>

                    {/* Chat Button */}
                    <button
                        className={`exc-top-btn hide-on-mobile${activeRightTab === 'chat' ? ' active' : ''}`}
                        onClick={() => setActiveRightTab(activeRightTab === 'chat' ? null : 'chat')}
                        data-exc-tooltip="Realtime Chat"
                    >
                        <MessageSquareText size={15} />
                    </button>

                    {!isNotesMode && (
                        <button
                            className={`exc-top-btn hide-on-mobile hide-on-tablet${activeRightTab === 'studio' || showVideo ? ' active' : ''}`}
                            onClick={() => setActiveRightTab(activeRightTab === 'studio' ? null : 'studio')}
                            data-exc-tooltip="Video Call & Recording"
                        >
                            <Video size={15} />
                        </button>
                    )}
                    {!isNotesMode && (
                        <button
                            className={`exc-top-btn exc-sidebar-btn hide-on-mobile hide-on-tablet${activeRightTab === 'library' ? ' active' : ''}`}
                            style={{
                                color: activeRightTab === 'library' ? '#fff' : '#c084fc',
                                backgroundColor: activeRightTab === 'library' ? '#8b5cf6' : 'rgba(168, 85, 247, 0.18)',
                                border: activeRightTab === 'library' ? '1px solid #8b5cf6' : '1px solid rgba(168, 85, 247, 0.45)',
                                boxShadow: activeRightTab === 'library' ? '0 0 14px rgba(139, 92, 246, 0.55)' : '0 0 8px rgba(168, 85, 247, 0.25)',
                                transition: 'all 0.15s ease'
                            }}
                            onClick={() => setActiveRightTab(activeRightTab === 'library' ? null : 'library')}
                            data-exc-tooltip="Tools & Assets Library"
                        >
                            <ShapesLogoIcon size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* ══ DRAGGABLE CONTROL PANEL (All Boards: Whiteboard, Architecture, ER Diagram) ══ */}
            {!isNotesMode && (
                <>
                    {/* Draggable Minimized Pill (Never disappears, can be dragged anywhere) */}
                    {isPropsPanelMinimized ? (
                        <motion.div
                            drag
                            dragMomentum={false}
                            whileDrag={{ scale: 1.05 }}
                            className="exc-props-minimized-pill"
                            onClick={() => setIsPropsPanelMinimized(false)}
                            title="Click to open Control Panel (Drag anywhere)"
                            style={{ position: 'fixed', top: 74, left: 16, zIndex: 65 }}
                        >
                            <GripVertical size={13} style={{ opacity: 0.6, cursor: 'grab' }} />
                            <Sliders size={14} style={{ color: '#8178e8' }} />
                            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#f1f5f9' }}>Styles</span>
                            <span
                                className="exc-props-color-dot"
                                style={{ backgroundColor: color || '#8178e8' }}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            drag
                            dragMomentum={false}
                            dragElastic={0.05}
                            whileDrag={{ scale: 1.01, boxShadow: '0 20px 48px rgba(0, 0, 0, 0.75)' }}
                            className="exc-properties-panel draggable-control-panel"
                            style={{
                                position: 'fixed',
                                top: 74,
                                left: isArchMode && isArchLibOpen ? 316 : 16,
                                zIndex: 65
                            }}
                        >
                            {/* Header with Drag handle and Close/Minimize button */}
                            <div className="exc-properties-panel-header" title="Drag to move panel anywhere">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'grab', minWidth: 0, flexShrink: 1 }}>
                                    <GripVertical size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
                                    <Sliders size={13} style={{ color: '#8178e8', flexShrink: 0 }} />
                                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                                        {hasSelection ? 'Element Styles' : 'Styles & Color'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="exc-panel-close-btn"
                                    style={{ flexShrink: 0 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsPropsPanelMinimized(true);
                                    }}
                                    title="Minimize Control Panel (Never disappears)"
                                >
                                    <Minus size={14} />
                                </button>
                            </div>
                    {tool === 'eraser' && !hasSelection ? (
                        <div className="selected-shape-actions">
                            <fieldset className="exc-fieldset">
                                <legend className="exc-panel-label">Eraser size</legend>
                                <div className="buttonList">
                                    {[
                                        { label: 'S', size: 12 },
                                        { label: 'M', size: 24 },
                                        { label: 'L', size: 44 },
                                        { label: 'XL', size: 72 },
                                    ].map(opt => (
                                        <button
                                            key={opt.label}
                                            type="button"
                                            className={`fill-style-btn${eraserSize === opt.size ? ' active' : ''}`}
                                            title={`${opt.label} (${opt.size}px)`}
                                            onClick={() => setEraserSize(opt.size)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>

                            <fieldset className="exc-fieldset" style={{ marginTop: 14 }}>
                                <legend className="exc-panel-label">Custom size ({eraserSize}px)</legend>
                                <input
                                    type="range"
                                    min="8"
                                    max="100"
                                    value={eraserSize}
                                    onChange={(e) => setEraserSize(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: '#6965db', cursor: 'pointer' }}
                                />
                            </fieldset>
                        </div>
                    ) : (
                        <div className="selected-shape-actions">
                            {/* Stroke */}
                            <div className="exc-panel-section" style={{ position: 'relative' }}>
                                <h3 className="exc-panel-label" aria-hidden="true">Stroke</h3>
                                <div role="dialog" aria-modal="true" className="color-picker-container">
                                    <div className="color-picker__top-picks" data-state="closed">
                                        {strokeColors.map(c => (
                                            <button
                                                key={c}
                                                className={`color-picker__button${color === c ? ' active' : ''}`}
                                                type="button"
                                                title={c}
                                                style={{ '--swatch-color': c }}
                                                onClick={() => { setColor(c); updateSelectedShapes({ stroke: c }); setActivePicker(null); }}
                                            >
                                                <div className="color-picker__button-outline"></div>
                                            </button>
                                        ))}
                                        <div className="color-picker__divider" />
                                        <button
                                            type="button"
                                            className={`color-picker__button active-color properties-trigger${activePicker === 'stroke' ? ' active' : ''}`}
                                            title="Custom stroke color"
                                            style={{
                                                '--swatch-color': color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: 0
                                            }}
                                            onClick={() => setActivePicker(activePicker === 'stroke' ? null : 'stroke')}
                                        >
                                            <Paintbrush size={10} style={{ color: color === '#ffffff' || color === '#fff' ? '#121212' : '#ffffff' }} />
                                        </button>
                                    </div>
                                </div>

                                {/* Stroke Color Palette Popover */}
                                {activePicker === 'stroke' && (
                                    <>
                                        <div
                                            className="color-picker-backdrop"
                                            style={{ position: 'fixed', inset: 0, zIndex: 104, background: 'transparent' }}
                                            onClick={() => setActivePicker(null)}
                                        />
                                        <div className="color-picker-popup" style={{ left: 'calc(100% + 8px)', top: 0, zIndex: 105 }}>
                                            <div className="color-picker__heading">STROKE PALETTE</div>
                                            <div className="color-picker-content--default">
                                                {PALETTE_COLORS.map(c => (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        className={`color-picker__button--large${color === c ? ' active' : ''}`}
                                                        style={{ '--swatch-color': c }}
                                                        title={c}
                                                        onClick={() => {
                                                            setColor(c);
                                                            updateSelectedShapes({ stroke: c });
                                                            setActivePicker(null);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <div className="color-picker__divider" style={{ width: '100%', height: 1, margin: '6px 0' }} />
                                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>
                                                <span>Custom Color:</span>
                                                <input
                                                    type="color"
                                                    value={color?.startsWith('#') ? color : '#ffffff'}
                                                    onChange={(e) => {
                                                        setColor(e.target.value);
                                                        updateSelectedShapes({ stroke: e.target.value });
                                                    }}
                                                    style={{ width: 28, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                                                />
                                            </label>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Background & Fill (Hidden for text, sticky, arrow, line) */}
                            {!(tool === 'text' || tool === 'arrow' || tool === 'line' || selectedShape?.type === 'text' || selectedShape?.type === 'sticky' || selectedShape?.type === 'arrow' || selectedShape?.type === 'line') && (
                                <div className="exc-panel-section" style={{ position: 'relative' }}>
                                    <h3 className="exc-panel-label" aria-hidden="true">Background</h3>
                                    <div role="dialog" aria-modal="true" className="color-picker-container">
                                        <div className="color-picker__top-picks" data-state="closed">
                                            {bgColors.map(c => (
                                                <button
                                                    key={c}
                                                    className={`color-picker__button${bgColor === c ? ' active' : ''}${c === 'transparent' ? ' is-transparent has-outline' : ''}`}
                                                    type="button"
                                                    title={c}
                                                    style={{ '--swatch-color': c === 'transparent' ? '#ededed00' : c }}
                                                    onClick={() => { setBgColor(c); updateSelectedShapes({ fill: c }); setActivePicker(null); }}
                                                >
                                                    <div className="color-picker__button-outline"></div>
                                                </button>
                                            ))}
                                            <div className="color-picker__divider" />
                                            <button
                                                type="button"
                                                className={`color-picker__button active-color properties-trigger${bgColor === 'transparent' ? ' is-transparent' : ''}${activePicker === 'background' ? ' active' : ''}`}
                                                title="Custom background color"
                                                style={{
                                                    '--swatch-color': bgColor === 'transparent' ? '#ededed00' : bgColor,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: 0
                                                }}
                                                onClick={() => setActivePicker(activePicker === 'background' ? null : 'background')}
                                            >
                                                <Paintbrush size={10} style={{ color: bgColor === '#ffffff' || bgColor === '#fff' ? '#121212' : '#ffffff' }} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Background Color Palette Popover */}
                                    {activePicker === 'background' && (
                                        <>
                                            <div
                                                className="color-picker-backdrop"
                                                style={{ position: 'fixed', inset: 0, zIndex: 104, background: 'transparent' }}
                                                onClick={() => setActivePicker(null)}
                                            />
                                            <div className="color-picker-popup" style={{ left: 'calc(100% + 8px)', top: 0, zIndex: 105 }}>
                                                <div className="color-picker__heading">BACKGROUND PALETTE</div>
                                                <div className="color-picker-content--default">
                                                    <button
                                                        type="button"
                                                        className={`color-picker__button--large is-transparent has-outline${bgColor === 'transparent' ? ' active' : ''}`}
                                                        style={{ '--swatch-color': 'transparent' }}
                                                        title="Transparent"
                                                        onClick={() => {
                                                            setBgColor('transparent');
                                                            updateSelectedShapes({ fill: 'transparent' });
                                                            setActivePicker(null);
                                                        }}
                                                    />
                                                    {PALETTE_COLORS.slice(0, 24).map(c => (
                                                        <button
                                                            key={c}
                                                            type="button"
                                                            className={`color-picker__button--large${bgColor === c ? ' active' : ''}`}
                                                            style={{ '--swatch-color': c }}
                                                            title={c}
                                                            onClick={() => {
                                                                setBgColor(c);
                                                                updateSelectedShapes({ fill: c });
                                                                setActivePicker(null);
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="color-picker__divider" style={{ width: '100%', height: 1, margin: '6px 0' }} />
                                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>
                                                    <span>Custom Color:</span>
                                                    <input
                                                        type="color"
                                                        value={bgColor?.startsWith('#') ? bgColor : '#1e1e2d'}
                                                        onChange={(e) => {
                                                            setBgColor(e.target.value);
                                                            updateSelectedShapes({ fill: e.target.value });
                                                        }}
                                                        style={{ width: 28, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                                                    />
                                                </label>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Fill Pattern */}
                            {!(tool === 'text' || tool === 'arrow' || tool === 'line' || selectedShape?.type === 'text' || selectedShape?.type === 'sticky' || selectedShape?.type === 'arrow' || selectedShape?.type === 'line') && (
                                <fieldset className="exc-fieldset">
                                    <legend className="exc-panel-label">Fill</legend>
                                    <div className="buttonList">
                                        <button
                                            type="button"
                                            className={`fill-style-btn${fillStyle === 'hachure' ? ' active' : ''}`}
                                            title="Hachure"
                                            onClick={() => {
                                                setFillStyle('hachure');
                                                const fallbackFill = (bgColor && bgColor !== 'transparent') ? bgColor : color;
                                                if (bgColor === 'transparent') setBgColor(fallbackFill);
                                                updateSelectedShapes(s => ({
                                                    fillStyle: 'hachure',
                                                    fill: (!s.fill || s.fill === 'transparent') ? (s.stroke || fallbackFill) : s.fill
                                                }));
                                            }}
                                        >
                                            <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z" strokeWidth="1.25"></path><mask id="FillHachureIcon" maskUnits="userSpaceOnUse" x="2" y="2" width="16" height="16" style={{ maskType: 'alpha' }}><path d="M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z" fill="currentColor" strokeWidth="1.25"></path></mask><g mask="url(#FillHachureIcon)"><path d="M2.258 15.156 15.156 2.258M7.324 20.222 20.222 7.325m-20.444 5.35L12.675-.222m-8.157 18.34L17.416 5.22" strokeWidth="1.25"></path></g></svg>
                                        </button>
                                        <button
                                            type="button"
                                            className={`fill-style-btn${fillStyle === 'cross-hatch' ? ' active' : ''}`}
                                            title="Cross-hatch"
                                            onClick={() => {
                                                setFillStyle('cross-hatch');
                                                const fallbackFill = (bgColor && bgColor !== 'transparent') ? bgColor : color;
                                                if (bgColor === 'transparent') setBgColor(fallbackFill);
                                                updateSelectedShapes(s => ({
                                                    fillStyle: 'cross-hatch',
                                                    fill: (!s.fill || s.fill === 'transparent') ? (s.stroke || fallbackFill) : s.fill
                                                }));
                                            }}
                                        >
                                            <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><g clipPath="url(#fillCrossHatchClip)"><path d="M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z" strokeWidth="1.25"></path><mask id="FillCrossHatchIcon" maskUnits="userSpaceOnUse" x="-1" y="-1" width="22" height="22" style={{ maskType: 'alpha' }}><path d="M2.426 15.044 15.044 2.426M7.383 20 20 7.383M0 12.617 12.617 0m-7.98 17.941L17.256 5.324m-2.211 12.25L2.426 4.956M20 12.617 7.383 0m5.234 20L0 7.383m17.941 7.98L5.324 2.745" strokeWidth="1.25"></path></mask><g mask="url(#FillCrossHatchIcon)"><path d="M14.121 2H5.88A3.879 3.879 0 0 0 2 5.879v8.242A3.879 3.879 0 0 0 5.879 18h8.242A3.879 3.879 0 0 0 18 14.121V5.88A3.879 3.879 0 0 0 14.121 2Z" fill="currentColor"></path></g></g><defs><clipPath id="fillCrossHatchClip"><path fill="#fff" d="M0 0h20v20H0z"></path></clipPath></defs></svg>
                                        </button>
                                        <button
                                            type="button"
                                            className={`fill-style-btn${fillStyle === 'solid' ? ' active' : ''}`}
                                            title="Solid"
                                            onClick={() => {
                                                setFillStyle('solid');
                                                const fallbackFill = (bgColor && bgColor !== 'transparent') ? bgColor : color;
                                                if (bgColor === 'transparent') setBgColor(fallbackFill);
                                                updateSelectedShapes(s => ({
                                                    fillStyle: 'solid',
                                                    fill: (!s.fill || s.fill === 'transparent') ? (s.stroke || fallbackFill) : s.fill
                                                }));
                                            }}
                                        >
                                            <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" width="18" height="18" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><g clipPath="url(#fillSolidClip)"><path d="M4.91 2.625h10.18a2.284 2.284 0 0 1 2.285 2.284v10.182a2.284 2.284 0 0 1-2.284 2.284H4.909a2.284 2.284 0 0 1-2.284-2.284V4.909a2.284 2.284 0 0 1 2.284-2.284Z" strokeWidth="1.25"></path></g><defs><clipPath id="fillSolidClip"><path fill="#fff" d="M0 0h20v20H0z"></path></clipPath></defs></svg>
                                        </button>
                                    </div>
                                </fieldset>
                            )}

                            {/* Text formatting if text tool / text shape selected */}
                            {(tool === 'text' || selectedShape?.type === 'text' || selectedShape?.type === 'sticky') && (
                                <>
                                    <fieldset className="exc-fieldset">
                                        <legend className="exc-panel-label">Font family</legend>
                                        <div className="buttonList">
                                            <button
                                                type="button"
                                                className={`fill-style-btn${fontFamily === 'Virgil' ? ' active' : ''}`}
                                                title="Hand-drawn (Virgil)"
                                                onClick={() => { setFontFamily('Virgil'); updateSelectedShapes({ fontFamily: 'Virgil' }); }}
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`fill-style-btn${fontFamily === 'Helvetica' ? ' active' : ''}`}
                                                title="Normal (Helvetica)"
                                                onClick={() => { setFontFamily('Helvetica'); updateSelectedShapes({ fontFamily: 'Helvetica' }); }}
                                            >
                                                <Type size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`fill-style-btn${fontFamily === 'Code' ? ' active' : ''}`}
                                                title="Code (monospace)"
                                                onClick={() => { setFontFamily('Code'); updateSelectedShapes({ fontFamily: 'Code' }); }}
                                            >
                                                <Code size={18} />
                                            </button>
                                        </div>
                                    </fieldset>

                                    <fieldset className="exc-fieldset">
                                        <legend className="exc-panel-label">Font size</legend>
                                        <div className="buttonList">
                                            {[
                                                { label: 'S', val: 16 },
                                                { label: 'M', val: 20 },
                                                { label: 'L', val: 28 },
                                                { label: 'XL', val: 36 }
                                            ].map(item => (
                                                <button
                                                    key={item.label}
                                                    type="button"
                                                    className={`fill-style-btn${fontSize === item.val ? ' active' : ''}`}
                                                    title={`${item.label} (${item.val}px)`}
                                                    onClick={() => { setFontSize(item.val); updateSelectedShapes({ fontSize: item.val }); }}
                                                    style={{ fontSize: 13, fontWeight: 600 }}
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    </fieldset>

                                    <fieldset className="exc-fieldset">
                                        <legend className="exc-panel-label">Text align</legend>
                                        <div className="buttonList">
                                            <button
                                                type="button"
                                                className={`fill-style-btn${textAlign === 'left' ? ' active' : ''}`}
                                                title="Left align"
                                                onClick={() => { setTextAlign('left'); updateSelectedShapes({ align: 'left' }); }}
                                            >
                                                <AlignLeft size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`fill-style-btn${textAlign === 'center' ? ' active' : ''}`}
                                                title="Center align"
                                                onClick={() => { setTextAlign('center'); updateSelectedShapes({ align: 'center' }); }}
                                            >
                                                <AlignCenter size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`fill-style-btn${textAlign === 'right' ? ' active' : ''}`}
                                                title="Right align"
                                                onClick={() => { setTextAlign('right'); updateSelectedShapes({ align: 'right' }); }}
                                            >
                                                <AlignRight size={18} />
                                            </button>
                                        </div>
                                    </fieldset>
                                </>
                            )}

                            {!(tool === 'text' || selectedShape?.type === 'text' || selectedShape?.type === 'sticky') && (
                                <>
                                    {/* Stroke width */}
                                    <fieldset className="exc-fieldset">
                                        <legend className="exc-panel-label">Stroke width</legend>
                                        <div className="buttonList">
                                            <button type="button" className={`fill-style-btn${brushSize === 2 ? ' active' : ''}`} title="Thin" onClick={() => { setBrushSize(2); updateSelectedShapes({ strokeWidth: 2 }); }}>
                                                <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M4.167 10h11.666" strokeWidth="1.25"></path></svg>
                                            </button>
                                            <button type="button" className={`fill-style-btn${brushSize === 4 ? ' active' : ''}`} title="Medium" onClick={() => { setBrushSize(4); updateSelectedShapes({ strokeWidth: 4 }); }}>
                                                <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10h10" strokeWidth="2.5"></path></svg>
                                            </button>
                                            <button type="button" className={`fill-style-btn${brushSize === 8 ? ' active' : ''}`} title="Bold" onClick={() => { setBrushSize(8); updateSelectedShapes({ strokeWidth: 8 }); }}>
                                                <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10h10" strokeWidth="3.75"></path></svg>
                                            </button>
                                        </div>
                                    </fieldset>

                                    {/* Stroke style */}
                                    <fieldset className="exc-fieldset">
                                        <legend className="exc-panel-label">Stroke style</legend>
                                        <div className="buttonList">
                                            <button type="button" className={`fill-style-btn${strokeStyle === 'solid' ? ' active' : ''}`} title="Solid" onClick={() => { setStrokeStyle('solid'); updateSelectedShapes({ strokeStyle: 'solid' }); }}>
                                                <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M4.167 10h11.666" strokeWidth="1.25"></path></svg>
                                            </button>
                                            <button type="button" className={`fill-style-btn${strokeStyle === 'dashed' ? ' active' : ''}`} title="Dashed" onClick={() => { setStrokeStyle('dashed'); updateSelectedShapes({ strokeStyle: 'dashed' }); }}>
                                                <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><g strokeWidth="2"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M5 12h2"></path><path d="M17 12h2"></path><path d="M11 12h2"></path></g></svg>
                                            </button>
                                            <button type="button" className={`fill-style-btn${strokeStyle === 'dotted' ? ' active' : ''}`} title="Dotted" onClick={() => { setStrokeStyle('dotted'); updateSelectedShapes({ strokeStyle: 'dotted' }); }}>
                                                <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><g strokeWidth="2"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 12v.01"></path><path d="M8 12v.01"></path><path d="M12 12v.01"></path><path d="M16 12v.01"></path><path d="M20 12v.01"></path></g></svg>
                                            </button>
                                        </div>
                                    </fieldset>

                                    {/* Sloppiness */}
                                    <fieldset className="exc-fieldset">
                                        <legend className="exc-panel-label">Sloppiness</legend>
                                        <div className="buttonList">
                                            <button type="button" className={`fill-style-btn${sloppiness === 'architect' ? ' active' : ''}`} title="Architect" onClick={() => { setSloppiness('architect'); updateSelectedShapes({ sloppiness: 'architect' }); }}>
                                                <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12.038c1.655-.885 5.9-3.292 8.568-4.354 2.668-1.063.101 2.821 1.32 3.104 1.218.283 5.112-1.814 5.112-1.814" strokeWidth="1.25"></path></svg>
                                            </button>
                                            <button type="button" className={`fill-style-btn${sloppiness === 'artist' ? ' active' : ''}`} title="Artist" onClick={() => { setSloppiness('artist'); updateSelectedShapes({ sloppiness: 'artist' }); }}>
                                                <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12.563c1.655-.886 5.9-3.293 8.568-4.355 2.668-1.062.101 2.822 1.32 3.105 1.218.283 5.112-1.814 5.112-1.814m-13.469 2.23c2.963-1.586 6.13-5.62 7.468-4.998 1.338.623-1.153 4.11-.132 5.595 1.02 1.487 6.133-1.43 6.133-1.43" strokeWidth="1.25"></path></svg>
                                            </button>
                                            <button type="button" className={`fill-style-btn${sloppiness === 'cartoonist' ? ' active' : ''}`} title="Cartoonist" onClick={() => { setSloppiness('cartoonist'); updateSelectedShapes({ sloppiness: 'cartoonist' }); }}>
                                                <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 11.936c1.737-.879 8.627-5.346 10.42-5.268 1.795.078-.418 5.138.345 5.736.763.598 3.53-1.789 4.235-2.147M2.929 9.788c1.164-.519 5.47-3.28 6.987-3.114 1.519.165 1 3.827 2.121 4.109 1.122.281 3.839-2.016 4.606-2.42" strokeWidth="1.25"></path></svg>
                                            </button>
                                        </div>
                                    </fieldset>

                                    {/* Arrow Type & Arrowheads for Arrow / Line (Exact Excalidraw SVGs) */}
                                    {(tool === 'arrow' || tool === 'line' || selectedShape?.type === 'arrow' || selectedShape?.type === 'line') && (
                                        <>
                                            <fieldset className="exc-fieldset">
                                                <legend className="exc-panel-label">Arrow type</legend>
                                                <div className="buttonList">
                                                    <button
                                                        type="button"
                                                        className={`fill-style-btn${arrowType === 'straight' ? ' active' : ''}`}
                                                        title="Straight"
                                                        onClick={() => { setArrowType('straight'); updateSelectedShapes({ arrowType: 'straight' }); }}
                                                    >
                                                        <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M5 19L19 5M19 5H10M19 5V14" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`fill-style-btn${arrowType === 'curved' ? ' active' : ''}`}
                                                        title="Curved arrow"
                                                        onClick={() => { setArrowType('curved'); updateSelectedShapes({ arrowType: 'curved' }); }}
                                                    >
                                                        <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                                            <g>
                                                                <path d="M16,12L20,9L16,6"></path>
                                                                <path d="M6 20c0 -6.075 4.925 -11 11 -11h3"></path>
                                                            </g>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`fill-style-btn${arrowType === 'elbow' ? ' active' : ''}`}
                                                        title="Elbow arrow"
                                                        onClick={() => { setArrowType('elbow'); updateSelectedShapes({ arrowType: 'elbow' }); }}
                                                    >
                                                        <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                                            <g>
                                                                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                                                                <path d="M4,19L10,19C11.097,19 12,18.097 12,17L12,9C12,7.903 12.903,7 14,7L21,7"></path>
                                                                <path d="M18 4l3 3l-3 3"></path>
                                                            </g>
                                                        </svg>
                                                    </button>
                                                </div>
                                            </fieldset>

                                            <fieldset className="exc-fieldset">
                                                <legend className="exc-panel-label">Arrowheads</legend>
                                                <div className="buttonList">
                                                    <button
                                                        type="button"
                                                        className={`fill-style-btn${arrowhead === 'none' ? ' active' : ''}`}
                                                        title="None"
                                                        onClick={() => { setArrowhead('none'); updateSelectedShapes({ arrowhead: 'none', type: 'line' }); }}
                                                    >
                                                        <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M5 12h14" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`fill-style-btn${arrowhead === 'arrow' ? ' active' : ''}`}
                                                        title="Arrow"
                                                        onClick={() => { setArrowhead('arrow'); updateSelectedShapes({ arrowhead: 'arrow', type: 'arrow' }); }}
                                                    >
                                                        <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M5 12h14M13 6l6 6-6 6" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </fieldset>
                                        </>
                                    )}

                                    {/* Edges for Rect / Diamond / Frame */}
                                    {!(tool === 'text' || tool === 'arrow' || tool === 'line' || selectedShape?.type === 'text' || selectedShape?.type === 'sticky' || selectedShape?.type === 'arrow' || selectedShape?.type === 'line' || selectedShape?.type === 'circle') && (
                                        <fieldset className="exc-fieldset">
                                            <legend className="exc-panel-label">Edges</legend>
                                            <div className="buttonList">
                                                <button type="button" className={`fill-style-btn${edges === 'sharp' ? ' active' : ''}`} title="Sharp" onClick={() => { setEdges('sharp'); updateSelectedShapes({ edges: 'sharp' }); }}>
                                                    <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><svg strokeWidth="1.5"><path d="M3.33334 9.99998V6.66665C3.33334 6.04326 3.33403 4.9332 3.33539 3.33646C4.95233 3.33436 6.06276 3.33331 6.66668 3.33331H10"></path><path d="M13.3333 3.33331V3.34331"></path><path d="M16.6667 3.33331V3.34331"></path><path d="M16.6667 6.66669V6.67669"></path><path d="M16.6667 10V10.01"></path><path d="M3.33334 13.3333V13.3433"></path><path d="M16.6667 13.3333V13.3433"></path><path d="M3.33334 16.6667V16.6767"></path><path d="M6.66666 16.6667V16.6767"></path><path d="M10 16.6667V16.6767"></path><path d="M13.3333 16.6667V16.6767"></path><path d="M16.6667 16.6667V16.6767"></path></svg></svg>
                                                </button>
                                                <button type="button" className={`fill-style-btn${edges === 'round' ? ' active' : ''}`} title="Round" onClick={() => { setEdges('round'); updateSelectedShapes({ edges: 'round' }); }}>
                                                    <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><g strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 12v-4a4 4 0 0 1 4 -4h4"></path><line x1="16" y1="4" x2="16" y2="4.01"></line><line x1="20" y1="4" x2="20" y2="4.01"></line><line x1="20" y1="8" x2="20" y2="8.01"></line><line x1="20" y1="12" x2="20" y2="12.01"></line><line x1="4" y1="16" x2="4" y2="16.01"></line><line x1="20" y1="16" x2="20" y2="16.01"></line><line x1="4" y1="20" x2="4" y2="20.01"></line><line x1="8" y1="20" x2="8" y2="20.01"></line><line x1="12" y1="20" x2="12" y2="20.01"></line><line x1="16" y1="20" x2="16" y2="20.01"></line><line x1="20" y1="20" x2="20" y2="20.01"></line></g></svg>
                                                </button>
                                            </div>
                                        </fieldset>
                                    )}
                                </>
                            )}

                            {/* Opacity */}
                            <label className="exc-panel-label" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', marginTop: '0.5rem', fontSize: '11px', fontWeight: 600 }}>
                                Opacity
                                <div className="exc-opacity-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        min="0" max="100" step="10"
                                        className="exc-opacity-slider range-input"
                                        type="range"
                                        value={opacity}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setOpacity(val);
                                            updateSelectedShapes({ opacity: val / 100 });
                                        }}
                                        style={{
                                            background: `linear-gradient(to right, var(--color-slider-track, #c084fc) 0%, var(--color-slider-track, #c084fc) ${opacity}%, var(--button-bg, rgba(255,255,255,0.1)) ${opacity}%, var(--button-bg, rgba(255,255,255,0.1)) 100%)`,
                                            width: '100%', cursor: 'pointer', appearance: 'none', height: '4px', borderRadius: '4px'
                                        }}
                                    />
                                </div>
                            </label>

                            {/* Layers Z-Index */}
                            {hasSelection && (
                                <fieldset className="exc-fieldset">
                                    <legend className="exc-panel-label">Layers</legend>
                                    <div className="buttonList">
                                        <button type="button" className="fill-style-btn" title="Send to back" onClick={sendToBack}>
                                            <ArrowDownToLine size={18} strokeWidth={1.5} />
                                        </button>
                                        <button type="button" className="fill-style-btn" title="Send backward" onClick={sendBackward}>
                                            <ArrowDown size={18} strokeWidth={1.5} />
                                        </button>
                                        <button type="button" className="fill-style-btn" title="Bring forward" onClick={bringForward}>
                                            <ArrowUp size={18} strokeWidth={1.5} />
                                        </button>
                                        <button type="button" className="fill-style-btn" title="Bring to front" onClick={bringToFront}>
                                            <ArrowUpToLine size={18} strokeWidth={1.5} />
                                        </button>
                                    </div>
                                </fieldset>
                            )}
                        </div>
                    )}

                    {/* Selection actions */}
                    {hasSelection && (
                        <>
                            <div className="exc-panel-sep" />
                            <div className="exc-sel-actions">
                                <button className="exc-sel-btn" onClick={duplicateSelected}>
                                    <Copy size={13} /> Duplicate
                                </button>
                                {isHost && (
                                    <button className="exc-sel-btn danger" onClick={deleteSelected}>
                                        <Trash2 size={13} /> Delete
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </motion.div>
                    )}
                </>
            )}

            {/* ══ MOBILE PROPERTIES BOTTOM SHEET ══ */}
            {showMobileSheet && (
                <>
                    <div className="exc-bottom-sheet-backdrop" onClick={() => setShowMobileSheet(false)} />
                    <div className="exc-bottom-sheet">
                        <div className="exc-bottom-sheet-header">
                            <div className="exc-bottom-sheet-handle" />
                            <span className="exc-bottom-sheet-title">{hasSelection ? 'Element Properties' : 'Canvas Properties'}</span>
                            <button className="exc-bottom-sheet-close" onClick={() => setShowMobileSheet(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="exc-bottom-sheet-content">
                            {/* Stroke Color */}
                            <div className="exc-panel-section">
                                <h3 className="exc-panel-label">Stroke</h3>
                                <div className="color-picker__top-picks">
                                    {strokeColors.map(c => (
                                        <button
                                            key={c}
                                            className={`color-picker__button${color === c ? ' active' : ''}`}
                                            type="button"
                                            style={{ '--swatch-color': c }}
                                            onClick={() => { setColor(c); updateSelectedShapes({ stroke: c }); }}
                                        >
                                            <div className="color-picker__button-outline" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Background Color */}
                            <div className="exc-panel-section">
                                <h3 className="exc-panel-label">Background</h3>
                                <div className="color-picker__top-picks">
                                    {bgColors.map(c => (
                                        <button
                                            key={c}
                                            className={`color-picker__button${bgColor === c ? ' active' : ''}${c === 'transparent' ? ' is-transparent' : ''}`}
                                            type="button"
                                            style={{ '--swatch-color': c === 'transparent' ? '#ededed00' : c }}
                                            onClick={() => { setBgColor(c); updateSelectedShapes({ fill: c }); }}
                                        >
                                            <div className="color-picker__button-outline" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Stroke Width */}
                            <fieldset className="exc-fieldset">
                                <legend className="exc-panel-label">Stroke width</legend>
                                <div className="buttonList">
                                    <button type="button" className={`fill-style-btn${brushSize === 2 ? ' active' : ''}`} onClick={() => { setBrushSize(2); updateSelectedShapes({ strokeWidth: 2 }); }}>Thin</button>
                                    <button type="button" className={`fill-style-btn${brushSize === 4 ? ' active' : ''}`} onClick={() => { setBrushSize(4); updateSelectedShapes({ strokeWidth: 4 }); }}>Medium</button>
                                    <button type="button" className={`fill-style-btn${brushSize === 8 ? ' active' : ''}`} onClick={() => { setBrushSize(8); updateSelectedShapes({ strokeWidth: 8 }); }}>Bold</button>
                                </div>
                            </fieldset>

                            {/* Opacity */}
                            <label className="exc-panel-label" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '11px', fontWeight: 600 }}>
                                Opacity ({opacity}%)
                                <input
                                    min="0" max="100" step="10"
                                    type="range"
                                    value={opacity}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        setOpacity(val);
                                        updateSelectedShapes({ opacity: val / 100 });
                                    }}
                                    style={{ width: '100%' }}
                                />
                            </label>

                            {/* Actions if selected */}
                            {hasSelection && (
                                <div className="exc-sel-actions" style={{ marginTop: '10px' }}>
                                    <button className="exc-sel-btn" onClick={duplicateSelected}>
                                        <Copy size={14} /> Duplicate
                                    </button>
                                    {isHost && (
                                        <button className="exc-sel-btn danger" onClick={deleteSelected}>
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ══ MOBILE QUICK PROPERTY BAR ══ */}
            <div className="exc-mobile-quick-bar hide-on-desktop">
                <div
                    className="color-picker__button"
                    style={{ '--swatch-color': color, width: 28, height: 28 }}
                    onClick={() => setShowMobileSheet(true)}
                >
                    <div className="color-picker__button-outline" />
                </div>
                <div
                    className={`color-picker__button${bgColor === 'transparent' ? ' is-transparent' : ''}`}
                    style={{ '--swatch-color': bgColor === 'transparent' ? '#ededed00' : bgColor, width: 28, height: 28 }}
                    onClick={() => setShowMobileSheet(true)}
                >
                    <div className="color-picker__button-outline" />
                </div>
                <button className="exc-mobile-quick-btn" onClick={() => setShowMobileSheet(true)}>
                    <Sliders size={14} /> Properties
                </button>
            </div>

            {/* Floating Color Picker Overlay */}
            {activePicker && (
                <ColorPickerPopup
                    currentColor={activePicker === 'stroke' ? color : bgColor}
                    style={{ left: 196, top: activePicker === 'stroke' ? 60 : 110 }}
                    onSelectColor={(c) => {
                        if (activePicker === 'stroke') {
                            setColor(c); updateSelectedShapes({ stroke: c });
                        } else {
                            setBgColor(c); updateSelectedShapes({ fill: c });
                        }
                        setActivePicker(null);
                    }}
                    onClose={() => setActivePicker(null)}
                    onMouseEnter={() => handlePickerMouseEnter(activePicker)}
                    onMouseLeave={handlePickerMouseLeave}
                />
            )}

            {/* ══ BOTTOM CONTROLS ══ */}
            <div className="exc-bottom-bar">
                <div
                    className="exc-bottom-left"
                    style={{
                        left: isArchMode && isArchLibOpen ? 316 : 16,
                        transition: 'left 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                >
                    {/* Zoom controls */}
                    <div className="exc-zoom-controls">
                        <button className="exc-zoom-btn" onClick={() => setStageScale(s => Math.max(0.1, s / 1.2))} data-exc-tooltip="Zoom out (-)">−</button>
                        <span className="exc-zoom-value" onClick={() => setStageScale(1)} title="Reset zoom">{Math.round(stageScale * 100)}%</span>
                        <button className="exc-zoom-btn" onClick={() => setStageScale(s => Math.min(5, s * 1.2))} data-exc-tooltip="Zoom in (+)">+</button>
                    </div>

                    {/* Undo/Redo */}
                    <div className="exc-history-controls">
                        <button className="exc-history-btn" onClick={undo} data-exc-tooltip="Undo (Ctrl+Z)"><Undo2 size={14} /></button>
                        <button className="exc-history-btn" onClick={redo} data-exc-tooltip="Redo (Ctrl+Y)"><Redo2 size={14} /></button>
                        {isHost && <button className="exc-history-btn" onClick={clearPage} data-exc-tooltip="Clear page"><Trash2 size={14} /></button>}
                    </div>
                </div>

                {!isNotesMode && (
                    <div className="exc-bottom-right">
                        {/* Page tabs (Moved to right side) */}
                        <div className="exc-page-tabs">
                            {pages.map(page => (
                                <div key={page._id} style={{ display: 'flex', alignItems: 'center', background: activePageId === page._id ? 'var(--exc-accent)' : 'transparent', borderRadius: 8 }}>
                                    <button
                                        className={`exc-page-tab${activePageId === page._id ? ' active' : ''}`}
                                        onClick={() => switchPage(page._id)}
                                        style={{ background: 'transparent' }}
                                    >{page.title}</button>
                                    {pages.length > 1 && activePageId === page._id && (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (window.confirm('Delete this page?')) {
                                                    try {
                                                        await deletePage(page._id);
                                                        const updatedPages = pages.filter(p => p._id !== page._id);
                                                        setPages(updatedPages);
                                                        switchPage(updatedPages[0]._id);
                                                        toast.success('Page deleted');
                                                    } catch (err) {
                                                        toast.error('Failed to delete');
                                                    }
                                                }
                                            }}
                                            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '0 6px', opacity: 0.7 }}
                                            title="Delete page"
                                        ><X size={12} /></button>
                                    )}
                                </div>
                            ))}
                            <button className="exc-add-page-btn" onClick={addPage} title="Add page">+</button>
                        </div>

                        {/* Export */}
                        <button
                            className="exc-help-btn"
                            title="Export PDF"
                            onClick={exportPDF}
                            style={{
                                background: 'var(--exc-accent)',
                                color: '#fff',
                                boxShadow: '0 0 12px var(--exc-accent)',
                                border: '1px solid rgba(255, 255, 255, 0.2)'
                            }}
                        >
                            <Download size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* ══ COLLAPSIBLE RIGHT SIDEBAR DOCK (EXCALIDRAW STYLE) ══ */}
            <AnimatePresence>
                {activeRightTab && (
                    <motion.div
                        className="exc-right-dock"
                        initial={{ x: 360, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 360, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {/* Dock Header Tabs */}
                        <div className="exc-dock-header">
                            <div className="exc-dock-tabs">
                                <button
                                    className={`exc-dock-tab${activeRightTab === 'search' ? ' active' : ''}`}
                                    onClick={() => setActiveRightTab('search')}
                                    data-exc-tooltip="Find on Canvas"
                                >
                                    <Search size={16} />
                                </button>
                                <button
                                    className={`exc-dock-tab${activeRightTab === 'ai' ? ' active' : ''}`}
                                    onClick={() => setActiveRightTab('ai')}
                                    data-exc-tooltip="AI Assistant"
                                >
                                    <Sparkles size={16} />
                                </button>
                                <button
                                    className={`exc-dock-tab${activeRightTab === 'library' ? ' active' : ''}`}
                                    style={{
                                        color: activeRightTab === 'library' ? '#c084fc' : undefined
                                    }}
                                    onClick={() => setActiveRightTab('library')}
                                    data-exc-tooltip="Library & Assets"
                                >
                                    <ShapesLogoIcon size={16} />
                                </button>
                                <button
                                    className={`exc-dock-tab${activeRightTab === 'chat' ? ' active' : ''}`}
                                    onClick={() => setActiveRightTab('chat')}
                                    data-exc-tooltip="Realtime Chat"
                                    style={{ position: 'relative' }}
                                >
                                    <MessageSquareText size={16} />
                                    {chatMessages.length > 0 && (
                                        <span className="exc-dock-badge">{chatMessages.length}</span>
                                    )}
                                </button>
                                <button
                                    className={`exc-dock-tab${activeRightTab === 'studio' ? ' active' : ''}`}
                                    onClick={() => setActiveRightTab('studio')}
                                    data-exc-tooltip="Studio & Recording"
                                    style={{ position: 'relative' }}
                                >
                                    <Video size={16} />
                                    {isRecording && (
                                        <span className="exc-dock-recording-dot" />
                                    )}
                                </button>
                                <button
                                    className={`exc-dock-tab${activeRightTab === 'presentation' ? ' active' : ''}`}
                                    onClick={() => setActiveRightTab('presentation')}
                                    data-exc-tooltip="Presentation & Slides"
                                >
                                    <Presentation size={16} />
                                </button>
                                <button
                                    className={`exc-dock-tab${activeRightTab === 'export' ? ' active' : ''}`}
                                    onClick={() => setActiveRightTab('export')}
                                    data-exc-tooltip="Code & Export Tools"
                                >
                                    <Code size={16} />
                                </button>
                            </div>

                            <div className="exc-dock-actions">
                                <button
                                    className={`exc-dock-icon-btn${isDockPinned ? ' active' : ''}`}
                                    onClick={() => setIsDockPinned(!isDockPinned)}
                                    data-exc-tooltip={isDockPinned ? "Unpin sidebar" : "Pin sidebar"}
                                >
                                    <Pin size={14} />
                                </button>
                                <button
                                    className="exc-dock-icon-btn"
                                    onClick={() => setActiveRightTab(null)}
                                    data-exc-tooltip="Close panel"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Dock Body Content by Tab */}
                        <div className="exc-dock-body">
                            {/* 0. SEARCH TAB */}
                            {activeRightTab === 'search' && (
                                <div className="exc-dock-section" style={{ padding: 16 }}>
                                    <div style={{ position: 'relative', marginBottom: 16 }}>
                                        <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--exc-text-muted)' }} />
                                        <input
                                            type="text"
                                            placeholder="Find text on canvas…"
                                            value={canvasSearchQuery}
                                            onChange={(e) => setCanvasSearchQuery(e.target.value)}
                                            style={{
                                                width: '100%',
                                                background: 'var(--exc-surface-2)',
                                                border: '1px solid var(--exc-border)',
                                                borderRadius: 8,
                                                padding: '10px 12px 10px 36px',
                                                fontSize: 13,
                                                color: 'var(--exc-text)',
                                                outline: 'none'
                                            }}
                                            autoFocus
                                        />
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {canvasSearchQuery.trim() === '' ? (
                                            <p style={{ color: 'var(--exc-text-muted)', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
                                                Type above to search text, notes & shapes on canvas.
                                            </p>
                                        ) : (
                                            (() => {
                                                const matches = shapes.filter(s =>
                                                    (s.text || s.label || s.title || s.type || '').toLowerCase().includes(canvasSearchQuery.toLowerCase())
                                                );
                                                if (matches.length === 0) {
                                                    return <p style={{ color: 'var(--exc-text-muted)', fontSize: 13, textAlign: 'center', marginTop: 24 }}>No items found on canvas</p>;
                                                }
                                                return matches.map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => {
                                                            setSelectedIds(new Set([s.id]));
                                                            setStagePos({
                                                                x: stageSize.width / 2 - (s.x || 0) * stageScale,
                                                                y: stageSize.height / 2 - (s.y || 0) * stageScale
                                                            });
                                                        }}
                                                        style={{
                                                            padding: '10px 12px',
                                                            borderRadius: 8,
                                                            background: 'var(--exc-surface-2)',
                                                            border: '1px solid var(--exc-border)',
                                                            textAlign: 'left',
                                                            color: 'var(--exc-text)',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{s.text || s.label || s.type}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--exc-text-dim)', marginTop: 2 }}>
                                                            Type: {s.type} • Position ({Math.round(s.x || 0)}, {Math.round(s.y || 0)})
                                                        </div>
                                                    </button>
                                                ));
                                            })()
                                        )}
                                    </div>
                                </div>
                            )}
                            {/* 1. LIBRARY TAB */}
                            {activeRightTab === 'library' && (
                                <div className="exc-dock-section" style={{ padding: 16 }}>
                                    <ShapeLibrary onDragStart={() => { }} />
                                </div>
                            )}

                            {/* 2. AI TAB */}
                            {activeRightTab === 'ai' && (
                                <div className="exc-dock-section">
                                    <Suspense fallback={<div style={{ padding: 20, color: '#94a3b8' }}>Loading AI...</div>}>
                                        <AIChatPanel
                                            socket={socket} boardId={boardId} pageId={activePageId}
                                            canvasState={shapes} selectedElements={shapes.filter(s => selectedIds.has(s.id))}
                                            onClose={() => setActiveRightTab(null)} visible={true}
                                        />
                                    </Suspense>
                                </div>
                            )}

                            {/* 3. CHAT TAB */}
                            {activeRightTab === 'chat' && (
                                <div className="exc-dock-section exc-dock-chat">
                                    <div className="exc-side-panel-body">
                                        {chatMessages.length === 0 ? (
                                            <p style={{ color: 'var(--exc-text-muted)', fontSize: 13, textAlign: 'center', marginTop: 32 }}>No messages yet</p>
                                        ) : (
                                            chatMessages.map((msg, i) => (
                                                <div key={i} style={{ marginBottom: 12 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: getAvatarColor(msg.userName) }}>{msg.userId === effectiveUser?._id ? 'You' : msg.userName}</span>
                                                        <span style={{ fontSize: 11, color: 'var(--exc-text-muted)' }}>{formatTime(msg.timestamp)}</span>
                                                    </div>
                                                    <p style={{ fontSize: 13, color: 'var(--exc-text)', lineHeight: 1.5 }}>{msg.message}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <form style={{ padding: '10px 12px', borderTop: '1px solid var(--exc-border)', display: 'flex', gap: 8 }} onSubmit={sendChat}>
                                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} accept="image/*,.pdf" />
                                        <input style={{ flex: 1, background: 'var(--exc-surface-2)', border: '1px solid var(--exc-border)', borderRadius: 8, padding: '7px 12px', fontSize: 13, color: 'var(--exc-text)', outline: 'none' }} placeholder="Message…" value={chatInput} onChange={e => setChatInput(e.target.value)} />
                                        <button type="submit" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--exc-accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Send size={14} /></button>
                                    </form>
                                </div>
                            )}

                            {/* 4. STUDIO & RECORDING TAB */}
                            {activeRightTab === 'studio' && (
                                <div className="exc-dock-section exc-dock-studio" style={{ padding: 16 }}>
                                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: 14, borderRadius: 10, border: '1px solid rgba(239, 68, 68, 0.25)', marginBottom: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Radio size={16} color={isRecording ? '#ef4444' : '#94a3b8'} />
                                                <span style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>
                                                    {isRecording ? 'Recording Live Session…' : 'Screen & Audio Recorder'}
                                                </span>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: 12, color: 'var(--exc-text-dim)', marginBottom: 12, lineHeight: 1.4 }}>
                                            Record your canvas explanations, lectures, and voice narration into a high-quality WebM video.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={toggleRecording}
                                            style={{
                                                width: '100%',
                                                padding: '9px 12px',
                                                borderRadius: 8,
                                                border: 'none',
                                                background: isRecording ? '#dc2626' : '#6965db',
                                                color: '#fff',
                                                fontWeight: 700,
                                                fontSize: 13,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 8,
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
                                            }}
                                        >
                                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                                            {isRecording ? 'Stop & Save Recording' : 'Start Screen Recording'}
                                        </button>
                                    </div>

                                    {/* Live Video Call */}
                                    <div style={{ background: 'var(--exc-surface-2)', padding: 14, borderRadius: 10, border: '1px solid var(--exc-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Video size={16} color="#818cf8" />
                                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--exc-text)' }}>Video Call Stream</span>
                                            </div>
                                            <button
                                                className={`exc-top-btn${showVideo ? ' active' : ''}`}
                                                onClick={() => setShowVideo(!showVideo)}
                                                style={{ height: 28, padding: '0 10px', fontSize: 11 }}
                                            >
                                                {showVideo ? 'Hide Video' : 'Launch Video'}
                                            </button>
                                        </div>
                                        {showVideo && (
                                            <VideoCall socket={socket} roomId={board?.workspace || boardId} user={effectiveUser} onClose={() => setShowVideo(false)} />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 5. PRESENTATION & SLIDES TAB */}
                            {activeRightTab === 'presentation' && (
                                <div className="exc-dock-section" style={{ padding: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--exc-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Presentation size={16} color="var(--exc-accent)" /> Presentation Slides
                                        </h4>
                                        <button
                                            type="button"
                                            className="exc-top-btn"
                                            style={{ background: 'var(--exc-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                            onClick={() => setIsPresentationActive(true)}
                                            disabled={shapes.filter(s => s.type === 'frame').length === 0}
                                        >
                                            Start Play
                                        </button>
                                    </div>

                                    {(() => {
                                        const frameShapes = shapes.filter(s => s.type === 'frame').sort((a, b) => {
                                            if (Math.abs(a.y - b.y) < 50) return a.x - b.x;
                                            return a.y - b.y;
                                        });

                                        if (frameShapes.length === 0) {
                                            return (
                                                <div style={{ padding: '32px 16px', textAlign: 'center', marginTop: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <div style={{ marginBottom: 16, color: 'var(--exc-text-muted)', opacity: 0.5 }}>
                                                        <Presentation size={36} strokeWidth={1.5} />
                                                    </div>
                                                    <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--exc-text)', marginBottom: 8 }}>
                                                        No slides found
                                                    </h4>
                                                    <p style={{ fontSize: 12, color: 'var(--exc-text-dim)', lineHeight: 1.5, marginBottom: 20, maxWidth: 220 }}>
                                                        Add Frame elements to the canvas to organize your content into slides.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setTool('frame'); setActiveRightTab(null); }}
                                                        style={{
                                                            background: 'transparent',
                                                            color: 'var(--exc-text)',
                                                            border: '1px solid var(--exc-border)',
                                                            borderRadius: 8,
                                                            padding: '8px 16px',
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--exc-hover)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                    >
                                                        <Plus size={14} /> Create Frame
                                                    </button>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {frameShapes.map((frame, index) => (
                                                    <div
                                                        key={frame.id}
                                                        onClick={() => {
                                                            const frameWidth = frame.width || 400;
                                                            const frameHeight = frame.height || 300;
                                                            const scaleX = (stageSize.width - 120) / frameWidth;
                                                            const scaleY = (stageSize.height - 120) / frameHeight;
                                                            const scale = Math.min(scaleX, scaleY, 1.5);
                                                            setStageScale(scale);
                                                            setStagePos({
                                                                x: stageSize.width / 2 - (frame.x + frameWidth / 2) * scale,
                                                                y: stageSize.height / 2 - (frame.y + frameHeight / 2) * scale
                                                            });
                                                        }}
                                                        style={{
                                                            background: 'var(--exc-surface-2)',
                                                            border: '1px solid var(--exc-border)',
                                                            borderRadius: 10,
                                                            padding: 12,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s ease',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 6
                                                        }}
                                                        className="exc-slide-card"
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--exc-accent)' }}>
                                                                Slide {index + 1}
                                                            </span>
                                                            <span style={{ fontSize: 11, color: 'var(--exc-text-muted)' }}>
                                                                {Math.round(frame.width || 400)} × {Math.round(frame.height || 300)}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--exc-text)' }}>
                                                            {frame.label || frame.text || `Frame ${index + 1}`}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* 6. CODE & EXPORT TAB */}
                            {activeRightTab === 'export' && (
                                <div className="exc-dock-section" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--exc-text-muted)', letterSpacing: 0.5 }}>Export Options</h4>

                                    <button
                                        className="exc-dock-action-btn"
                                        onClick={() => setShowWireframeModal(true)}
                                    >
                                        <div className="icon-wrapper"><Code size={18} color="#818cf8" /></div>
                                        <div style={{ textAlign: 'left', flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700 }}>Wireframe to Code</div>
                                            <div style={{ fontSize: 11, color: 'var(--exc-text-dim)' }}>Convert drawn UI into React & Tailwind code</div>
                                        </div>
                                    </button>

                                    <button
                                        className="exc-dock-action-btn"
                                        onClick={exportPNG}
                                    >
                                        <div className="icon-wrapper"><FileImage size={18} color="#10b981" /></div>
                                        <div style={{ textAlign: 'left', flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700 }}>Export Image (PNG)</div>
                                            <div style={{ fontSize: 11, color: 'var(--exc-text-dim)' }}>High resolution 2x canvas snapshot</div>
                                        </div>
                                    </button>

                                    <button
                                        className="exc-dock-action-btn"
                                        onClick={exportPDF}
                                    >
                                        <div className="icon-wrapper"><Download size={18} color="#f59e0b" /></div>
                                        <div style={{ textAlign: 'left', flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700 }}>Export Document (PDF)</div>
                                            <div style={{ fontSize: 11, color: 'var(--exc-text-dim)' }}>Print-ready vector PDF presentation</div>
                                        </div>
                                    </button>

                                    <button
                                        className="exc-dock-action-btn"
                                        onClick={saveBoardJSON}
                                    >
                                        <div className="icon-wrapper"><FolderKanban size={18} color="#06b6d4" /></div>
                                        <div style={{ textAlign: 'left', flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700 }}>Save Excalidraw JSON</div>
                                            <div style={{ fontSize: 11, color: 'var(--exc-text-dim)' }}>Backup raw board state file</div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Architecture Shape Library */}
            {isArchMode && isArchLibOpen && (
                <div className="arch-sidebar-container">
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <ShapeLibrary onDragStart={() => { }} onClose={() => setIsArchLibOpen(false)} />
                        </div>
                        <div style={{ padding: '16px', borderTop: '1px solid var(--exc-border, rgba(255,255,255,0.1))', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--exc-text-dim, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Canvas Background</span>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {['#121212', '#0d0d14', '#0f172a', '#171530'].map(bg => (
                                    <button
                                        key={bg}
                                        type="button"
                                        style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: '50%',
                                            backgroundColor: bg,
                                            border: canvasBg === bg ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.15)',
                                            cursor: 'pointer',
                                            transition: 'transform 0.1s'
                                        }}
                                        onClick={() => setCanvasBg(bg)}
                                    />
                                ))}
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <button
                                        type="button"
                                        title="Custom canvas background color"
                                        style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: '50%',
                                            backgroundColor: canvasBg,
                                            border: activePicker === 'background' ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.15)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: 0
                                        }}
                                        onClick={() => setActivePicker(activePicker === 'background' ? null : 'background')}
                                    >
                                        <Paintbrush size={9} style={{ color: '#fff' }} />
                                    </button>

                                    {activePicker === 'background' && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: '100%',
                                                bottom: 0,
                                                marginLeft: 8,
                                                zIndex: 100,
                                                background: '#1e1e2d',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: 8,
                                                padding: 8,
                                                boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
                                            }}
                                            onMouseLeave={handlePickerMouseLeave}
                                        >
                                            <input
                                                type="color"
                                                value={canvasBg}
                                                onChange={(e) => setCanvasBg(e.target.value)}
                                                style={{ border: 'none', background: 'transparent', width: 44, height: 32, cursor: 'pointer' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lazy Feature Modals */}
            <Suspense fallback={null}>
                {/* ER Edit Modal */}
                <AnimatePresence>
                    {editingERShape && <EREditModal shape={editingERShape} onSave={handleERSave} onClose={() => setEditingERShape(null)} />}
                </AnimatePresence>

                {/* Web Embed Modal */}
                <AnimatePresence>
                    {showWebEmbedModal && <WebEmbedModal onEmbed={handleInsertWebEmbed} onClose={() => setShowWebEmbedModal(false)} />}
                </AnimatePresence>

                {/* Wireframe to Code Modal */}
                <AnimatePresence>
                    {showWireframeModal && <WireframeToCodeModal canvasState={shapes} onClose={() => setShowWireframeModal(false)} />}
                </AnimatePresence>

                {/* Mermaid to Excalidraw Modal */}
                <AnimatePresence>
                    {showMermaidModal && <MermaidModal onInsertDiagram={handleInsertDiagram} onClose={() => setShowMermaidModal(false)} />}
                </AnimatePresence>

                {/* Text to Diagram AI Modal */}
                <AnimatePresence>
                    {showAIDiagramModal && <AIDiagramModal onInsertDiagram={handleInsertDiagram} onClose={() => setShowAIDiagramModal(false)} />}
                </AnimatePresence>
            </Suspense>

            {/* Canvas Threaded Comments Overlay */}
            <CommentsOverlay
                boardId={boardId}
                pageId={activePageId}
                stageScale={stageScale}
                stagePos={stagePos}
                effectiveUser={effectiveUser}
                activeTool={tool}
                draftCommentPos={draftCommentPos}
                onCancelDraft={() => setDraftCommentPos(null)}
                onCommentCreated={() => { setDraftCommentPos(null); setTool('select'); }}
                socket={socket}
            />

            {/* Interactive Web Embed Cards */}
            {shapes.filter(s => s.type === 'web-embed').map(embed => {
                const absX = embed.x * stageScale + stagePos.x;
                const absY = embed.y * stageScale + stagePos.y;
                return (
                    <div key={embed.id} className="web-embed-card glass" style={{
                        position: 'absolute',
                        left: absX,
                        top: absY,
                        width: (embed.width || 480) * stageScale,
                        height: (embed.height || 320) * stageScale,
                        zIndex: 80,
                        borderRadius: 10,
                        overflow: 'hidden',
                        border: '1px solid rgba(99,102,241,0.4)',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                        pointerEvents: 'auto'
                    }}>
                        <div style={{ background: '#1e1e2d', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#a5b4fc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>🔗 {embed.url}</span>
                            <a href={embed.url} target="_blank" rel="noreferrer" style={{ color: '#818cf8', fontSize: 11, textDecoration: 'none', fontWeight: 600 }}>Open ↗</a>
                        </div>
                        <iframe src={embed.url} title="Web Embed" style={{ width: '100%', height: 'calc(100% - 28px)', border: 'none', background: '#fff' }} />
                    </div>
                );
            })}

            {/* Command Palette Modal */}
            <AnimatePresence>
                {showCommandPalette && (
                    <div className="exc-modal-overlay" onClick={() => setShowCommandPalette(false)}>
                        <div className="command-palette-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="command-palette-header">
                                <Zap size={18} color="#818cf8" />
                                <input
                                    type="text"
                                    className="command-palette-input"
                                    placeholder="Type a command or search actions..."
                                    value={cmdQuery}
                                    onChange={(e) => setCmdQuery(e.target.value)}
                                    autoFocus
                                />
                                <kbd className="shortcut-kbd">ESC</kbd>
                            </div>
                            <div className="command-palette-list">
                                {[
                                    { title: 'Open Board File', icon: <Folder size={14} />, action: () => { document.querySelector('input[type="file"]')?.click(); } },
                                    { title: 'Save Excalidraw JSON', icon: <Download size={14} />, action: saveBoardJSON },
                                    { title: 'Export Image (PNG)', icon: <FileImage size={14} />, action: exportPNG },
                                    { title: 'Export Document (PDF)', icon: <Download size={14} />, action: exportPDF },
                                    { title: 'Find on Canvas (Search)', icon: <Search size={14} />, action: () => setActiveRightTab('search') },
                                    { title: 'Reset Canvas (Clear All)', icon: <Trash2 size={14} />, action: clearPage },
                                    { title: 'Copy Live Collaboration Link', icon: <Users size={14} />, action: copyShareLink },
                                    { title: 'Toggle Theme (Dark / Light)', icon: <Sun size={14} />, action: toggleTheme },
                                    { title: 'Show Keyboard Shortcuts', icon: <HelpCircle size={14} />, action: () => setShowHelpModal(true) },
                                    { title: 'Add New Page', icon: <Plus size={14} />, action: addPage },
                                ]
                                    .filter(item => item.title.toLowerCase().includes(cmdQuery.toLowerCase()))
                                    .map((cmd, idx) => (
                                        <button
                                            key={idx}
                                            className="command-palette-item"
                                            onClick={() => { cmd.action(); setShowCommandPalette(false); }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                {cmd.icon}
                                                <span>{cmd.title}</span>
                                            </div>
                                            <kbd className="shortcut-kbd">↵</kbd>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Help / Keyboard Shortcuts Modal */}
            <AnimatePresence>
                {showHelpModal && (
                    <div className="exc-modal-overlay" onClick={() => setShowHelpModal(false)}>
                        <div className="help-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="help-modal-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <HelpCircle size={18} color="#818cf8" />
                                    <span className="help-modal-title">Help & Keyboard Shortcuts</span>
                                </div>
                                <button className="exc-tool-btn" onClick={() => setShowHelpModal(false)}><X size={16} /></button>
                            </div>
                            <div className="help-grid">
                                <div className="help-shortcut-row"><span>Selection tool</span><kbd className="shortcut-kbd">V</kbd></div>
                                <div className="help-shortcut-row"><span>Pencil tool</span><kbd className="shortcut-kbd">P</kbd></div>
                                <div className="help-shortcut-row"><span>Rectangle tool</span><kbd className="shortcut-kbd">R</kbd></div>
                                <div className="help-shortcut-row"><span>Circle tool</span><kbd className="shortcut-kbd">O</kbd></div>
                                <div className="help-shortcut-row"><span>Arrow tool</span><kbd className="shortcut-kbd">A</kbd></div>
                                <div className="help-shortcut-row"><span>Text tool</span><kbd className="shortcut-kbd">T</kbd></div>
                                <div className="help-shortcut-row"><span>Eraser tool</span><kbd className="shortcut-kbd">E</kbd></div>
                                <div className="help-shortcut-row"><span>Pan canvas</span><kbd className="shortcut-kbd">H</kbd></div>
                                <div className="help-shortcut-row"><span>Undo</span><kbd className="shortcut-kbd">Ctrl+Z</kbd></div>
                                <div className="help-shortcut-row"><span>Redo</span><kbd className="shortcut-kbd">Ctrl+Y</kbd></div>
                                <div className="help-shortcut-row"><span>Open file</span><kbd className="shortcut-kbd">Ctrl+O</kbd></div>
                                <div className="help-shortcut-row"><span>Export PNG</span><kbd className="shortcut-kbd">Ctrl+Shift+E</kbd></div>
                                <div className="help-shortcut-row"><span>Command palette</span><kbd className="shortcut-kbd">Ctrl+/</kbd></div>
                                <div className="help-shortcut-row"><span>Find on canvas</span><kbd className="shortcut-kbd">Ctrl+F</kbd></div>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* ══ NOTES BOARD FLOATING MARKUP TOOLBAR (APPLE NOTES STYLE) ══ */}
            {isNotesMode && (
                <>
                    <NotesMarkupToolbar
                        tool={tool}
                        setTool={setTool}
                        color={color}
                        setColor={setColor}
                        strokeWidth={brushSize}
                        setStrokeWidth={setBrushSize}
                        eraserSize={eraserSize}
                        setEraserSize={setEraserSize}
                        onClearPage={clearPage}
                        paperPattern={paperPattern}
                        setPaperPattern={setPaperPattern}
                        onUndo={undo}
                        onRedo={redo}
                        canUndo={historyIdx > 0}
                        canRedo={historyIdx < historyLen - 1}
                        onExportPDF={exportToA4PDF}
                        onExportPNG={exportPNG}
                        onInsertImage={insertImageFromFile}
                        palmRejection={palmRejection}
                        setPalmRejection={setPalmRejection}
                    />

                    {/* ══ NOTES BOARD THUMBNAIL GALLERY STRIP ══ */}
                    <NotesPageStrip
                        pages={pages}
                        activePageId={activePageId}
                        isOpen={showNotesPages}
                        onClose={() => setShowNotesPages(false)}
                        onSelectPage={(id, idx) => {
                            const pIdx = idx !== undefined ? idx : pages.findIndex(x => x._id === id);
                            const p = pages[pIdx];
                            switchPage(id, p);
                            if (window.innerWidth <= 1024) {
                                setShowNotesPages(false);
                            }
                        }}
                        onCreatePage={addPage}
                        onDuplicatePage={duplicatePage}
                        onDeletePage={deletePageHandler}
                        onRenamePage={renamePageHandler}
                        onReorderPage={reorderPageHandler}
                        paperPattern={paperPattern}
                    />
                </>
            )}
        </div>
    );
}

/* ── Excalidraw Full Color Picker Palette & Helpers ── */
const EXCALIDRAW_PALETTE = [
    { name: 'Transparent', color: 'transparent', key: 'q' },
    { name: 'Black', color: '#1e1e1e', key: 'w' },
    { name: 'Light Gray', color: '#c6c6c6', key: 'e' },
    { name: 'White', color: '#ffffff', key: 'r' },
    { name: 'Bronze', color: '#846358', key: 't' },
    { name: 'Cyan', color: '#0c8599', key: 'a' },
    { name: 'Blue', color: '#1971c2', key: 's' },
    { name: 'Violet', color: '#6741d9', key: 'd' },
    { name: 'Grape', color: '#9c36b5', key: 'f' },
    { name: 'Pink', color: '#c2255c', key: 'g' },
    { name: 'Green', color: '#2f9e44', key: 'z' },
    { name: 'Teal', color: '#099268', key: 'x' },
    { name: 'Yellow', color: '#f08c00', key: 'c' },
    { name: 'Orange', color: '#e8590c', key: 'v' },
    { name: 'Red', color: '#e03131', key: 'b' },
];

function RoughShape({ shape, isSelected, tool, onClick, onTap, onDragEnd, onTransformEnd, onDblClick }) {
    const isPointShape = (shape.type === 'arrow' || shape.type === 'line') && shape.points && shape.points.length >= 4;

    const sceneFunc = useCallback((context, kShape) => {
        const ctx = context._context;
        const rc = rough.canvas(ctx.canvas);

        const fillStyle = shape.fillStyle || 'solid';
        const strokeStyle = shape.strokeStyle || 'solid';
        const stroke = shape.stroke || '#ffffff';
        let fill = shape.fill;
        if (fillStyle === 'hachure' || fillStyle === 'cross-hatch') {
            if (!fill || fill === 'transparent') {
                fill = stroke;
            }
        } else if (fill === 'transparent' || !fill) {
            fill = undefined;
        }
        const sloppiness = shape.sloppiness || 'artist';
        const roughness = sloppiness === 'architect' ? 0.2 : sloppiness === 'cartoonist' ? 2.5 : 1.2;

        const isCrossHatch = fillStyle === 'cross-hatch';
        const isHachure = fillStyle === 'hachure';

        const options = {
            stroke,
            strokeWidth: isSelected ? strokeWidth + 1 : strokeWidth,
            fill,
            fillStyle: isCrossHatch ? 'cross-hatch' : isHachure ? 'hachure' : 'solid',
            roughness,
            strokeLineDash: strokeStyle === 'dashed' ? [12, 8] : strokeStyle === 'dotted' ? [3, 6] : undefined,
            hachureGap: isCrossHatch ? 5 : 6, // Excalidraw dense net spacing
            hachureAngle: isCrossHatch ? 60 : -41, // Excalidraw 60-degree isometric criss-cross net
            fillWeight: Math.max(1, strokeWidth / 2),
            bowing: sloppiness === 'cartoonist' ? 2 : 1,
            seed: shape.id ? shape.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 12345
        };

        ctx.save();
        if (shape.type === 'rect') {
            const rawW = shape.width ?? 160;
            const rawH = shape.height ?? 60;
            const rw = Math.abs(rawW);
            const rh = Math.abs(rawH);
            const ox = rawW < 0 ? rawW : 0;
            const oy = rawH < 0 ? rawH : 0;
            if (rw > 0 && rh > 0) {
                if (shape.edges === 'sharp') {
                    rc.rectangle(ox, oy, rw, rh, options);
                } else {
                    const cr = Math.min(8, rw / 4, rh / 4);
                    rc.path(`M ${ox + cr} ${oy} L ${ox + rw - cr} ${oy} Q ${ox + rw} ${oy} ${ox + rw} ${oy + cr} L ${ox + rw} ${oy + rh - cr} Q ${ox + rw} ${oy + rh} ${ox + rw - cr} ${oy + rh} L ${ox + cr} ${oy + rh} Q ${ox} ${oy + rh} ${ox} ${oy + rh - cr} L ${ox} ${oy + cr} Q ${ox} ${oy} ${ox + cr} ${oy} Z`, options);
                }
            }
        } else if (shape.type === 'circle') {
            const r = Math.abs(shape.radius ?? 35);
            if (r > 0) {
                rc.ellipse(r, r, r * 2, r * 2, options);
            }
        } else if (shape.type === 'diamond') {
            const rawW = shape.width ?? 140;
            const rawH = shape.height ?? 80;
            const dw = Math.abs(rawW);
            const dh = Math.abs(rawH);
            const ox = rawW < 0 ? rawW : 0;
            const oy = rawH < 0 ? rawH : 0;
            if (dw > 0 && dh > 0) {
                rc.polygon([
                    [ox + dw / 2, oy],
                    [ox + dw, oy + dh / 2],
                    [ox + dw / 2, oy + dh],
                    [ox, oy + dh / 2]
                ], options);
            }
        } else if (shape.type === 'arrow' && shape.points && shape.points.length >= 4) {
            const p = shape.points;
            const dx = p[2] - p[0];
            const dy = p[3] - p[1];
            rc.line(0, 0, dx, dy, options);
            const len = Math.hypot(dx, dy);
            if (len > 5) {
                const angle = Math.atan2(dy, dx);
                const headLen = Math.min(18, Math.max(10, len * 0.25));
                const x1 = dx - headLen * Math.cos(angle - Math.PI / 6);
                const y1 = dy - headLen * Math.sin(angle - Math.PI / 6);
                const x2 = dx - headLen * Math.cos(angle + Math.PI / 6);
                const y2 = dy - headLen * Math.sin(angle + Math.PI / 6);
                rc.line(dx, dy, x1, y1, { ...options, fillStyle: 'solid' });
                rc.line(dx, dy, x2, y2, { ...options, fillStyle: 'solid' });
            }
        } else if (shape.type === 'line' && shape.points && shape.points.length >= 4) {
            const p = shape.points;
            const dx = p[2] - p[0];
            const dy = p[3] - p[1];
            rc.line(0, 0, dx, dy, options);
        } else if (shape.type === 'frame') {
            const rawW = shape.width ?? 300;
            const rawH = shape.height ?? 200;
            const fw = Math.abs(rawW);
            const fh = Math.abs(rawH);
            const ox = rawW < 0 ? rawW : 0;
            const oy = rawH < 0 ? rawH : 0;
            if (fw > 0 && fh > 0) {
                rc.rectangle(ox, oy, fw, fh, { ...options, strokeStyle: 'dashed', fill: undefined });
            }
        }
        ctx.restore();

        context.fillStrokeShape(kShape);
    }, [shape, isSelected]);

    const isCircle = shape.type === 'circle';
    const r = Math.abs(shape.radius ?? 35);
    const rw = isCircle ? r * 2 : Math.abs(shape.width ?? 160);
    const rh = isCircle ? r * 2 : Math.abs(shape.height ?? 60);

    const groupX = isPointShape ? shape.points[0] : (shape.x || 0);
    const groupY = isPointShape ? shape.points[1] : (shape.y || 0);

    return (
        <Group
            key={shape.id}
            id={shape.id}
            x={groupX}
            y={groupY}
            draggable={tool === 'select'}
            opacity={shape.opacity !== undefined ? shape.opacity : 1}
            onClick={onClick} onTap={onTap}
            onDragEnd={onDragEnd} onTransformEnd={onTransformEnd}
            onDblClick={onDblClick}
        >
            <Shape sceneFunc={sceneFunc} />
            {(shape.text || shape.label) ? (
                <Text
                    x={8}
                    y={isCircle ? r - (shape.fontSize || 13) * 0.7 : rh / 2 - (shape.fontSize || 13) * 0.7}
                    width={isCircle ? r * 2 - 16 : rw - 16}
                    text={shape.text || shape.label}
                    fill={shape.stroke || '#ffffff'}
                    fontSize={shape.fontSize || 13}
                    fontFamily={shape.fontFamily === 'Code' ? 'Cascadia Code, monospace' : shape.fontFamily === 'Helvetica' ? 'Inter, sans-serif' : 'Virgil, Caveat, cursive'}
                    align={shape.align || 'center'}
                />
            ) : null}
        </Group>
    );
}

function adjustColor(color, percent) {
    if (!color || !color.startsWith('#')) return color || '#888888';
    let num = parseInt(color.replace('#', ''), 16);
    let r = Math.min(255, Math.max(0, (num >> 16) + Math.round(255 * (percent / 100))));
    let g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + Math.round(255 * (percent / 100))));
    let b = Math.min(255, Math.max(0, (num & 0x0000FF) + Math.round(255 * (percent / 100))));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function ColorPickerPopup({ currentColor, style, onSelectColor, onClose, onMouseEnter, onMouseLeave }) {
    const [hexVal, setHexVal] = useState(currentColor && currentColor.startsWith('#') ? currentColor.replace('#', '') : '');

    useEffect(() => {
        if (currentColor && currentColor.startsWith('#')) {
            setHexVal(currentColor.replace('#', ''));
        }
    }, [currentColor]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
            const key = e.key.toLowerCase();
            const found = EXCALIDRAW_PALETTE.find(item => item.key === key);
            if (found) {
                e.preventDefault();
                onSelectColor(found.color);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onSelectColor]);

    const shades = useMemo(() => {
        if (!currentColor || currentColor === 'transparent') return ['#1f1717', '#5a2c2c', '#b44d4d', '#fa6969', '#ff8383'];
        return [
            adjustColor(currentColor, -60),
            adjustColor(currentColor, -30),
            currentColor,
            adjustColor(currentColor, 30),
            adjustColor(currentColor, 60),
        ];
    }, [currentColor]);

    const triggerEyeDropper = async () => {
        if ('EyeDropper' in window) {
            try {
                const eyeDropper = new window.EyeDropper();
                const res = await eyeDropper.open();
                if (res.sRGBHex) {
                    onSelectColor(res.sRGBHex);
                }
            } catch { }
        } else {
            toast('EyeDropper not supported in browser', { icon: '✒️' });
        }
    };

    return (
        <div className="color-picker-popup" style={style} onClick={(e) => e.stopPropagation()} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            <div>
                <div className="color-picker__heading">Colors</div>
                <div className="color-picker-content--default">
                    {EXCALIDRAW_PALETTE.map(item => (
                        <button
                            key={item.color}
                            type="button"
                            className={`color-picker__button color-picker__button--large${item.color === 'transparent' ? ' is-transparent' : ''}${currentColor === item.color ? ' active' : ''}`}
                            title={`${item.name} — ${item.key}`}
                            style={{ '--swatch-color': item.color === 'transparent' ? '#ededed00' : item.color }}
                            onClick={() => onSelectColor(item.color)}
                        >
                            <div className="color-picker__button-outline" />
                            <div className="color-picker__button__hotkey-label" style={{ color: item.color === '#ffffff' || item.color === 'transparent' ? '#000' : '#fff' }}>{item.key}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <div className="color-picker__heading">Shades</div>
                <div className="color-picker-content--default">
                    {shades.map((shade, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className={`color-picker__button color-picker__button--large${currentColor === shade ? ' active' : ''}`}
                            title={`Shade ${idx + 1}`}
                            style={{ '--swatch-color': shade }}
                            onClick={() => onSelectColor(shade)}
                        >
                            <div className="color-picker__button-outline" />
                            <div className="color-picker__button__hotkey-label" style={{ color: '#fff' }}>⇧{idx + 1}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <div className="color-picker__heading">Hex code</div>
                <div className="color-picker__input-label-container">
                    <div className="color-picker__input-label">
                        <div className="color-picker__input-hash">#</div>
                        <input
                            spellCheck="false"
                            className="color-picker-input"
                            placeholder="Color"
                            value={hexVal}
                            onChange={(e) => {
                                const raw = e.target.value;
                                setHexVal(raw);
                                if (/^[0-9A-Fa-f]{6}$/.test(raw)) {
                                    onSelectColor('#' + raw);
                                }
                            }}
                        />
                        <div style={{ width: 1, height: '1.25rem', backgroundColor: 'var(--exc-border)' }} />
                        <div className="excalidraw-eye-dropper-trigger" title="Pick color from canvas — EyeDropper" onClick={triggerEyeDropper}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 16l11.7 -11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4z"></path><path d="M11 7l6 6"></path></svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className="color-picker__tip">Tip: drag any color onto your top picks to pin it</div>
        </div>
    );
}

function KonvaImageShape({ shape, isSelected, tool, onClick, onTap, onDragEnd, onTransformEnd }) {
    const [imageObj, setImageObj] = useState(null);

    useEffect(() => {
        const src = shape.url || shape.src;
        if (!src) return;
        const img = new window.Image();
        img.crossOrigin = 'Anonymous';
        img.src = src;
        img.onload = () => setImageObj(img);
    }, [shape.url, shape.src]);

    const w = shape.width || 240;
    const h = shape.height || 180;

    return (
        <Group
            key={shape.id}
            id={shape.id}
            x={shape.x}
            y={shape.y}
            draggable={tool === 'select'}
            onClick={onClick}
            onTap={onTap}
            onDragEnd={onDragEnd}
            onTransformEnd={onTransformEnd}
        >
            {isSelected && (
                <Rect x={-4} y={-4} width={w + 8} height={h + 8} fill="transparent" stroke="#818cf8" strokeWidth={2.5} cornerRadius={12} dash={[6, 3]} />
            )}
            {imageObj ? (
                <KonvaImage image={imageObj} width={w} height={h} cornerRadius={8} shadowColor="rgba(0,0,0,0.3)" shadowBlur={10} shadowOffsetY={3} />
            ) : (
                <Group>
                    <Rect width={w} height={h} fill="#1e1e2d" stroke="#38bdf8" strokeWidth={1.5} cornerRadius={8} />
                    <Text x={0} y={h / 2 - 8} width={w} text="Loading Image..." fill="#cbd5e1" align="center" fontSize={12} fontFamily="Inter, sans-serif" />
                </Group>
            )}
        </Group>
    );
}
