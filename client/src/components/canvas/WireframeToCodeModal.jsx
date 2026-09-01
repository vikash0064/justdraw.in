import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Code, Eye, Copy, RefreshCw, Send, Loader2, FileCode, Check } from 'lucide-react';
import { wireframeToCode } from '../../api/ai.api';
import toast from 'react-hot-toast';
import '../../styles/wireframe-modal.css';

export default function WireframeToCodeModal({ canvasState = [], onClose }) {
    const [code, setCode] = useState('');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'code'
    const [history, setHistory] = useState([]);
    const [copied, setCopied] = useState(false);
    const iframeRef = useRef(null);

    // Initial code generation upon modal mount
    useEffect(() => {
        generateCode();
    }, []);

    const generateCode = async (refinementPrompt = '') => {
        setIsGenerating(true);
        try {
            const res = await wireframeToCode({
                canvasState: canvasState.map(e => ({
                    id: e.id,
                    type: e.type,
                    x: e.x,
                    y: e.y,
                    width: e.width,
                    height: e.height,
                    text: e.text,
                    label: e.label,
                })),
                prompt: refinementPrompt,
                history: history,
            });

            if (res.data && res.data.code) {
                setCode(res.data.code);
                
                // Add to history
                if (refinementPrompt) {
                    setHistory(prev => [
                        ...prev,
                        { role: 'user', content: refinementPrompt },
                        { role: 'assistant', content: res.data.code },
                    ]);
                } else {
                    setHistory([
                        { role: 'user', content: 'Generate code' },
                        { role: 'assistant', content: res.data.code },
                    ]);
                }
            } else {
                toast.error('AI returned empty code response');
            }
        } catch (err) {
            console.error('Failed to generate code:', err);
            toast.error('Failed to generate code from wireframes');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendRefinement = (e) => {
        e.preventDefault();
        if (!prompt.trim() || isGenerating) return;
        generateCode(prompt.trim());
        setPrompt('');
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        toast.success('Code copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    // Keep preview iframe updated
    useEffect(() => {
        if (iframeRef.current && code) {
            const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(code);
            iframeDoc.close();
        }
    }, [code, activeTab]);

    return (
        <div className="wf-modal-overlay">
            <motion.div 
                className="wf-modal-content glass"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
            >
                {/* Header */}
                <div className="wf-modal-header">
                    <div className="wf-modal-title">
                        <FileCode className="text-primary" size={20} />
                        <div>
                            <h3>Wireframe to HTML/Tailwind Code</h3>
                            <span className="wf-modal-subtitle">AI-generated executable website mockup</span>
                        </div>
                    </div>
                    <button className="wf-modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="wf-modal-body">
                    {/* Left Pane: Preview and Code Editor */}
                    <div className="wf-left-pane">
                        <div className="wf-pane-tabs">
                            <button 
                                className={`wf-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
                                onClick={() => setActiveTab('preview')}
                            >
                                <Eye size={14} /> Preview
                            </button>
                            <button 
                                className={`wf-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
                                onClick={() => setActiveTab('code')}
                            >
                                <Code size={14} /> Code
                            </button>
                            
                            <div className="wf-pane-actions">
                                <button className="wf-action-btn" onClick={copyToClipboard} title="Copy Code">
                                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                </button>
                                <button className="wf-action-btn" onClick={() => generateCode()} title="Regenerate">
                                    <RefreshCw size={14} className={isGenerating ? 'spin' : ''} />
                                </button>
                            </div>
                        </div>

                        <div className="wf-viewport">
                            {isGenerating && code === '' ? (
                                <div className="wf-loading-overlay">
                                    <Loader2 size={36} className="spin text-primary" />
                                    <span>AI is writing code...</span>
                                </div>
                            ) : null}

                            {activeTab === 'preview' ? (
                                <iframe 
                                    ref={iframeRef}
                                    title="Wireframe Live Preview"
                                    className="wf-preview-iframe"
                                    sandbox="allow-scripts"
                                />
                            ) : (
                                <pre className="wf-code-block">
                                    <code>{code}</code>
                                </pre>
                            )}
                        </div>
                    </div>

                    {/* Right Pane: AI Refinement Chat */}
                    <div className="wf-right-pane">
                        <div className="wf-chat-header">
                            <h4>Refine with AI</h4>
                            <p>Ask the AI to change styles, colors, layout, responsiveness, or add interactions.</p>
                        </div>

                        <div className="wf-chat-history">
                            {history.filter(h => h.role === 'user' && h.content !== 'Generate code').map((h, index) => (
                                <div key={index} className="wf-chat-bubble">
                                    <span className="wf-user-tag">You</span>
                                    <p>{h.content}</p>
                                </div>
                            ))}
                            {isGenerating && (
                                <div className="wf-chat-bubble ai">
                                    <span className="wf-ai-tag">AI</span>
                                    <div className="wf-loading-dots">
                                        <div className="dot"></div>
                                        <div className="dot"></div>
                                        <div className="dot"></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <form className="wf-chat-form" onSubmit={handleSendRefinement}>
                            <input 
                                type="text"
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                placeholder="e.g., make headers dark, buttons blue..."
                                disabled={isGenerating}
                                className="wf-chat-input"
                            />
                            <button type="submit" disabled={!prompt.trim() || isGenerating} className="wf-chat-send">
                                {isGenerating ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                            </button>
                        </form>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
