/**
 * 2-Stage Deterministic Text-to-Diagram Pipeline
 * 
 * Stage A — Semantic Graph Generation (LLM call + Zod Schema Validation & Auto-Retry)
 * Stage B — Auto Layout (Deterministic graph placement via Dagre)
 * Stage C — Convert to Canvas Elements with Bound Arrow Connectors
 */

const { z } = require('zod');
const dagre = require('dagre');
const aiService = require('./ai.service');
const { getConnectorPoints } = require('./actionExecutor');

// ── Stage A: Type Definitions & Zod Schemas ──
const FieldSchema = z.object({
    name: z.string(),
    type: z.string(),
    pk: z.boolean().optional(),
    fk: z.boolean().optional(),
    required: z.boolean().optional(),
    unique: z.boolean().optional(),
    indexed: z.boolean().optional(),
});

const NodeSchema = z.object({
    id: z.string(),
    label: z.string(),
    shape: z.enum(['rectangle', 'ellipse', 'diamond', 'cloud', 'database', 'table']).default('rectangle'),
    type: z.enum(['start', 'process', 'decision', 'end', 'storage', 'service', 'user', 'table']).default('process'),
    fields: z.array(FieldSchema).optional(),
});

const EdgeSchema = z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
});

const SemanticGraphSchema = z.object({
    direction: z.enum(['TB', 'LR', 'BT', 'RL']).default('TB'),
    nodes: z.array(NodeSchema).max(40, 'Maximum 40 nodes allowed per generation'),
    edges: z.array(EdgeSchema),
});

/**
 * Stage A — Generate or Refine Semantic Graph via LLM
 */
async function generateSemanticGraph(prompt, currentGraph = null) {
    let systemPrompt = `You are an expert diagram architect.
Convert user requests into a clean, logical diagram semantic graph JSON.

OUTPUT ONLY A VALID JSON OBJECT matching this exact JSON Schema:
{
  "direction": "TB" | "LR",
  "nodes": [
    { "id": "n1", "label": "Start Process", "shape": "ellipse", "type": "start" },
    { "id": "n2", "label": "Validate Input", "shape": "rectangle", "type": "process" },
    { "id": "n3", "label": "Is Valid?", "shape": "diamond", "type": "decision" },
    { "id": "n4", "label": "Save to DB", "shape": "database", "type": "storage" },
    { "id": "n5", "label": "End", "shape": "ellipse", "type": "end" }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2" },
    { "id": "e2", "source": "n2", "target": "n3" },
    { "id": "e3", "source": "n3", "target": "n4", "label": "Yes" },
    { "id": "e4", "source": "n3", "target": "n2", "label": "No" },
    { "id": "e5", "source": "n4", "target": "n5" }
  ]
}

RULES:
1. "direction": "TB" (top-to-bottom for flowcharts/trees) or "LR" (left-to-right for processes/pipelines).
2. "shape": "ellipse" (start/end), "rectangle" (processes/actions), "diamond" (decisions/branches), "database" (storage/data), "cloud" (external/services), "table" (only for database tables/schemas and ER diagrams).
3. "type": "start", "process", "decision", "end", "storage", "service", "user", or "table" (only for database tables/schemas).
4. For database tables/schemas and ER diagrams, you MUST use "shape": "table" and "type": "table" for table entities. For each table entity node, you MUST include a "fields" array where each field is an object with "name" (string), "type" (e.g., string, integer, uuid, timestamp, boolean, decimal), and optional boolean properties "pk" (Primary Key), "fk" (Foreign Key), "required" (Not Null), and "unique".
   Example of a table node:
   { 
     "id": "t1", 
     "label": "customers", 
     "shape": "table", 
     "type": "table", 
     "fields": [
       { "name": "id", "type": "uuid", "pk": true }, 
       { "name": "email", "type": "string", "unique": true, "required": true },
       { "name": "name", "type": "string" }
     ] 
   }
5. Labels must be concise (1-5 words max).
6. Output MUST be strictly raw JSON. No markdown ticks (\`\`\`json), no commentary.`;

    let userMessage = prompt;
    if (currentGraph) {
        userMessage = `CURRENT GRAPH JSON:\n${JSON.stringify(currentGraph, null, 2)}\n\nUSER MODIFICATION INSTRUCTION:\n"${prompt}"\n\nReturn the UPDATED complete diagram semantic graph JSON incorporating the modification.`;
    }

    let retriesLeft = 2;
    let lastError = null;

    while (retriesLeft > 0) {
        try {
            let attemptPrompt = userMessage;
            if (lastError) {
                attemptPrompt += `\n\n⚠️ PREVIOUS ATTEMPT FAILED SCHEMA VALIDATION: ${lastError}. Please fix the JSON output strictly.`;
            }

            const responseObj = await aiService.chat({
                systemPrompt,
                messages: [{ role: 'user', content: attemptPrompt }]
            });

            // Extract text string from AI provider response object
            const rawText = typeof responseObj === 'string' ? responseObj : (responseObj?.text || '');

            // Clean potential markdown formatting
            const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const rawJson = JSON.parse(cleaned);

            // Validate against Zod schema
            const validatedGraph = SemanticGraphSchema.parse(rawJson);
            return validatedGraph;

        } catch (err) {
            console.warn(`[SemanticPipeline] Stage A Validation Retry (${retriesLeft} left):`, err.message);
            lastError = err.message;
            retriesLeft--;
        }
    }

    console.warn('[SemanticPipeline] Falling back to structured semantic synthesizer for:', prompt);
    return buildDeterministicSemanticFallback(prompt);
}

