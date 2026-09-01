/**
 * AI Controller — REST endpoints for AI features
 */
const AiUsage = require('../models/AiUsage');

/**
 * GET /api/ai/usage — Get usage stats for current user
 */
const getUsage = async (req, res) => {
    try {
        const userId = req.user._id;

        // Current month usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const monthlyUsage = await AiUsage.aggregate([
            { $match: { user: userId, createdAt: { $gte: startOfMonth } } },
            {
                $group: {
                    _id: null,
                    totalRequests: { $sum: 1 },
                    totalToolCalls: { $sum: '$toolCalls' },
                    totalTokens: { $sum: '$totalTokens' },
                    successCount: { $sum: { $cond: ['$success', 1, 0] } },
                    errorCount: { $sum: { $cond: ['$success', 0, 1] } },
                },
            },
        ]);

        const usage = monthlyUsage[0] || {
            totalRequests: 0,
            totalToolCalls: 0,
            totalTokens: 0,
            successCount: 0,
            errorCount: 0,
        };

        // Recent requests
        const recentRequests = await AiUsage.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .select('prompt provider model toolCalls totalTokens success createdAt');

        res.json({
            monthly: usage,
            recent: recentRequests,
            limits: {
                free: 50,
                pro: 1000,
                team: 5000,
            },
        });
    } catch (error) {
        console.error('AI usage error:', error);
        res.status(500).json({ message: 'Failed to fetch AI usage' });
    }
};

/**
 * GET /api/ai/templates — Get AI prompt templates
 */
const getTemplates = async (req, res) => {
    const templates = [
        {
            id: 'flowchart',
            name: 'Flowchart',
            icon: '📊',
            description: 'Create a flowchart diagram',
            prompt: 'Create a flowchart for',
            suggestions: [
                'Create a flowchart for a user authentication process',
                'Create a flowchart for an e-commerce checkout flow',
                'Create a flowchart for a CI/CD pipeline',
            ],
        },
        {
            id: 'architecture',
            name: 'System Architecture',
            icon: '🏗️',
            description: 'Design a system architecture diagram',
            prompt: 'Create a system architecture diagram for',
            suggestions: [
                'Create a microservices architecture for a social media platform',
                'Create a system architecture for a real-time chat application',
                'Create a cloud architecture for a SaaS platform',
            ],
        },
        {
            id: 'er-diagram',
            name: 'ER Diagram',
            icon: '🗄️',
            description: 'Design an entity-relationship diagram',
            prompt: 'Create an ER diagram for',
            suggestions: [
                'Create an ER diagram for an e-commerce database',
                'Create an ER diagram for a school management system',
                'Create an ER diagram for a social media platform',
            ],
        },
        {
            id: 'user-journey',
            name: 'User Journey',
            icon: '🗺️',
            description: 'Map out a user journey',
            prompt: 'Create a user journey map for',
            suggestions: [
                'Create a user journey for first-time app onboarding',
                'Create a user journey for online shopping',
                'Create a user journey for booking a flight',
            ],
        },
        {
            id: 'mind-map',
            name: 'Mind Map',
            icon: '🧠',
            description: 'Create a mind map',
            prompt: 'Create a mind map for',
            suggestions: [
                'Create a mind map for project planning',
                'Create a mind map for learning web development',
                'Create a mind map for startup business ideas',
            ],
        },
        {
            id: 'wireframe',
            name: 'Wireframe',
            icon: '📱',
            description: 'Create a wireframe layout',
            prompt: 'Create a wireframe for',
            suggestions: [
                'Create a wireframe for a landing page',
                'Create a wireframe for a dashboard',
                'Create a wireframe for a mobile app',
            ],
        },
        {
            id: 'sequence',
            name: 'Sequence Diagram',
            icon: '🔄',
            description: 'Create a sequence diagram',
            prompt: 'Create a sequence diagram for',
            suggestions: [
                'Create a sequence diagram for API request handling',
                'Create a sequence diagram for OAuth authentication',
                'Create a sequence diagram for payment processing',
            ],
        },
        {
            id: 'org-chart',
            name: 'Org Chart',
            icon: '👥',
            description: 'Create an organizational chart',
            prompt: 'Create an org chart for',
            suggestions: [
                'Create an org chart for a tech startup',
                'Create an org chart for a marketing department',
            ],
        },
    ];

    res.json(templates);
};

