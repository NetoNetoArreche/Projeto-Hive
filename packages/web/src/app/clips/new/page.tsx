'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken } from '../../../lib/api';
import { ArrowLeft, Loader2, Film, Sparkles, Youtube, Upload, Settings } from 'lucide-react';

export default function NewClipPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'url' | 'upload'>('upload');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUrlSubmit() {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res: any = await api.analyzeVideo({ url: url.trim() });
      const id = res.data?.id || res.id;
      router.push(`/clips/${id}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar analise');
      setLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    if (!file) return;
    if (!file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
      setError('Formato invalido. Use MP4, MOV, AVI, MKV ou WebM.');
      return;
    }
    setLoading(true);
    setError('');
    setUploadProgress(`Enviando ${(file.size / 1024 / 1024).toFixed(0)}MB...`);
    try {
      // Send directly to API to bypass Next.js proxy body size limit
      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', file.name);
      const headers: Record<string, string> = {};
      const t = getToken();
      if (t) headers['Authorization'] = `Bearer ${t}`;

      // Uses Next.js API route that streams to Express API (no body size limit)
      const uploadRes = await fetch('/api/videos/upload', { method: 'POST', headers, body: formData });
      const data = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(data?.error || 'Upload failed');

      const id = data?.data?.id || data?.id;
      router.push(`/clips/${id}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar video');
      setLoading(false);
      setUploadProgress('');
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clips" className="p-2 rounded-lg hover:bg-bg-card-hover transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-page-title">Novo Clip</h1>
          <p className="text-sm text-text-secondary">
            Envie um video ou cole a URL do YouTube
          </p>
        </div>
      </div>

      <div className="card p-6 space-y-5">
        {/* Mode Toggle */}
        <div className="flex items-center bg-bg-main rounded-lg p-0.5">
          <button
            onClick={() => setMode('upload')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-xs font-semibold transition-all ${mode === 'upload' ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
          >
            <Upload className="w-4 h-4" />
            Upload de Video
          </button>
          <button
            onClick={() => setMode('url')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-xs font-semibold transition-all ${mode === 'url' ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
          >
            <Youtube className="w-4 h-4" />
            URL do YouTube
          </button>
        </div>

        {/* Upload Mode */}
        {mode === 'upload' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            <div
              onClick={() => !loading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${loading ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-primary/5'}`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-10 h-10 text-primary mx-auto mb-3 animate-spin" />
                  <p className="text-sm font-semibold text-text-primary">{uploadProgress || 'Processando...'}</p>
                  <p className="text-xs text-text-muted mt-1">Isso pode levar alguns minutos</p>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-text-muted mx-auto mb-3" />
                  <p className="text-sm font-semibold text-text-primary">Clique para enviar um video</p>
                  <p className="text-xs text-text-muted mt-1">MP4, MOV, AVI, MKV ou WebM (max 500MB)</p>
                </>
              )}
            </div>
          </>
        )}

        {/* URL Mode */}
        {mode === 'url' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1.5">URL do YouTube</label>
              <div className="relative">
                <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="input-field pl-10"
                  placeholder="https://youtube.com/watch?v=..."
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                />
              </div>
              <p className="text-[10px] text-text-muted mt-1.5">
                Requer cookies do YouTube configurados em Configuracoes
              </p>
            </div>
            <button
              onClick={handleUrlSubmit}
              disabled={!url.trim() || loading}
              className="btn-cta w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando video...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analisar Video
                </>
              )}
            </button>
          </>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-sm text-status-failed">
            {error}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="mt-6 card p-5">
        <h3 className="font-semibold text-sm text-text-primary mb-3 flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" />
          Como funciona
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-bg-main">
            <div className="text-lg font-bold text-primary mb-1">1</div>
            <p className="text-xs text-text-secondary">Envie um video ou cole uma URL do YouTube</p>
          </div>
          <div className="p-3 rounded-lg bg-bg-main">
            <div className="text-lg font-bold text-primary mb-1">2</div>
            <p className="text-xs text-text-secondary">A IA transcreve e identifica os melhores momentos</p>
          </div>
          <div className="p-3 rounded-lg bg-bg-main">
            <div className="text-lg font-bold text-primary mb-1">3</div>
            <p className="text-xs text-text-secondary">Voce escolhe quais momentos quer transformar em clips</p>
          </div>
          <div className="p-3 rounded-lg bg-bg-main">
            <div className="text-lg font-bold text-primary mb-1">4</div>
            <p className="text-xs text-text-secondary">Clips verticais (9:16) com face cam e legendas automaticas</p>
          </div>
        </div>
      </div>
    </div>
  );
}
