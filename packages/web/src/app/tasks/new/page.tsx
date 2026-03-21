'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { ArrowLeft, Save, Megaphone, Upload, FileText, X, Loader2 } from 'lucide-react';

const PLATFORMS = [
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'META_ADS', label: 'Meta Ads' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'OTHER', label: 'Outro' },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Baixa', color: 'bg-emerald-50 text-status-published border-emerald-200' },
  { value: 'MEDIUM', label: 'Media', color: 'bg-blue-50 text-status-scheduled border-blue-200' },
  { value: 'HIGH', label: 'Alta', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'URGENT', label: 'Urgente', color: 'bg-red-50 text-status-failed border-red-200' },
];

function FileUploadField({ label, fileUrl, fileName, uploading, onUpload, onRemove }: {
  label: string;
  fileUrl: string;
  fileName: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-3">
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" onChange={(e) => { if (e.target.files?.[0]) onUpload(e.target.files[0]); e.target.value = ''; }} />
      {fileUrl ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-bg-main border border-border">
          <FileText className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={1.5} />
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1">{fileName || 'Arquivo'}</a>
          <button onClick={onRemove} className="p-1 rounded hover:bg-white transition-colors flex-shrink-0"><X className="w-3.5 h-3.5 text-text-muted" /></button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-xs font-medium text-text-secondary hover:border-primary hover:text-primary transition-colors">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" strokeWidth={2} />}
          {uploading ? 'Enviando...' : label}
        </button>
      )}
    </div>
  );
}