const aiService = require('../services/ai.service');

const wireframeToCode = async (req, res) => {
    try {
        const { canvasState = [], prompt = '', history = [] } = req.body;
        const userId = req.user._id;

        const systemPrompt = `You are an expert frontend developer.
Given a list of wireframe elements from a whiteboard/canvas, generate a fully functional, beautiful, modern single-page website mockup.
Use HTML with Tailwind CSS. Include CSS and JavaScript inside script/style tags if needed. Make the design highly polished, responsive, and interactive.
Use Tailwind CDN: <script src="https://cdn.tailwindcss.com"></script>
Use font families like Inter or Roboto via Google Fonts.
Provide ONLY the complete executable HTML document. Do NOT wrap it in markdown code blocks.
Return your response as a JSON object:
{
  "code": "complete HTML code string starting with <!DOCTYPE html>"
}
`;

        const userPrompt = `Generate a website based on these wireframe elements:
${JSON.stringify(canvasState, null, 2)}

User feedback/specifications: ${prompt || 'Make it look highly professional, clean, and modern.'}
`;

        const messages = [
            ...history.map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: userPrompt }
        ];

        const aiResult = await aiService.chat({
            systemPrompt,
            messages,
            provider: 'gemini'
        });

        await AiUsage.create({
            user: userId,
            prompt: `Wireframe to Code (${canvasState.length} elements)`,
            provider: aiResult.provider,
            model: aiResult.model,
            promptTokens: aiResult.usage?.promptTokens || 0,
            completionTokens: aiResult.usage?.completionTokens || 0,
            totalTokens: aiResult.usage?.totalTokens || 0,
        });

        let htmlCode = aiResult.text.trim();
        
        // Clean markdown wrapper if LLM returned it
        if (htmlCode.startsWith('```json')) {
            htmlCode = htmlCode.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (htmlCode.startsWith('```html')) {
            htmlCode = htmlCode.replace(/^```html/, '').replace(/```$/, '').trim();
            return res.json({ code: htmlCode });
        } else if (htmlCode.startsWith('```')) {
            htmlCode = htmlCode.replace(/^```[a-zA-Z]*/, '').replace(/```$/, '').trim();
        }

        if (htmlCode.includes('<!DOCTYPE html>') || htmlCode.includes('<html')) {
            // Check if it's already raw HTML instead of JSON
            // Extract HTML if it's wrapped in a JSON key or raw
            try {
                const parsed = JSON.parse(htmlCode);
                return res.json({ code: parsed.code || htmlCode });
            } catch (e) {
                return res.json({ code: htmlCode });
            }
        }

        try {
            const parsed = JSON.parse(htmlCode);
            return res.json({ code: parsed.code || htmlCode });
        } catch (e) {
            return res.json({ code: htmlCode });
        }

    } catch (error) {
        console.error('Wireframe to Code error:', error);
        res.status(500).json({ message: 'Failed to convert wireframe to code' });
    }
};

const PALETTES = {
    navy: { fill: '#1e1b4b', stroke: '#818cf8' },
    cyan: { fill: '#0f172a', stroke: '#38bdf8' },
    emerald: { fill: '#064e3b', stroke: '#34d399' },
    purple: { fill: '#4c1d95', stroke: '#c084fc' },
    rose: { fill: '#4c0519', stroke: '#fb7185' },
    amber: { fill: '#451a03', stroke: '#fbbf24' }
};

