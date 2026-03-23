'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { ArrowLeft, Loader2, FileText, Pencil } from 'lucide-react';
import { FormattedText } from '../../../../components/FormattedText';

export default function ScriptView() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<any>(null);

  useEffect(() => {
    api.getTask(id).then((t) => {
      setTask(t);
      setLoading(false);
    }).catch(() => { router.push('/tasks'); });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const hasScript = task?.script?.trim();
  const hasFile = task?.scriptFileUrl;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/tasks/${id}`} className="w-9 h-9 rounded-lg bg-white border border-border flex items-center justify-center hover:border-primary transition-colors">
          <ArrowLeft className="w-4 h-4 text-text-secondary" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-page-title text-text-primary truncate">{task?.title}</h1>
          <p className="text-sm text-text-secondary mt-0.5">Roteiro / Script</p>
        </div>
        <Link href={`/tasks/${id}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-primary border border-primary/20 hover:bg-primary/5 transition-colors">
          <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
          Editar
        </Link>
      </div>

      {/* Script content */}
      {hasScript && (
        <div className="card p-8">
          <FormattedText text={task.script} className="text-sm text-text-primary leading-relaxed" />
        </div>
      )}

      {/* Attached file */}
      {hasFile && (
        <div className="card p-6 mt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Arquivo do Roteiro</p>
              <a href={task.scriptFileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate block">
                {task.scriptFileUrl.split('/').pop() || 'Download'}
              </a>
            </div>
          </div>
        </div>
      )}

      {!hasScript && !hasFile && (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-text-muted mx-auto mb-3" strokeWidth={1} />
          <p className="text-sm text-text-secondary">Nenhum roteiro cadastrado para esta tarefa.</p>
          <Link href={`/tasks/${id}`} className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-xs font-semibold text-primary border border-primary/20 hover:bg-primary/5 transition-colors">
            <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
            Adicionar Roteiro
          </Link>
        </div>
      )}
    </div>
  );
}
