'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import {
  Plus, Trash2, Save, Loader2, Image as ImageIcon, Type, Palette,
  ChevronLeft, Sparkles, Wand2, Upload, Layout,
} from 'lucide-react';

// ── Types ──

type AspectRatio = '1:1' | '4:5' | '9:16';

type TemplateId = 'hero' | 'content' | 'stat' | 'quote' | 'cta' | 'list';

type Position = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

interface SlideState {
  id: string;
  template: TemplateId;
  // Background
  backgroundUrl: string;
  backgroundPrompt: string;
  overlayOpacity: number;
  // Content fields (filled by template, edited by user)
  label: string;      // small tag/category (ex: "Dica 1", "Dados", "Tutorial")
  title: string;      // main text
  subtitle: string;   // secondary text
  stat: string;       // big number for stat template (ex: "+40%", "1.5k")
  // Style
  position: Position;
  titleColor: string;
  fontFamily: string;
  fontWeight: number;
  glassEffect: boolean;
  // Corners
  cornerTopLeft: string;
  cornerTopRight: string;
  cornerBottomLeft: string;
  // Render result
  renderedUrl?: string;
}

// ── Template definitions ──

interface TemplateConfig {
  id: TemplateId;
  name: string;
  desc: string;
  icon: string;
  fields: ('label' | 'title' | 'subtitle' | 'stat')[];
  defaultPosition: Position;
}

const TEMPLATES: TemplateConfig[] = [
  { id: 'hero', name: 'Capa / Hook', desc: 'Titulo grande de impacto', icon: '🎯', fields: ['title', 'subtitle'], defaultPosition: 'bottom-left' },
  { id: 'content', name: 'Conteudo', desc: 'Rotulo + titulo + subtitulo', icon: '📝', fields: ['label', 'title', 'subtitle'], defaultPosition: 'middle-center' },
  { id: 'stat', name: 'Dado / Stat', desc: 'Numero em destaque + contexto', icon: '📊', fields: ['stat', 'title', 'subtitle'], defaultPosition: 'middle-center' },
  { id: 'quote', name: 'Citacao', desc: 'Frase em italico + autor', icon: '💬', fields: ['title', 'subtitle'], defaultPosition: 'middle-center' },
  { id: 'cta', name: 'CTA Final', desc: 'Chamada pra acao + handle', icon: '🚀', fields: ['title', 'subtitle', 'label'], defaultPosition: 'middle-center' },
  { id: 'list', name: 'Lista / Steps', desc: 'Rotulo + titulo + subtitulo longo', icon: '📋', fields: ['label', 'title', 'subtitle'], defaultPosition: 'middle-left' },
];

const FONTS = [
  { id: 'Inter', label: 'Inter' },
  { id: 'Sora', label: 'Sora' },
  { id: 'Space Grotesk', label: 'Space' },
  { id: 'Outfit', label: 'Outfit' },
  { id: 'DM Sans', label: 'DM Sans' },
  { id: 'Manrope', label: 'Manrope' },
  { id: 'Plus Jakarta Sans', label: 'Jakarta' },
  { id: 'Bebas Neue', label: 'Bebas' },
];

const POSITIONS: { id: Position; label: string }[] = [
  { id: 'top-left', label: 'Sup.Esq' }, { id: 'top-center', label: 'Sup.Centro' }, { id: 'top-right', label: 'Sup.Dir' },
  { id: 'middle-left', label: 'Meio Esq' }, { id: 'middle-center', label: 'Centro' }, { id: 'middle-right', label: 'Meio Dir' },
  { id: 'bottom-left', label: 'Inf.Esq' }, { id: 'bottom-center', label: 'Inf.Centro' }, { id: 'bottom-right', label: 'Inf.Dir' },
];

const COLORS = ['#ffffff', '#000000', '#FFD700', '#EF4444', '#3B82F6', '#22C55E', '#F97316', '#A855F7', '#EC4899', '#14B8A6'];

function makeId() { return Math.random().toString(36).slice(2); }