function layoutDiagramShapes(data) {
    const nodes = data.nodes || [];
    const edges = data.edges || [];
    const shapes = [];
    const nodePosMap = new Map();

    const centerX = 400;
    const startY = 100;
    const gapY = 120;

    nodes.forEach((node, idx) => {
        const y = startY + idx * gapY;
        const w = node.type === 'circle' ? 120 : (node.type === 'diamond' ? 160 : 210);
        const h = node.type === 'circle' ? 65 : 60;
        const x = centerX - w / 2;

        nodePosMap.set(node.id || `n${idx + 1}`, { 
            centerX, 
            centerY: y + h / 2, 
            topY: y, 
            bottomY: y + h, 
            w, 
            h 
        });

        const paletteKeys = Object.keys(PALETTES);
        const paletteKey = node.colorScheme || paletteKeys[idx % paletteKeys.length];
        const theme = PALETTES[paletteKey] || PALETTES.navy;

        shapes.push({
            id: `ai_${node.id || idx}_${Date.now()}`,
            type: node.type || 'rect',
            x,
            y,
            width: w,
            height: h,
            radius: w / 2,
            fill: theme.fill,
            stroke: theme.stroke,
            strokeWidth: 2,
            fillStyle: 'solid',
            sloppiness: 'architect',
            edges: 'round',
            text: node.label || `Step ${idx + 1}`,
            fontSize: 13,
            fontFamily: 'Helvetica',
            opacity: 1
        });
    });

    edges.forEach((edge, idx) => {
        const from = nodePosMap.get(edge.from);
        const to = nodePosMap.get(edge.to);
        if (from && to) {
            shapes.push({
                id: `ai_e_${idx}_${Date.now()}`,
                type: 'arrow',
                x: 0,
                y: 0,
                points: [from.centerX, from.bottomY, to.centerX, to.topY],
                stroke: '#818cf8',
                strokeWidth: 2,
                fillStyle: 'solid',
                sloppiness: 'architect',
                text: edge.label || ''
            });
        }
    });

    return shapes;
}

function buildStructuredFallbackDiagram(prompt, templateType) {
    const p = (prompt || '').toLowerCase();
    let nodes = [];

    if (p.includes('payment') || p.includes('paytm') || p.includes('stripe') || p.includes('checkout') || p.includes('gateway')) {
        nodes = [
            { id: 'n1', label: 'User / App Checkout', type: 'circle', colorScheme: 'navy' },
            { id: 'n2', label: 'Payment Gateway API', type: 'rect', colorScheme: 'cyan' },
            { id: 'n3', label: 'Valid Credentials?', type: 'diamond', colorScheme: 'purple' },
            { id: 'n4', label: 'Paytm / Bank Processing', type: 'rect', colorScheme: 'emerald' },
            { id: 'n5', label: 'Payment Confirmed (Success)', type: 'circle', colorScheme: 'amber' }
        ];
    } else if (p.includes('auth') || p.includes('login') || p.includes('signup') || p.includes('jwt')) {
        nodes = [
            { id: 'n1', label: 'User Login Request', type: 'circle', colorScheme: 'navy' },
            { id: 'n2', label: 'Auth Controller API', type: 'rect', colorScheme: 'cyan' },
            { id: 'n3', label: 'Password Valid?', type: 'diamond', colorScheme: 'purple' },
            { id: 'n4', label: 'Issue Signed JWT Token', type: 'rect', colorScheme: 'emerald' },
            { id: 'n5', label: 'User Session Active', type: 'circle', colorScheme: 'amber' }
        ];
    } else if (p.includes('order') || p.includes('cart') || p.includes('shop')) {
        nodes = [
            { id: 'n1', label: 'Browse & Add to Cart', type: 'circle', colorScheme: 'navy' },
            { id: 'n2', label: 'Checkout Request', type: 'rect', colorScheme: 'cyan' },
            { id: 'n3', label: 'Item In Stock?', type: 'diamond', colorScheme: 'purple' },
            { id: 'n4', label: 'Order Processing API', type: 'rect', colorScheme: 'emerald' },
            { id: 'n5', label: 'Order Dispatch Confirmed', type: 'circle', colorScheme: 'amber' }
        ];
    } else {
        nodes = [
            { id: 'n1', label: 'User / Trigger Action', type: 'circle', colorScheme: 'navy' },
            { id: 'n2', label: 'API Gateway Router', type: 'rect', colorScheme: 'cyan' },
            { id: 'n3', label: 'Validation Check', type: 'diamond', colorScheme: 'purple' },
            { id: 'n4', label: 'Core Service Processing', type: 'rect', colorScheme: 'emerald' },
            { id: 'n5', label: 'Response & Complete', type: 'circle', colorScheme: 'amber' }
        ];
    }

    const edges = [
        { from: 'n1', to: 'n2', label: 'Start' },
        { from: 'n2', to: 'n3', label: 'Verify' },
        { from: 'n3', to: 'n4', label: 'Yes' },
        { from: 'n4', to: 'n5', label: 'Done' }
    ];

    return { title: `${templateType} Diagram`, nodes, edges };
}

