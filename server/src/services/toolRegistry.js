/**
 * AI Tool Registry — Centralized definition of all tools the AI agent can invoke.
 * Each tool has: name, description, parameters (JSON Schema), and an executor function.
 * The registry is consumed by the AI service for function calling declarations
 * and by the action executor for runtime dispatch.
 */
const { z } = require('zod');

// ── Zod schemas for runtime validation ──

const CreateElementSchema = z.object({
    type: z.enum(['rect', 'circle', 'text', 'arrow', 'sticky', 'diamond', 'frame']),
    x: z.number(),
    y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
    radius: z.number().optional(),
    text: z.string().optional(),
    fill: z.string().optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().optional(),
    fontSize: z.number().optional(),
    points: z.array(z.number()).optional(),
    label: z.string().optional(),
});

const UpdateElementSchema = z.object({
    elementId: z.string(),
    updates: z.object({
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        radius: z.number().optional(),
        text: z.string().optional(),
        fill: z.string().optional(),
        stroke: z.string().optional(),
        strokeWidth: z.number().optional(),
        fontSize: z.number().optional(),
        label: z.string().optional(),
    }),
});

const DeleteElementSchema = z.object({
    elementId: z.string(),
});

const MoveElementSchema = z.object({
    elementId: z.string(),
    x: z.number(),
    y: z.number(),
});

const ConnectElementsSchema = z.object({
    fromElementId: z.string(),
    toElementId: z.string(),
    label: z.string().optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().optional(),
});

const ImportMermaidSchema = z.object({
    mermaidCode: z.string(),
});

const GroupElementsSchema = z.object({
    elementIds: z.array(z.string()).min(2),
    label: z.string().optional(),
});

const AutoLayoutSchema = z.object({
    algorithm: z.enum(['tree', 'grid', 'dag', 'force']).optional(),
    direction: z.enum(['TB', 'LR', 'BT', 'RL']).optional(),
    spacing: z.number().optional(),
});

const BatchCreateSchema = z.object({
    elements: z.array(CreateElementSchema),
});

const GetCanvasStateSchema = z.object({});

const GetSelectedElementsSchema = z.object({});

// ── Tool Definitions (JSON Schema for LLM function declarations) ──

