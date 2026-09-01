import { useEffect, useRef } from 'react';

export default function LaserPointerOverlay({ 
    activeTool, 
    stagePos, 
    stageScale, 
    socket, 
    boardId,
    color = '#ef4444',
    brushSize = 6,
    palmRejection = true,
    usePressure = true
}) {
    const canvasRef = useRef(null);
    const localPointsRef = useRef([]); // for laser single point mode
    const presenterStrokesRef = useRef([]); // Array of stroke point arrays for lecture presenter pen
    const isDrawingPresenterRef = useRef(false);
    const remoteLaserMapRef = useRef({}); // userId -> array of points

    // Sync refs for active props
    const activeToolRef = useRef(activeTool);
    const stagePosRef = useRef(stagePos);
    const stageScaleRef = useRef(stageScale);
    const colorRef = useRef(color);
    const brushSizeRef = useRef(brushSize);
    const palmRejectionRef = useRef(palmRejection);
    const usePressureRef = useRef(usePressure);

    useEffect(() => {
        activeToolRef.current = activeTool;
        stagePosRef.current = stagePos;
        stageScaleRef.current = stageScale;
        colorRef.current = color;
        brushSizeRef.current = brushSize;
        palmRejectionRef.current = palmRejection;
        usePressureRef.current = usePressure;
    }, [activeTool, stagePos, stageScale, color, brushSize, palmRejection, usePressure]);

    // Handle pointer events for Laser and Presenter Pen (Lecture Mode After-Pen Effect)
    useEffect(() => {
        const handlePointerDown = (e) => {
            const tool = activeToolRef.current;
            if (tool !== 'laser' && tool !== 'presenter-pen') return;
            if (palmRejectionRef.current && e.pointerType === 'touch') return;

            if (tool === 'presenter-pen') {
                isDrawingPresenterRef.current = true;
                const now = Date.now();
                const pressure = usePressureRef.current && e.pressure ? e.pressure : 0.5;
                const sPos = stagePosRef.current;
                const sScale = stageScaleRef.current;
                const canvasX = (e.clientX - sPos.x) / sScale;
                const canvasY = (e.clientY - sPos.y) / sScale;
                const newPoint = { x: e.clientX, y: e.clientY, time: now, color: colorRef.current, width: brushSizeRef.current, pressure };

                presenterStrokesRef.current.push([newPoint]);
                socket?.emit('presenter:start', { boardId, x: canvasX, y: canvasY, color: colorRef.current, width: brushSizeRef.current });
            }
        };

        const handlePointerMove = (e) => {
            const tool = activeToolRef.current;
            if (tool !== 'laser' && tool !== 'presenter-pen') return;
            if (palmRejectionRef.current && e.pointerType === 'touch') return;
            const now = Date.now();

            const sPos = stagePosRef.current;
            const sScale = stageScaleRef.current;

            if (tool === 'laser') {
                const pt = { x: e.clientX, y: e.clientY, time: now };
                localPointsRef.current = [...localPointsRef.current.filter(p => now - p.time < 1500), pt];

                const canvasX = (e.clientX - sPos.x) / sScale;
                const canvasY = (e.clientY - sPos.y) / sScale;
                socket?.emit('laser:move', { boardId, x: canvasX, y: canvasY });
            } else if (tool === 'presenter-pen' && isDrawingPresenterRef.current) {
                const pressure = usePressureRef.current && e.pressure ? e.pressure : 0.5;
                const newPoint = { x: e.clientX, y: e.clientY, time: now, color: colorRef.current, width: brushSizeRef.current, pressure };

                const strokes = presenterStrokesRef.current;
                if (strokes.length === 0) {
                    strokes.push([newPoint]);
                } else {
                    strokes[strokes.length - 1].push(newPoint);
                }

                const canvasX = (e.clientX - sPos.x) / sScale;
                const canvasY = (e.clientY - sPos.y) / sScale;
                socket?.emit('presenter:move', { boardId, x: canvasX, y: canvasY });
            }
        };

        const handlePointerUp = () => {
            if (activeToolRef.current === 'presenter-pen' && isDrawingPresenterRef.current) {
                isDrawingPresenterRef.current = false;
                socket?.emit('presenter:end', { boardId });
            }
        };

        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [socket, boardId]);

    // Socket multiplayer laser pointers & presenter trails
    useEffect(() => {
        if (!socket) return;

        const handleRemoteLaser = ({ userId, x, y }) => {
            const now = Date.now();
            const sPos = stagePosRef.current;
            const sScale = stageScaleRef.current;
            const clientX = x * sScale + sPos.x;
            const clientY = y * sScale + sPos.y;
            const pt = { x: clientX, y: clientY, time: now };

            const map = remoteLaserMapRef.current;
            const userPts = map[userId] || [];
            map[userId] = [...userPts.filter(p => now - p.time < 1500), pt];
        };

        socket.on('laser:move', handleRemoteLaser);
        return () => {
            socket.off('laser:move', handleRemoteLaser);
        };
    }, [socket]);

    // Animation Loop for Fading Laser Trail & Lecture Presenter Pen After-Effect (Zero React Re-renders!)
    useEffect(() => {
        let animId;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const render = () => {
            if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const now = Date.now();
            const FADE_DURATION = 2500; // 2.5 seconds glowing after-pen effect

            // 1. Render Presenter Pen Strokes (After-Pen Fading Trail)
            // Prune expired strokes in-place on presenterStrokesRef
            presenterStrokesRef.current = presenterStrokesRef.current
                .map(stroke => stroke.filter(p => now - p.time < FADE_DURATION))
                .filter(stroke => stroke.length > 0);

            presenterStrokesRef.current.forEach((stroke) => {
                if (stroke.length < 2) return;

                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                for (let i = 1; i < stroke.length; i++) {
                    const p1 = stroke[i - 1];
                    const p2 = stroke[i];
                    const age = now - p2.time;
                    const alpha = Math.max(0, 1 - age / FADE_DURATION);
                    const strokeWidth = (p2.width || 6) * (0.6 + (p2.pressure || 0.5) * 0.8);

                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = p2.color || colorRef.current;
                    ctx.globalAlpha = alpha;
                    ctx.lineWidth = strokeWidth;
                    ctx.shadowColor = p2.color || '#ff2a6d';
                    ctx.shadowBlur = 14;
                    ctx.stroke();
                }
                ctx.restore();
            });

            // 2. Render Single Point Laser Trails (Local & Remote)
            localPointsRef.current = localPointsRef.current.filter(p => now - p.time < 1500);
            renderTrail(ctx, localPointsRef.current, now, '#ef4444', '#ef4444');

            Object.entries(remoteLaserMapRef.current).forEach(([uId, pts]) => {
                const active = pts.filter(p => now - p.time < 1500);
                remoteLaserMapRef.current[uId] = active;
                renderTrail(ctx, active, now, '#00f6ff', '#a855f7');
            });

            animId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animId);
    }, []);

    const renderTrail = (ctx, points, now, primaryColor, glowColor) => {
        if (points.length < 2) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            const age = now - p2.time;
            const alpha = Math.max(0, 1 - age / 1500);
            const size = Math.max(2, 8 * (1 - age / 1500));

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = primaryColor;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = size;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 12;
            ctx.stroke();
        }

        ctx.restore();
    };

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0, left: 0,
                width: '100vw', height: '100vh',
                pointerEvents: 'none',
                zIndex: 999
            }}
        />
    );
}