function emptySlide(idx: number, tpl: TemplateId = idx === 0 ? 'hero' : 'content'): SlideState {
  const t = TEMPLATES.find((x) => x.id === tpl)!;
  return {
    id: makeId(),
    template: tpl,
    backgroundUrl: '',
    backgroundPrompt: '',
    overlayOpacity: 0.4,
    label: tpl === 'content' || tpl === 'list' ? `Passo ${idx}` : tpl === 'cta' ? 'Proximo passo' : '',
    title: idx === 0 ? 'Titulo do carrossel' : `Titulo do slide ${idx + 1}`,
    subtitle: idx === 0 ? 'Subtitulo que complementa' : 'Subtitulo do slide',
    stat: tpl === 'stat' ? '+40%' : '',
    position: t.defaultPosition,
    titleColor: '#ffffff',
    fontFamily: 'Inter',
    fontWeight: 800,
    glassEffect: false,
    cornerTopLeft: '',
    cornerTopRight: '',
    cornerBottomLeft: '',
    renderedUrl: undefined,
  };
}

// ── Build HTML from template + fields (user never sees this) ──

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSlideHtml(s: SlideState): string {
  const font = `'${s.fontFamily}', sans-serif`;
  const color = s.titleColor;
  const shadow = 'text-shadow:0 6px 40px rgba(0,0,0,0.6);';
  const shadowSm = 'text-shadow:0 4px 20px rgba(0,0,0,0.5);';

  const glassOpen = s.glassEffect
    ? `<div style="background:rgba(0,0,0,0.35);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:24px;padding:48px;max-width:85%;">`
    : '';
  const glassClose = s.glassEffect ? '</div>' : '';

  // Position CSS
  const posMap: Record<Position, string> = {
    'top-left': 'top:80px;left:80px;text-align:left;',
    'top-center': 'top:80px;left:0;right:0;text-align:center;align-items:center;',
    'top-right': 'top:80px;right:80px;text-align:right;align-items:flex-end;',
    'middle-left': 'inset:0;text-align:left;padding-left:80px;justify-content:center;',
    'middle-center': 'inset:0;text-align:center;align-items:center;justify-content:center;',
    'middle-right': 'inset:0;text-align:right;align-items:flex-end;padding-right:80px;justify-content:center;',
    'bottom-left': 'bottom:120px;left:80px;text-align:left;',
    'bottom-center': 'bottom:120px;left:0;right:0;text-align:center;align-items:center;',
    'bottom-right': 'bottom:120px;right:80px;text-align:right;align-items:flex-end;',
  };
  const pos = posMap[s.position];

  const corners = [
    s.cornerTopLeft && `<div style="position:absolute;top:32px;left:32px;font-size:20px;color:${color};opacity:0.8;font-family:${font};${shadowSm}">${escHtml(s.cornerTopLeft)}</div>`,
    s.cornerTopRight && `<div style="position:absolute;top:32px;right:32px;font-size:20px;color:${color};opacity:0.8;font-family:${font};${shadowSm}">${escHtml(s.cornerTopRight)}</div>`,
    s.cornerBottomLeft && `<div style="position:absolute;bottom:32px;left:32px;font-size:20px;color:${color};opacity:0.8;font-family:${font};${shadowSm}">${escHtml(s.cornerBottomLeft)}</div>`,
  ].filter(Boolean).join('\n');

  const labelHtml = s.label
    ? `<div style="font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:var(--brand-accent,${color});opacity:0.85;font-family:${font};${shadowSm}">${escHtml(s.label)}</div>`
    : '';

  const subtitleHtml = s.subtitle
    ? `<div style="font-size:28px;font-weight:400;color:${color};opacity:0.9;line-height:1.4;font-family:${font};${shadowSm};max-width:90%;">${escHtml(s.subtitle)}</div>`
    : '';

  let content = '';

  switch (s.template) {
    case 'hero':
      content = `
        ${labelHtml}
        <div style="font-size:72px;font-weight:${s.fontWeight};color:${color};line-height:1.05;letter-spacing:-0.02em;font-family:${font};${shadow};max-width:90%;">${escHtml(s.title)}</div>
        ${subtitleHtml}
      `;
      break;
    case 'content':
    case 'list':
      content = `
        ${labelHtml}
        <div style="font-size:56px;font-weight:${s.fontWeight};color:${color};line-height:1.1;letter-spacing:-0.01em;font-family:${font};${shadow};max-width:90%;">${escHtml(s.title)}</div>
        ${subtitleHtml}
      `;
      break;
    case 'stat':
      content = `
        ${labelHtml}
        <div style="font-size:140px;font-weight:900;line-height:1;font-family:${font};background:linear-gradient(135deg,var(--brand-primary,${color}),var(--brand-secondary,#E84393));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${escHtml(s.stat)}</div>
        <div style="font-size:48px;font-weight:${s.fontWeight};color:${color};line-height:1.15;font-family:${font};${shadow}">${escHtml(s.title)}</div>
        ${subtitleHtml}
      `;
      break;
    case 'quote':
      content = `
        <div style="font-size:120px;color:var(--brand-primary,${color});opacity:0.3;line-height:0.5;font-family:Georgia,serif;">&ldquo;</div>
        <div style="font-size:48px;font-weight:400;font-style:italic;color:${color};line-height:1.35;font-family:Georgia,serif;${shadow};max-width:85%;">${escHtml(s.title)}</div>
        ${s.subtitle ? `<div style="font-size:22px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:var(--brand-accent,${color});font-family:${font};margin-top:24px;">${escHtml(s.subtitle)}</div>` : ''}
      `;
      break;
    case 'cta':
      content = `
        <div style="font-size:56px;font-weight:${s.fontWeight};color:${color};line-height:1.1;font-family:${font};${shadow}">${escHtml(s.title)}</div>
        ${subtitleHtml}
        ${s.label ? `<div style="margin-top:32px;display:inline-block;padding:16px 40px;background:var(--brand-primary,${color});color:#000;border-radius:999px;font-size:20px;font-weight:700;font-family:${font};">${escHtml(s.label)}</div>` : ''}
      `;
      break;
  }

  return `
    ${corners}
    <div style="position:absolute;${pos};display:flex;flex-direction:column;gap:20px;padding:40px;font-family:${font};">
      ${glassOpen}
      ${content}
      ${glassClose}
    </div>
  `;
}

