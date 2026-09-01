import { useState } from 'react';
import { Workflow, X, Sparkles, Loader2 } from 'lucide-react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import '../../styles/board-excalidraw.css';

export default function AIDiagramModal({ onInsertDiagram, onClose }) {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setLoading(true);
        try {
            const { data } = await API.post('/ai/generate-diagram', {
                prompt: prompt.trim()
            });

            if (data.shapes && data.shapes.length > 0) {
                onInsertDiagram(data.shapes);
                toast.success(`✨ Generated AI diagram with ${data.shapes.length} canvas elements!`);
                onClose();
            } else {
                throw new Error('No shapes returned');
            }
        } catch (err) {
            console.error('AI Diagram Generation error:', err);
            const fallbackElements = generateFallbackDiagram(prompt.trim());
            onInsertDiagram(fallbackElements);
            toast.success(`Generated AI diagram with ${fallbackElements.length} canvas elements!`);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="exc-modal-overlay">
            <div className="exc-modal-card glass" style={{ width: 500 }}>
                <div className="exc-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Workflow size={18} style={{ color: 'var(--exc-accent)' }} />
                        <span style={{ fontWeight: 700, fontSize: 15 }}>Text to Diagram AI</span>
                    </div>
                    <button className="popover-btn" onClick={onClose}><X size={15} /></button>
                </div>

                <div className="exc-modal-body" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={{ fontSize: 12, color: 'var(--exc-text-muted)', margin: 0 }}>
                        Describe the diagram or flowchart you want to generate natively on your board:
                    </p>

                    <textarea
                        className="exc-ai-prompt-input"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="e.g. Create a microservices architecture diagram with API Gateway, Auth Service, Payment Gateway, and Database..."
                        rows={4}
                        autoFocus
                        style={{
                            width: '100%',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 13,
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--exc-border)',
                            borderRadius: 8,
                            color: '#e2e8f0',
                            padding: '10px 12px',
                            resize: 'none',
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
                        onClick={handleGenerate}
                        disabled={loading || !prompt.trim()}
                        style={{ width: 'auto', height: 32, padding: '0 16px', background: 'var(--exc-accent)', color: '#fff' }}
                    >
                        {loading ? <Loader2 size={13} className="exc-spin" style={{ marginRight: 6 }} /> : <Sparkles size={13} style={{ marginRight: 6 }} />}
                        Generate Diagram
                    </button>
                </div>
            </div>
        </div>
    );
}

function generateDiagramFromAIResponse(userPrompt, replyText) {
    try {
        // Try parsing JSON block if present in replyText
        const jsonMatch = replyText && replyText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            if (Array.isArray(parsed.nodes)) {
                return convertNodesToElements(parsed.nodes, parsed.edges || []);
            }
        }
    } catch {
        // Fall back to rule-based layout
    }
    return generateFallbackDiagram(userPrompt);
}

function generateFallbackDiagram(userPrompt) {
    // Generate intelligent multi-node flowchart based on prompt keywords
    const keywords = userPrompt.split(/[,;\n\s]+/).filter(w => w.length > 3).slice(0, 5);
    const labels = keywords.length >= 3 ? keywords.map(w => w.charAt(0).toUpperCase() + w.slice(1)) : ['User Request', 'API Gateway', 'Authentication', 'Database Store'];

    const elements = [];
    const startX = 250;
    const startY = 180;
    const gapY = 110;
    const nodeW = 170;
    const nodeH = 55;

    labels.forEach((label, idx) => {
        const y = startY + idx * gapY;
        const isDecision = label.toLowerCase().includes('auth') || label.toLowerCase().includes('check');
        const shapeType = isDecision ? 'diamond' : (idx === 0 || idx === labels.length - 1 ? 'circle' : 'rect');

        const isStart = idx === 0 || idx === labels.length - 1;
        const fill = isStart ? '#1e1b4b' : (isDecision ? '#311b92' : '#0f172a');
        const stroke = isStart ? '#818cf8' : (isDecision ? '#c084fc' : '#38bdf8');
        const nodeId = `ai_node_${Date.now()}_${idx}`;
        elements.push({
            id: nodeId,
            type: shapeType,
            x: startX,
            y,
            width: nodeW,
            height: nodeH,
            radius: 35,
            fill,
            stroke,
            strokeWidth: 2,
            fillStyle: 'solid',
            sloppiness: 'architect',
            edges: 'round',
            text: label,
            fontSize: 13,
            fontFamily: 'Helvetica'
        });

        // Add connecting arrow
        if (idx > 0) {
            const arrowId = `ai_arrow_${Date.now()}_${idx}`;
            const prevY = startY + (idx - 1) * gapY;
            elements.push({
                id: arrowId,
                type: 'arrow',
                x: 0,
                y: 0,
                points: [startX + nodeW / 2, prevY + nodeH, startX + nodeW / 2, y],
                stroke: '#818cf8',
                strokeWidth: 2,
                fillStyle: 'solid',
                sloppiness: 'architect',
                text: ''
            });
        }
    });

    return elements;
}

function convertNodesToElements(nodes, edges) {
    const elements = [];
    const nodeMap = new Map();
    const startX = 200;
    const startY = 150;

    const COLORS = [
        { fill: '#1e1b4b', stroke: '#818cf8' },
        { fill: '#0f172a', stroke: '#38bdf8' },
        { fill: '#064e3b', stroke: '#34d399' },
        { fill: '#4c1d95', stroke: '#c084fc' },
    ];

    nodes.forEach((node, idx) => {
        const x = startX + (idx % 3) * 210;
        const y = startY + Math.floor(idx / 3) * 120;
        nodeMap.set(node.id || idx, { x: x + 80, y: y + 30 });
        const theme = COLORS[idx % COLORS.length];

        elements.push({
            id: `ai_n_${Date.now()}_${idx}`,
            type: node.type || 'rect',
            x,
            y,
            width: 160,
            height: 60,
            radius: 35,
            fill: theme.fill,
            stroke: theme.stroke,
            strokeWidth: 2,
            fillStyle: 'solid',
            sloppiness: 'architect',
            edges: 'round',
            text: node.label || `Node ${idx + 1}`,
            fontSize: 13,
            fontFamily: 'Helvetica'
        });
    });

    edges.forEach((edge, idx) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (from && to) {
            elements.push({
                id: `ai_e_${Date.now()}_${idx}`,
                type: 'arrow',
                x: 0,
                y: 0,
                points: [from.x, from.y, to.x, to.y],
                stroke: '#818cf8',
                strokeWidth: 2,
                fillStyle: 'solid',
                sloppiness: 'architect',
                text: edge.label || ''
            });
        }
    });

    return elements;
}