export default function NewTask() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [scriptUploading, setScriptUploading] = useState(false);
  const [briefingUploading, setBriefingUploading] = useState(false);
  const [scriptFile, setScriptFile] = useState({ url: '', name: '' });
  const [briefingFile, setBriefingFile] = useState({ url: '', name: '' });
  const [form, setForm] = useState({
    title: '',
    description: '',
    platform: 'INSTAGRAM',
    priority: 'MEDIUM',
    recordDate: '',
    publishDate: '',
    script: '',
    driveLink: '',
    isSponsored: false,
    sponsorName: '',
    sponsorBriefing: '',
    sponsorContact: '',
    sponsorDeadline: '',
    projectId: '',
  });

  useEffect(() => {
    api.listProjects({ limit: '100' }).then((r) => setProjects(r.items)).catch(() => {});
  }, []);

  function set(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleFileUpload(file: File, target: 'script' | 'briefing') {
    const setUploading = target === 'script' ? setScriptUploading : setBriefingUploading;
    const setFile = target === 'script' ? setScriptFile : setBriefingFile;
    setUploading(true);
    try {
      const result = await api.uploadFile(file);
      setFile({ url: result.fileUrl, name: result.fileName });
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar arquivo');
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!form.title.trim()) { alert('Titulo e obrigatorio'); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { title: form.title, platform: form.platform, priority: form.priority };
      if (form.description) body.description = form.description;
      if (form.recordDate) body.recordDate = new Date(form.recordDate).toISOString();
      if (form.publishDate) body.publishDate = new Date(form.publishDate).toISOString();
      if (form.script) body.script = form.script;
      if (scriptFile.url) body.scriptFileUrl = scriptFile.url;
      if (form.driveLink) body.driveLink = form.driveLink;
      if (form.projectId) body.projectId = form.projectId;
      body.isSponsored = form.isSponsored;
      if (form.isSponsored) {
        if (form.sponsorName) body.sponsorName = form.sponsorName;
        if (form.sponsorBriefing) body.sponsorBriefing = form.sponsorBriefing;
        if (briefingFile.url) body.briefingFileUrl = briefingFile.url;
        if (form.sponsorContact) body.sponsorContact = form.sponsorContact;
        if (form.sponsorDeadline) body.sponsorDeadline = new Date(form.sponsorDeadline).toISOString();
      }
      await api.createTask(body);
      router.push('/tasks');
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar');
    }
    setSaving(false);
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tasks" className="w-9 h-9 rounded-lg bg-white border border-border flex items-center justify-center hover:border-primary transition-colors">
          <ArrowLeft className="w-4 h-4 text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-page-title text-text-primary">Nova Tarefa</h1>
          <p className="text-sm text-text-secondary mt-0.5">Cadastre uma nova tarefa de producao</p>
        </div>
      </div>

      {/* Title & Description */}
      <div className="card p-6 mb-4">
        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Titulo *</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Ex: Video patrocinado - Produto X"
          className="input-field mb-4"
          maxLength={200}
        />
        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Descricao</label>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Detalhes sobre a tarefa..."
          className="input-field min-h-[80px] resize-y"
          maxLength={5000}
        />
      </div>

      {/* Platform & Priority */}
      <div className="card p-6 mb-4">
        <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Plataforma</label>
        <div className="flex gap-2 flex-wrap mb-5">
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              onClick={() => set('platform', p.value)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                form.platform === p.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-secondary border-border hover:border-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Prioridade</label>
        <div className="flex gap-2 flex-wrap">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              onClick={() => set('priority', p.value)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                form.priority === p.value ? p.color + ' border-current' : 'bg-white text-text-secondary border-border hover:border-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="card p-6 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Data de Gravacao</label>
            <input type="datetime-local" value={form.recordDate} onChange={(e) => set('recordDate', e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Data de Publicacao</label>
            <input type="datetime-local" value={form.publishDate} onChange={(e) => set('publishDate', e.target.value)} className="input-field" />
          </div>
        </div>
      </div>

      {/* Script */}
      <div className="card p-6 mb-4">
        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Roteiro / Script</label>
        <textarea
          value={form.script}
          onChange={(e) => set('script', e.target.value)}
          placeholder="Escreva o roteiro do video aqui..."
          className="input-field min-h-[200px] resize-y font-mono text-sm"
        />
        <FileUploadField
          label="Enviar arquivo do roteiro"
          fileUrl={scriptFile.url}
          fileName={scriptFile.name}
          uploading={scriptUploading}
          onUpload={(f) => handleFileUpload(f, 'script')}
          onRemove={() => setScriptFile({ url: '', name: '' })}
        />
      </div>

      {/* Drive Link */}
      <div className="card p-6 mb-4">
        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Link do Drive</label>
        <input
          type="url"
          value={form.driveLink}
          onChange={(e) => set('driveLink', e.target.value)}
          placeholder="https://drive.google.com/..."
          className="input-field"
        />
      </div>

      {/* Project */}
      {projects.length > 0 && (
        <div className="card p-6 mb-4">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Projeto (opcional)</label>
          <select value={form.projectId} onChange={(e) => set('projectId', e.target.value)} className="input-field">
            <option value="">Nenhum projeto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Sponsored */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => set('isSponsored', !form.isSponsored)}
            className={`w-10 h-6 rounded-full transition-colors relative ${form.isSponsored ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isSponsored ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-accent-orange" strokeWidth={2} />
            <span className="text-sm font-semibold text-text-primary">Conteudo Patrocinado</span>
          </div>
        </div>
        {form.isSponsored && (
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="mt-4">
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Empresa / Marca</label>
              <input type="text" value={form.sponsorName} onChange={(e) => set('sponsorName', e.target.value)} placeholder="Nome da empresa" className="input-field" maxLength={200} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Briefing</label>
              <textarea value={form.sponsorBriefing} onChange={(e) => set('sponsorBriefing', e.target.value)} placeholder="Detalhes do briefing..." className="input-field min-h-[120px] resize-y" />
              <FileUploadField
                label="Enviar arquivo do briefing"
                fileUrl={briefingFile.url}
                fileName={briefingFile.name}
                uploading={briefingUploading}
                onUpload={(f) => handleFileUpload(f, 'briefing')}
                onRemove={() => setBriefingFile({ url: '', name: '' })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Contato</label>
                <input type="text" value={form.sponsorContact} onChange={(e) => set('sponsorContact', e.target.value)} placeholder="Email ou telefone" className="input-field" maxLength={200} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Deadline da Entrega</label>
                <input type="datetime-local" value={form.sponsorDeadline} onChange={(e) => set('sponsorDeadline', e.target.value)} className="input-field" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <Link href="/tasks" className="btn-ghost text-sm">Cancelar</Link>
        <button onClick={handleSave} disabled={saving || !form.title.trim()} className="btn-cta">
          <Save className="w-4 h-4" strokeWidth={2} />
          {saving ? 'Salvando...' : 'Salvar Tarefa'}
        </button>
      </div>
    </div>
  );
}
