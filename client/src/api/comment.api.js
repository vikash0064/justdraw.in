import api from './axios';

export const getComments = (boardId) => api.get(`/comments/${boardId}`);
export const createComment = (data) => api.post('/comments', data);
export const resolveComment = (id) => api.patch(`/comments/${id}/resolve`);
export const updateComment = (id, data) => api.patch(`/comments/${id}`, data);
export const deleteComment = (id) => api.delete(`/comments/${id}`);
