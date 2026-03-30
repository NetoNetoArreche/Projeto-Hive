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

  // Team
  listMembers: () => request<any[]>('/api/team/members'),
  listInvitations: () => request<any[]>('/api/team/invitations'),
  createInvitation: (email: string, role?: string, allowedPages?: string[]) =>
    request('/api/team/invite', { method: 'POST', body: JSON.stringify({ email, role, allowedPages }) }),
  deleteInvitation: (id: string) => request(`/api/team/invitations/${id}`, { method: 'DELETE' }),
  updateMemberRole: (id: string, role: string) =>
    request(`/api/team/members/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  updateMemberPages: (id: string, allowedPages: string[]) =>
    request(`/api/team/members/${id}/pages`, { method: 'PUT', body: JSON.stringify({ allowedPages }) }),
  removeMember: (id: string) => request(`/api/team/members/${id}`, { method: 'DELETE' }),
  getInvitationByToken: (token: string) => request<any>(`/api/team/invite/${token}`),
  acceptInvitation: (token: string, name: string, password: string) =>
    request<{ user: any; token: string }>('/api/team/accept', {
      method: 'POST',
      body: JSON.stringify({ token, name, password }),
    }),

  // Funnels
  listFunnels: () => request<any[]>('/api/funnels'),
  getFunnel: (id: string) => request<any>(`/api/funnels/${id}`),
  createFunnel: (body: Record<string, unknown>) =>
    request('/api/funnels', { method: 'POST', body: JSON.stringify(body) }),
  updateFunnel: (id: string, body: Record<string, unknown>) =>
    request(`/api/funnels/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteFunnel: (id: string) => request(`/api/funnels/${id}`, { method: 'DELETE' }),
  addStage: (funnelId: string, body: Record<string, unknown>) =>
    request(`/api/funnels/${funnelId}/stages`, { method: 'POST', body: JSON.stringify(body) }),
  updateStage: (funnelId: string, stageId: string, body: Record<string, unknown>) =>
    request(`/api/funnels/${funnelId}/stages/${stageId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteStage: (funnelId: string, stageId: string) =>
    request(`/api/funnels/${funnelId}/stages/${stageId}`, { method: 'DELETE' }),
  addStep: (funnelId: string, stageId: string, body: Record<string, unknown>) =>
    request(`/api/funnels/${funnelId}/stages/${stageId}/steps`, { method: 'POST', body: JSON.stringify(body) }),
  updateStep: (funnelId: string, stageId: string, stepId: string, body: Record<string, unknown>) =>
    request(`/api/funnels/${funnelId}/stages/${stageId}/steps/${stepId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteStep: (funnelId: string, stageId: string, stepId: string) =>
    request(`/api/funnels/${funnelId}/stages/${stageId}/steps/${stepId}`, { method: 'DELETE' }),
  reorderStages: (funnelId: string, stageIds: string[]) =>
    request(`/api/funnels/${funnelId}/stages/reorder`, { method: 'PUT', body: JSON.stringify({ stageIds }) }),
  moveStep: (funnelId: string, stepId: string, body: { targetStageId: string; order: number }) =>
    request(`/api/funnels/${funnelId}/steps/${stepId}/move`, { method: 'PUT', body: JSON.stringify(body) }),

  // Video Clips
  analyzeVideo: (body: Record<string, unknown>) =>
    request('/api/videos', { method: 'POST', body: JSON.stringify(body) }),
  getVideoClip: (id: string) =>
    request<any>(`/api/videos/${id}`),
  listVideoClips: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ data: { items: any[]; total: number; page: number; limit: number } }>(`/api/videos${qs}`);
  },
  cutVideoClips: (id: string, body: Record<string, unknown>) =>
    request(`/api/videos/${id}/cut`, { method: 'POST', body: JSON.stringify(body) }),
  deleteVideoClip: (id: string) =>
    request(`/api/videos/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request<any>('/api/settings'),
  updateSetting: (key: string, value: string) =>
    request('/api/settings', { method: 'PUT', body: JSON.stringify({ key, value }) }),
  deleteSetting: (key: string) => request(`/api/settings/${key}`, { method: 'DELETE' }),
  uploadYoutubeCookies: async (file: File) => {
    const formData = new FormData();
    formData.append('cookies', file);
    const headers: Record<string, string> = {};
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
    const res = await fetch(`${BASE_URL}/api/settings/youtube-cookies`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    return data?.data;
  },
};
