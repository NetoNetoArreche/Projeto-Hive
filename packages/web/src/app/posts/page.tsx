'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Plus, Trash2, Send, Calendar, X, Loader2, FileText, Image as ImageIcon, Layers, ChevronLeft, ChevronRight, Pencil, Video as VideoIcon, Film, Wand2 } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-draft',
  SCHEDULED: 'badge-scheduled',
  PUBLISHING: 'badge-publishing',
  PUBLISHED: 'badge-published',
  FAILED: 'badge-failed',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendado',
  PUBLISHING: 'Publicando',
  PUBLISHED: 'Publicado',
  FAILED: 'Falha',
};

export default function PostsList() {
  const [posts, setPosts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [scheduleModal, setScheduleModal] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<any | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editHashtags, setEditHashtags] = useState('');
  const [editScheduledAt, setEditScheduledAt] = useState('');

  async function loadPosts() {
    try {
      const params: Record<string, string> = { page: String(page), limit: '10' };
      if (filter) params.status = filter;
      const result = await api.listPosts(params);
      setPosts(result.items);
      setTotal(result.total);
    } catch { /* ignore */ }
  }

  useEffect(() => { loadPosts(); }, [filter, page]);

  // Auto-refresh every 5s when there are posts being published
  useEffect(() => {
    const hasPublishing = posts.some((p) => p.status === 'PUBLISHING');
    if (!hasPublishing) return;
    const interval = setInterval(loadPosts, 5000);
    return () => clearInterval(interval);
  }, [posts]);

  async function handleDelete(id: string) {
    if (!confirm('Deletar este post?')) return;
    try {
      await api.deletePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => t - 1);
    } catch { alert('Erro ao deletar'); }
  }

  async function handlePublish(id: string) {
    if (!confirm('Publicar agora no Instagram?')) return;
    setActionLoading(id);
    try {
      await api.publishPost(id);
      // Update local state immediately (API now returns instantly, publishes in background)
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, status: 'PUBLISHING' } : p));
    } catch (err: any) { alert(err.message || 'Erro ao publicar'); }
    setActionLoading(null);
  }

  function openEditModal(post: any) {
    setEditModal(post);
    setEditCaption(post.caption || '');
    setEditHashtags((post.hashtags || []).join(', '));
    setEditScheduledAt(post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : '');
  }

  async function handleEditSave() {
    if (!editModal) return;
    setActionLoading(editModal.id);
    try {
      const body: Record<string, unknown> = {
        caption: editCaption,
        hashtags: editHashtags.split(',').map((h: string) => h.trim()).filter(Boolean),
      };
      if (editScheduledAt) {
        body.scheduledAt = new Date(editScheduledAt).toISOString();
      }
      await api.updatePost(editModal.id, body);
      setEditModal(null);
      await loadPosts();
    } catch (err: any) { alert(err.message || 'Erro ao salvar'); }
    setActionLoading(null);
  }

  async function handleSchedule() {
    if (!scheduleModal || !scheduleDate) return;
    setActionLoading(scheduleModal);
    try {
      await api.schedulePost(scheduleModal, new Date(scheduleDate).toISOString());
      setScheduleModal(null);
      setScheduleDate('');
      await loadPosts();
    } catch (err: any) { alert(err.message || 'Erro ao agendar'); }
    setActionLoading(null);
  }

  const filters = [
    { value: '', label: 'Todos' },
    { value: 'DRAFT', label: 'Rascunhos' },
    { value: 'SCHEDULED', label: 'Agendados' },
    { value: 'PUBLISHED', label: 'Publicados' },
    { value: 'FAILED', label: 'Falhas' },
  ];

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Posts</h1>
          <p className="text-sm text-text-secondary mt-1">{total} posts no total</p>
        </div>
        <Link href="/posts/new" className="btn-cta">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Novo Post
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`px-4 py-2 rounded-btn text-xs font-semibold transition-all duration-200 ${
              filter === f.value
                ? 'bg-primary text-white shadow-cta'
                : 'bg-bg-card text-text-secondary border border-border hover:border-primary hover:text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Post</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Status</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Fonte</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Data</th>
              <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-text-muted uppercase tracking-wider">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {posts.map((post) => (
              <tr key={post.id} className="hover:bg-bg-card-hover transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {post.mediaType === 'VIDEO' && post.videoUrl ? (
                      <div className="relative">
                        <video
                          src={post.videoUrl}
                          className="w-11 h-11 rounded-thumb object-cover cursor-pointer hover:opacity-80 transition-opacity border border-border bg-black"
                          muted
                          playsInline
                          onClick={() => { setSelectedPost(post); setCarouselIndex(0); }}
                        />
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-sm">
                          <Film className="w-3 h-3 text-white" strokeWidth={2.5} />
                        </div>
                      </div>
                    ) : post.mediaType === 'VIDEO' ? (
                      <div className="relative w-11 h-11 rounded-thumb bg-bg-main flex items-center justify-center border border-border">
                        <Film className="w-5 h-5 text-primary" strokeWidth={1.5} />
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-sm">
                          <Film className="w-3 h-3 text-white" strokeWidth={2.5} />
                        </div>
                      </div>
                    ) : (post.imageUrl || post.editorState?.slides?.[0]?.backgroundUrl) ? (
                      <div className="relative">
                        <img
                          src={post.imageUrl || post.editorState?.slides?.[0]?.renderedUrl || post.editorState?.slides?.[0]?.backgroundUrl}
                          alt=""
                          className="w-11 h-11 rounded-thumb object-cover cursor-pointer hover:opacity-80 transition-opacity border border-border"
                          onClick={() => { setSelectedPost(post); setCarouselIndex(0); }}
                        />
                        {(post.isCarousel || (post.editorState?.slides?.length ?? 0) >= 2) && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-sm">
                            <Layers className="w-3 h-3 text-white" strokeWidth={2.5} />
                          </div>
                        )}
                      </div>
                    ) : post.editorState?.slides?.length ? (
                      <div className="relative w-11 h-11 rounded-thumb bg-black flex items-center justify-center border border-border cursor-pointer"
                        onClick={() => { setSelectedPost(post); setCarouselIndex(0); }}>
                        <span className="text-white text-[9px] font-bold">{post.editorState.slides.length}s</span>
                        {post.editorState.slides.length >= 2 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-sm">
                            <Layers className="w-3 h-3 text-white" strokeWidth={2.5} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-thumb bg-bg-main flex items-center justify-center border border-border">
                        <ImageIcon className="w-5 h-5 text-text-muted" strokeWidth={1.5} />
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-text-primary max-w-xs truncate">{post.caption || 'Sem legenda'}</p>
                      {post.mediaType === 'VIDEO' && (
                        <span className="text-[10px] text-primary font-bold uppercase">
                          {post.publishMode === 'STORIES' ? 'Stories' : post.publishMode === 'FEED' ? 'Feed Video' : 'Reels'}
                        </span>
                      )}
                      {(post.isCarousel || (post.editorState?.slides?.length ?? 0) >= 2) && (
                        <span className="text-[10px] text-text-muted">
                          {post.images?.length || post.editorState?.slides?.length || 0} slides
                        </span>
                      )}
                      {post.status === 'FAILED' && post.lastError && (
                        <p className="text-[10px] text-status-failed mt-1 max-w-xs truncate" title={post.lastError}>
                          {post.lastError}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`badge ${STATUS_BADGE[post.status] || 'badge-draft'}`}>
                    {STATUS_LABEL[post.status] || post.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-xs text-text-secondary bg-bg-main px-2 py-1 rounded-badge font-medium">
                    {post.source || 'WEB'}
                  </span>
                </td>
                <td className="px-5 py-4 text-text-secondary text-xs">
                  {post.scheduledAt
                    ? new Date(post.scheduledAt).toLocaleString('pt-BR')
                    : new Date(post.createdAt).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-1.5 justify-end">
                    {(post.status === 'DRAFT' || post.status === 'FAILED') && (
                      <>
                        <button
                          onClick={() => handlePublish(post.id)}
                          disabled={actionLoading === post.id}
                          className="px-3 py-1.5 rounded-badge text-xs font-semibold bg-emerald-500/10 text-status-published hover:bg-emerald-100 transition-colors disabled:opacity-50"
                          title="Publicar"
                        >
                          {actionLoading === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 inline mr-1" strokeWidth={1.5} />}
                          {actionLoading !== post.id && 'Publicar'}
                        </button>
                        <button
                          onClick={() => { setScheduleModal(post.id); setScheduleDate(''); }}
                          className="px-3 py-1.5 rounded-badge text-xs font-semibold bg-blue-500/10 text-status-scheduled hover:bg-blue-100 transition-colors"
                          title="Agendar"
                        >
                          <Calendar className="w-3.5 h-3.5 inline mr-1" strokeWidth={1.5} />
                          Agendar
                        </button>
                      </>
                    )}
                    {post.status === 'PUBLISHING' && (
                      <span className="px-3 py-1.5 rounded-badge text-xs font-medium bg-amber-500/10 text-amber-600 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Publicando...
                      </span>
                    )}
                    {post.status === 'SCHEDULED' && (
                      <span className="px-3 py-1.5 rounded-badge text-xs font-medium bg-blue-500/10 text-status-scheduled">
                        {new Date(post.scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {(post.status !== 'PUBLISHING' && post.status !== 'PUBLISHED' && post.mediaType !== 'VIDEO') && (
                      <Link
                        href={`/posts/visual-editor?postId=${post.id}`}
                        className="px-2.5 py-1.5 rounded-badge text-xs bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100 transition-colors"
                        title="Abrir no Editor Visual"
                      >
                        <Wand2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </Link>
                    )}
                    {(post.status !== 'PUBLISHING' && post.status !== 'PUBLISHED') && (
                      <button
                        onClick={() => openEditModal(post)}
                        className="px-2.5 py-1.5 rounded-badge text-xs bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
                        title="Editar legenda/agendamento"
                      >
                        <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="px-2.5 py-1.5 rounded-badge text-xs bg-red-500/10 text-status-failed hover:bg-red-100 transition-colors"
                      title="Deletar"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <FileText className="w-12 h-12 text-text-muted mx-auto mb-3" strokeWidth={1} />
                  <p className="text-text-muted text-sm">Nenhum post encontrado</p>
                  <Link href="/posts/new" className="text-xs text-primary hover:underline mt-2 inline-block font-medium">
                    Criar primeiro post
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 10 && (() => {
        const totalPages = Math.ceil(total / 10);
        return (
          <div className="flex items-center justify-between mt-4 px-1">
            <p className="text-xs text-text-secondary">
              Mostrando {(page - 1) * 10 + 1}-{Math.min(page * 10, total)} de {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                    p === page
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:bg-bg-card-hover'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={() => setEditModal(null)}>
          <div className="bg-bg-card rounded-card p-6 w-full max-w-md shadow-lg modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Pencil className="w-5 h-5 text-violet-600" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Editar Post</h3>
                <p className="text-xs text-text-secondary">Altere legenda, hashtags ou agendamento</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Legenda</label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  maxLength={2200}
                  rows={4}
                  className="input-field resize-none"
                  placeholder="Legenda do post..."
                />
                <span className="text-[10px] text-text-muted mt-1 block text-right">{editCaption.length}/2200</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Hashtags</label>
                <input
                  value={editHashtags}
                  onChange={(e) => setEditHashtags(e.target.value)}
                  placeholder="IA, Tech, Programacao (separadas por virgula)"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                  {editModal.status === 'SCHEDULED' ? 'Reagendar para' : 'Agendar para'}
                </label>
                <input
                  type="datetime-local"
                  value={editScheduledAt}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                  className="input-field"
                />
                {editModal.status === 'SCHEDULED' && editScheduledAt && (
                  <p className="text-[10px] text-primary mt-1 font-medium">O agendamento sera atualizado automaticamente</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setEditModal(null)} className="btn-ghost text-xs">Cancelar</button>
              <button
                onClick={handleEditSave}
                disabled={actionLoading !== null}
                className="btn-cta text-xs"
              >
                {actionLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={() => setScheduleModal(null)}>
          <div className="bg-bg-card rounded-card p-6 w-full max-w-sm shadow-lg modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-status-scheduled" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Agendar Post</h3>
                <p className="text-xs text-text-secondary">Escolha a data e hora</p>
              </div>
            </div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Data e hora</label>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="input-field mb-5"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setScheduleModal(null)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handleSchedule} disabled={!scheduleDate || actionLoading !== null} className="btn-cta text-xs">
                {actionLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Agendando...</> : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image / Video / Carousel Modal */}
      {selectedPost && (() => {
        const isVideo = selectedPost.mediaType === 'VIDEO';
        const allImages = isVideo
          ? []
          : selectedPost.isCarousel && selectedPost.images?.length > 0
            ? selectedPost.images.map((img: any) => img.imageUrl)
            : [selectedPost.imageUrl].filter(Boolean);
        const isMulti = allImages.length > 1;
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={() => setSelectedPost(null)}>
            <div className="relative modal-content max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
              {isVideo ? (
                selectedPost.videoUrl ? (
                  <video
                    src={selectedPost.videoUrl}
                    className="w-full max-h-[85vh] object-contain rounded-card shadow-2xl bg-black"
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <div className="w-full bg-bg-main rounded-card shadow-2xl p-16 text-center">
                    <Film className="w-16 h-16 text-text-muted mx-auto mb-4" strokeWidth={1} />
                    <p className="text-sm text-text-secondary">Video ja foi publicado e removido do storage</p>
                    {selectedPost.instagramId && (
                      <p className="text-xs text-text-muted mt-2">Instagram ID: {selectedPost.instagramId}</p>
                    )}
                  </div>
                )
              ) : (
                <img
                  src={allImages[carouselIndex]}
                  alt={`Imagem ${carouselIndex + 1}`}
                  className="w-full max-h-[85vh] object-contain rounded-card shadow-2xl"
                />
              )}
              <button onClick={() => setSelectedPost(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors z-10">
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
              {isMulti && (
                <>
                  {carouselIndex > 0 && (
                    <button
                      onClick={() => setCarouselIndex((i) => i - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-text-primary" />
                    </button>
                  )}
                  {carouselIndex < allImages.length - 1 && (
                    <button
                      onClick={() => setCarouselIndex((i) => i + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-text-primary" />
                    </button>
                  )}
                  {/* Counter */}
                  <div className="absolute top-3 left-3 bg-black/60 text-white text-sm px-3 py-1 rounded-full font-medium">
                    {carouselIndex + 1}/{allImages.length}
                  </div>
                  {/* Dots */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {allImages.map((_: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setCarouselIndex(idx)}
                        className={`h-2 rounded-full transition-all ${
                          idx === carouselIndex ? 'bg-white w-5' : 'bg-white/50 w-2'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
