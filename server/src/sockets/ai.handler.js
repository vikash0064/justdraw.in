/**
 * AI Socket Handler — Real-time AI agent loop via Socket.IO
 */
const aiService = require('../services/ai.service');
const { generateDiagram, refineDiagram } = require('../services/semanticPipeline');

module.exports = (socket, io) => {
    // ── Dedicated 2-Stage Deterministic Diagram Generator ──
    socket.on('ai:diagram:generate', async (data) => {
        const { boardId, pageId, prompt } = data;
        const sessionId = `diag-${Date.now()}`;
        io.to(boardId).emit('ai:action:start', { sessionId, prompt });

        try {
            const result = await generateDiagram(prompt);
            
            // Broadcast batch shape creation
            for (const shape of result.shapes) {
                io.to(boardId).emit('shape:add', { boardId, pageId, shape });
            }

            io.to(boardId).emit('ai:action:complete', {
                sessionId,
                message: `Generated diagram with ${result.layoutGraph.nodes.length} nodes and ${result.layoutGraph.edges.length} connections.`,
                semanticGraph: result.semanticGraph,
                totalActions: result.shapes.length,
                shapeIds: result.shapes.map(s => s.id)
            });
        } catch (err) {
            console.error('[AI Pipeline Error]:', err);
            io.to(boardId).emit('ai:action:error', { sessionId, error: err.message });
        }
    });

    // ── Diagram Refinement Loop ──
    socket.on('ai:diagram:refine', async (data) => {
        const { boardId, pageId, prompt, currentGraph, previousShapeIds = [] } = data;
        const sessionId = `refine-${Date.now()}`;
        io.to(boardId).emit('ai:action:start', { sessionId, prompt });

        try {
            const result = await refineDiagram(currentGraph, prompt);
            
            // Delete old diagram elements to prevent overlapping
            if (previousShapeIds.length > 0) {
                for (const shapeId of previousShapeIds) {
                    io.to(boardId).emit('shape:delete', { boardId, pageId, shapeId });
                }
            }

            // Broadcast batch shape update/add
            for (const shape of result.shapes) {
                io.to(boardId).emit('shape:add', { boardId, pageId, shape });
            }

            io.to(boardId).emit('ai:action:complete', {
                sessionId,
                message: `Refined diagram graph. Updated to ${result.layoutGraph.nodes.length} nodes.`,
                semanticGraph: result.semanticGraph,
                totalActions: result.shapes.length,
                shapeIds: result.shapes.map(s => s.id)
            });
        } catch (err) {
            console.error('[AI Refine Error]:', err);
            io.to(boardId).emit('ai:action:error', { sessionId, error: err.message });
        }
    });
    socket.on('ai:prompt', async (data) => {
        const { boardId, pageId, prompt, canvasState = [], selectedElements = [], conversationHistory = [] } = data;
        const sessionId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

        // Emit start
        io.to(boardId).emit('ai:action:start', { sessionId, prompt });

        try {
            const systemPrompt = buildSystemPrompt(canvasState, selectedElements);

            // Construct context-enriched prompt including recent dialog
            let contextPrompt = '';
            if (conversationHistory.length > 0) {
                contextPrompt = conversationHistory.slice(-6).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n') + `\nUser: ${prompt}`;
            } else {
                contextPrompt = prompt;
            }

            const aiResult = await aiService.runAgent({
                boardId,
                pageId,
                prompt: contextPrompt,
                systemPrompt,
                canvasState,
                selectedElements,
                onStep: (toolName, status, result, execResult) => {
                    // Emit individual step completion over socket
                    io.to(boardId).emit('ai:action:step', {
                        sessionId,
                        toolName,
                        status,
                        result,
                        error: status === 'error' ? result : undefined,
                    });

                    // Broadcast action mutations to canvas
                    if (execResult) {
                        if (execResult.batchActions) {
                            for (const act of execResult.batchActions) {
                                broadcastAction(io, boardId, act);
                            }
                        } else if (execResult.action) {
                            broadcastAction(io, boardId, execResult.action);
                            if (execResult.extraActions) {
                                for (const extra of execResult.extraActions) {
                                    broadcastAction(io, boardId, extra);
                                }
                            }
                        }
                    }
                }
            });

            // Emit complete
            io.to(boardId).emit('ai:action:complete', {
                sessionId,
                message: aiResult.text,
                totalActions: aiResult.totalActions,
                usage: aiResult.usage,
                inverses: aiResult.inverses,
            });

        } catch (error) {
            console.error('[AI] Socket Handler Error:', error);
            io.to(boardId).emit('ai:action:error', {
                sessionId,
                error: error.message || 'AI agent encountered an error',
            });
        }
    });
};

/**
 * Build the system prompt with canvas context awareness
 */
