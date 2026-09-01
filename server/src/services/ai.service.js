/**
 * AI Provider Service — LLM abstraction layer
 * Handles provider initialization, single-turn requests, and multi-turn agent loops with rate limit resilience.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getToolDeclarations, validateToolCall } = require('./toolRegistry');
const { executeToolCall } = require('./actionExecutor');

const providers = {};

function initProviders() {
    // Google Gemini (primary)
    if (process.env.GEMINI_API_KEY || process.env.AI_API_KEY) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        providers.gemini = {
            name: 'gemini',
            model: process.env.AI_MODEL || 'gemini-flash-latest',
            client: genAI,
            apiKey: apiKey,
        };
        console.log(`AI Provider initialised: Gemini (${providers.gemini.model})`);
    }

    // OpenAI (optional fallback)
    if (process.env.OPENAI_API_KEY) {
        providers.openai = {
            name: 'openai',
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY,
        };
        console.log(`AI Provider initialised: OpenAI (${providers.openai.model})`);
    }

    if (Object.keys(providers).length === 0) {
        console.warn('⚠️ No AI provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY in .env');
    }
}

// Auto-call on module load
try { initProviders(); } catch (e) {}

function getProvider(preferredProvider) {
    if (Object.keys(providers).length === 0) {
        initProviders();
    }
    if (preferredProvider && providers[preferredProvider]) {
        return providers[preferredProvider];
    }
    // Prioritise Gemini if available, then OpenAI
    return providers.gemini || providers.openai || null;
}

/**
 * Fetch wrapper with exponential backoff retry for rate limits (429) and service unavailable (503)
 */
async function fetchWithRetry(url, options, retries = 2, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.status === 429 || res.status === 503) {
                const reason = res.status === 429 ? 'Rate limit' : 'Service unavailable';
                console.warn(`[AI] ${reason} (${res.status}) hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay = Math.min(delay * 2, 8000);
                continue;
            }
            return res;
        } catch (fetchError) {
            if (i < retries - 1) {
                console.warn(`[AI] Network error: ${fetchError.message}. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay = Math.min(delay * 2, 8000);
                continue;
            }
            throw fetchError;
        }
    }
    return fetch(url, options);
}

/**
 * Execute a single-turn chat completion with automatic fallback between providers
 */
async function chat({ systemPrompt, messages, provider: preferredProvider }) {
    const candidateProviders = [];
    if (preferredProvider && providers[preferredProvider]) {
        candidateProviders.push(providers[preferredProvider]);
    }
    if (providers.gemini && !candidateProviders.includes(providers.gemini)) {
        candidateProviders.push(providers.gemini);
    }
    if (providers.openai && !candidateProviders.includes(providers.openai)) {
        candidateProviders.push(providers.openai);
    }

    let lastError = null;

    for (const provider of candidateProviders) {
        try {
            if (provider.name === 'gemini') {
                const contents = messages.map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }],
                }));

                const body = {
                    contents,
                    systemInstruction: { parts: [{ text: systemPrompt }] }
                };

                const modelName = provider.model || 'gemini-1.5-flash';
                const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${provider.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                if (!res.ok) {
                    const err = await res.text();
                    throw new Error(`Gemini API error: ${res.status} ${err}`);
                }

                const data = await res.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                return {
                    text,
                    usage: {
                        promptTokens: data.usageMetadata?.promptTokenCount || 0,
                        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
                        totalTokens: data.usageMetadata?.totalTokenCount || 0,
                    },
                    provider: provider.name,
                    model: provider.model,
                };
            } else if (provider.name === 'openai') {
                const openaiMessages = [
                    { role: 'system', content: systemPrompt },
                    ...messages,
                ];

                const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${provider.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: provider.model || 'gpt-4o-mini',
                        messages: openaiMessages,
                    }),
                });

                if (!res.ok) {
                    const err = await res.text();
                    throw new Error(`OpenAI API error: ${res.status} ${err}`);
                }

                const data = await res.json();
                return {
                    text: data.choices[0].message.content || '',
                    usage: {
                        promptTokens: data.usage?.prompt_tokens || 0,
                        completionTokens: data.usage?.completion_tokens || 0,
                        totalTokens: data.usage?.total_tokens || 0,
                    },
                    provider: provider.name,
                    model: provider.model,
                };
            }
        } catch (err) {
            console.warn(`[AI Service] Provider ${provider.name} failed: ${err.message}. Trying next candidate...`);
            lastError = err;
        }
    }

    // Free Fallback: Pollinations Open LLM endpoint (no API key required)
    try {
        const lastMsg = messages[messages.length - 1]?.content || '';
        const combinedPrompt = `${systemPrompt}\n\nUser: ${lastMsg}`;
        const res = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages
                ],
                model: 'openai',
                jsonMode: true
            })
        });
        if (res.ok) {
            const text = await res.text();
            return {
                text,
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                provider: 'pollinations',
                model: 'free-fallback',
            };
        }
    } catch (fallbackErr) {
        console.warn('[AI Service] Pollinations free fallback failed:', fallbackErr.message);
    }

    throw lastError || new Error('No available AI providers.');
}