const generateDiagram = async (req, res) => {
    try {
        const { prompt = '', templateType = 'flowchart' } = req.body;
        const userId = req.user?._id;

        const systemPrompt = `You are a senior Software Architect and Canva AI diagram generator.
Given a prompt, generate a professional, multi-step technical flowchart or system architecture diagram.

CRITICAL RULES:
1. Do NOT split the words of the user prompt into nodes. Instead, understand the domain and create 4 to 6 REAL architectural steps (e.g. for "Paytm payment", create steps like "User Checkout", "API Gateway", "Verify Signature / Hash", "Paytm Payment Gateway SDK", "Payment Success Notification").
2. Allowed node types: "rect" (process/service), "circle" (start/end node), "diamond" (decision node).
3. Color Schemes: "navy", "cyan", "emerald", "purple", "rose", "amber".

Return ONLY valid JSON matching this schema:
{
  "title": "Diagram Title",
  "nodes": [
    { "id": "n1", "label": "User Checkout", "type": "circle", "colorScheme": "navy" },
    { "id": "n2", "label": "Payment API Gateway", "type": "rect", "colorScheme": "cyan" },
    { "id": "n3", "label": "Valid Signature?", "type": "diamond", "colorScheme": "purple" },
    { "id": "n4", "label": "Paytm Gateway SDK", "type": "rect", "colorScheme": "emerald" },
    { "id": "n5", "label": "Payment Success", "type": "circle", "colorScheme": "amber" }
  ],
  "edges": [
    { "from": "n1", "to": "n2", "label": "Initiate" },
    { "from": "n2", "to": "n3", "label": "Verify" },
    { "from": "n3", "to": "n4", "label": "Yes" },
    { "from": "n4", "to": "n5", "label": "Success" }
  ]
}
Do NOT include markdown wrapping.`;

        let aiData;
        try {
            const aiResult = await aiService.chat({
                systemPrompt,
                messages: [{ role: 'user', content: `Generate a ${templateType} diagram for: "${prompt}". Create 4 to 6 domain architecture steps with clear labels.` }],
                provider: 'gemini'
            });

            let rawText = aiResult.text.trim();
            if (rawText.startsWith('```json')) {
                rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (rawText.startsWith('```')) {
                rawText = rawText.replace(/^```[a-zA-Z]*/, '').replace(/```$/, '').trim();
            }
            aiData = JSON.parse(rawText);

            if (userId) {
                await AiUsage.create({
                    user: userId,
                    prompt: `Diagram (${templateType}): ${prompt}`,
                    provider: aiResult.provider,
                    model: aiResult.model,
                    promptTokens: aiResult.usage?.promptTokens || 0,
                    completionTokens: aiResult.usage?.completionTokens || 0,
                    totalTokens: aiResult.usage?.totalTokens || 0,
                }).catch(() => {});
            }
        } catch (err) {
            console.warn('[AI Controller] AI diagram parse fallback:', err.message);
            aiData = buildStructuredFallbackDiagram(prompt, templateType);
        }

        const shapes = layoutDiagramShapes(aiData);
        res.json({ success: true, shapes });

    } catch (error) {
        console.error('Generate Diagram error:', error);
        res.status(500).json({ message: 'Failed to generate AI diagram' });
    }
};

module.exports = {
    getUsage,
    getTemplates,
    wireframeToCode,
    generateDiagram,
};
