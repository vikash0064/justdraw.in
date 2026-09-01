/**
 * Action Executor — Executes validated AI tool calls against the canvas state.
 * Each action generates an inverse for undo support and broadcasts via Socket.IO.
 *
 * This module does NOT directly mutate React state — it creates action descriptors
 * that are broadcast to all clients via Socket.IO, where they are applied to state.
 */
const { v4: uuidv4 } = require('uuid');
const { validateToolCall } = require('./toolRegistry');

/**
 * Generate a unique element ID
 */
function genId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Execute a single tool call.
 * Returns { success, action, inverse, result, error }
 *
 * @param {string} toolName
 * @param {object} args - Validated arguments
 * @param {object} context - { boardId, pageId, canvasState, selectedElements }
 */
function executeToolCall(toolName, args, context) {
    const { boardId, pageId, canvasState = [], selectedElements = [] } = context;

    switch (toolName) {
        case 'createElement': {
            const id = genId();
            const element = buildElement(id, args);

            return {
                success: true,
                action: { type: 'shape:add', boardId, pageId, shape: element },
                inverse: { type: 'shape:delete', boardId, pageId, shapeId: id },
                result: { elementId: id, type: element.type, x: element.x, y: element.y, label: element.label || element.text || '' },
            };
        }

        case 'updateElement': {
            const existing = canvasState.find(e => e.id === args.elementId);
            if (!existing) {
                return { success: false, error: `Element ${args.elementId} not found on canvas` };
            }

            // Store previous values for inverse
            const previousValues = {};
            for (const key of Object.keys(args.updates)) {
                previousValues[key] = existing[key];
            }

            return {
                success: true,
                action: { type: 'shape:update', boardId, pageId, shapeId: args.elementId, updates: args.updates },
                inverse: { type: 'shape:update', boardId, pageId, shapeId: args.elementId, updates: previousValues },
                result: { elementId: args.elementId, updatedProperties: Object.keys(args.updates) },
            };
        }

        case 'deleteElement': {
            const existing = canvasState.find(e => e.id === args.elementId);
            if (!existing) {
                return { success: false, error: `Element ${args.elementId} not found on canvas` };
            }

            return {
                success: true,
                action: { type: 'shape:delete', boardId, pageId, shapeId: args.elementId },
                inverse: { type: 'shape:add', boardId, pageId, shape: { ...existing } },
                result: { deletedElementId: args.elementId },
            };
        }

        case 'moveElement': {
            const existing = canvasState.find(e => e.id === args.elementId);
            if (!existing) {
                return { success: false, error: `Element ${args.elementId} not found on canvas` };
            }

            const previousPos = { x: existing.x, y: existing.y };

            return {
                success: true,
                action: { type: 'shape:move', boardId, pageId, shapeId: args.elementId, x: args.x, y: args.y },
                inverse: { type: 'shape:move', boardId, pageId, shapeId: args.elementId, ...previousPos },
                result: { elementId: args.elementId, movedTo: { x: args.x, y: args.y } },
            };
        }

        case 'connectElements': {
            const fromEl = canvasState.find(e => e.id === args.fromElementId);
            const toEl = canvasState.find(e => e.id === args.toElementId);

            if (!fromEl) return { success: false, error: `Source element ${args.fromElementId} not found` };
            if (!toEl) return { success: false, error: `Target element ${args.toElementId} not found` };

            // Calculate precise boundary connection points (edge-to-edge)
            const pts = getConnectorPoints(fromEl, toEl);
            const fromCenter = getElementCenter(fromEl);
            const toCenter = getElementCenter(toEl);

            const id = genId();
            const arrow = {
                id,
                type: 'arrow',
                points: pts,
                stroke: args.stroke || '#64748b',
                strokeWidth: args.strokeWidth || 2,
                fromId: args.fromElementId,
                toId: args.toElementId,
                label: args.label || '',
            };

            const result = {
                success: true,
                action: { type: 'shape:add', boardId, pageId, shape: arrow },
                inverse: { type: 'shape:delete', boardId, pageId, shapeId: id },
                result: { connectionId: id, from: args.fromElementId, to: args.toElementId },
            };

            // If there's a label, also create a text element at the midpoint
            if (args.label) {
                const midX = (fromCenter.x + toCenter.x) / 2;
                const midY = (fromCenter.y + toCenter.y) / 2 - 12;
                const labelId = genId();
                const labelElement = {
                    id: labelId,
                    type: 'text',
                    x: midX,
                    y: midY,
                    text: args.label,
                    fill: '#cbd5e1',
                    fontSize: 13,
                    connectionLabel: true,
                };
                // Return as batch result with extra action
                result.extraActions = [
                    { type: 'shape:add', boardId, pageId, shape: labelElement },
                ];
                result.extraInverses = [
                    { type: 'shape:delete', boardId, pageId, shapeId: labelId },
                ];
            }

            return result;
        }

        case 'batchCreate': {
            const actions = [];
            const inverses = [];
            const createdElements = [];

            for (const elDef of args.elements) {
                const id = genId();
                const element = buildElement(id, elDef);
                actions.push({ type: 'shape:add', boardId, pageId, shape: element });
                inverses.push({ type: 'shape:delete', boardId, pageId, shapeId: id });
                createdElements.push({ elementId: id, type: element.type, label: element.label || element.text || '' });
            }

            return {
                success: true,
                batchActions: actions,
                batchInverses: inverses.reverse(), // Reverse order for undo
                result: { created: createdElements.length, elements: createdElements },
            };
        }

        case 'importMermaid': {
            const code = args.mermaidCode;
            const nodesMap = new Map();
            const links = [];

            // 1. Identify graph direction
            let direction = 'TB';
            if (/graph\s+(LR|RL|TB|TD|BT)/i.test(code) || /flowchart\s+(LR|RL|TB|TD|BT)/i.test(code)) {
                const match = code.match(/(?:graph|flowchart)\s+(LR|RL|TB|TD|BT)/i);
                if (match) {
                    direction = match[1].toUpperCase();
                    if (direction === 'TD') direction = 'TB';
                }
            }

            // 2. Parse nodes
            const nodeRegex = /([a-zA-Z0-9_-]+)(?:\[(.*?)\]|\(\((.*?)\)\)|\((.*?)\)|\{(.*?)\}|\>(.*?)\)|"([^"]+)")/g;
            let match;
            while ((match = nodeRegex.exec(code)) !== null) {
                const id = match[1];
                let label = match[2] || match[3] || match[4] || match[5] || match[6] || match[7] || id;
                let shapeType = 'rect';

                const fullMatch = match[0];
                if (fullMatch.includes('{')) {
                    shapeType = 'diamond';
                } else if (fullMatch.includes('((') || fullMatch.includes('(')) {
                    shapeType = 'circle';
                } else if (fullMatch.includes('>')) {
                    shapeType = 'sticky';
                }

                nodesMap.set(id, { id, label, shapeType });
            }

            // 3. Parse connections
            const linkRegex = /([a-zA-Z0-9_-]+)\s*(?:-->|---|--.*?-->)\s*(?:\|(.*?)\|)?\s*([a-zA-Z0-9_-]+)/g;
            while ((match = linkRegex.exec(code)) !== null) {
                const from = match[1];
                const label = match[2] || '';
                const to = match[3];
                links.push({ from, to, label });

                if (!nodesMap.has(from)) {
                    nodesMap.set(from, { id: from, label: from, shapeType: 'rect' });
                }
                if (!nodesMap.has(to)) {
                    nodesMap.set(to, { id: to, label: to, shapeType: 'rect' });
                }
            }

            if (links.length === 0) {
                const simpleLinkRegex = /([a-zA-Z0-9_-]+)\s*(?:--\>)\s*([a-zA-Z0-9_-]+)/g;
                while ((match = simpleLinkRegex.exec(code)) !== null) {
                    const from = match[1];
                    const to = match[2];
                    links.push({ from, to, label: '' });

                    if (!nodesMap.has(from)) nodesMap.set(from, { id: from, label: from, shapeType: 'rect' });
                    if (!nodesMap.has(to)) nodesMap.set(to, { id: to, label: to, shapeType: 'rect' });
                }
            }

            if (nodesMap.size === 0) {
                return { success: false, error: 'Could not parse any nodes in the provided Mermaid diagram' };
            }

            // 4. Create nodes
            const nodeElements = [];
            const tempMap = new Map();

            let currentX = 150;
            let currentY = 150;

            for (const node of nodesMap.values()) {
                const newId = genId();
                tempMap.set(node.id, newId);

                const element = {
                    id: newId,
                    type: node.shapeType,
                    x: currentX,
                    y: currentY,
                    label: node.label,
                    fill: node.shapeType === 'diamond' ? '#b45309' : node.shapeType === 'circle' ? '#047857' : node.shapeType === 'sticky' ? '#fef3c7' : '#4338ca',
                    stroke: node.shapeType === 'diamond' ? '#f59e0b' : node.shapeType === 'circle' ? '#10b981' : '#6366f1',
                    strokeWidth: 1.5,
                    ...(node.shapeType === 'circle' ? { radius: 45 } : { width: 180, height: 65 })
                };
                nodeElements.push(element);
                
                currentX += 160;
                if (currentX > 800) {
                    currentX = 150;
                    currentY += 120;
                }
            }

            const layoutEngine = require('../utils/layoutEngine');
            const layoutEdges = links.map(lnk => ({
                fromId: tempMap.get(lnk.from),
                toId: tempMap.get(lnk.to)
            })).filter(edge => edge.fromId && edge.toId);

            const positions = layoutEngine.layout(nodeElements, layoutEdges, {
                algorithm: 'tree',
                direction: direction,
                spacing: 95
            });

            for (const nodeEl of nodeElements) {
                const pos = positions[nodeEl.id];
                if (pos) {
                    nodeEl.x = pos.x;
                    nodeEl.y = pos.y;
                }
            }

            // 5. Generate action arrays
            const actions = [];
            const inverses = [];

            for (const el of nodeElements) {
                actions.push({ type: 'shape:add', boardId, pageId, shape: el });
                inverses.push({ type: 'shape:delete', boardId, pageId, shapeId: el.id });
            }

            for (const lnk of links) {
                const fromNewId = tempMap.get(lnk.from);
                const toNewId = tempMap.get(lnk.to);
                const fromEl = nodeElements.find(e => e.id === fromNewId);
                const toEl = nodeElements.find(e => e.id === toNewId);

                if (fromEl && toEl) {
                    const arrowId = genId();
                    const pts = getConnectorPoints(fromEl, toEl);
                    const arrow = {
                        id: arrowId,
                        type: 'arrow',
                        points: pts,
                        stroke: '#64748b',
                        strokeWidth: 2,
                        fromId: fromNewId,
                        toId: toNewId,
                        label: lnk.label || '',
                    };

                    actions.push({ type: 'shape:add', boardId, pageId, shape: arrow });
                    inverses.push({ type: 'shape:delete', boardId, pageId, shapeId: arrowId });

                    if (lnk.label) {
                        const labelId = genId();
                        const fromCenter = getElementCenter(fromEl);
                        const toCenter = getElementCenter(toEl);
                        const midX = (fromCenter.x + toCenter.x) / 2;
                        const midY = (fromCenter.y + toCenter.y) / 2 - 12;

                        const labelElement = {
                            id: labelId,
                            type: 'text',
                            x: midX,
                            y: midY,
                            text: lnk.label,
                            fill: '#cbd5e1',
                            fontSize: 13,
                            connectionLabel: true,
                        };
                        actions.push({ type: 'shape:add', boardId, pageId, shape: labelElement });
                        inverses.push({ type: 'shape:delete', boardId, pageId, shapeId: labelId });
                    }
                }
            }

            return {
                success: true,
                batchActions: actions,
                batchInverses: inverses.reverse(),
                result: {
                    parsedNodes: nodesMap.size,
                    parsedConnections: links.length,
                    nodes: Array.from(nodesMap.keys()),
                }
            };
        }

        case 'autoLayout': {
            // Delegate to layout engine
            const layoutEngine = require('../utils/layoutEngine');
            const algorithm = args.algorithm || 'tree';
            const direction = args.direction || 'TB';
            const spacing = args.spacing || 80;

            // Separate nodes (non-arrows) and edges (arrows)
            const nodes = canvasState.filter(e => e.type !== 'arrow');
            const edges = canvasState.filter(e => e.type === 'arrow');

            if (nodes.length === 0) {
                return { success: false, error: 'No elements on canvas to layout' };
            }

            const positions = layoutEngine.layout(nodes, edges, { algorithm, direction, spacing });

            const actions = [];
            const inverses = [];

            for (const [elementId, newPos] of Object.entries(positions)) {
                const existing = canvasState.find(e => e.id === elementId);
                if (existing) {
                    actions.push({ type: 'shape:move', boardId, pageId, shapeId: elementId, x: newPos.x, y: newPos.y });
                    inverses.push({ type: 'shape:move', boardId, pageId, shapeId: elementId, x: existing.x, y: existing.y });
                }
            }

            // Also update arrow connection points
            for (const edge of edges) {
                if (edge.fromId && edge.toId) {
                    const fromPos = positions[edge.fromId];
                    const toPos = positions[edge.toId];
                    if (fromPos && toPos) {
                        const fromEl = canvasState.find(e => e.id === edge.fromId);
                        const toEl = canvasState.find(e => e.id === edge.toId);
                        const fromCenter = getElementCenter({ ...fromEl, x: fromPos.x, y: fromPos.y });
                        const toCenter = getElementCenter({ ...toEl, x: toPos.x, y: toPos.y });

                        actions.push({
                            type: 'shape:update', boardId, pageId, shapeId: edge.id,
                            updates: { points: [fromCenter.x, fromCenter.y, toCenter.x, toCenter.y] },
                        });
                        inverses.push({
                            type: 'shape:update', boardId, pageId, shapeId: edge.id,
                            updates: { points: edge.points },
                        });
                    }
                }
            }

            return {
                success: true,
                batchActions: actions,
                batchInverses: inverses.reverse(),
                result: { layoutAlgorithm: algorithm, elementsArranged: Object.keys(positions).length },
            };
        }

        case 'getCanvasState': {
            const summary = canvasState.map(e => ({
                id: e.id,
                type: e.type,
                x: e.x,
                y: e.y,
                width: e.width,
                height: e.height,
                radius: e.radius,
                text: e.text,
                label: e.label,
                fill: e.fill,
                stroke: e.stroke,
            }));

            return {
                success: true,
                action: null, // Read-only, no canvas mutation
                inverse: null,
                result: { elementCount: canvasState.length, elements: summary },
            };
        }

        case 'getSelectedElements': {
            const summary = selectedElements.map(e => ({
                id: e.id,
                type: e.type,
                x: e.x,
                y: e.y,
                width: e.width,
                height: e.height,
                text: e.text,
                label: e.label,
                fill: e.fill,
                stroke: e.stroke,
            }));

            return {
                success: true,
                action: null, // Read-only
                inverse: null,
                result: { selectedCount: selectedElements.length, elements: summary },
            };
        }

        default:
            return { success: false, error: `Unknown tool: ${toolName}` };
    }
}

