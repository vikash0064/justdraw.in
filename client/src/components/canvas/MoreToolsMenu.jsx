import { useRef, useEffect } from 'react';
import '../../styles/board-excalidraw.css';

/**
 * MoreToolsMenu — 1:1 Exact Excalidraw Dropdown
 * Background: #232329
 * Title Case "Generate"
 */
export default function MoreToolsMenu({ 
    activeTool, 
    onSelectTool, 
    onOpenWebEmbed,
    onOpenTextToDiagram, 
    onOpenMermaid, 
    onOpenWireframeToCode, 
    onClose 
}) {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('.exc-more-tools-trigger')) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div ref={menuRef} className="exc-more-menu-container" onClick={(e) => e.stopPropagation()}>
            <div className="exc-more-menu-group">
                {/* 1. Frame tool */}
                <button 
                    className={`exc-more-menu-item ${activeTool === 'frame' ? 'active' : ''}`}
                    onClick={() => { onSelectTool('frame'); onClose(); }}
                >
                    <div className="exc-more-item-left">
                        {/* # Hash grid */}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="9" x2="20" y2="9" />
                            <line x1="4" y1="15" x2="20" y2="15" />
                            <line x1="10" y1="3" x2="8" y2="21" />
                            <line x1="16" y1="3" x2="14" y2="21" />
                        </svg>
                        <span>Frame tool</span>
                    </div>
                    <span className="exc-shortcut-plain">F</span>
                </button>

                {/* 2. Web Embed */}
                <button 
                    className={`exc-more-menu-item ${activeTool === 'web-embed' ? 'active' : ''}`}
                    onClick={() => { 
                        if (onOpenWebEmbed) onOpenWebEmbed();
                        else onSelectTool('web-embed'); 
                        onClose(); 
                    }}
                >
                    <div className="exc-more-item-left">
                        {/* <> Brackets */}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                        </svg>
                        <span>Web Embed</span>
                    </div>
                </button>

                {/* 3. Draw to shape */}
                <button 
                    className={`exc-more-menu-item ${activeTool === 'draw-to-shape' ? 'active' : ''}`}
                    onClick={() => { onSelectTool('draw-to-shape'); onClose(); }}
                >
                    <div className="exc-more-item-left">
                        {/* Overlapping rounded shapes */}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 16.5A5.5 5.5 0 0 1 12.5 11H13" />
                            <circle cx="9" cy="9" r="6" />
                            <circle cx="15" cy="15" r="6" />
                        </svg>
                        <span>Draw to shape</span>
                    </div>
                    <span className="exc-shortcut-plain">Shift+X</span>
                </button>

                {/* 4. Laser pointer */}
                <button 
                    className={`exc-more-menu-item ${activeTool === 'laser' ? 'active' : ''}`}
                    onClick={() => { onSelectTool('laser'); onClose(); }}
                >
                    <div className="exc-more-item-left">
                        {/* Slanted laser pointer wand */}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 4-2 2" />
                            <path d="m15 9-2-2" />
                            <path d="M17.8 11.8 19 13" />
                            <path d="M3 21l9-9" />
                            <path d="M12.2 6.2 11 5" />
                        </svg>
                        <span>Laser pointer</span>
                    </div>
                    <span className="exc-shortcut-plain">K</span>
                </button>

                {/* 5. Bucket fill */}
                <button 
                    className={`exc-more-menu-item ${activeTool === 'bucket' ? 'active' : ''}`}
                    onClick={() => { onSelectTool('bucket'); onClose(); }}
                >
                    <div className="exc-more-item-left">
                        {/* Paint bucket */}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
                            <path d="m5 2 5 5" />
                            <path d="M2 13h15" />
                            <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
                        </svg>
                        <span>Bucket fill</span>
                    </div>
                    <span className="exc-shortcut-plain">B</span>
                </button>

                {/* 6. Lasso selection */}
                <button 
                    className={`exc-more-menu-item ${activeTool === 'lasso' ? 'active' : ''}`}
                    onClick={() => { onSelectTool('lasso'); onClose(); }}
                >
                    <div className="exc-more-item-left">
                        {/* Lasso loop */}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 21a9 9 0 1 0-9-9c0 1.48.35 2.88.98 4.12L3 21l4.88-.98A8.93 8.93 0 0 0 12 21z"/>
                        </svg>
                        <span>Lasso selection</span>
                    </div>
                </button>
            </div>

            {/* Generate Section */}
            <div className="exc-more-menu-section-label">Generate</div>

            <div className="exc-more-menu-group">
                {/* 7. Text to diagram */}
                <button 
                    className="exc-more-menu-item"
                    onClick={() => { onOpenTextToDiagram(); onClose(); }}
                >
                    <div className="exc-more-item-left">
                        {/* 4-leaf diagram clover */}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                            <path d="M10 6.5h4a2 2 0 0 1 2 2v5.5"/>
                            <circle cx="6.5" cy="17.5" r="3.5"/>
                        </svg>
                        <span>Text to diagram</span>
                    </div>
                    <span className="exc-ai-badge">AI</span>
                </button>

                {/* 8. Mermaid to Excalidraw */}
                <button 
                    className="exc-more-menu-item"
                    onClick={() => { onOpenMermaid(); onClose(); }}
                >
                    <div className="exc-more-item-left">
                        {/* Branching tree Y */}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="19" r="2.5"/>
                            <path d="M12 16.5V12"/>
                            <path d="M5 4l7 8 7-8"/>
                            <circle cx="5" cy="4" r="2.5"/>
                            <circle cx="19" cy="4" r="2.5"/>
                        </svg>
                        <span>Mermaid to Excalidraw</span>
                    </div>
                </button>

                {/* 9. Wireframe to code */}
                <button 
                    className="exc-more-menu-item"
                    onClick={() => { onOpenWireframeToCode(); onClose(); }}
                >
                    <div className="exc-more-item-left">
                        {/* Slanted magic wand */}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 4-2 2" />
                            <path d="m15 9-2-2" />
                            <path d="M17.8 11.8 19 13" />
                            <path d="M3 21l9-9" />
                            <path d="M12.2 6.2 11 5" />
                        </svg>
                        <span>Wireframe to code</span>
                    </div>
                    <span className="exc-ai-badge">AI</span>
                </button>
            </div>
        </div>
    );
}
