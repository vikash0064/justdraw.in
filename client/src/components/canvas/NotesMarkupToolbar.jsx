import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    Pencil, Highlighter, Eraser, MousePointer, Type,
    StickyNote, Square, Circle, Diamond, ArrowUpRight, Minus,
    Image, Palette, Undo2, Redo2, Download, FileText,
    Sliders, ChevronDown, ChevronUp, Move, Trash2, Check,
    GripVertical, PenTool, Sparkles, Hand
} from 'lucide-react';

const APPLE_COLORS = [
    { label: 'Black Ink', hex: '#0f172a' },
    { label: 'Royal Blue', hex: '#2563eb' },
    { label: 'Crimson', hex: '#dc2626' },
    { label: 'Forest Green', hex: '#16a34a' },
    { label: 'Warm Amber', hex: '#d97706' },
    { label: 'Amethyst', hex: '#9333ea' },
    { label: 'Rose Highlighter', hex: '#db2777' },
    { label: 'Bright Yellow', hex: '#facc15' },
    { label: 'Pure White', hex: '#ffffff' },
];

const STROKE_WIDTHS = [
    { label: 'Fine', size: 2, dot: 4 },
    { label: 'Medium', size: 4, dot: 7 },
    { label: 'Broad', size: 8, dot: 11 },
    { label: 'Chisel', size: 16, dot: 15 },
];

const ERASER_SIZES = [
    { label: 'Fine', size: 10, dot: 5 },
    { label: 'Medium', size: 20, dot: 9 },
    { label: 'Large', size: 34, dot: 14 },
    { label: 'Wide', size: 52, dot: 20 },
];

