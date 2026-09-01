import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Loader2, CheckCircle2, AlertCircle,
    Trash2, Zap, Bot, Mic, MicOff, ArrowDown,
    Sparkles, RotateCcw, Copy, Check,
    Workflow, Layers, Database, Compass, Share2, Layout, Component
} from 'lucide-react';
import { getAiTemplates } from '../../api/ai.api';
import '../../styles/ai-chat.css';

/**
 * Helix — Premium AI Diagramming Agent
 * Professional ChatGPT-style interface for the Centrio board.
 * Embedded inside the right sidebar dock (no own header/close — dock handles that).
 */
export default function AIChatPanel({
    socket,
    boardId,
    pageId,
    canvasState = [],
    selectedElements = [],
    onClose,
    visible,
}) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [currentSteps, setCurrentSteps] = useState([]);
    const [lastSemanticGraph, setLastSemanticGraph] = useState(null);
    const [lastShapeIds, setLastShapeIds] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [showTemplates, setShowTemplates] = useState(true);
    const [isListening, setIsListening] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState(null);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const recognitionRef = useRef(null);

    // Load templates
    useEffect(() => {
        getAiTemplates()
            .then(res => setTemplates(res.data))
            .catch(() => { });
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentSteps]);

    // Scroll detection for "scroll to bottom" button
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 80);
        };
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    // Socket listeners for AI events (ref-based to avoid re-render loops)
    const stepsRef = useRef([]);
    useEffect(() => { stepsRef.current = currentSteps; }, [currentSteps]);

    useEffect(() => {
        if (!socket) return;

        const handleStart = (data) => {
            setCurrentSessionId(data.sessionId);
            setCurrentSteps([]);
            stepsRef.current = [];
            setIsProcessing(true);
        };

        const handleStep = (data) => {
            if (!data.sessionId) return;
            setCurrentSteps(prev => [...prev, {
                toolName: data.toolName,
                status: data.status,
                result: data.result,
                error: data.error,
                timestamp: Date.now(),
            }]);
        };

        const handleComplete = (data) => {
            setIsProcessing(false);
            if (data.semanticGraph) {
                setLastSemanticGraph(data.semanticGraph);
            }
            if (data.shapeIds) {
                setLastShapeIds(data.shapeIds);
            }
            const capturedSteps = [...stepsRef.current];
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.message || 'Done!',
                steps: capturedSteps,
                totalActions: data.totalActions || 0,
                usage: data.usage,
                timestamp: Date.now(),
                ...(data.inverses && data.inverses.length > 0 ? { inverses: data.inverses } : {}),
            }]);
            setCurrentSteps([]);
            stepsRef.current = [];
            setCurrentSessionId(null);
        };

        const handleError = (data) => {
            setIsProcessing(false);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.error || 'Something went wrong. Please try again.',
                isError: true,
                timestamp: Date.now(),
            }]);
            setCurrentSteps([]);
            stepsRef.current = [];
            setCurrentSessionId(null);
        };

        socket.on('ai:action:start', handleStart);
        socket.on('ai:action:step', handleStep);
        socket.on('ai:action:complete', handleComplete);
        socket.on('ai:action:error', handleError);

        return () => {
            socket.off('ai:action:start', handleStart);
            socket.off('ai:action:step', handleStep);
            socket.off('ai:action:complete', handleComplete);
            socket.off('ai:action:error', handleError);
        };
    }, [socket]);

    // Web Speech API — mic input
    const toggleMic = useCallback(() => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            setInput(transcript);
        };

        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    }, [isListening]);

    // Send prompt to AI
    const sendPrompt = useCallback((promptText) => {
        if (!promptText?.trim() || !socket || isProcessing) return;
        const prompt = promptText.trim();

        setMessages(prev => [...prev, {
            role: 'user',
            content: prompt,
            timestamp: Date.now(),
        }]);

        const conversationHistory = messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
        }));

        const selectedData = selectedElements.map(e => ({
            id: e.id, type: e.type, x: e.x, y: e.y,
            width: e.width, height: e.height, radius: e.radius,
            text: e.text, label: e.label, fill: e.fill, stroke: e.stroke,
        }));

        if (lastSemanticGraph) {
            socket.emit('ai:diagram:refine', {
                boardId,
                pageId,
                prompt,
                currentGraph: lastSemanticGraph,
                previousShapeIds: lastShapeIds,
            });
        } else {
            socket.emit('ai:diagram:generate', {
                boardId,
                pageId,
                prompt,
            });
        }

        setInput('');
        setShowTemplates(false);
    }, [socket, boardId, pageId, lastSemanticGraph, isProcessing]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendPrompt(input);
        }
    };

    const clearChat = () => {
        setMessages([]);
        setCurrentSteps([]);
        setShowTemplates(true);
    };

    const copyMessage = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    const formatToolName = (name) => {
        const map = {
            createElement: 'Creating shape',
            updateElement: 'Updating shape',
            deleteElement: 'Removing shape',
            moveElement: 'Moving shape',
            connectElements: 'Drawing connection',
            batchCreate: 'Batch creating shapes',
            autoLayout: 'Auto-arranging layout',
            getCanvasState: 'Reading canvas',
            getSelectedElements: 'Inspecting selection',
            importMermaid: 'Parsing Mermaid code',
        };
        return map[name] || name;
    };

    const formatTime = (ts) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderTemplateIcon = (id, name = '') => {
        const lower = (id + ' ' + name).toLowerCase();
        if (lower.includes('flow')) return <div className="helix-t-icon-box helix-t-icon-box--indigo"><Workflow size={15} /></div>;
        if (lower.includes('arch') || lower.includes('system')) return <div className="helix-t-icon-box helix-t-icon-box--sky"><Layers size={15} /></div>;
        if (lower.includes('er') || lower.includes('data')) return <div className="helix-t-icon-box helix-t-icon-box--emerald"><Database size={15} /></div>;
        if (lower.includes('journey') || lower.includes('user')) return <div className="helix-t-icon-box helix-t-icon-box--rose"><Compass size={15} /></div>;
        if (lower.includes('mind') || lower.includes('map')) return <div className="helix-t-icon-box helix-t-icon-box--purple"><Share2 size={15} /></div>;
        if (lower.includes('wire') || lower.includes('code')) return <div className="helix-t-icon-box helix-t-icon-box--amber"><Layout size={15} /></div>;
        return <div className="helix-t-icon-box helix-t-icon-box--indigo"><Component size={15} /></div>;
    };

    // Hardcoded template fallback when API templates are empty
    const defaultTemplates = [
        { id: 'flow', name: 'Flowchart', prompt: 'Create a user login flowchart with start, input, validation, success and error states' },
        { id: 'arch', name: 'System Architecture', prompt: 'Create a microservices architecture diagram with API Gateway, Auth Service, User Service, and Database' },
        { id: 'er', name: 'ER Diagram', prompt: 'Create an ER diagram for an e-commerce system with Users, Products, Orders, and Reviews tables' },
        { id: 'journey', name: 'User Journey', prompt: 'Create a user journey map for an onboarding flow: signup, verification, profile setup, dashboard' },
        { id: 'mindmap', name: 'Mind Map', prompt: 'Create a mind map for product launch strategy with marketing, dev, design, and sales nodes' },
        { id: 'wireframe', name: 'Wireframe', prompt: 'Create a landing page wireframe with header, hero section, features grid, and footer' },
    ];
    const displayTemplates = templates.length > 0 ? templates.slice(0, 6) : defaultTemplates;

    if (!visible) return null;

    return (
        <div className="helix-panel">
            {/* ── Messages Area ── */}
            <div className="helix-messages" ref={messagesContainerRef}>
                {/* Welcome / Empty State */}
                {messages.length === 0 && showTemplates && (
                    <div className="helix-welcome">
                        <div className="helix-logo">
                            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                                <defs>
                                    <linearGradient id="helixGrad" x1="0" y1="0" x2="36" y2="36">
                                        <stop stopColor="#818cf8" />
                                        <stop offset="1" stopColor="#c084fc" />
                                    </linearGradient>
                                </defs>
                                <circle cx="18" cy="18" r="18" fill="url(#helixGrad)" opacity="0.12" />
                                <path d="M12 12 C12 18, 24 18, 24 24 M24 12 C24 18, 12 18, 12 24" stroke="url(#helixGrad)" strokeWidth="2.5" strokeLinecap="round" />
                                <circle cx="12" cy="12" r="2" fill="#818cf8" />
                                <circle cx="24" cy="12" r="2" fill="#c084fc" />
                                <circle cx="12" cy="24" r="2" fill="#c084fc" />
                                <circle cx="24" cy="24" r="2" fill="#818cf8" />
                            </svg>
                        </div>
                        <h3 className="helix-title">Nemo</h3>
                        <p className="helix-subtitle">
                            Your AI diagramming agent. Describe what you need and I'll build it on your canvas.
                        </p>

                        <div className="helix-templates">
                            {displayTemplates.map(t => (
                                <button
                                    key={t.id}
                                    className="helix-template-btn"
                                    onClick={() => {
                                        const text = t.suggestions?.[0] || t.prompt;
                                        sendPrompt(text);
                                    }}
                                >
                                    {renderTemplateIcon(t.id, t.name)}
                                    <span className="helix-template-name">{t.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Chat Messages */}
                <AnimatePresence initial={false}>
                    {messages.map((msg, i) => (
                        <motion.div
                            key={i}
                            className={`helix-msg helix-msg--${msg.role}`}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Avatar */}
                            <div className={`helix-avatar helix-avatar--${msg.role}`}>
                                {msg.role === 'user' ? (
                                    <span>Y</span>
                                ) : (
                                    <Sparkles size={14} />
                                )}
                            </div>

                            {/* Content */}
                            <div className="helix-msg-body">
                                <div className="helix-msg-header">
                                    <span className="helix-msg-name">
                                        {msg.role === 'user' ? 'You' : 'Nemo'}
                                    </span>
                                    <span className="helix-msg-time">{formatTime(msg.timestamp)}</span>
                                </div>

                                {msg.isError ? (
                                    <div className="helix-error">
                                        <AlertCircle size={14} />
                                        <span>{msg.content}</span>
                                    </div>
                                ) : (
                                    <div className="helix-msg-text">{msg.content}</div>
                                )}

                                {/* Tool execution steps */}
                                {msg.steps && msg.steps.length > 0 && (
                                    <div className="helix-steps">
                                        <div className="helix-steps-label">
                                            <Zap size={11} />
                                            <span>{msg.steps.length} action{msg.steps.length > 1 ? 's' : ''} executed</span>
                                        </div>
                                        <div className="helix-steps-list">
                                            {msg.steps.map((step, j) => (
                                                <div key={j} className={`helix-step helix-step--${step.status}`}>
                                                    {step.status === 'success' ? (
                                                        <CheckCircle2 size={12} />
                                                    ) : (
                                                        <AlertCircle size={12} />
                                                    )}
                                                    <span>{formatToolName(step.toolName)}</span>
                                                    {step.result?.label && (
                                                        <span className="helix-step-tag">"{step.result.label}"</span>
                                                    )}
                                                    {step.result?.created && (
                                                        <span className="helix-step-tag">{step.result.created} items</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {msg.totalActions > 0 && (
                                    <div className="helix-meta">
                                        <Zap size={11} />
                                        <span>{msg.totalActions} canvas modification{msg.totalActions > 1 ? 's' : ''}</span>
                                    </div>
                                )}

                                {/* Copy button for assistant messages */}
                                {msg.role === 'assistant' && !msg.isError && (
                                    <button
                                        className="helix-copy-btn"
                                        onClick={() => copyMessage(msg.content, i)}
                                        title="Copy response"
                                    >
                                        {copiedIdx === i ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Typing / Processing Indicator */}
                {isProcessing && (
                    <motion.div
                        className="helix-msg helix-msg--assistant"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="helix-avatar helix-avatar--assistant">
                            <Sparkles size={14} />
                        </div>
                        <div className="helix-msg-body">
                            <div className="helix-msg-header">
                                <span className="helix-msg-name">Nemo</span>
                            </div>
                            {currentSteps.length > 0 ? (
                                <div className="helix-steps">
                                    <div className="helix-steps-list">
                                        {currentSteps.map((step, j) => (
                                            <div key={j} className={`helix-step helix-step--${step.status}`}>
                                                {step.status === 'success' ? (
                                                    <CheckCircle2 size={12} />
                                                ) : step.status === 'error' ? (
                                                    <AlertCircle size={12} />
                                                ) : (
                                                    <Loader2 size={12} className="helix-spin" />
                                                )}
                                                <span>{formatToolName(step.toolName)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            <div className="helix-typing">
                                <span /><span /><span />
                            </div>
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Scroll to bottom */}
            <AnimatePresence>
                {showScrollBtn && (
                    <motion.button
                        className="helix-scroll-btn"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    >
                        <ArrowDown size={16} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Quick suggestions for selection */}
            {selectedElements.length > 0 && !isProcessing && (
                <div className="helix-suggestions">
                    {['Style this', 'Delete selected', 'Duplicate', 'Connect to next'].map(text => (
                        <button key={text} onClick={() => sendPrompt(text)}>{text}</button>
                    ))}
                </div>
            )}

            {/* ── Input Bar ── */}
            <div className="helix-input-bar">
                <div className="helix-input-row">
                    <button
                        className={`helix-mic-btn${isListening ? ' active' : ''}`}
                        onClick={toggleMic}
                        title={isListening ? 'Stop listening' : 'Voice input'}
                    >
                        {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isProcessing ? 'Nemo is working…' : 'Message Nemo…'}
                        disabled={isProcessing}
                        rows={1}
                        className="helix-textarea"
                    />
                    <button
                        onClick={() => sendPrompt(input)}
                        disabled={!input.trim() || isProcessing}
                        className="helix-send-btn"
                    >
                        {isProcessing ? <Loader2 size={16} className="helix-spin" /> : <Send size={16} />}
                    </button>
                </div>
                <div className="helix-input-footer">
                    <span>Nemo can make mistakes. Verify diagram results.</span>
                    {messages.length > 0 && (
                        <button className="helix-clear-btn" onClick={clearChat}>
                            <Trash2 size={11} /> Clear
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
