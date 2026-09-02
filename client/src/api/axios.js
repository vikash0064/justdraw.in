import axios from 'axios';

export const getApiBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
    if (typeof window !== 'undefined') {
        if (window.location.port === '5173') return 'http://localhost:5000';
        return window.location.origin;
    }
    return '';
};

const getBaseURL = () => {
    return `${getApiBaseUrl()}/api`;
};

const API = axios.create({
    baseURL: getBaseURL(),
    headers: { 'Content-Type': 'application/json' },
});

// In-memory cache for fast GET responses and in-flight promise deduplication
const apiCache = new Map();
const inFlightRequests = new Map();
const CACHE_TTL_MS = 6000; // 6 seconds memory cache for rapid navigation

export const clearApiCache = (prefix) => {
    if (!prefix) {
        apiCache.clear();
        return;
    }
    for (const key of apiCache.keys()) {
        if (key.includes(prefix)) {
            apiCache.delete(key);
        }
    }
};

// Intercept requests: attach auth token and serve fast cache if available
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('centrio_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Invalidate cache on mutations
    const method = (config.method || 'get').toLowerCase();
    if (method !== 'get') {
        clearApiCache();
    }

    return config;
});

// Wrap API.get to deduplicate concurrent requests and provide instant cached response
const originalGet = API.get.bind(API);
API.get = async function(url, config = {}) {
    const cacheKey = `${url}_${JSON.stringify(config?.params || {})}`;
    const now = Date.now();

    // 1. Return fresh cached response if available
    const cached = apiCache.get(cacheKey);
    if (cached && (now - cached.timestamp < CACHE_TTL_MS) && !config?.noCache) {
        return Promise.resolve(cached.response);
    }

    // 2. Deduplicate simultaneous in-flight requests to the same endpoint
    if (inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey);
    }

    const requestPromise = originalGet(url, config)
        .then((res) => {
            apiCache.set(cacheKey, {
                response: res,
                timestamp: Date.now(),
            });
            inFlightRequests.delete(cacheKey);
            return res;
        })
        .catch((err) => {
            inFlightRequests.delete(cacheKey);
            throw err;
        });

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
};

// Handle 401 responses (expired/invalid token)
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            clearApiCache();
            // Don't redirect guests who are on board pages — they don't have tokens
            const onBoardPage = window.location.pathname.startsWith('/board/');
            const onJoinPage = window.location.pathname.startsWith('/join');
            if (!onBoardPage && !onJoinPage) {
                localStorage.removeItem('centrio_token');
                localStorage.removeItem('centrio_user');
                if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default API;
