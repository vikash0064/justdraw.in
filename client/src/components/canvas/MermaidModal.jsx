import { useState } from 'react';
import { Network, X, Play, Code2 } from 'lucide-react';
import toast from 'react-hot-toast';
import '../../styles/board-excalidraw.css';

const DEFAULT_MERMAID = `graph TD
    A[Start Request] --> B{Is Authenticated?}
    B -->|Yes| C[Process Data]
    B -->|No| D[Return Error 401]
    C --> E[Save to Database]`;

export default function MermaidModal({ onInsertDiagram, onClose }) {
    const [code, setCode] = useState(DEFAULT_MERMAID);

    const handleParseAndInsert = () => {
        if (!code.trim()) return;

        try {
            const parsedElements = parseMermaidToCanvasElements(code);
            if (parsedElements.length === 0) {
                toast.error('Could not parse diagram. Check Mermaid syntax.');
                return;
            }

            onInsertDiagram(parsedElements);
            toast.success(`Inserted ${parsedElements.length} native canvas elements!`);
            onClose();
        } catch (err) {
            console.error('Mermaid parse error:', err);
            toast.error('Failed to parse Mermaid diagram code');
        }
    };

    return (
        <div className="exc-modal-overlay">
            <div className="exc-modal-card glass" style={{ width: 540 }}>
                <div className="exc-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Network size={18} style={{ color: 'var(--exc-accent)' }} />
                        <span style={{ fontWeight: 700, fontSize: 15 }}>Mermaid to Diagram</span>
                    </div>
                    <button className="popover-btn" onClick={onClose}><X size={15} /></button>
                </div>

                <div className="exc-modal-body" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={{ fontSize: 12, color: 'var(--exc-text-muted)', margin: 0 }}>
                        Paste Mermaid diagram code below to generate native editable board shapes:
                    </p>

                    <textarea
                        className="exc-mermaid-input"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder="graph TD..."
                        rows={8}
                        style={{
                            width: '100%',
                            fontFamily: 'Cascadia Code, Fira Code, monospace',
                            fontSize: 12,
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--exc-border)',
                            borderRadius: 8,
                            color: '#e2e8f0',
                            padding: '10px 12px',
                            resize: 'vertical',
                            outline: 'none'
                        }}
                    />
                </div>

                <div className="exc-modal-footer" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--exc-border)' }}>
                    <button className="exc-sel-btn" onClick={onClose} style={{ width: 'auto', height: 32, padding: '0 14px' }}>
                        Cancel
                    </button>
                    <button 
                        className="exc-sel-btn" 
                        onClick={handleParseAndInsert}
                        style={{ width: 'auto', height: 32, padding: '0 16px', background: 'var(--exc-accent)', color: '#fff' }}
                    >
                        <Play size={13} style={{ marginRight: 6 }} /> Render to Board
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Robust lightweight parser that turns Mermaid graph definitions into native RoughShape elements
 */
function parseMermaidToCanvasElements(mermaidText) {
    const lines = mermaidText.split('\n').map(l => l.trim()).filter(Boolean);
    const nodesMap = new Map(); // id -> { id, label, shapeType }
    const edges = []; // { from, to, label }

    // Regex patterns
    const nodeRegex = /([A-Za-z0-9_]+)\s*(\[|\{|\()"?([^"\]\}\)]+)"?(\]|\}|\))/g;
    const arrowRegex = /([A-Za-z0-9_]+)\s*-->(?:\|([^|]+)\|)?\s*([A-Za-z0-9_]+)/g;

    // Parse nodes
    lines.forEach(line => {
        let match;
        while ((match = nodeRegex.exec(line)) !== null) {
            const [, id, openBracket, label] = match;
            let shapeType = 'rect';
            if (openBracket === '{') shapeType = 'diamond';
            if (openBracket === '(') shapeType = 'circle';

            nodesMap.set(id, { id, label: label.trim(), shapeType });
        }
    });

    // Parse arrows
    lines.forEach(line => {
        let match;
        while ((match = arrowRegex.exec(line)) !== null) {
            const [, from, edgeLabel, to] = match;

            if (!nodesMap.has(from)) nodesMap.set(from, { id: from, label: from, shapeType: 'rect' });
            if (!nodesMap.has(to)) nodesMap.set(to, { id: to, label: to, shapeType: 'rect' });

            edges.push({ from, to, label: edgeLabel ? edgeLabel.trim() : '' });
        }
    });

    const nodes = Array.from(nodesMap.values());
    if (nodes.length === 0) return [];

    // Simple vertical grid layout calculation
    const startX = 200;
    const startY = 150;
    const nodeW = 160;
    const nodeH = 60;
    const gapY = 100;
    const gapX = 220;

    const elements = [];
    const nodePosMap = new Map();

    nodes.forEach((node, index) => {
        const row = Math.floor(index / 2);
        const col = index % 2;
        const x = startX + col * gapX;
        const y = startY + row * gapY;

        nodePosMap.set(node.id, { x: x + nodeW / 2, y: y + nodeH / 2, xTopLeft: x, yTopLeft: y });

        const shapeId = `mermaid_${node.id}_${Date.now()}_${index}`;
        elements.push({
            id: shapeId,
            type: node.shapeType,
            x,
            y,
            width: nodeW,
            height: nodeH,
            radius: 35,
            fill: index === 0 ? '#1e1b4b' : '#0f172a',
            stroke: index === 0 ? '#818cf8' : '#38bdf8',
            strokeWidth: 2,
            fillStyle: 'solid',
            sloppiness: 'architect',
            edges: 'round',
            text: node.label,
            fontSize: 13,
            fontFamily: 'Helvetica'
        });
    });

    // Generate arrow elements
    edges.forEach((edge, index) => {
        const fromPos = nodePosMap.get(edge.from);
        const toPos = nodePosMap.get(edge.to);
        if (!fromPos || !toPos) return;

        const arrowId = `mermaid_arrow_${Date.now()}_${index}`;
        elements.push({
            id: arrowId,
            type: 'arrow',
            x: 0,
            y: 0,
            points: [fromPos.x, fromPos.y + nodeH / 2, toPos.x, toPos.y - nodeH / 2],
            stroke: '#a5b4fc',
            strokeWidth: 2,
            sloppiness: 'artist',
            text: edge.label || ''
        });
    });

    return elements;
}
