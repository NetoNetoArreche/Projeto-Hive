'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Plus, Trash2, Send, Calendar, X, Loader2, FileText, Image as ImageIcon, Layers, ChevronLeft, ChevronRight } from 'lucide-react';

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

  async function loadPosts() {
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (filter) params.status = filter;
      const result = await api.listPosts(params);
      setPosts(result.items);
      setTotal(result.total);
    } catch { /* ignore */ }
  }

  useEffect(() => { loadPosts(); }, [filter, page]);

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
      await loadPosts();
    } catch (err: any) { alert(err.message || 'Erro ao publicar'); }
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
                : 'bg-white text-text-secondary border border-border hover:border-primary hover:text-primary'
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
          <tbody className="divide-y divide-[#F0EFEC]">
            {posts.map((post) => (
              <tr key={post.id} className="hover:bg-bg-card-hover transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {post.imageUrl ? (
                      <div className="relative">
                        <img
                          src={post.imageUrl}
                          alt=""
                          className="w-11 h-11 rounded-thumb object-cover cursor-pointer hover:opacity-80 transition-opacity border border-border"
                          onClick={() => { setSelectedPost(post); setCarouselIndex(0); }}
                        />
                        {post.isCarousel && (
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
                      {post.isCarousel && post.images?.length > 0 && (
                        <span className="text-[10px] text-text-muted">{post.images.length} imagens</span>
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
                          className="px-3 py-1.5 rounded-badge text-xs font-semibold bg-emerald-50 text-status-published hover:bg-emerald-100 transition-colors disabled:opacity-50"
                          title="Publicar"
                        >
                          {actionLoading === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 inline mr-1" strokeWidth={1.5} />}
                          {actionLoading !== post.id && 'Publicar'}
                        </button>
                        <button
                          onClick={() => { setScheduleModal(post.id); setScheduleDate(''); }}
                          className="px-3 py-1.5 rounded-badge text-xs font-semibold bg-blue-50 text-status-scheduled hover:bg-blue-100 transition-colors"
                          title="Agendar"
                        >
                          <Calendar className="w-3.5 h-3.5 inline mr-1" strokeWidth={1.5} />
                          Agendar
                        </button>
                      </>
                    )}
                    {post.status === 'SCHEDULED' && (
                      <span className="px-3 py-1.5 rounded-badge text-xs font-medium bg-blue-50 text-status-scheduled">
                        {new Date(post.scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="px-2.5 py-1.5 rounded-badge text-xs bg-red-50 text-status-failed hover:bg-red-100 transition-colors"
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
      {total > 20 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-text-secondary">
            Mostrando {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} de {total}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost text-xs disabled:opacity-30">Anterior</button>
            <span className="px-3 py-1.5 text-xs text-text-secondary">Pagina {page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={posts.length < 20} className="btn-ghost text-xs disabled:opacity-30">Proxima</button>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={() => setScheduleModal(null)}>
          <div className="bg-white rounded-card p-6 w-full max-w-sm shadow-lg modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
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

      {/* Full Image / Carousel Modal */}
      {selectedPost && (() => {
        const allImages = selectedPost.isCarousel && selectedPost.images?.length > 0
          ? selectedPost.images.map((img: any) => img.imageUrl)
          : [selectedPost.imageUrl].filter(Boolean);
        const isMulti = allImages.length > 1;
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={() => setSelectedPost(null)}>
            <div className="relative modal-content max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
              <img
                src={allImages[carouselIndex]}
                alt={`Imagem ${carouselIndex + 1}`}
                className="w-full max-h-[85vh] object-contain rounded-card shadow-2xl"
              />
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
