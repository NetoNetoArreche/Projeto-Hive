const API_TOKEN = process.env.API_TOKEN || process.env.INTERNAL_SERVICE_TOKEN || '';
const API_URL = process.env.API_URL || 'http://api:3001';

console.log(`[Bot API Client] API_URL=${API_URL}`);
console.log(`[Bot API Client] TOKEN=${API_TOKEN ? API_TOKEN.slice(0, 10) + '...' : 'NOT SET'}`);

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  console.log(`[Bot API] ${options.method || 'GET'} ${url}`);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
        ...options.headers,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`[Bot API] ${url} -> ${res.status}:`, (data as any).error);
      throw new Error((data as any).error || 'API request failed');
    }
    return (data as any).data;
  } catch (err: any) {
    console.error(`[Bot API] ${url} FAILED:`, err.message);
    throw err;
  }
}

export const api = {
  createPost: (body: Record<string, unknown>) => request('/api/posts', { method: 'POST', body: JSON.stringify(body) }),

  getPost: (id: string) => request<any>(`/api/posts/${id}`),

  updatePost: (id: string, body: Record<string, unknown>) =>
    request(`/api/posts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  listPosts: (status?: string) => request<{ items: any[]; total: number }>(`/api/posts?status=${status || ''}&limit=10`),

  publishPost: (id: string) => request(`/api/posts/${id}/publish`, { method: 'POST' }),

  schedulePost: (id: string, scheduledAt: string) =>
    request(`/api/posts/${id}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt }) }),

  cancelPost: (id: string) => request(`/api/posts/${id}`, { method: 'DELETE' }),

  addImageToPost: (postId: string, image: { imageUrl: string; order?: number }) =>
    request(`/api/posts/${postId}/images`, { method: 'POST', body: JSON.stringify(image) }),

  generateImage: (prompt: string, aspectRatio = '1:1') =>
    request<{ imageUrl: string }>('/api/generate/image', {
      method: 'POST',
      body: JSON.stringify({ prompt, aspectRatio }),
    }),

  generateCaption: (topic: string, tone?: string) =>
    request<{ caption: string; hashtags: string[] }>('/api/generate/caption', {
      method: 'POST',
      body: JSON.stringify({ topic, tone }),
    }),

  instagramStatus: () => request<{ connected: boolean }>('/api/instagram/status'),

  // Tasks
  listTasks: (params?: string) =>
    request<{ items: any[]; total: number }>(`/api/tasks?${params || 'limit=10'}`),
  getTask: (id: string) => request<any>(`/api/tasks/${id}`),
  createTask: (body: Record<string, unknown>) =>
    request('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),
  updateTask: (id: string, body: Record<string, unknown>) =>
    request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Projects
  listProjects: (params?: string) =>
    request<{ items: any[]; total: number }>(`/api/projects?${params || 'limit=10'}`),
  getProject: (id: string) => request<any>(`/api/projects/${id}`),
  createProject: (body: Record<string, unknown>) =>
    request('/api/projects', { method: 'POST', body: JSON.stringify(body) }),

  // Funnels
  listFunnels: () => request<any[]>('/api/funnels'),
  getFunnel: (id: string) => request<any>(`/api/funnels/${id}`),

  // Video Clips
  analyzeVideo: (url: string) =>
    request<any>('/api/videos', { method: 'POST', body: JSON.stringify({ url }) }),
  getVideoClip: (id: string) => request<any>(`/api/videos/${id}`),
  listVideoClips: () => request<{ items: any[]; total: number }>('/api/videos?limit=10'),
  cutVideoClips: (id: string, clips: any[], format = 'vertical') =>
    request<any>(`/api/videos/${id}/cut`, { method: 'POST', body: JSON.stringify({ clips, format }) }),
};