// ── Component ──

export default function VisualEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postIdParam = searchParams?.get('postId');
  const [slides, setSlides] = useState<SlideState[]>([emptySlide(0, 'hero'), emptySlide(1, 'content')]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [brands, setBrands] = useState<any[]>([]);
  const [brandId, setBrandId] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  const [loadingPost, setLoadingPost] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [renderingAll, setRenderingAll] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = slides[activeIdx];
  const activeTemplate = TEMPLATES.find((t) => t.id === active.template)!;

  // ── Load brands ──
  useEffect(() => {
    api.listBrands()
      .then((r: any) => {
        setBrands(r.items || []);
        const def = (r.items || []).find((b: any) => b.isDefault);
        if (def) setBrandId(def.id);
      })
      .catch(() => {});
  }, []);

  // ── Load post ──
  useEffect(() => {
    if (!postIdParam) return;
    setLoadingPost(true);
    api.getPost(postIdParam)
      .then((post: any) => {
        if (!post) return;
        setCurrentPostId(post.id);
        setCaption(post.caption || '');
        setHashtags((post.hashtags || []).join(', '));
        if (post.scheduledAt) setScheduledAt(new Date(post.scheduledAt).toISOString().slice(0, 16));
        if (post.aspectRatio) setAspectRatio(post.aspectRatio as AspectRatio);

        if (post.editorState?.slides?.length) {
          setSlides(post.editorState.slides);
          if (post.editorState.brandId) setBrandId(post.editorState.brandId);
          setMessage('Post carregado no editor');
          setMessageType('success');
          return;
        }

        // Import normal post images as hero slides
        const urls: string[] = [];
        if (post.isCarousel && post.images?.length) urls.push(...post.images.map((i: any) => i.imageUrl));
        else if (post.imageUrl) urls.push(post.imageUrl);

        if (urls.length) {
          setSlides(urls.map((url, i) => ({ ...emptySlide(i, 'hero'), backgroundUrl: url, renderedUrl: url, title: '', subtitle: '', overlayOpacity: 0 })));
          setMessage(`${urls.length} imagem(ns) importadas`);
          setMessageType('success');
        }
      })
      .catch((e: any) => { setMessage(e.message); setMessageType('error'); })
      .finally(() => setLoadingPost(false));
  }, [postIdParam]);

  // ── Helpers ──
  function updateActive(patch: Partial<SlideState>) {
    setSlides((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, ...patch, renderedUrl: undefined } : s)));
  }

  function addSlide(tpl: TemplateId = 'content') {
    const next = [...slides, emptySlide(slides.length, tpl)];
    setSlides(next);
    setActiveIdx(next.length - 1);
  }

  function removeSlide(id: string) {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((s) => s.id !== id));
    setActiveIdx(Math.max(0, activeIdx - 1));
  }

  function changeTemplate(tpl: TemplateId) {
    const t = TEMPLATES.find((x) => x.id === tpl)!;
    updateActive({ template: tpl, position: t.defaultPosition });
  }

  async function handleUploadBg(file: File) {
    setGenLoading('upload');
    try {
      const r = await api.uploadFile(file);
      updateActive({ backgroundUrl: r.fileUrl });
    } catch (e: any) { setMessage(e.message); setMessageType('error'); }
    setGenLoading(null);
  }

  async function handleGenerateBg() {
    if (!active.backgroundPrompt.trim()) { setMessage('Descreva o fundo'); setMessageType('error'); return; }
    setGenLoading('bg');
    try {
      const r = await api.generateImage(active.backgroundPrompt, aspectRatio);
      updateActive({ backgroundUrl: r.imageUrl });
    } catch (e: any) { setMessage(e.message); setMessageType('error'); }
    setGenLoading(null);
  }

  async function handleGenerateContent() {
    if (!caption.trim() && !active.title.trim()) { setMessage('Preencha a legenda ou titulo primeiro'); setMessageType('error'); return; }
    setGenLoading('content');
    try {
      const topic = caption || active.title;
      const r = await api.generateCaption(topic);
      // Simple heuristic: first sentence -> title, rest -> subtitle
      const parts = r.caption.split('.\n');
      updateActive({
        title: parts[0]?.slice(0, 60) || active.title,
        subtitle: parts[1]?.slice(0, 100) || active.subtitle,
      });
    } catch (e: any) { setMessage(e.message); setMessageType('error'); }
    setGenLoading(null);
  }

  async function renderSlide(slide: SlideState): Promise<string> {
    const html = buildSlideHtml(slide);
    const result = await api.generateComposed({
      html,
      backgroundUrl: slide.backgroundUrl || undefined,
      backgroundPrompt: !slide.backgroundUrl ? (slide.backgroundPrompt || slide.title) : undefined,
      aspectRatio,
      overlayOpacity: slide.overlayOpacity,
      brandId: brandId || undefined,
      applyBrand: !!brandId,
    });
    return result.imageUrl;
  }

  async function handleRenderAll() {
    setRenderingAll(true);
    setMessage('');
    try {
      const updated: SlideState[] = [];
      for (const slide of slides) {
        const url = await renderSlide(slide);
        updated.push({ ...slide, renderedUrl: url });
      }
      setSlides(updated);
      setMessage(`${updated.length} slides renderizados!`);
      setMessageType('success');
    } catch (e: any) { setMessage(e.message); setMessageType('error'); }
    setRenderingAll(false);
  }

  async function handleSavePost(action: 'draft' | 'schedule') {
    setSavingPost(true);
    setMessage('');
    try {
      const finalSlides: SlideState[] = [];
      for (const slide of slides) {
        if (slide.renderedUrl) finalSlides.push(slide);
        else { const url = await renderSlide(slide); finalSlides.push({ ...slide, renderedUrl: url }); }
      }
      setSlides(finalSlides);

      const urls = finalSlides.map((s) => s.renderedUrl!).filter(Boolean);
      if (!urls.length) throw new Error('Nenhum slide');

      const editorState = { slides: finalSlides, brandId, aspectRatio };
      const isCarousel = urls.length >= 2;

      if (currentPostId) {
        await api.updatePost(currentPostId, { caption, hashtags: hashtags.split(',').map((h) => h.trim()).filter(Boolean), aspectRatio, editorState, isCarousel, imageUrl: urls[0] });
        if (action === 'schedule' && scheduledAt) await api.schedulePost(currentPostId, new Date(scheduledAt).toISOString());
        setMessage('Post atualizado!');
      } else {
        const payload: Record<string, unknown> = { caption, hashtags: hashtags.split(',').map((h) => h.trim()).filter(Boolean), aspectRatio, editorState };
        if (isCarousel) { payload.isCarousel = true; payload.images = urls.map((u, i) => ({ imageUrl: u, order: i })); }
        else payload.imageUrl = urls[0];
        const post = (await api.createPost(payload)) as any;
        if (action === 'schedule' && scheduledAt) await api.schedulePost(post.id, new Date(scheduledAt).toISOString());
        setMessage(action === 'schedule' ? 'Post agendado!' : 'Rascunho salvo!');
      }
      setMessageType('success');
      setTimeout(() => router.push('/posts'), 1500);
    } catch (e: any) { setMessage(e.message); setMessageType('error'); }
    setSavingPost(false);
  }

  const aspectClass = aspectRatio === '4:5' ? 'aspect-[4/5]' : aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square';

  // ── Render ──
  return (
    <div className="max-w-[1800px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href="/posts" className="text-xs text-text-secondary hover:text-primary inline-flex items-center gap-1 mb-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Voltar
          </Link>
          <h1 className="text-page-title text-text-primary flex items-center gap-3">
            Editor Visual
            {currentPostId && <span className="text-[11px] font-semibold px-2 py-1 rounded-badge bg-primary/10 text-primary">EDITANDO</span>}
            {loadingPost && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-bg-main rounded-lg p-0.5">
            {(['1:1', '4:5', '9:16'] as AspectRatio[]).map((ar) => (
              <button key={ar} onClick={() => setAspectRatio(ar)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${aspectRatio === ar ? 'bg-white text-primary shadow-sm' : 'text-text-muted'}`}
              >{ar}</button>
            ))}
          </div>
          <button onClick={handleRenderAll} disabled={renderingAll} className="btn-ghost text-xs">
            {renderingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            {renderingAll ? 'Renderizando...' : 'Renderizar'}
          </button>
          <button onClick={() => handleSavePost('draft')} disabled={savingPost} className="btn-ghost text-xs">
            <Save className="w-3.5 h-3.5" /> Rascunho
          </button>
          <button onClick={() => handleSavePost('schedule')} disabled={savingPost || !scheduledAt} className="btn-cta text-xs">
            <Save className="w-3.5 h-3.5" /> Agendar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* ── Left: Canvas ── */}
        <div className="col-span-9 space-y-4">
          {/* Slide thumbnails */}
          <div className="card p-4 overflow-x-auto">
            <div className="flex items-start gap-3 min-w-min">
              {slides.map((slide, idx) => (
                <div key={slide.id} onClick={() => setActiveIdx(idx)}
                  className={`relative ${aspectClass} w-40 flex-shrink-0 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                    idx === activeIdx ? 'border-primary shadow-lg scale-105' : 'border-border hover:border-primary/50'
                  }`}
                  style={{ background: slide.backgroundUrl ? `url('${slide.backgroundUrl}') center/cover` : 'linear-gradient(135deg,#1a1a2e,#16213e)' }}
                >
                  <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${slide.overlayOpacity})` }} />
                  <div className="absolute inset-0 flex items-center justify-center p-2 text-center">
                    <div>
                      {slide.stat && <p className="text-white text-sm font-black" style={{ textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>{slide.stat}</p>}
                      <p className="text-white text-[10px] font-bold leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>{slide.title}</p>
                    </div>
                  </div>
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">{idx + 1}</div>
                  {slide.renderedUrl && <div className="absolute top-1 right-1 bg-emerald-500 text-white text-[7px] font-bold px-1 py-0.5 rounded">OK</div>}
                  <button onClick={(e) => { e.stopPropagation(); removeSlide(slide.id); }}
                    className="absolute bottom-1 right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 rounded text-white flex items-center justify-center">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {/* Add new slide dropdown */}
              <div className={`${aspectClass} w-40 flex-shrink-0 rounded-xl border-2 border-dashed border-border hover:border-primary text-text-muted hover:text-primary flex flex-col items-center justify-center gap-1 transition-all cursor-pointer`}
                onClick={() => addSlide('content')}>
                <Plus className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Novo slide</span>
              </div>
            </div>
          </div>

          {/* Big preview */}
          <div className="card p-6">
            <div className={`${aspectClass} w-full max-w-[600px] mx-auto rounded-xl overflow-hidden relative shadow-xl`}
              style={{ background: active.backgroundUrl ? `url('${active.backgroundUrl}') center/cover` : 'linear-gradient(135deg,#1a1a2e,#16213e)' }}
            >
              <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${active.overlayOpacity})` }} />
              {/* Live preview from template */}
              <div className="absolute inset-0" style={{ transform: 'scale(0.556)', transformOrigin: 'top left', width: '1080px', height: '1080px' }}
                dangerouslySetInnerHTML={{ __html: buildSlideHtml(active) }}
              />
            </div>
            <p className="text-center text-xs text-text-muted mt-3">
              Slide {activeIdx + 1} / {slides.length} — {TEMPLATES.find((t) => t.id === active.template)?.name} — {active.renderedUrl ? 'renderizado' : 'preview ao vivo'}
            </p>
          </div>

          {/* Caption */}
          <div className="card p-5 space-y-3">
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={2200} placeholder="Legenda do post..." className="input-field resize-none text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="hashtags (virgula)" className="input-field text-sm" />
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input-field text-sm" />
            </div>
          </div>

          {message && (
            <div className={`px-4 py-3 rounded-btn border text-sm ${messageType === 'success' ? 'bg-emerald-50 border-emerald-200 text-status-published' : 'bg-red-50 border-red-200 text-status-failed'}`}>
              {message}
            </div>
          )}
        </div>

        {/* ── Right: Sidebar ── */}
        <div className="col-span-3 space-y-3 sticky top-4 self-start max-h-[90vh] overflow-y-auto">
          {/* Brand */}
          <div className="card p-4">
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Brand
            </h3>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="input-field text-xs">
              <option value="">Sem brand</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}{b.isDefault ? ' (padrao)' : ''}</option>)}
            </select>
          </div>

          {/* Template selector */}
          <div className="card p-4">
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layout className="w-3.5 h-3.5" /> Template
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => changeTemplate(t.id)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    active.template === t.id ? 'border-primary bg-primary/[0.08] text-primary' : 'border-border bg-white text-text-secondary hover:border-primary/30'
                  }`}>
                  <div className="text-base mb-0.5">{t.icon}</div>
                  <div className="text-[10px] font-bold leading-tight">{t.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Background */}
          <div className="card p-4">
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Imagem de fundo
            </h3>
            {active.backgroundUrl && (
              <div className="relative mb-2">
                <img src={active.backgroundUrl} alt="" className="w-full h-20 object-cover rounded-lg border border-border" />
                <button onClick={() => updateActive({ backgroundUrl: '' })} className="absolute top-1 right-1 w-5 h-5 bg-red-500/90 text-white rounded flex items-center justify-center">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUploadBg(e.target.files[0]); e.target.value = ''; }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={genLoading === 'upload'} className="btn-ghost text-[10px] w-full justify-center py-1.5 mb-2">
              {genLoading === 'upload' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload
            </button>
            <textarea value={active.backgroundPrompt} onChange={(e) => updateActive({ backgroundPrompt: e.target.value })} rows={2} placeholder="Descreva o fundo (so visual, sem texto)" className="input-field text-[11px] resize-none" />
            <button onClick={handleGenerateBg} disabled={genLoading === 'bg' || !active.backgroundPrompt} className="btn-cta text-[10px] w-full justify-center py-1.5 mt-1.5">
              {genLoading === 'bg' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Gerar fundo
            </button>
            <div className="mt-2">
              <label className="text-[10px] font-semibold text-text-muted uppercase">Escurecer: {Math.round(active.overlayOpacity * 100)}%</label>
              <input type="range" min={0} max={1} step={0.05} value={active.overlayOpacity} onChange={(e) => updateActive({ overlayOpacity: Number(e.target.value) })} className="w-full" />
            </div>
          </div>

          {/* Content fields (from template) */}
          <div className="card p-4 space-y-3">
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5" /> Conteudo — {activeTemplate.name}
            </h3>

            {activeTemplate.fields.includes('label') && (
              <div>
                <label className="text-[10px] font-semibold text-text-muted uppercase mb-0.5 block">Rotulo</label>
                <input value={active.label} onChange={(e) => updateActive({ label: e.target.value })} placeholder="Ex: Dica 1, Tutorial, Dados" className="input-field text-xs" />
              </div>
            )}

            {activeTemplate.fields.includes('stat') && (
              <div>
                <label className="text-[10px] font-semibold text-text-muted uppercase mb-0.5 block">Numero / Dado</label>
                <input value={active.stat} onChange={(e) => updateActive({ stat: e.target.value })} placeholder="Ex: +40%, 1.5k, 3x" className="input-field text-xl font-black text-center" />
              </div>
            )}

            {activeTemplate.fields.includes('title') && (
              <div>
                <label className="text-[10px] font-semibold text-text-muted uppercase mb-0.5 block">Titulo</label>
                <textarea value={active.title} onChange={(e) => updateActive({ title: e.target.value })} rows={2} className="input-field text-xs resize-none" />
              </div>
            )}

            {activeTemplate.fields.includes('subtitle') && (
              <div>
                <label className="text-[10px] font-semibold text-text-muted uppercase mb-0.5 block">Subtitulo</label>
                <textarea value={active.subtitle} onChange={(e) => updateActive({ subtitle: e.target.value })} rows={2} className="input-field text-xs resize-none" />
              </div>
            )}

            <button onClick={handleGenerateContent} disabled={genLoading === 'content'} className="btn-ghost text-[10px] w-full justify-center py-1.5">
              {genLoading === 'content' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Gerar conteudo com IA
            </button>

            {/* Glass effect */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" checked={active.glassEffect} onChange={(e) => updateActive({ glassEffect: e.target.checked })} className="w-3.5 h-3.5 rounded text-primary" />
              <span className="text-[10px] text-text-secondary">Glass ao redor do conteudo</span>
            </label>
          </div>

          {/* Position + Style */}
          <div className="card p-4 space-y-3">
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Posicao & Estilo</h3>

            <div className="grid grid-cols-3 gap-1">
              {POSITIONS.map((p) => (
                <button key={p.id} onClick={() => updateActive({ position: p.id })}
                  className={`text-[8px] py-1.5 rounded border ${active.position === p.id ? 'bg-primary text-white border-primary' : 'bg-white border-border text-text-secondary'}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Font */}
            <div className="grid grid-cols-2 gap-1">
              {FONTS.map((f) => (
                <button key={f.id} onClick={() => updateActive({ fontFamily: f.id })} style={{ fontFamily: `'${f.id}'` }}
                  className={`text-[10px] py-1 rounded border font-bold ${active.fontFamily === f.id ? 'bg-primary text-white border-primary' : 'bg-white border-border text-text-secondary'}`}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Weight */}
            <div className="grid grid-cols-5 gap-1">
              {[300, 400, 600, 700, 900].map((w) => (
                <button key={w} onClick={() => updateActive({ fontWeight: w })}
                  className={`text-[10px] py-1 rounded border ${active.fontWeight === w ? 'bg-primary text-white border-primary' : 'bg-white border-border text-text-secondary'}`}>
                  {w}
                </button>
              ))}
            </div>

            {/* Color */}
            <div className="grid grid-cols-5 gap-1.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => updateActive({ titleColor: c })} style={{ background: c }}
                  className={`h-6 rounded border-2 ${active.titleColor === c ? 'border-primary' : 'border-border'}`} title={c} />
              ))}
            </div>
          </div>

          {/* Corners */}
          <div className="card p-4 space-y-2">
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Cantos</h3>
            <div className="grid grid-cols-2 gap-2">
              <input value={active.cornerTopLeft} onChange={(e) => updateActive({ cornerTopLeft: e.target.value })} placeholder="Sup. esq (ex: @user)" className="input-field text-[10px]" />
              <input value={active.cornerTopRight} onChange={(e) => updateActive({ cornerTopRight: e.target.value })} placeholder="Sup. dir (ex: Marca)" className="input-field text-[10px]" />
              <input value={active.cornerBottomLeft} onChange={(e) => updateActive({ cornerBottomLeft: e.target.value })} placeholder="Inf. esq (ex: 1/5)" className="input-field text-[10px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
