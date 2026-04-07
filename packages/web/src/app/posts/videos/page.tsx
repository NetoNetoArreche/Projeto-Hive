'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import {
  Upload, Video as VideoIcon, X, Loader2, CheckCircle2, AlertCircle,
  Calendar, Send, Save, Trash2, Film, ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';

interface VideoItem {
  id: string;
  file: File;
  fileName: string;
  sizeBytes: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'saving' | 'saved';
  progress: number;
  videoUrl?: string;
  videoMinioKey?: string;
  caption: string;
  hashtags: string;
  scheduledAt: string;
  keepMedia: boolean;
  postId?: string;
  error?: string;
  previewUrl: string; // local blob URL
}

const MAX_SIZE_MB = 150;
const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-m4v'];

export default function VideosBulkPage() {
  const router = useRouter();
  const [items, setItems] = useState<VideoItem[]>([]);
  const [globalCaption, setGlobalCaption] = useState('');
  const [globalHashtags, setGlobalHashtags] = useState('');
  const [bulkScheduleStart, setBulkScheduleStart] = useState('');
  const [bulkIntervalMin, setBulkIntervalMin] = useState(60);
  const [keepMediaDefault, setKeepMediaDefault] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  function makeId() {
    return Math.random().toString(36).slice(2);
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const newItems: VideoItem[] = [];
    for (const file of arr) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`${file.name}: tipo invalido (use MP4 ou MOV)`);
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`${file.name}: muito grande (max ${MAX_SIZE_MB}MB)`);
        continue;
      }
      newItems.push({
        id: makeId(),
        file,
        fileName: file.name,
        sizeBytes: file.size,
        status: 'pending',
        progress: 0,
        caption: globalCaption,
        hashtags: globalHashtags,
        scheduledAt: '',
        keepMedia: keepMediaDefault,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setItems((prev) => [...prev, ...newItems]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function updateItem(id: string, patch: Partial<VideoItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const item = prev.find((it) => it.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((it) => it.id !== id);
    });
  }

  async function uploadOne(item: VideoItem) {
    updateItem(item.id, { status: 'uploading', progress: 0 });
    try {
      const result = await api.uploadVideo(item.file, (pct) => {
        updateItem(item.id, { progress: pct });
      });
      updateItem(item.id, {
        status: 'uploaded',
        progress: 100,
        videoUrl: result.videoUrl,
        videoMinioKey: result.videoMinioKey,
      });
      return result;
    } catch (err: any) {
      updateItem(item.id, { status: 'failed', error: err?.message || 'Falha no upload' });
      throw err;
    }
  }

  async function uploadAll() {
    for (const item of items.filter((it) => it.status === 'pending')) {
      try {
        await uploadOne(item);
      } catch {
        // continue with next
      }
    }
  }

  function applyBulkSchedule() {
    if (!bulkScheduleStart) {
      alert('Defina a data/hora inicial');
      return;
    }
    const start = new Date(bulkScheduleStart).getTime();
    const intervalMs = bulkIntervalMin * 60 * 1000;
    setItems((prev) =>
      prev.map((it, idx) => ({
        ...it,
        scheduledAt: new Date(start + idx * intervalMs).toISOString().slice(0, 16),
      }))
    );
  }

  function applyBulkCaption() {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        caption: it.caption || globalCaption,
        hashtags: it.hashtags || globalHashtags,
      }))
    );
  }

  async function saveOne(item: VideoItem) {
    if (item.status !== 'uploaded') return null;
    if (!item.videoUrl) return null;

    updateItem(item.id, { status: 'saving' });
    try {
      const post = (await api.createPost({
        caption: item.caption || undefined,
        mediaType: 'VIDEO',
        videoUrl: item.videoUrl,
        videoMinioKey: item.videoMinioKey,
        videoSizeBytes: item.sizeBytes,
        keepMedia: item.keepMedia,
        aspectRatio: '9:16',
        hashtags: item.hashtags.split(',').map((h) => h.trim()).filter(Boolean),
      })) as any;

      if (item.scheduledAt) {
        await api.schedulePost(post.id, new Date(item.scheduledAt).toISOString());
      }

      updateItem(item.id, { status: 'saved', postId: post.id });
      return post;
    } catch (err: any) {
      updateItem(item.id, { status: 'failed', error: err?.message || 'Falha ao salvar' });
      return null;
    }
  }

  async function saveAll() {
    setSavingAll(true);
    for (const item of items.filter((it) => it.status === 'uploaded')) {
      await saveOne(item);
    }
    setSavingAll(false);

    const allSaved = items.every((it) => it.status === 'saved' || it.status === 'failed');
    if (allSaved) {
      setTimeout(() => router.push('/posts'), 1500);
    }
  }

  const stats = {
    total: items.length,
    pending: items.filter((it) => it.status === 'pending').length,
    uploading: items.filter((it) => it.status === 'uploading').length,
    uploaded: items.filter((it) => it.status === 'uploaded').length,
    saved: items.filter((it) => it.status === 'saved').length,
    failed: items.filter((it) => it.status === 'failed').length,
  };

  function fmtSize(bytes: number) {
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <Link href="/posts" className="text-xs text-text-secondary hover:text-primary inline-flex items-center gap-1 mb-2">
          <ChevronLeft className="w-3.5 h-3.5" /> Voltar para Posts
        </Link>
        <h1 className="text-page-title text-text-primary">Videos / Reels</h1>
        <p className="text-sm text-text-secondary mt-1">
          Faca upload de varios videos curtos (Reels 9:16) e agende todos de uma vez. Apos publicacao, o video e
          deletado automaticamente do storage (a menos que voce marque "manter").
        </p>
      </div>

      {/* Drop zone */}
      <div
        ref={dragRef}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`card p-12 mb-6 border-2 border-dashed cursor-pointer transition-all ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-m4v"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-accent-pink/10 flex items-center justify-center">
            <Upload className="w-7 h-7 text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary">Arraste videos aqui ou clique para selecionar</p>
            <p className="text-xs text-text-muted mt-1">MP4 ou MOV - max {MAX_SIZE_MB}MB cada - varios arquivos de uma vez</p>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <>
          {/* Stats + bulk controls */}
          <div className="card p-5 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              <div className="text-center"><p className="text-xs text-text-muted">Total</p><p className="text-lg font-bold text-text-primary">{stats.total}</p></div>
              <div className="text-center"><p className="text-xs text-text-muted">Pendente</p><p className="text-lg font-bold text-text-secondary">{stats.pending}</p></div>
              <div className="text-center"><p className="text-xs text-text-muted">Enviado</p><p className="text-lg font-bold text-status-published">{stats.uploaded}</p></div>
              <div className="text-center"><p className="text-xs text-text-muted">Salvo</p><p className="text-lg font-bold text-primary">{stats.saved}</p></div>
              <div className="text-center"><p className="text-xs text-text-muted">Falha</p><p className="text-lg font-bold text-status-failed">{stats.failed}</p></div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Aplicar a todos</h3>

              {/* Global caption */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Legenda padrao</label>
                  <input
                    value={globalCaption}
                    onChange={(e) => setGlobalCaption(e.target.value)}
                    placeholder="Legenda aplicada nos itens vazios"
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Hashtags padrao</label>
                  <input
                    value={globalHashtags}
                    onChange={(e) => setGlobalHashtags(e.target.value)}
                    placeholder="reels, viral (separadas por virgula)"
                    className="input-field text-xs"
                  />
                </div>
              </div>
              <button
                onClick={applyBulkCaption}
                className="btn-ghost text-xs"
              >
                Aplicar legenda + hashtags nos vazios
              </button>

              {/* Bulk schedule */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Comecar em</label>
                  <input
                    type="datetime-local"
                    value={bulkScheduleStart}
                    onChange={(e) => setBulkScheduleStart(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Intervalo (minutos)</label>
                  <input
                    type="number"
                    min={1}
                    value={bulkIntervalMin}
                    onChange={(e) => setBulkIntervalMin(Number(e.target.value))}
                    className="input-field text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <button onClick={applyBulkSchedule} className="btn-ghost text-xs w-full justify-center">
                    <Calendar className="w-3.5 h-3.5" />
                    Distribuir agendamentos
                  </button>
                </div>
              </div>

              {/* Keep media default */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepMediaDefault}
                  onChange={(e) => setKeepMediaDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-primary"
                />
                <span className="text-xs text-text-secondary">
                  Manter videos no storage apos publicar (padrao: deletar para liberar espaco)
                </span>
              </label>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-4 mt-4 border-t border-border">
              {stats.pending > 0 && (
                <button onClick={uploadAll} className="btn-cta text-xs">
                  <Upload className="w-3.5 h-3.5" />
                  Enviar {stats.pending} pendente{stats.pending > 1 ? 's' : ''}
                </button>
              )}
              {stats.uploaded > 0 && (
                <button onClick={saveAll} disabled={savingAll} className="btn-cta text-xs">
                  {savingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {savingAll ? 'Salvando...' : `Salvar/Agendar ${stats.uploaded}`}
                </button>
              )}
            </div>
          </div>

          {/* Items list */}
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="card p-4">
                <div className="flex gap-4">
                  {/* Video preview */}
                  <div className="flex-shrink-0">
                    <video
                      src={item.previewUrl}
                      className="w-32 h-48 rounded-card object-cover bg-bg-main border border-border"
                      muted
                      playsInline
                      controls
                    />
                  </div>

                  {/* Form */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate flex items-center gap-2">
                          <Film className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={1.5} />
                          #{idx + 1} {item.fileName}
                        </p>
                        <p className="text-[10px] text-text-muted mt-0.5">{fmtSize(item.sizeBytes)}</p>
                      </div>

                      {/* Status badge */}
                      <div className="flex items-center gap-2">
                        {item.status === 'pending' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-badge bg-bg-main text-text-muted font-semibold uppercase">Pendente</span>
                        )}
                        {item.status === 'uploading' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-badge bg-blue-50 text-status-scheduled font-semibold uppercase flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> {item.progress}%
                          </span>
                        )}
                        {item.status === 'uploaded' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-badge bg-emerald-50 text-status-published font-semibold uppercase flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Enviado
                          </span>
                        )}
                        {item.status === 'saving' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-badge bg-blue-50 text-status-scheduled font-semibold uppercase flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Salvando
                          </span>
                        )}
                        {item.status === 'saved' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-badge bg-emerald-50 text-status-published font-semibold uppercase flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Salvo
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-badge bg-red-50 text-status-failed font-semibold uppercase flex items-center gap-1" title={item.error}>
                            <AlertCircle className="w-3 h-3" /> Falha
                          </span>
                        )}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-text-muted hover:text-status-failed transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {item.status === 'uploading' && (
                      <div className="w-full h-1 rounded-full bg-bg-main overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${item.progress}%` }} />
                      </div>
                    )}

                    {item.error && (
                      <p className="text-[10px] text-status-failed">{item.error}</p>
                    )}

                    {/* Caption + hashtags + schedule */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-text-muted mb-0.5 uppercase">Legenda</label>
                        <textarea
                          value={item.caption}
                          onChange={(e) => updateItem(item.id, { caption: e.target.value })}
                          rows={2}
                          maxLength={2200}
                          placeholder="Legenda do reel..."
                          className="input-field text-xs resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-text-muted mb-0.5 uppercase">Hashtags</label>
                          <input
                            value={item.hashtags}
                            onChange={(e) => updateItem(item.id, { hashtags: e.target.value })}
                            placeholder="reels, viral"
                            className="input-field text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-text-muted mb-0.5 uppercase">Agendar para</label>
                          <input
                            type="datetime-local"
                            value={item.scheduledAt}
                            onChange={(e) => updateItem(item.id, { scheduledAt: e.target.value })}
                            className="input-field text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={item.keepMedia}
                        onChange={(e) => updateItem(item.id, { keepMedia: e.target.checked })}
                        className="w-3.5 h-3.5 rounded text-primary"
                      />
                      <span className="text-[10px] text-text-secondary">Manter video no storage apos publicar</span>
                    </label>

                    {/* Per-item actions */}
                    {item.status === 'pending' && (
                      <button onClick={() => uploadOne(item)} className="btn-ghost text-[10px] py-1.5">
                        <Upload className="w-3 h-3" /> Enviar este
                      </button>
                    )}
                    {item.status === 'uploaded' && (
                      <button onClick={() => saveOne(item)} className="btn-ghost text-[10px] py-1.5">
                        <Save className="w-3 h-3" /> Salvar este
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
