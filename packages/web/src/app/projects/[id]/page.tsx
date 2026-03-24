'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { ArrowLeft, Plus, Trash2, Save, ExternalLink, CheckSquare, Square, Loader2, FolderKanban, ChevronDown, ChevronUp, Pencil, X, Upload, FileText } from 'lucide-react';
import { FormattedText } from '../../../components/FormattedText';

const STATUSES = [
  { value: 'PLANNING', label: 'Planejamento', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'IN_PROGRESS', label: 'Em Andamento', color: 'bg-blue-50 text-status-scheduled border-blue-200' },
  { value: 'COMPLETED', label: 'Concluido', color: 'bg-emerald-50 text-status-published border-emerald-200' },
  { value: 'ARCHIVED', label: 'Arquivado', color: 'bg-gray-50 text-text-muted border-gray-200' },
];

export default function ProjectDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleContent, setNewModuleContent] = useState('');
  const [addingModule, setAddingModule] = useState(false);
  const [driveLinkEditing, setDriveLinkEditing] = useState<string | null>(null);
  const [driveLinkValue, setDriveLinkValue] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingModule, setSavingModule] = useState(false);
  const [fileUploadingModuleId, setFileUploadingModuleId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileTargetModuleId, setFileTargetModuleId] = useState<string | null>(null);

  function toggleExpand(moduleId: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  function startEditing(mod: any) {
    setEditingModule(mod.id);
    setEditTitle(mod.title);
    setEditContent(mod.content || '');
    setExpandedModules((prev) => new Set(prev).add(mod.id));
  }

  async function handleSaveModule(moduleId: string) {
    if (!editTitle.trim()) return;
    setSavingModule(true);
    try {
      await api.updateModule(id, moduleId, { title: editTitle, content: editContent || null });
      setProject((p: any) => ({
        ...p,
        modules: p.modules.map((m: any) => m.id === moduleId ? { ...m, title: editTitle, content: editContent || null } : m),
      }));
      setEditingModule(null);
    } catch { alert('Erro ao salvar modulo'); }
    setSavingModule(false);
  }

  async function loadProject() {
    try {
      const data = await api.getProject(id);
      setProject(data);
      setLoading(false);
    } catch { router.push('/projects'); }
  }

  useEffect(() => { loadProject(); }, [id]);

  async function handleStatusChange(status: string) {
    try {
      await api.updateProject(id, { status });
      setProject((p: any) => ({ ...p, status }));
    } catch { alert('Erro ao atualizar status'); }
  }

  async function handleToggleRecorded(moduleId: string, current: boolean) {
    try {
      await api.updateModule(id, moduleId, { isRecorded: !current });
      setProject((p: any) => ({
        ...p,
        modules: p.modules.map((m: any) => m.id === moduleId ? { ...m, isRecorded: !current } : m),
      }));
    } catch { alert('Erro ao atualizar modulo'); }
  }

  async function handleSaveDriveLink(moduleId: string) {
    try {
      await api.updateModule(id, moduleId, { driveLink: driveLinkValue || null });
      setProject((p: any) => ({
        ...p,
        modules: p.modules.map((m: any) => m.id === moduleId ? { ...m, driveLink: driveLinkValue || null } : m),
      }));
      setDriveLinkEditing(null);
    } catch { alert('Erro ao salvar link'); }
  }

  async function handleFileUpload(moduleId: string, file: File) {
    setFileUploadingModuleId(moduleId);
    try {
      const result = await api.uploadFile(file);
      await api.updateModule(id, moduleId, { fileUrl: result.fileUrl });
      setProject((p: any) => ({
        ...p,
        modules: p.modules.map((m: any) => m.id === moduleId ? { ...m, fileUrl: result.fileUrl } : m),
      }));
    } catch { alert('Erro ao enviar arquivo'); }
    setFileUploadingModuleId(null);
  }

  async function handleRemoveFile(moduleId: string) {
    try {
      await api.updateModule(id, moduleId, { fileUrl: null });
      setProject((p: any) => ({
        ...p,
        modules: p.modules.map((m: any) => m.id === moduleId ? { ...m, fileUrl: null } : m),
      }));
    } catch { alert('Erro ao remover arquivo'); }
  }

  function getFileName(url: string) {
    return url.split('/').pop() || 'Arquivo';
  }

  async function handleAddModule() {
    if (!newModuleTitle.trim()) return;
    setAddingModule(true);
    try {
      await api.addModule(id, { title: newModuleTitle, content: newModuleContent || undefined, order: project.modules?.length || 0 });
      setNewModuleTitle('');
      setNewModuleContent('');
      await loadProject();
    } catch (err: any) { alert(err.message || 'Erro ao adicionar modulo'); }
    setAddingModule(false);
  }

  async function handleDeleteModule(moduleId: string) {
    if (!confirm('Remover este modulo?')) return;
    try {
      await api.deleteModule(id, moduleId);
      setProject((p: any) => ({ ...p, modules: p.modules.filter((m: any) => m.id !== moduleId) }));
    } catch { alert('Erro ao remover modulo'); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  const totalModules = project.modules?.length || 0;
  const recorded = project.modules?.filter((m: any) => m.isRecorded).length || 0;
  const progress = totalModules > 0 ? Math.round((recorded / totalModules) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Hidden file input for module uploads */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          if (e.target.files?.[0] && fileTargetModuleId) {
            handleFileUpload(fileTargetModuleId, e.target.files[0]);
          }
          e.target.value = '';
          setFileTargetModuleId(null);
        }}
      />
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/projects" className="w-9 h-9 rounded-lg bg-white border border-border flex items-center justify-center hover:border-primary transition-colors">
          <ArrowLeft className="w-4 h-4 text-text-secondary" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-page-title text-text-primary truncate">{project.title}</h1>
          {project.description && <p className="text-sm text-text-secondary mt-0.5 truncate">{project.description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column - Status, Progress, Tasks */}
        <div className="lg:col-span-5 space-y-4">
          {/* Status */}
          <div className="card p-6">
            <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleStatusChange(s.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border text-center ${
                    project.status === s.value
                      ? s.color + ' border-current'
                      : 'bg-white text-text-secondary border-border hover:border-primary'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="card p-6">
            <label className="block text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Progresso</label>
            <div className="flex items-end justify-between mb-3">
              <p className="text-3xl font-bold text-text-primary">{progress}%</p>
              <p className="text-xs text-text-secondary">{recorded} de {totalModules} gravados</p>
            </div>
            <div className="w-full h-3 bg-bg-main rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent-pink rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Tasks linked to this project */}
          {project.tasks && project.tasks.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Tarefas ({project.tasks.length})</h2>
              <div className="divide-y divide-[#F0EFEC]">
                {project.tasks.map((task: any) => (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center gap-3 py-2.5 hover:bg-bg-card-hover rounded-lg transition-colors px-2 -mx-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CheckSquare className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{task.title}</p>
                      <p className="text-xs text-text-secondary">{task.platform} &middot; {task.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Modules */}
        <div className="lg:col-span-7">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-section-title text-text-primary">Modulos</h2>
              <span className="text-xs text-text-muted">{totalModules} modulos</span>
            </div>

            {totalModules === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl mb-4">
                <FolderKanban className="w-10 h-10 text-text-muted mx-auto mb-2" strokeWidth={1} />
                <p className="text-sm text-text-muted">Nenhum modulo adicionado ainda</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {project.modules.map((mod: any, idx: number) => (
                  <div key={mod.id} className={`border rounded-xl p-4 transition-colors ${mod.isRecorded ? 'bg-emerald-50/50 border-emerald-200' : 'border-border bg-white'}`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleRecorded(mod.id, mod.isRecorded)}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {mod.isRecorded ? (
                          <CheckSquare className="w-5 h-5 text-status-published" strokeWidth={2} />
                        ) : (
                          <Square className="w-5 h-5 text-text-muted" strokeWidth={1.5} />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        {editingModule === mod.id ? (
                          /* Edit mode */
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-text-muted">{idx + 1}.</span>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="input-field flex-1 text-sm font-medium"
                                maxLength={200}
                                autoFocus
                              />
                            </div>
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              placeholder="Conteudo / descricao do modulo..."
                              className="input-field text-xs min-h-[120px] resize-y w-full"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSaveModule(mod.id)}
                                disabled={savingModule || !editTitle.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                              >
                                <Save className="w-3 h-3" strokeWidth={2} />
                                {savingModule ? 'Salvando...' : 'Salvar'}
                              </button>
                              <button
                                onClick={() => setEditingModule(null)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* View mode */
                          <>
                            <button
                              onClick={() => toggleExpand(mod.id)}
                              className="w-full text-left group"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-text-muted">{idx + 1}.</span>
                                <p className={`text-sm font-medium flex-1 ${mod.isRecorded ? 'text-status-published line-through' : 'text-text-primary'}`}>
                                  {mod.title}
                                </p>
                                {mod.content && (
                                  expandedModules.has(mod.id)
                                    ? <ChevronUp className="w-4 h-4 text-text-muted flex-shrink-0" strokeWidth={1.5} />
                                    : <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0 group-hover:text-primary transition-colors" strokeWidth={1.5} />
                                )}
                              </div>
                              {mod.content && (
                                expandedModules.has(mod.id)
                                  ? <FormattedText text={mod.content} className="text-xs text-text-secondary mt-1.5" />
                                  : <p className="text-xs text-text-secondary mt-1.5 line-clamp-2">{mod.content.replace(/\*\*/g, '').replace(/^[-•*]\s/gm, '')}</p>
                              )}
                            </button>
                            {/* Actions row */}
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => startEditing(mod)}
                                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-primary transition-colors"
                              >
                                <Pencil className="w-3 h-3" strokeWidth={1.5} />
                                Editar
                              </button>
                              <span className="text-text-muted/30">|</span>
                              {driveLinkEditing === mod.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="url"
                                    value={driveLinkValue}
                                    onChange={(e) => setDriveLinkValue(e.target.value)}
                                    placeholder="https://drive.google.com/..."
                                    className="input-field text-xs flex-1"
                                    autoFocus
                                  />
                                  <button onClick={() => handleSaveDriveLink(mod.id)} className="px-2.5 py-1.5 rounded-badge text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                    <Save className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setDriveLinkEditing(null)} className="text-xs text-text-muted hover:text-text-primary">Cancelar</button>
                                </div>
                              ) : mod.driveLink ? (
                                <a href={mod.driveLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                                  <ExternalLink className="w-3 h-3" />
                                  Link do Drive
                                </a>
                              ) : null}
                              {driveLinkEditing !== mod.id && (
                                <button
                                  onClick={() => { setDriveLinkEditing(mod.id); setDriveLinkValue(mod.driveLink || ''); }}
                                  className="text-[11px] text-text-muted hover:text-primary transition-colors"
                                >
                                  {mod.driveLink ? 'Editar link' : '+ Link Drive'}
                                </button>
                              )}
                              <span className="text-text-muted/30">|</span>
                              {mod.fileUrl ? (
                                <div className="flex items-center gap-1.5">
                                  <a href={mod.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                                    <FileText className="w-3 h-3" />
                                    {getFileName(mod.fileUrl)}
                                  </a>
                                  <button onClick={() => handleRemoveFile(mod.id)} className="p-0.5 rounded hover:bg-red-50 transition-colors">
                                    <X className="w-3 h-3 text-text-muted hover:text-status-failed" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setFileTargetModuleId(mod.id); setTimeout(() => fileInputRef.current?.click(), 0); }}
                                  disabled={fileUploadingModuleId === mod.id}
                                  className="flex items-center gap-1 text-[11px] text-text-muted hover:text-primary transition-colors"
                                >
                                  {fileUploadingModuleId === mod.id ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Enviando...</>
                                  ) : (
                                    <><Upload className="w-3 h-3" strokeWidth={2} /> + Arquivo</>
                                  )}
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      <button onClick={() => handleDeleteModule(mod.id)} className="p-1.5 rounded text-text-muted hover:text-status-failed transition-colors flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Module Inline */}
            <div className="border border-dashed border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Adicionar Modulo</p>
              <input
                type="text"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="Titulo do modulo"
                className="input-field mb-2"
                maxLength={200}
              />
              <textarea
                value={newModuleContent}
                onChange={(e) => setNewModuleContent(e.target.value)}
                placeholder="Conteudo / descricao (opcional)"
                className="input-field text-xs min-h-[60px] resize-y mb-3"
              />
              <button
                onClick={handleAddModule}
                disabled={addingModule || !newModuleTitle.trim()}
                className="btn-cta text-xs"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                {addingModule ? 'Adicionando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
