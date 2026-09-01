import api from './axios';

export const getAiUsage = () => api.get('/ai/usage');
export const getAiTemplates = () => api.get('/ai/templates');
export const wireframeToCode = (data) => api.post('/ai/wireframe-to-code', data);