export default function NotesMarkupToolbar({
    tool,
    setTool,
    color,
    setColor,
    strokeWidth,
    setStrokeWidth,
    eraserSize = 20,
    setEraserSize,
    onClearPage,
    paperPattern,
    setPaperPattern,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onExportPDF,
    onExportPNG,
    onInsertImage,
    palmRejection = true,
    setPalmRejection,
}) {
    const [dockPosition, setDockPosition] = useState('bottom'); // 'bottom' | 'left' | 'right'
    const [isMinimized, setIsMinimized] = useState(false);
    const [showPalette, setShowPalette] = useState(false);
    const [showWidths, setShowWidths] = useState(false);
    const [showEraserMenu, setShowEraserMenu] = useState(false);
    const [showShapes, setShowShapes] = useState(false);
    const [showPaperMenu, setShowPaperMenu] = useState(false);
    const fileInputRef = useRef(null);
    const isDraggingRef = useRef(false);

    const handleToolSelect = (selectedTool) => {
        if (isDraggingRef.current) return;
        
        if (selectedTool === 'eraser') {
            if (tool === 'eraser') {
                // Clicking while eraser is already active opens the 4-dot size menu
                setShowEraserMenu(prev => !prev);
            } else {
                // Initial selection switches tool cleanly with ZERO popup
                setTool('eraser');
                setShowEraserMenu(false);
            }
            setShowPalette(false);
            setShowWidths(false);
            setShowShapes(false);
            setShowPaperMenu(false);
            return;
        }

        setTool(selectedTool);
        setShowEraserMenu(false);

        if (selectedTool === 'highlighter') {
            if (color === '#0f172a' || color === '#ffffff') {
                setColor('#facc15');
            }
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (file && onInsertImage) {
            onInsertImage(file);
        }
        e.target.value = '';
    };

    const cycleDockPosition = () => {
        setDockPosition(prev => {
            if (prev === 'bottom') return 'left';
            if (prev === 'left') return 'right';
            return 'bottom';
        });
    };

    // If toolbar is minimized into a compact floating pill (also draggable anywhere!)
    if (isMinimized) {
        return (
            <motion.div
                key={`min_${dockPosition}`}
                className={`apple-notes-dock-wrap dock-${dockPosition}`}
                drag
                dragMomentum={false}
                dragElastic={0.1}
                dragConstraints={{ left: -350, right: 350, top: -450, bottom: 20 }}
                onDragStart={() => { isDraggingRef.current = true; }}
                onDragEnd={() => {
                    setTimeout(() => { isDraggingRef.current = false; }, 150);
                }}
                whileDrag={{ scale: 1.05 }}
            >
                <div
                    className="apple-notes-minimized-pill"
                    onDoubleClick={() => {
                        if (!isDraggingRef.current) setIsMinimized(false);
                    }}
                    title="Drag to move. Double-click or click arrow (▲) to expand"
                    style={{ cursor: 'grab' }}
                >
                    <GripVertical size={14} color="#94a3b8" />
                    <Pencil size={15} color="#f59e0b" />
                    <span>Markup Tools</span>
                    <span
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: color,
                            border: '1px solid rgba(0,0,0,0.2)',
                            display: 'inline-block'
                        }}
                    />
                    {/* Dedicated Arrow button to expand (will NOT trigger on drag & drop) */}
                    <button
                        type="button"
                        className="apple-expand-arrow-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!isDraggingRef.current) {
                                setIsMinimized(false);
                            }
                        }}
                        title="Click arrow to expand toolbar"
                        style={{
                            background: 'rgba(245, 158, 11, 0.18)',
                            border: '1px solid rgba(245, 158, 11, 0.45)',
                            borderRadius: '50%',
                            width: 22,
                            height: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#d97706',
                            marginLeft: 4,
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <ChevronUp size={14} />
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            key={`dock_${dockPosition}`}
            className={`apple-notes-dock-wrap dock-${dockPosition}`}
            drag
            dragMomentum={false}
            dragElastic={0.1}
            dragConstraints={{ left: -350, right: 350, top: -450, bottom: 20 }}
            onDragStart={() => { isDraggingRef.current = true; }}
            onDragEnd={() => {
                setTimeout(() => { isDraggingRef.current = false; }, 150);
            }}
        >
            {/* ══ POPOVERS / FLYOUTS ROW ══ */}

            {/* 1. Color Palette Flyout */}
            {showPalette && (
                <div className="apple-palette-flyout">
                    {APPLE_COLORS.map((c) => (
                        <button
                            key={c.hex}
                            className={`apple-color-chip ${color === c.hex ? 'selected' : ''}`}
                            style={{ backgroundColor: c.hex }}
                            onClick={() => {
                                setColor(c.hex);
                                setShowPalette(false);
                            }}
                            title={c.label}
                        />
                    ))}
                    <input
                        type="color"
                        value={color.startsWith('#') ? color : '#0f172a'}
                        onChange={(e) => setColor(e.target.value)}
                        style={{ width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '50%' }}
                        title="Custom Color Picker"
                    />
                </div>
            )}

            {/* 2. Stroke Width Flyout */}
            {showWidths && (
                <div className="apple-palette-flyout">
                    <div className="apple-width-selector">
                        {STROKE_WIDTHS.map((w) => (
                            <button
                                key={w.size}
                                className={`apple-width-dot ${strokeWidth === w.size ? 'active' : ''}`}
                                onClick={() => {
                                    setStrokeWidth(w.size);
                                    setShowWidths(false);
                                }}
                                title={`${w.label} (${w.size}px)`}
                            >
                                <span
                                    style={{
                                        width: w.dot,
                                        height: w.dot,
                                        borderRadius: '50%',
                                        backgroundColor: color,
                                        display: 'inline-block',
                                    }}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Eraser 4-Dot Size Flyout (Clean Apple Notes / GoodNotes Style) */}
            {showEraserMenu && (
                <div className="apple-palette-flyout">
                    <div className="apple-width-selector">
                        {ERASER_SIZES.map((opt) => (
                            <button
                                key={opt.size}
                                type="button"
                                className={`apple-width-dot ${eraserSize === opt.size ? 'active' : ''}`}
                                onClick={() => {
                                    setEraserSize && setEraserSize(opt.size);
                                    setShowEraserMenu(false);
                                }}
                                title={`Eraser ${opt.label} (${opt.size}px)`}
                            >
                                <span
                                    style={{
                                        width: opt.dot,
                                        height: opt.dot,
                                        borderRadius: '50%',
                                        backgroundColor: '#94a3b8',
                                        display: 'inline-block',
                                        boxShadow: eraserSize === opt.size ? '0 0 8px rgba(245, 158, 11, 0.7)' : 'none',
                                    }}
                                />
                            </button>
                        ))}
                    </div>

                    {onClearPage && (
                        <>
                            <div className="apple-dock-divider" style={{ height: '20px' }} />
                            <button
                                type="button"
                                className="apple-tool-btn"
                                style={{ width: '32px', height: '32px', color: '#f87171' }}
                                onClick={() => {
                                    if (window.confirm('Clear all drawings on this page?')) {
                                        onClearPage();
                                        setShowEraserMenu(false);
                                    }
                                }}
                                title="Clear all strokes on this page"
                            >
                                <Trash2 size={15} />
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* 4. Shapes Menu Flyout */}
            {showShapes && (
                <div className="apple-palette-flyout">
                    <button
                        className={`apple-tool-btn ${tool === 'rect' ? 'active' : ''}`}
                        onClick={() => { setTool('rect'); setShowShapes(false); }}
                        title="Rectangle"
                    >
                        <Square size={17} />
                    </button>
                    <button
                        className={`apple-tool-btn ${tool === 'circle' ? 'active' : ''}`}
                        onClick={() => { setTool('circle'); setShowShapes(false); }}
                        title="Circle"
                    >
                        <Circle size={17} />
                    </button>
                    <button
                        className={`apple-tool-btn ${tool === 'diamond' ? 'active' : ''}`}
                        onClick={() => { setTool('diamond'); setShowShapes(false); }}
                        title="Diamond"
                    >
                        <Diamond size={17} />
                    </button>
                    <button
                        className={`apple-tool-btn ${tool === 'arrow' ? 'active' : ''}`}
                        onClick={() => { setTool('arrow'); setShowShapes(false); }}
                        title="Arrow"
                    >
                        <ArrowUpRight size={17} />
                    </button>
                    <button
                        className={`apple-tool-btn ${tool === 'line' ? 'active' : ''}`}
                        onClick={() => { setTool('line'); setShowShapes(false); }}
                        title="Line"
                    >
                        <Minus size={17} />
                    </button>
                </div>
            )}

            {/* 5. Paper Pattern Flyout (Theme Matched) */}
            {showPaperMenu && (
                <div className="apple-palette-flyout">
                    {[
                        { id: 'lined', label: '📝 Line wala' },
                        { id: 'plain', label: '📄 Plain' },
                        { id: 'dots', label: '⚬ Dots' },
                        { id: 'grid', label: '▦ Grid' }
                    ].map((p) => (
                        <button
                            key={p.id}
                            className={`eraser-size-btn ${paperPattern === p.id ? 'active' : ''}`}
                            onClick={() => { setPaperPattern(p.id); setShowPaperMenu(false); }}
                            style={{ padding: '5px 10px' }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            )}

            {/* ══ MAIN IPADOS FLOATING MARKUP DOCK ══ */}
            <div className="apple-notes-dock">
                {/* Drag Grip Handle */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px 2px',
                        cursor: 'grab',
                        color: '#94a3b8',
                        userSelect: 'none'
                    }}
                    title="Drag toolbar anywhere"
                >
                    <GripVertical size={16} />
                </div>

                {/* 1. Selection / Lasso */}
                <button
                    className={`apple-tool-btn ${tool === 'select' ? 'active' : ''}`}
                    onClick={() => handleToolSelect('select')}
                    title="Selection Tool (1)"
                >
                    <MousePointer size={15} />
                </button>

                {/* 2. Apple Pencil (Realistic Handwriting & Sketching) */}
                <button
                    className={`apple-tool-btn ${tool === 'pencil' ? 'active' : ''}`}
                    onClick={() => handleToolSelect('pencil')}
                    title="Apple Pencil (Accurate Handwriting & Drawing)"
                >
                    <Pencil size={15} />
                    <span
                        className="apple-tool-indicator"
                        style={{ backgroundColor: tool === 'pencil' ? color : 'transparent' }}
                    />
                </button>

                {/* 3. Highlighter (Real Translucent Chisel Marker) */}
                <button
                    className={`apple-tool-btn ${tool === 'highlighter' ? 'active' : ''}`}
                    onClick={() => handleToolSelect('highlighter')}
                    title="Highlighter (Realistic Translucent Chisel Tip)"
                >
                    <Highlighter size={15} />
                    <span
                        className="apple-tool-indicator"
                        style={{ backgroundColor: tool === 'highlighter' ? color : 'transparent', opacity: 0.8 }}
                    />
                </button>

                {/* 4. Eraser (Click to select; tap again while active for 4-dot size menu) */}
                <button
                    className={`apple-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                    onClick={() => handleToolSelect('eraser')}
                    title={`Eraser (${eraserSize}px) — Tap again to choose size`}
                >
                    <Eraser size={15} />
                    {tool === 'eraser' && (
                        <span
                            style={{
                                position: 'absolute',
                                bottom: 2,
                                width: 4,
                                height: 4,
                                borderRadius: '50%',
                                backgroundColor: '#f59e0b',
                            }}
                        />
                    )}
                </button>

                <div className="apple-dock-divider" />

                {/* 5. Text Box */}
                <button
                    className={`apple-tool-btn ${tool === 'text' ? 'active' : ''}`}
                    onClick={() => handleToolSelect('text')}
                    title="Text Box (8)"
                >
                    <Type size={15} />
                </button>

                {/* 6. Sticky Note */}
                <button
                    className={`apple-tool-btn ${tool === 'sticky' ? 'active' : ''}`}
                    onClick={() => handleToolSelect('sticky')}
                    title="Add Sticky Note"
                >
                    <StickyNote size={15} />
                </button>

                {/* 7. Shapes Menu */}
                <button
                    className={`apple-tool-btn ${['rect', 'circle', 'diamond', 'arrow', 'line'].includes(tool) ? 'active' : ''}`}
                    onClick={() => {
                        setShowShapes(!showShapes);
                        setShowPalette(false);
                        setShowWidths(false);
                        setShowEraserMenu(false);
                        setShowPaperMenu(false);
                    }}
                    title="Shapes (Rectangle, Circle, Arrow, Line)"
                >
                    <Square size={15} />
                </button>

                {/* 8. Insert Photo / Image */}
                <button
                    className="apple-tool-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Insert Photo / Image (Write over images)"
                >
                    <Image size={15} />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageUpload}
                    />
                </button>

                <div className="apple-dock-divider" />

                {/* 9. Active Color Indicator & Picker */}
                <button
                    className="apple-color-btn"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                        setShowPalette(!showPalette);
                        setShowShapes(false);
                        setShowWidths(false);
                        setShowEraserMenu(false);
                        setShowPaperMenu(false);
                    }}
                    title={`Color Swatches (Current: ${color})`}
                />

                {/* 10. Stroke Width Toggle */}
                <button
                    className="apple-tool-btn"
                    onClick={() => {
                        setShowWidths(!showWidths);
                        setShowPalette(false);
                        setShowShapes(false);
                        setShowEraserMenu(false);
                        setShowPaperMenu(false);
                    }}
                    title={`Stroke Width (${strokeWidth}px)`}
                >
                    <Sliders size={14} />
                </button>

                {/* 11. Paper Template Selector (Desktop only — already in topbar) */}
                <button
                    className="apple-tool-btn dock-desktop-only"
                    onClick={() => {
                        setShowPaperMenu(!showPaperMenu);
                        setShowPalette(false);
                        setShowShapes(false);
                        setShowWidths(false);
                        setShowEraserMenu(false);
                    }}
                    title="Paper Style (Lined, Plain, Dots, Grid)"
                >
                    <FileText size={15} />
                </button>

                <div className="apple-dock-divider dock-desktop-only" />

                {/* 12. Move / Dock Position Shortcut (Desktop only — draggable via grip handle) */}
                <button
                    className="apple-tool-btn dock-desktop-only"
                    onClick={cycleDockPosition}
                    title={`Dock Snap Position: ${dockPosition} (Click to switch dock side)`}
                >
                    <Move size={14} />
                </button>

                {/* 13. Undo & Redo */}
                <button
                    className="apple-tool-btn"
                    onClick={onUndo}
                    disabled={!canUndo}
                    style={{ opacity: canUndo ? 1 : 0.4 }}
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 size={14} />
                </button>
                <button
                    className="apple-tool-btn"
                    onClick={onRedo}
                    disabled={!canRedo}
                    style={{ opacity: canRedo ? 1 : 0.4 }}
                    title="Redo (Ctrl+Y)"
                >
                    <Redo2 size={14} />
                </button>

                {/* 14. Export A4 PDF (Desktop only — in top menu) */}
                <button
                    className="apple-tool-btn dock-desktop-only"
                    onClick={onExportPDF}
                    title="Export A4 Notes as PDF"
                >
                    <Download size={14} />
                </button>

                {/* 15. Palm Rejection Toggle */}
                {setPalmRejection && (
                    <button
                        className={`apple-tool-btn ${palmRejection ? 'active' : ''}`}
                        onClick={() => setPalmRejection(prev => !prev)}
                        title={palmRejection ? "Palm Rejection ON (Stylus only - hand resting safe). Click to allow finger drawing." : "Finger Drawing ON. Click to reject palm touches."}
                        style={{
                            color: palmRejection ? '#fbbf24' : '#94a3b8',
                            backgroundColor: palmRejection ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                            borderRadius: '8px'
                        }}
                    >
                        <Hand size={15} strokeWidth={2} />
                    </button>
                )}

                <div className="apple-dock-divider" />

                {/* 16. Minimize / Close Button */}
                <button
                    className="apple-tool-btn"
                    onClick={() => setIsMinimized(true)}
                    title="Minimize Markup Dock"
                    style={{ color: '#94a3b8' }}
                >
                    <ChevronDown size={14} />
                </button>
            </div>
        </motion.div>
    );
}
