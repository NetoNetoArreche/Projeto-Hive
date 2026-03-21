const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

let token: string | null = null;

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
}

export function getToken(): string | null {
  if (token) return token;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  }
  return token;
}

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (res.status === 401 && t) {
    // Try refresh
    try {
      const refresh = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      });
      if (refresh.ok) {
        const data = await refresh.json();
        setToken(data.data.token);
        headers['Authorization'] = `Bearer ${data.data.token}`;
        const retry = await fetch(`${BASE_URL}${path}`, { ...options, headers });
        const retryData = await retry.json();
        if (!retry.ok) throw new Error((retryData as any).error || 'Request failed');
        return (retryData as any).data;
      }
    } catch {
      setToken(null);
    }
    throw new Error('Unauthorized');
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(res.ok ? 'Resposta invalida do servidor' : `Erro ${res.status}: servidor indisponivel`);
  }
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data?.data;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name?: string) =>
    request<{ user: any; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  listPosts: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: any[]; total: number; page: number; limit: number }>(`/api/posts${qs}`);
  },

  getPost: (id: string) => request<any>(`/api/posts/${id}`),

  createPost: (body: Record<string, unknown>) =>
    request('/api/posts', { method: 'POST', body: JSON.stringify(body) }),

  updatePost: (id: string, body: Record<string, unknown>) =>
    request(`/api/posts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deletePost: (id: string) => request(`/api/posts/${id}`, { method: 'DELETE' }),

  publishPost: (id: string) => request(`/api/posts/${id}/publish`, { method: 'POST' }),

  schedulePost: (id: string, scheduledAt: string) =>
    request(`/api/posts/${id}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt }) }),

  generateImage: (prompt: string, aspectRatio?: string) =>
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
  listTasks: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: any[]; total: number; page: number; limit: number }>(`/api/tasks${qs}`);
  },
  getTask: (id: string) => request<any>(`/api/tasks/${id}`),
  createTask: (body: Record<string, unknown>) =>
    request('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),
  updateTask: (id: string, body: Record<string, unknown>) =>
    request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTask: (id: string) => request(`/api/tasks/${id}`, { method: 'DELETE' }),

  // Projects
  listProjects: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: any[]; total: number; page: number; limit: number }>(`/api/projects${qs}`);
  },
  getProject: (id: string) => request<any>(`/api/projects/${id}`),
  createProject: (body: Record<string, unknown>) =>
    request('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  updateProject: (id: string, body: Record<string, unknown>) =>
    request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProject: (id: string) => request(`/api/projects/${id}`, { method: 'DELETE' }),
  addModule: (projectId: string, body: Record<string, unknown>) =>
    request(`/api/projects/${projectId}/modules`, { method: 'POST', body: JSON.stringify(body) }),
  updateModule: (projectId: string, moduleId: string, body: Record<string, unknown>) =>
    request(`/api/projects/${projectId}/modules/${moduleId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteModule: (projectId: string, moduleId: string) =>
    request(`/api/projects/${projectId}/modules/${moduleId}`, { method: 'DELETE' }),

  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const t = getToken();
    const res = await fetch(`${BASE_URL}/api/upload/file`, {
      method: 'POST',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    return data.data as { fileUrl: string; fileName: string; mimeType: string };
  },

  instagramProfile: () =>
    request<{
      profile: {
        id: string;
        username: string;
        name: string;
        biography: string;
        profile_picture_url: string;
        followers_count: number;
        follows_count: number;
        media_count: number;
        website: string;
      };
      recentMedia: Array<{
        id: string;
        caption: string;
        media_type: string;
        media_url: string;
        permalink: string;
        timestamp: string;
        like_count: number;
        comments_count: number;
      }>;
    }>('/api/instagram/profile'),
};