/**
 * Build a canvas element from tool arguments
 */
function buildElement(id, args) {
    const base = {
        id,
        type: args.type,
        x: args.x,
        y: args.y,
    };

    switch (args.type) {
        case 'rect':
        case 'frame':
            return {
                ...base,
                width: args.width || 180,
                height: args.height || 65,
                fill: args.fill || '#4338ca',
                stroke: args.stroke || '#6366f1',
                strokeWidth: args.strokeWidth || 1.5,
                label: args.label || '',
            };

        case 'diamond':
            return {
                ...base,
                width: args.width || 160,
                height: args.height || 100,
                fill: args.fill || '#b45309',
                stroke: args.stroke || '#f59e0b',
                strokeWidth: args.strokeWidth || 1.5,
                label: args.label || '',
            };

        case 'circle':
            return {
                ...base,
                radius: args.radius || 45,
                fill: args.fill || '#047857',
                stroke: args.stroke || '#10b981',
                strokeWidth: args.strokeWidth || 1.5,
                label: args.label || '',
            };

        case 'text':
            return {
                ...base,
                text: args.text || args.label || 'Text',
                fill: args.fill || '#f1f5f9',
                fontSize: args.fontSize || 18,
            };

        case 'arrow':
            return {
                ...base,
                points: args.points || [args.x, args.y, args.x + 100, args.y],
                stroke: args.stroke || '#64748b',
                strokeWidth: args.strokeWidth || 2,
            };

        case 'sticky':
            return {
                ...base,
                width: args.width || 180,
                height: args.height || 140,
                text: args.text || args.label || '',
                fill: args.fill || '#f59e0b',
                fontSize: args.fontSize || 14,
            };

        default:
            return base;
    }
}