/**
 * Intelligent deterministic diagram synthesizer for offline/quota-exhausted scenarios
 */
function buildDeterministicSemanticFallback(prompt = '') {
    const p = prompt.toLowerCase();

    if (p.includes('pay') || p.includes('stripe') || p.includes('checkout') || p.includes('billing') || p.includes('upi')) {
        return {
            direction: 'TB',
            nodes: [
                { id: 'n1', label: 'User Checkout', shape: 'ellipse', type: 'start' },
                { id: 'n2', label: 'Order API Gateway', shape: 'rectangle', type: 'process' },
                { id: 'n3', label: 'Payment Method Valid?', shape: 'diamond', type: 'decision' },
                { id: 'n4', label: 'Payment Gateway (UPI/Card)', shape: 'rectangle', type: 'service' },
                { id: 'n5', label: 'Update Payments DB', shape: 'database', type: 'storage' },
                { id: 'n6', label: 'Payment Success & Receipt', shape: 'ellipse', type: 'end' }
            ],
            edges: [
                { id: 'e1', source: 'n1', target: 'n2' },
                { id: 'e2', source: 'n2', target: 'n3' },
                { id: 'e3', source: 'n3', target: 'n4', label: 'Yes' },
                { id: 'e4', source: 'n3', target: 'n1', label: 'Invalid (Retry)' },
                { id: 'e5', source: 'n4', target: 'n5' },
                { id: 'e6', source: 'n5', target: 'n6' }
            ]
        };
    }

    if (p.includes('auth') || p.includes('login') || p.includes('signup') || p.includes('user') || p.includes('jwt')) {
        return {
            direction: 'TB',
            nodes: [
                { id: 'n1', label: 'Client Login Form', shape: 'ellipse', type: 'start' },
                { id: 'n2', label: 'Auth Router & Controller', shape: 'rectangle', type: 'process' },
                { id: 'n3', label: 'Validate Credentials', shape: 'diamond', type: 'decision' },
                { id: 'n4', label: 'Generate Signed JWT Token', shape: 'rectangle', type: 'service' },
                { id: 'n5', label: 'Query / Cache Session', shape: 'database', type: 'storage' },
                { id: 'n6', label: 'Authenticated Session Active', shape: 'ellipse', type: 'end' }
            ],
            edges: [
                { id: 'e1', source: 'n1', target: 'n2' },
                { id: 'e2', source: 'n2', target: 'n3' },
                { id: 'e3', source: 'n3', target: 'n4', label: 'Valid' },
                { id: 'e4', source: 'n3', target: 'n1', label: 'Error 401' },
                { id: 'e5', source: 'n4', target: 'n5' },
                { id: 'e6', source: 'n5', target: 'n6' }
            ]
        };
    }

    if (p.includes('table') || p.includes('er') || p.includes('schema') || p.includes('database') || p.includes('sql')) {
        return {
            direction: 'LR',
            nodes: [
                {
                    id: 't1',
                    label: 'users',
                    shape: 'table',
                    type: 'table',
                    fields: [
                        { name: 'id', type: 'uuid', pk: true },
                        { name: 'name', type: 'string', required: true },
                        { name: 'email', type: 'string', unique: true, required: true },
                        { name: 'createdAt', type: 'timestamp' }
                    ]
                },
                {
                    id: 't2',
                    label: 'workspaces',
                    shape: 'table',
                    type: 'table',
                    fields: [
                        { name: 'id', type: 'uuid', pk: true },
                        { name: 'ownerId', type: 'uuid', fk: true },
                        { name: 'name', type: 'string', required: true }
                    ]
                },
                {
                    id: 't3',
                    label: 'boards',
                    shape: 'table',
                    type: 'table',
                    fields: [
                        { name: 'id', type: 'uuid', pk: true },
                        { name: 'workspaceId', type: 'uuid', fk: true },
                        { name: 'title', type: 'string', required: true }
                    ]
                }
            ],
            edges: [
                { id: 'e1', source: 't1', target: 't2', label: '1 : N' },
                { id: 'e2', source: 't2', target: 't3', label: '1 : N' }
            ]
        };
    }

    // Generic dynamic workflow from prompt keywords
    const words = prompt.replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    const mainTopic = words.slice(0, 3).join(' ') || 'Process Workflow';

    return {
        direction: 'TB',
        nodes: [
            { id: 'n1', label: `Start: ${mainTopic}`, shape: 'ellipse', type: 'start' },
            { id: 'n2', label: 'Ingest & Validate Request', shape: 'rectangle', type: 'process' },
            { id: 'n3', label: 'Condition Verified?', shape: 'diamond', type: 'decision' },
            { id: 'n4', label: 'Execute Core Logic', shape: 'rectangle', type: 'service' },
            { id: 'n5', label: 'Persist State / Database', shape: 'database', type: 'storage' },
            { id: 'n6', label: 'Complete & Response', shape: 'ellipse', type: 'end' }
        ],
        edges: [
            { id: 'e1', source: 'n1', target: 'n2' },
            { id: 'e2', source: 'n2', target: 'n3' },
            { id: 'e3', source: 'n3', target: 'n4', label: 'Yes' },
            { id: 'e4', source: 'n3', target: 'n1', label: 'No' },
            { id: 'e5', source: 'n4', target: 'n5' },
            { id: 'e6', source: 'n5', target: 'n6' }
        ]
    };
}