function buildSystemPrompt(canvasState, selectedElements) {
    let prompt = `You are Nemo, an expert AI assistant for a collaborative whiteboard called justdraw.
You can hold normal conversations, answer questions, and explain concepts directly in the chat.
IMPORTANT: Do NOT use tools to draw or create shapes unless the user explicitly asks you to draw, create, or modify a diagram. If they just ask a question, answer it conversationally.

When you DO create diagrams, you create BEAUTIFUL, PROFESSIONAL diagrams that look like Excalidraw+.
══ CRITICAL VISUAL RULES FOR DIAGRAMS (ALWAYS FOLLOW THESE) ══
1. ALWAYS give EVERY shape a FILLED background color. NEVER use fill:"transparent". Shapes without fills look broken.
2. ALWAYS set a descriptive "label" on EVERY shape (rect, diamond, circle). Labels must be 1–5 words maximum.
3. Use semantically meaningful DARK-TINTED colors for fills. Text on shapes is ALWAYS white, so fill must be dark enough for contrast:
   - Process / Action steps → fill:"#4338ca" (deep indigo)
   - Decision / Branch → fill:"#b45309" (deep amber)
   - Start / Success → fill:"#047857" (deep emerald green) 
   - Service / API → fill:"#6d28d9" (deep violet/purple)
   - Database / Storage → fill:"#0e7490" (deep cyan)
   - Error / Failure → fill:"#b91c1c" (deep red)
   - User / Actor / Input → fill:"#be185d" (deep pink)
   - Output / Result → fill:"#1d4ed8" (deep blue)
   - Infrastructure → fill:"#374151" (slate grey)
4. Use CORRECT shape types:
   - rect (w:180, h:65) → processes, steps, components, entities
   - diamond (w:160, h:100) → decisions (Yes/No branches), conditions
   - circle (r:45) → start states, end states, terminal nodes
   - arrow → connections between nodes (always use connectElements)
5. DIMENSIONS: rect should be at least width:180 height:65. Diamond: width:160 height:100. Circle: radius:45.
6. SPACING: Place elements at least 160px apart vertically, 220px apart horizontally.
7. For a flowchart, start at x=300, y=80 and arrange TOP to BOTTOM (increase y by 170 per row).
8. For architecture diagrams, arrange in columns (e.g. frontend x=100, backend x=350, database x=600).
9. Use batchCreate for efficiency when creating 3+ elements at once. This is MUCH FASTER.
10. After creating complex diagrams (5+ nodes), run autoLayout with algorithm:"tree".
11. After creating nodes, ALWAYS use connectElements to draw arrows.
12. Keep labels short: "User Login", "Auth Service", "Decision", "Database", "API Gateway".
13. Respond with a short, clear summary of what you created.
14. SPEED: Minimize API round-trips. Use batchCreate wherever possible. Create all elements first, then connect.
15. Arrow stroke MUST be "#64748b" (slate-400) with strokeWidth:2 for visibility.

══ SHAPE PALETTE REFERENCE ══
- rect:    width:180, height:65,  fill:"#4338ca", stroke:"#6366f1"
- diamond: width:160, height:100, fill:"#b45309", stroke:"#f59e0b"
- circle:  radius:45,             fill:"#047857", stroke:"#10b981"
- arrow:   stroke:"#64748b", strokeWidth:2

CANVAS COORDINATE SYSTEM:
- Origin (0,0) is at the top-left
- X increases to the right, Y increases downward
- Visible area: 0–1200 (x), 0–800 (y)
- Always start diagrams around x=100, y=80
`;

    // Add current canvas context
    if (canvasState.length > 0) {
        const summary = canvasState.slice(0, 50).map(e => {
            const parts = [`id:${e.id}`, `type:${e.type}`, `pos:(${Math.round(e.x)},${Math.round(e.y)})`];
            if (e.label) parts.push(`label:"${e.label}"`);
            if (e.text) parts.push(`text:"${e.text}"`);
            if (e.fill && e.fill !== 'transparent') parts.push(`fill:${e.fill}`);
            return parts.join(' ');
        }).join('\n');

        prompt += `\nCURRENT CANVAS STATE (${canvasState.length} elements):\n${summary}\n`;
        if (canvasState.length > 50) {
            prompt += `(... and ${canvasState.length - 50} more elements)\n`;
        }
    } else {
        prompt += '\nThe canvas is currently empty.\n';
    }

    // Add selected elements context
    if (selectedElements.length > 0) {
        const selSummary = selectedElements.map(e => {
            const parts = [`id:${e.id}`, `type:${e.type}`];
            if (e.label) parts.push(`label:"${e.label}"`);
            if (e.text) parts.push(`text:"${e.text}"`);
            return parts.join(' ');
        }).join('\n');
        prompt += `\nCURRENTLY SELECTED ELEMENTS:\n${selSummary}\n`;
    }

    return prompt;
}

/**
 * Broadcast a canvas action via Socket.IO
 */
function broadcastAction(io, boardId, action) {
    if (!action) return;
    io.to(boardId).emit(action.type, {
        pageId: action.pageId,
        shape: action.shape,
        shapeId: action.shapeId,
        x: action.x,
        y: action.y,
        updates: action.updates,
        isAI: true,
    });
}