/**
 * Get the center point of an element (for arrow connections)
 */
function getElementCenter(el) {
    if (!el) return { x: 0, y: 0 };
    if (el.type === 'circle') {
        const r = el.radius || 45;
        return { x: el.x + r, y: el.y + r };
    }
    const w = el.width || 180;
    const h = el.height || 65;
    return { x: el.x + w / 2, y: el.y + h / 2 };
}

/**
 * Ray-casting boundary intersection for precise shape-to-shape connections
 */
function getShapeIntersection(el, targetPoint) {
    const center = getElementCenter(el);
    const dx = targetPoint.x - center.x;
    const dy = targetPoint.y - center.y;
    if (dx === 0 && dy === 0) return center;

    const angle = Math.atan2(dy, dx);

    if (el.type === 'circle') {
        const r = el.radius || 45;
        return {
            x: center.x + r * Math.cos(angle),
            y: center.y + r * Math.sin(angle)
        };
    }

    const w = el.width || 180;
    const h = el.height || 65;
    const hw = w / 2;
    const hh = h / 2;

    if (el.type === 'diamond') {
        // Diamond equation: |x/hw| + |y/hh| = 1
        const absCos = Math.abs(Math.cos(angle));
        const absSin = Math.abs(Math.sin(angle));
        const scale = 1 / (absCos / hw + absSin / hh);
        return {
            x: center.x + scale * Math.cos(angle),
            y: center.y + scale * Math.sin(angle)
        };
    }

    // Rectangle equation
    const absCos = Math.abs(Math.cos(angle));
    const absSin = Math.abs(Math.sin(angle));
    let scale;
    if (hw * absSin < hh * absCos) {
        scale = hw / absCos;
    } else {
        scale = hh / absSin;
    }
    return {
        x: center.x + scale * Math.cos(angle),
        y: center.y + scale * Math.sin(angle)
    };
}

/**
 * Calculate precise boundary connection points between two elements
 */
function getConnectorPoints(fromEl, toEl) {
    const fromCenter = getElementCenter(fromEl);
    const toCenter = getElementCenter(toEl);

    const start = getShapeIntersection(fromEl, toCenter);
    const end = getShapeIntersection(toEl, fromCenter);

    return [
        Math.round(start.x),
        Math.round(start.y),
        Math.round(end.x),
        Math.round(end.y)
    ];
}

module.exports = {
    executeToolCall,
    buildElement,
    getElementCenter,
    getConnectorPoints,
};