const TOOL_DEFINITIONS = [
    {
        name: 'createElement',
        description: 'Create a new element on the canvas. Use this to add shapes like rectangles, circles, text labels, arrows, sticky notes, diamonds, or frames. For text nodes that represent diagram labels or boxes, use type "rect" with a "label" property for the text inside, or type "text" for standalone text. Position elements using x,y coordinates. The canvas coordinate space starts at (0,0) top-left.',
        parameters: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['rect', 'circle', 'text', 'arrow', 'sticky', 'diamond', 'frame'], description: 'The shape type to create' },
                x: { type: 'number', description: 'X position on the canvas' },
                y: { type: 'number', description: 'Y position on the canvas' },
                width: { type: 'number', description: 'Width of the element (for rect, sticky, diamond, frame)' },
                height: { type: 'number', description: 'Height of the element (for rect, sticky, diamond, frame)' },
                radius: { type: 'number', description: 'Radius (for circle)' },
                text: { type: 'string', description: 'Text content (for text type)' },
                fill: { type: 'string', description: 'Fill color (hex string like #6366f1)' },
                stroke: { type: 'string', description: 'Stroke/border color (hex string)' },
                strokeWidth: { type: 'number', description: 'Stroke width in pixels' },
                fontSize: { type: 'number', description: 'Font size (for text type)' },
                points: { type: 'array', items: { type: 'number' }, description: 'Point coordinates [x1,y1,x2,y2] for arrow type' },
                label: { type: 'string', description: 'Label text displayed inside the shape (for rect, circle, diamond, sticky)' },
            },
            required: ['type', 'x', 'y'],
        },
        schema: CreateElementSchema,
    },
    {
        name: 'updateElement',
        description: 'Update properties of an existing element on the canvas. Use elementId to target a specific element. You can change position, size, color, text, or any visual property.',
        parameters: {
            type: 'object',
            properties: {
                elementId: { type: 'string', description: 'The ID of the element to update' },
                updates: {
                    type: 'object',
                    description: 'Properties to update',
                    properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                        width: { type: 'number' },
                        height: { type: 'number' },
                        radius: { type: 'number' },
                        text: { type: 'string' },
                        fill: { type: 'string' },
                        stroke: { type: 'string' },
                        strokeWidth: { type: 'number' },
                        fontSize: { type: 'number' },
                        label: { type: 'string' },
                    },
                },
            },
            required: ['elementId', 'updates'],
        },
        schema: UpdateElementSchema,
    },
    {
        name: 'deleteElement',
        description: 'Delete an element from the canvas by its ID.',
        parameters: {
            type: 'object',
            properties: {
                elementId: { type: 'string', description: 'The ID of the element to delete' },
            },
            required: ['elementId'],
        },
        schema: DeleteElementSchema,
    },
    {
        name: 'moveElement',
        description: 'Move an element to new x,y coordinates on the canvas.',
        parameters: {
            type: 'object',
            properties: {
                elementId: { type: 'string', description: 'The ID of the element to move' },
                x: { type: 'number', description: 'New X position' },
                y: { type: 'number', description: 'New Y position' },
            },
            required: ['elementId', 'x', 'y'],
        },
        schema: MoveElementSchema,
    },
    {
        name: 'connectElements',
        description: 'Create an arrow connection between two elements. The arrow will be drawn from the center of the source element to the center of the target element. Optionally add a label on the connection.',
        parameters: {
            type: 'object',
            properties: {
                fromElementId: { type: 'string', description: 'Source element ID' },
                toElementId: { type: 'string', description: 'Target element ID' },
                label: { type: 'string', description: 'Optional label text on the connection' },
                stroke: { type: 'string', description: 'Arrow color (hex)' },
                strokeWidth: { type: 'number', description: 'Arrow stroke width' },
            },
            required: ['fromElementId', 'toElementId'],
        },
        schema: ConnectElementsSchema,
    },
    {
        name: 'batchCreate',
        description: 'Create multiple elements at once in a single operation. This is more efficient than creating elements one by one. Use this when building complete diagrams.',
        parameters: {
            type: 'object',
            properties: {
                elements: {
                    type: 'array',
                    description: 'Array of elements to create',
                    items: {
                        type: 'object',
                        properties: {
                            type: { type: 'string', enum: ['rect', 'circle', 'text', 'arrow', 'sticky', 'diamond', 'frame'] },
                            x: { type: 'number' },
                            y: { type: 'number' },
                            width: { type: 'number' },
                            height: { type: 'number' },
                            radius: { type: 'number' },
                            text: { type: 'string' },
                            fill: { type: 'string' },
                            stroke: { type: 'string' },
                            strokeWidth: { type: 'number' },
                            fontSize: { type: 'number' },
                            points: { type: 'array', items: { type: 'number' } },
                            label: { type: 'string' },
                        },
                        required: ['type', 'x', 'y'],
                    },
                },
            },
            required: ['elements'],
        },
        schema: BatchCreateSchema,
    },
    {
        name: 'autoLayout',
        description: 'Automatically arrange all elements on the canvas using a layout algorithm. Use after creating multiple elements to organize them neatly. Algorithms: "tree" for hierarchical/flowchart, "grid" for uniform grid, "dag" for directed acyclic graph, "force" for force-directed.',
        parameters: {
            type: 'object',
            properties: {
                algorithm: { type: 'string', enum: ['tree', 'grid', 'dag', 'force'], description: 'Layout algorithm to use' },
                direction: { type: 'string', enum: ['TB', 'LR', 'BT', 'RL'], description: 'Direction: TB=top-to-bottom, LR=left-to-right, BT=bottom-to-top, RL=right-to-left' },
                spacing: { type: 'number', description: 'Spacing between elements in pixels' },
            },
        },
        schema: AutoLayoutSchema,
    },
    {
        name: 'getCanvasState',
        description: 'Get the current state of the canvas including all elements and their properties. Use this to understand what is currently on the canvas before making modifications. Returns a list of all elements with their IDs, types, positions, sizes, colors, and text content.',
        parameters: {
            type: 'object',
            properties: {},
        },
        schema: GetCanvasStateSchema,
    },
    {
        name: 'getSelectedElements',
        description: 'Get information about the currently selected elements on the canvas. Use this when the user says "this", "these", "the selected" etc. to understand which elements they are referring to.',
        parameters: {
            type: 'object',
            properties: {},
        },
        schema: GetSelectedElementsSchema,
    },
    {
        name: 'importMermaid',
        description: 'Convert a Mermaid syntax flowchart/diagram into native canvas elements (rects, circles, diamonds, and connecting arrows) and arrange them neatly.',
        parameters: {
            type: 'object',
            properties: {
                mermaidCode: { type: 'string', description: 'The raw Mermaid diagram string (e.g., graph TD; A[Start] --> B{Decision};)' }
            },
            required: ['mermaidCode'],
        },
        schema: ImportMermaidSchema,
    },
];

/**
 * Get tool declarations for the AI provider (without schemas/executors)
 */
function getToolDeclarations() {
    return TOOL_DEFINITIONS.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
    }));
}

/**
 * Validate tool call arguments against Zod schema
 */
function validateToolCall(toolName, args) {
    const tool = TOOL_DEFINITIONS.find(t => t.name === toolName);
    if (!tool) {
        return { valid: false, error: `Unknown tool: ${toolName}` };
    }

    try {
        const validated = tool.schema.parse(args);
        return { valid: true, data: validated };
    } catch (err) {
        return { valid: false, error: err.errors?.map(e => e.message).join(', ') || err.message };
    }
}

/**
 * Get a tool definition by name
 */
function getTool(name) {
    return TOOL_DEFINITIONS.find(t => t.name === name) || null;
}

module.exports = {
    TOOL_DEFINITIONS,
    getToolDeclarations,
    validateToolCall,
    getTool,
};