/**
 * Execute the multi-turn agent loop.
 * Translates model tool calls directly into executed board canvas changes.
 */
async function runAgent({ boardId, pageId, prompt, systemPrompt, canvasState = [], selectedElements = [], onStep }) {
    if (providers.gemini) {
        try {
            return await runAgentGemini({ boardId, pageId, prompt, systemPrompt, provider: providers.gemini, canvasState, selectedElements, onStep });
        } catch (geminiErr) {
            console.warn('[AI Service] Gemini Agent failed, falling back to OpenAI...', geminiErr.message);
        }
    }

    if (providers.openai) {
        return runAgentOpenAI({ boardId, pageId, prompt, systemPrompt, provider: providers.openai, canvasState, selectedElements, onStep });
    }

    throw new Error('No working AI provider available.');
}

/**
 * Gemini REST-based Native Chat Agent Loop (bypasses SDK role mapping bugs)
 */
async function runAgentGemini({ boardId, pageId, prompt, systemPrompt, provider, canvasState, selectedElements, onStep }) {
    const tools = getToolDeclarations();
    const geminiTools = tools.length > 0 ? [{
        functionDeclarations: tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        })),
    }] : undefined;

    const messages = [
        { role: 'user', parts: [{ text: prompt }] }
    ];

    let loopCount = 0;
    const allInverses = [];
    let currentCanvasState = [...canvasState];
    let totalActions = 0;
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    while (loopCount < 10) {
        const body = {
            contents: messages,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            ...(geminiTools && { tools: geminiTools })
        };

        const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Gemini API error: ${res.status} ${err}`);
        }

        const data = await res.json();
        const candidate = data.candidates?.[0];
        const responseContent = candidate?.content;

        totalUsage.promptTokens += data.usageMetadata?.promptTokenCount || 0;
        totalUsage.completionTokens += data.usageMetadata?.candidatesTokenCount || 0;
        totalUsage.totalTokens += data.usageMetadata?.totalTokenCount || 0;

        const toolCalls = [];
        const parts = responseContent?.parts || [];
        for (const part of parts) {
            if (part.functionCall) {
                toolCalls.push({
                    name: part.functionCall.name,
                    arguments: part.functionCall.args || {},
                });
            }
        }

        // Push model's response to history exactly as received to preserve thought signatures
        messages.push({
            role: 'model',
            parts: parts
        });

        if (toolCalls.length === 0) break;
        loopCount++;

        const responseParts = [];

        for (const tc of toolCalls) {
            const validation = validateToolCall(tc.name, tc.arguments);
            if (!validation.valid) {
                responseParts.push({
                    functionResponse: {
                        name: tc.name,
                        response: { error: `Validation failed: ${validation.error}` }
                    }
                });
                onStep?.(tc.name, 'error', validation.error);
                continue;
            }

            const context = { boardId, pageId, canvasState: currentCanvasState, selectedElements };
            const execResult = executeToolCall(tc.name, validation.data, context);

            if (!execResult.success) {
                responseParts.push({
                    functionResponse: {
                        name: tc.name,
                        response: { error: execResult.error }
                    }
                });
                onStep?.(tc.name, 'error', execResult.error);
                continue;
            }

            // Sync state tracker
            if (execResult.batchActions) {
                for (const act of execResult.batchActions) {
                    updateLocalState(currentCanvasState, act);
                }
                allInverses.push(...(execResult.batchInverses || []));
                totalActions += execResult.batchActions.length;
            } else if (execResult.action) {
                updateLocalState(currentCanvasState, execResult.action);
                if (execResult.inverse) allInverses.push(execResult.inverse);
                totalActions++;

                if (execResult.extraActions) {
                    for (const extra of execResult.extraActions) {
                        updateLocalState(currentCanvasState, extra);
                    }
                    if (execResult.extraInverses) allInverses.push(...execResult.extraInverses);
                    totalActions += execResult.extraActions.length;
                }
            }

            onStep?.(tc.name, 'success', execResult.result, execResult);

            responseParts.push({
                functionResponse: {
                    name: tc.name,
                    response: { result: execResult.result }
                }
            });
        }

        // Push function results as user turn containing functionResponse parts
        messages.push({
            role: 'user',
            parts: responseParts
        });
    }

    let finalResponse = '';
    const lastContent = messages[messages.length - 1];
    if (lastContent && lastContent.role === 'model') {
        for (const part of lastContent.parts) {
            if (part.text) finalResponse += part.text;
        }
    }

    return {
        text: finalResponse || `Completed ${totalActions} modifications successfully.`,
        totalActions,
        usage: totalUsage,
        inverses: allInverses,
    };
}

/**
 * OpenAI Agent Loop
 */
async function runAgentOpenAI({ boardId, pageId, prompt, systemPrompt, provider, canvasState, selectedElements, onStep }) {
    const tools = getToolDeclarations();
    const openaiTools = tools.map(t => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        },
    }));

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
    ];

    let loopCount = 0;
    const allInverses = [];
    let currentCanvasState = [...canvasState];
    let totalActions = 0;
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    while (loopCount < 10) {
        const body = {
            model: provider.model,
            messages,
            ...(openaiTools.length > 0 && { tools: openaiTools }),
        };

        const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${provider.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`OpenAI API error: ${res.status} ${err}`);
        }

        const data = await res.json();
        const choice = data.choices[0];

        totalUsage.promptTokens += data.usage?.prompt_tokens || 0;
        totalUsage.completionTokens += data.usage?.completion_tokens || 0;
        totalUsage.totalTokens += data.usage?.total_tokens || 0;

        const toolCalls = (choice.message.tool_calls || []).map(tc => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
        }));

        messages.push(choice.message);

        if (toolCalls.length === 0) break;
        loopCount++;

        for (const tc of toolCalls) {
            const validation = validateToolCall(tc.name, tc.arguments);
            if (!validation.valid) {
                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: JSON.stringify({ error: `Validation failed: ${validation.error}` })
                });
                onStep?.(tc.name, 'error', validation.error);
                continue;
            }

            const context = { boardId, pageId, canvasState: currentCanvasState, selectedElements };
            const execResult = executeToolCall(tc.name, validation.data, context);

            if (!execResult.success) {
                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: JSON.stringify({ error: execResult.error })
                });
                onStep?.(tc.name, 'error', execResult.error);
                continue;
            }

            // Sync state tracker
            if (execResult.batchActions) {
                for (const act of execResult.batchActions) {
                    updateLocalState(currentCanvasState, act);
                }
                allInverses.push(...(execResult.batchInverses || []));
                totalActions += execResult.batchActions.length;
            } else if (execResult.action) {
                updateLocalState(currentCanvasState, execResult.action);
                if (execResult.inverse) allInverses.push(execResult.inverse);
                totalActions++;

                if (execResult.extraActions) {
                    for (const extra of execResult.extraActions) {
                        updateLocalState(currentCanvasState, extra);
                    }
                    if (execResult.extraInverses) allInverses.push(...execResult.extraInverses);
                    totalActions += execResult.extraActions.length;
                }
            }

            onStep?.(tc.name, 'success', execResult.result, execResult);

            messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(execResult.result)
            });
        }
    }

    const finalChoice = messages[messages.length - 1];
    return {
        text: finalChoice?.content || `Completed ${totalActions} modifications successfully.`,
        totalActions,
        usage: totalUsage,
        inverses: allInverses,
    };
}

/**
 * Update local canvas state tracker after an action
 */
function updateLocalState(state, action) {
    if (!action) return;

    switch (action.type) {
        case 'shape:add':
            if (action.shape) state.push(action.shape);
            break;
        case 'shape:delete':
            const deleteIdx = state.findIndex(e => e.id === action.shapeId);
            if (deleteIdx >= 0) state.splice(deleteIdx, 1);
            break;
        case 'shape:move':
            const moveEl = state.find(e => e.id === action.shapeId);
            if (moveEl) { moveEl.x = action.x; moveEl.y = action.y; }
            break;
        case 'shape:update':
            const updateEl = state.find(e => e.id === action.shapeId);
            if (updateEl && action.updates) Object.assign(updateEl, action.updates);
            break;
    }
}

module.exports = {
    initProviders,
    getProvider,
    chat,
    runAgent,
};
