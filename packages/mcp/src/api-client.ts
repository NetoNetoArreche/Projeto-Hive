const API_URL = process.env.API_URL || 'http://localhost:3001';
const API_TOKEN = process.env.API_TOKEN || process.env.MCP_AUTH_TOKEN || '';

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || 'API request failed');
  return (data as any).data;
}

export const api = {
  createPost: (body: Record<string, unknown>) =>
    request('/api/posts', { method: 'POST', body: JSON.stringify(body) }),

  listPosts: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ items: any[]; total: number }>(`/api/posts?${qs}`);
  },

  publishPost: (id: string, accountId?: string) =>
    request(`/api/posts/${id}/publish`, { method: 'POST', body: JSON.stringify({ accountId }) }),

  schedulePost: (id: string, scheduledAt: string) =>
    request(`/api/posts/${id}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt }) }),

  generateImage: (body: Record<string, unknown>) =>
    request<{ imageUrl: string; minioKey: string }>('/api/generate/image', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  generateCaption: (body: Record<string, unknown>) =>
    request<{ caption: string; hashtags: string[] }>('/api/generate/caption', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  uploadImage: (base64: string, filename: string) => {
    const buffer = Buffer.from(base64, 'base64');
    const mimetype = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const formData = new FormData();
    formData.append('image', new Blob([buffer], { type: mimetype }), filename);
    return request<{ imageUrl: string }>('/api/upload', {
      method: 'POST',
      body: formData,
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
  },

  getAnalytics: (period: string) =>
    request(`/api/analytics?period=${period}`),

  addImageToPost: (postId: string, image: { imageUrl: string; order?: number }) =>
    request(`/api/posts/${postId}/images`, { method: 'POST', body: JSON.stringify(image) }),

  // Tasks
  createTask: (body: Record<string, unknown>) =>
    request('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),

  listTasks: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ items: any[]; total: number }>(`/api/tasks?${qs}`);
  },

  getTask: (id: string) => request<any>(`/api/tasks/${id}`),

  updateTask: (id: string, body: Record<string, unknown>) =>
    request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deleteTask: (id: string) =>
    request(`/api/tasks/${id}`, { method: 'DELETE' }),

  // Projects
  createProject: (body: Record<string, unknown>) =>
    request('/api/projects', { method: 'POST', body: JSON.stringify(body) }),

  listProjects: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ items: any[]; total: number }>(`/api/projects?${qs}`);
  },

  getProject: (id: string) => request<any>(`/api/projects/${id}`),

  updateProject: (id: string, body: Record<string, unknown>) =>
    request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deleteProject: (id: string) =>
    request(`/api/projects/${id}`, { method: 'DELETE' }),

  // Project Modules
  addModule: (projectId: string, body: Record<string, unknown>) =>
    request(`/api/projects/${projectId}/modules`, { method: 'POST', body: JSON.stringify(body) }),

  updateModule: (projectId: string, moduleId: string, body: Record<string, unknown>) =>
    request(`/api/projects/${projectId}/modules/${moduleId}`, { method: 'PUT', body: JSON.stringify(body) }),

  deleteModule: (projectId: string, moduleId: string) =>
    request(`/api/projects/${projectId}/modules/${moduleId}`, { method: 'DELETE' }),

  // Video Clips
  analyzeVideo: (body: Record<string, unknown>) =>
    request('/api/videos', { method: 'POST', body: JSON.stringify(body) }),

  getVideoClip: (id: string) => request<any>(`/api/videos/${id}`),

  listVideoClips: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ items: any[]; total: number }>(`/api/videos?${qs}`);
  },

  cutVideoClips: (id: string, body: Record<string, unknown>) =>
    request(`/api/videos/${id}/cut`, { method: 'POST', body: JSON.stringify(body) }),

  // Template image generation
  generateTemplate: (body: Record<string, unknown>) =>
    request<{ imageUrl: string }>('/api/generate/template', { method: 'POST', body: JSON.stringify(body) }),

  // HTML to image rendering
  renderHtml: (body: Record<string, unknown>) =>
    request<{ imageUrl: string }>('/api/generate/html', { method: 'POST', body: JSON.stringify(body) }),
};