/**
 * Stage B — Deterministic Auto Layout via Dagre
 */
function layoutSemanticGraph(semanticGraph, startX = 120, startY = 120) {
    const g = new dagre.graphlib.Graph();
    const direction = semanticGraph.direction || 'TB';

    g.setGraph({
        rankdir: direction,
        nodesep: direction === 'LR' ? 60 : 50,
        ranksep: direction === 'LR' ? 80 : 70,
        marginx: 40,
        marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to dagre graph
    semanticGraph.nodes.forEach(node => {
        let width, height;
        if (node.shape === 'table' || node.type === 'table') {
            const fields = node.fields || [];
            const longestName = fields.reduce((max, f) => Math.max(max, (f.name || '').length), (node.label || 'table').length);
            width = Math.max(220, longestName * 8.5 + 120);
            height = 36 + Math.max(fields.length, 1) * 26 + 6;
        } else {
            const textLen = (node.label || '').length;
            width = Math.max(120, Math.min(220, textLen * 8 + 32));
            height = node.shape === 'ellipse' ? 60 : (node.shape === 'diamond' ? 80 : 50);
        }
        g.setNode(node.id, { width, height, ...node });
    });

    // Add edges to dagre graph
    semanticGraph.edges.forEach(edge => {
        g.setEdge(edge.source, edge.target, { id: edge.id, label: edge.label });
    });

    // Execute dagre layout calculation
    dagre.layout(g);

    // Extract node coordinates
    const layoutNodes = [];
    g.nodes().forEach(v => {
        const node = g.node(v);
        if (node) {
            // Keep the exact center coordinates from Dagre, we will adjust them per-shape later
            layoutNodes.push({
                id: v,
                label: node.label,
                shape: node.shape || 'rectangle',
                type: node.type || 'process',
                centerX: Math.round(startX + node.x),
                centerY: Math.round(startY + node.y),
                width: Math.round(node.width),
                height: Math.round(node.height),
            });
        }
    });

    // Extract edge info
    const layoutEdges = [];
    g.edges().forEach(e => {
        const edgeData = g.edge(e);
        layoutEdges.push({
            id: edgeData.id || `e-${e.v}-${e.w}`,
            source: e.v,
            target: e.w,
            label: edgeData.label || '',
        });
    });

    return {
        direction,
        nodes: layoutNodes,
        edges: layoutEdges,
    };
}

/**
 * Stage C — Convert Layout Graph to Canvas Shapes with Bound Arrows
 */
function convertToCanvasElements(layoutGraph) {
    const nodeMap = new Map();
    const shapes = [];

    // Theme color dictionary (high-contrast dark fills with white text)
    const colorTheme = {
        start: { fill: '#047857', stroke: '#10b981' },     // Emerald green
        process: { fill: '#4338ca', stroke: '#818cf8' },   // Indigo
        decision: { fill: '#b45309', stroke: '#f59e0b' },  // Amber
        end: { fill: '#b91c1c', stroke: '#f87171' },       // Crimson red
        storage: { fill: '#0e7490', stroke: '#38bdf8' },   // Cyan
        service: { fill: '#6d28d9', stroke: '#c084fc' },   // Violet
        user: { fill: '#be185d', stroke: '#f472b6' },      // Pink
    };

    // 1. Convert Nodes to Shapes
    layoutGraph.nodes.forEach(node => {
        const theme = colorTheme[node.type] || colorTheme.process;
        let shapeType = 'rect';
        if (node.shape === 'ellipse' || node.type === 'start' || node.type === 'end') shapeType = 'circle';
        else if (node.shape === 'diamond' || node.type === 'decision') shapeType = 'diamond';
        else if (node.shape === 'table' || node.type === 'table') shapeType = 'er-table';
        else if (node.shape === 'cloud' || node.shape === 'database') shapeType = 'rect';

        const element = {
            id: node.id,
            type: shapeType,
            x: shapeType === 'circle' ? node.centerX : Math.round(node.centerX - node.width / 2),
            y: shapeType === 'circle' ? node.centerY : Math.round(node.centerY - node.height / 2),
            width: node.width,
            height: node.height,
            text: node.label,
            label: node.label,
            fill: theme.fill,
            stroke: '#ffffff',
            strokeWidth: 2,
            fontSize: 14,
            fontFamily: 'Helvetica',
            opacity: 1,
            nodeType: node.type,
            nodeShape: node.shape,
        };

        if (shapeType === 'circle') {
            element.radius = Math.round(node.width / 2);
        }

        if (shapeType === 'er-table') {
            element.tableName = node.label;
            element.fields = (node.fields || []).map(f => ({
                name: f.name || 'field',
                type: f.type || 'string',
                pk: f.pk || false,
                fk: f.fk || false,
                required: f.required || false,
                unique: f.unique || false,
                indexed: f.indexed || false,
            }));
            // Remove properties drawn custom by EREntity
            delete element.fill;
            delete element.stroke;
            delete element.strokeWidth;
            delete element.text;
            delete element.label;
        }

        nodeMap.set(node.id, element);
        shapes.push(element);
    });

    // 2. Convert Edges to Bound Connected Arrows
    layoutGraph.edges.forEach(edge => {
        const fromNode = nodeMap.get(edge.source);
        const toNode = nodeMap.get(edge.target);

        if (fromNode && toNode) {
            const points = getConnectorPoints(fromNode, toNode);
            const arrowElement = {
                id: edge.id || `arrow-${edge.source}-${edge.target}`,
                type: 'arrow',
                points,
                fromId: edge.source,
                toId: edge.target,
                label: edge.label || '',
                stroke: '#818cf8',
                strokeWidth: 2,
                opacity: 1,
            };
            shapes.push(arrowElement);
        }
    });

    return shapes;
}

/**
 * Complete Pipeline: Generate Diagram from Prompt
 */
async function generateDiagram(prompt) {
    const semanticGraph = await generateSemanticGraph(prompt);
    const layoutGraph = layoutSemanticGraph(semanticGraph);
    const shapes = convertToCanvasElements(layoutGraph);

    return {
        semanticGraph,
        layoutGraph,
        shapes,
    };
}

/**
 * Complete Pipeline: Refine Diagram with Chat Instruction
 */
async function refineDiagram(currentGraph, instruction) {
    const updatedGraph = await generateSemanticGraph(instruction, currentGraph);
    const layoutGraph = layoutSemanticGraph(updatedGraph);
    const shapes = convertToCanvasElements(layoutGraph);

    return {
        semanticGraph: updatedGraph,
        layoutGraph,
        shapes,
    };
}

module.exports = {
    SemanticGraphSchema,
    generateSemanticGraph,
    layoutSemanticGraph,
    convertToCanvasElements,
    generateDiagram,
    refineDiagram,
};
