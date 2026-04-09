'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Plus, Trash2, Loader2, ChevronLeft } from 'lucide-react';
import {
  SlideState, GlobalStyle, SavedTemplate, AspectRatio, TemplateId,
  TEMPLATES, emptySlide, defaultGlobalStyle,
} from './types';
import { buildSlideHtml, getSafeZone } from './build-slide-html';
import { EditorSidebar } from './components/EditorSidebar';
import { useStyleTemplates } from './hooks/use-style-templates';

export default function VisualEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postIdParam = searchParams?.get('postId');

  // ── State ──
  const [slides, setSlides] = useState<SlideState[]>([emptySlide(0, 'hero'), emptySlide(1, 'content')]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [globalStyle, setGlobalStyle] = useState<GlobalStyle>(defaultGlobalStyle());
  const [brands, setBrands] = useState<any[]>([]);
  const [brandId, setBrandId] = useState('');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [brandName, setBrandName] = useState('');
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

  const { templates: savedTemplates, saveTemplate: saveStyleTemplate, deleteTemplate: deleteStyleTemplate } = useStyleTemplates();

  const active = slides[activeIdx];
  const activeTemplate = TEMPLATES.find((t) => t.id === active.template)!;

  // ── Load brands ──
  useEffect(() => {
    api.listBrands()
      .then((r: any) => {
        const items = r.items || [];
        setBrands(items);
        const def = items.find((b: any) => b.isDefault);
        if (def) { setBrandId(def.id); setBrandLogoUrl(def.logoUrl || ''); setBrandName(def.name || ''); }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const brand = brands.find((b) => b.id === brandId);
    setBrandLogoUrl(brand?.logoUrl || '');
    setBrandName(brand?.name || '');
  }, [brandId, brands]);

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
          if (post.editorState.globalStyle) setGlobalStyle(post.editorState.globalStyle);
          if (post.editorState.aspectRatio) setAspectRatio(post.editorState.aspectRatio as AspectRatio);
          setMessage('Post carregado no editor');
          setMessageType('success');
          return;
        }
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

  function copyLayoutToNext() {
    if (activeIdx >= slides.length - 1) return;
    const { id, title, subtitle, label, stat, backgroundUrl, backgroundPrompt, renderedUrl, refinePrompt, wordHighlights, ...style } = active;
    setSlides((prev) => prev.map((s, i) => (i === activeIdx + 1 ? { ...s, ...style, renderedUrl: undefined } : s)));
    setMessage('Layout copiado para o proximo slide');
    setMessageType('success');
  }

  function loadTemplate(tpl: SavedTemplate) {
    updateActive(tpl.style);
    setMessage(`Template "${tpl.name}" aplicado`);
    setMessageType('success');
  }

  function handleSaveTemplate(name: string) {
    const { id, title, subtitle, label, stat, backgroundUrl, backgroundPrompt, renderedUrl, refinePrompt, wordHighlights, ...style } = active;
    saveStyleTemplate(name, style);
    setMessage(`Template "${name}" salvo`);
    setMessageType('success');
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
      const parts = r.caption.split('.\n');
      updateActive({ title: parts[0]?.slice(0, 60) || active.title, subtitle: parts[1]?.slice(0, 100) || active.subtitle });
    } catch (e: any) { setMessage(e.message); setMessageType('error'); }
    setGenLoading(null);
  }

  function resolveBackground(slide: SlideState, idx: number, allSlides: SlideState[]): { url: string; posX: string; posY: string; size: string; opacity: number; flip: boolean } {
    const prevSlide = idx > 0 ? allSlides[idx - 1] : null;
    const isInfiniteLeft = slide.infiniteCarousel && slide.backgroundUrl;
    const isInfiniteRight = prevSlide?.infiniteCarousel && prevSlide?.backgroundUrl;

    if (isInfiniteLeft) {
      return {
        url: slide.backgroundUrl,
        posX: 'left', posY: `${slide.backgroundY ?? 50}%`,
        size: '200% auto',
        opacity: (slide.backgroundOpacity ?? 100) / 100,
        flip: slide.backgroundFlipH || false,
      };
    }
    if (isInfiniteRight) {
      return {
        url: prevSlide!.backgroundUrl,
        posX: 'right', posY: `${prevSlide!.backgroundY ?? 50}%`,
        size: '200% auto',
        opacity: (prevSlide!.backgroundOpacity ?? 100) / 100,
        flip: prevSlide!.backgroundFlipH || false,
      };
    }
    return {
      url: slide.backgroundUrl,
      posX: `${slide.backgroundX ?? 50}%`, posY: `${slide.backgroundY ?? 50}%`,
      size: `auto ${slide.backgroundZoom ?? 100}%`,
      opacity: (slide.backgroundOpacity ?? 100) / 100,
      flip: slide.backgroundFlipH || false,
    };
  }

  async function renderSlide(slide: SlideState, idx: number, allSlides: SlideState[]): Promise<string> {
    const contentHtml = buildSlideHtml(slide, { aspectRatio, brandLogoUrl, brandName, globalStyle });
    const bg = resolveBackground(slide, idx, allSlides);

    // Build background as part of the HTML so we control position/zoom/flip/opacity
    const bgHtml = bg.url
      ? `<div style="position:absolute;inset:0;background-image:url('${bg.url}');background-position:${bg.posX} ${bg.posY};background-size:${bg.size};background-repeat:no-repeat;opacity:${bg.opacity};${bg.flip ? 'transform:scaleX(-1);' : ''}z-index:0;"></div>`
      : '';

    // Overlay
    const overlayStyle = slide.overlayStyle || 'base';
    const overlayBg = overlayStyle === 'gradient'
      ? `linear-gradient(to bottom, transparent 20%, rgba(0,0,0,${slide.overlayOpacity}))`
      : overlayStyle === 'vignette'
      ? `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${slide.overlayOpacity}) 100%)`
      : `rgba(0,0,0,${slide.overlayOpacity})`;
    const overlayHtml = `<div style="position:absolute;inset:0;background:${overlayBg};z-index:1;"></div>`;

    // Slide bg color
    const slideBgColor = slide.slideBgColor || '#000000';

    // Full HTML with bg baked in — pass NO backgroundUrl to API so it doesn't add its own
    const fullHtml = `<div style="position:absolute;inset:0;background:${slideBgColor};">${bgHtml}${overlayHtml}</div><div style="position:absolute;inset:0;z-index:2;">${contentHtml}</div>`;

    const result = await api.generateComposed({
      html: fullHtml,
      // Background is baked into the HTML — no separate backgroundUrl needed
      aspectRatio,
      overlayOpacity: 0,
      brandId: brandId || undefined,
      applyBrand: !!brandId,
    });
    return result.imageUrl;
  }

  async function handleRenderAll() {
    setRenderingAll(true);
    setMessage('');
    try {
      const total = slides.length;
      const allSlides = slides.map((s, i) => ({ ...s, slideNumber: i + 1, totalSlides: total }));
      const updated: SlideState[] = [];
      for (let i = 0; i < allSlides.length; i++) {
        const url = await renderSlide(allSlides[i], i, allSlides);
        updated.push({ ...allSlides[i], renderedUrl: url });
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
      const total = slides.length;

      // Prepare all slides first so resolveBackground can see neighbors
      const allSlides = slides.map((s, i) => ({ ...s, slideNumber: i + 1, totalSlides: total }));

      // Render all slides that don't have a renderedUrl yet
      setMessage('Renderizando slides...');
      const finalSlides: SlideState[] = [];
      for (let i = 0; i < allSlides.length; i++) {
        const slide = allSlides[i];
        if (slide.renderedUrl) {
          finalSlides.push(slide);
        } else {
          setMessage(`Renderizando slide ${i + 1} de ${total}...`);
          try {
            const url = await renderSlide(slide, i, allSlides);
            finalSlides.push({ ...slide, renderedUrl: url });
          } catch {
            finalSlides.push(slide);
          }
        }
      }
      setSlides(finalSlides);

      const editorState = { slides: finalSlides, brandId, aspectRatio, globalStyle };
      const hashtagList = hashtags.split(',').map((h) => h.trim()).filter(Boolean);

      // Use rendered images (composed with text/overlay), fallback to background
      const slideImages = finalSlides.map((s) => s.renderedUrl || s.backgroundUrl || '');
      const coverUrl = slideImages.find((u) => u) || '';
      const validImages = slideImages.filter((u) => u);
      const isCarousel = finalSlides.length >= 2;

      if (currentPostId) {
        const updatePayload: Record<string, unknown> = {
          caption,
          hashtags: hashtagList,
          aspectRatio,
          editorState,
          isCarousel,
          mediaType: isCarousel ? 'CAROUSEL' : 'IMAGE',
        };
        if (coverUrl) updatePayload.imageUrl = coverUrl;
        if (isCarousel && validImages.length >= 2) {
          updatePayload.images = validImages.map((u, i) => ({ imageUrl: u, order: i }));
        }
        if (action === 'schedule' && scheduledAt) {
          updatePayload.scheduledAt = new Date(scheduledAt).toISOString();
        }
        await api.updatePost(currentPostId, updatePayload);
        setMessage(action === 'schedule' ? 'Post agendado!' : 'Post salvo!');
      } else {
        const payload: Record<string, unknown> = {
          caption,
          hashtags: hashtagList,
          aspectRatio,
          editorState,
          mediaType: isCarousel ? 'CAROUSEL' : 'IMAGE',
        };
        if (coverUrl) payload.imageUrl = coverUrl;
        if (isCarousel && validImages.length >= 2) {
          payload.isCarousel = true;
          payload.images = validImages.map((u, i) => ({ imageUrl: u, order: i }));
        }
        const post = (await api.createPost(payload)) as any;
        setCurrentPostId(post.id);
        window.history.replaceState(null, '', `/posts/visual-editor?postId=${post.id}`);
        if (action === 'schedule' && scheduledAt) {
          await api.schedulePost(post.id, new Date(scheduledAt).toISOString());
        }
        setMessage(action === 'schedule' ? 'Post agendado!' : 'Rascunho salvo!');
      }
      setMessageType('success');
    } catch (e: any) { setMessage(e.message); setMessageType('error'); }
    setSavingPost(false);
  }

  const aspectClass = aspectRatio === '4:5' ? 'aspect-[4/5]' : aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square';

  // ── Render ──
  return (
    <div className="animate-fade-in">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleUploadBg(e.target.files[0]); e.target.value = ''; }} />

      {/* ── Right Sidebar ── */}
      <EditorSidebar
        slides={slides}
        activeIdx={activeIdx}
        active={active}
        updateActive={updateActive}
        globalStyle={globalStyle}
        setGlobalStyle={setGlobalStyle}
        brands={brands}
        brandId={brandId}
        setBrandId={setBrandId}
        brandLogoUrl={brandLogoUrl}
        genLoading={genLoading}
        handleUploadBg={handleUploadBg}
        handleGenerateBg={handleGenerateBg}
        handleGenerateContent={handleGenerateContent}
        handleRenderAll={handleRenderAll}
        handleSavePost={handleSavePost}
        renderingAll={renderingAll}
        savingPost={savingPost}
        caption={caption}
        setCaption={setCaption}
        hashtags={hashtags}
        setHashtags={setHashtags}
        scheduledAt={scheduledAt}
        setScheduledAt={setScheduledAt}
        fileInputRef={fileInputRef}
        copyLayoutToNext={copyLayoutToNext}
        savedTemplates={savedTemplates}
        saveTemplate={handleSaveTemplate}
        deleteTemplate={deleteStyleTemplate}
        loadTemplate={loadTemplate}
        changeTemplate={changeTemplate}
      />

      {/* ── Canvas Area ── */}
      <div className="mr-[340px] flex flex-col" style={{ height: 'calc(100vh - 2rem)' }}>
        {/* Header bar */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/posts" className="text-xs text-text-secondary hover:text-primary inline-flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> Voltar
            </Link>
            <h1 className="text-[20px] font-bold text-text-primary flex items-center gap-2">
              Editor Visual
              {currentPostId && <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">EDITANDO</span>}
              {loadingPost && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Formato */}
            <div className="flex items-center gap-1 text-[11px] text-text-muted font-semibold">
              <div className="flex items-center bg-bg-main rounded-lg p-0.5">
                {(['1:1', '4:5', '9:16'] as AspectRatio[]).map((ar) => (
                  <button key={ar} onClick={() => setAspectRatio(ar)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${aspectRatio === ar ? 'bg-bg-card text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                  >{ar}</button>
                ))}
              </div>
            </div>
            {/* Slide navigation */}
            <div className="flex items-center gap-2 text-[12px] text-text-secondary font-semibold">
              <button onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))} disabled={activeIdx === 0}
                className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-bg-card-hover disabled:opacity-30 transition-all">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span>Slide <span className="text-text-primary">{activeIdx + 1}</span> de {slides.length}</span>
              <button onClick={() => setActiveIdx(Math.min(slides.length - 1, activeIdx + 1))} disabled={activeIdx >= slides.length - 1}
                className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-bg-card-hover disabled:opacity-30 transition-all rotate-180">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => addSlide('content')}
                className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary hover:text-primary transition-all text-text-muted">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Slides horizontal strip — all slides side by side, height-driven */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex items-stretch gap-5 h-full min-w-min py-2 px-1">
            {slides.map((slide, idx) => {
              const isActive = idx === activeIdx;
              const previewH = aspectRatio === '9:16' ? '1920px' : aspectRatio === '4:5' ? '1350px' : '1080px';

              // Resolve background (handles infinite carousel)
              const bg = resolveBackground(slide, idx, slides);

              return (
                <div key={slide.id} onClick={() => setActiveIdx(idx)}
                  className={`flex-shrink-0 h-full cursor-pointer transition-all duration-200 ${isActive ? '' : 'opacity-60 hover:opacity-85'}`}
                  style={{ aspectRatio: aspectRatio === '9:16' ? '9/16' : aspectRatio === '4:5' ? '4/5' : '1/1' }}
                >
                  {/* Slide card */}
                  <div className={`w-full h-full rounded-xl overflow-hidden relative shadow-lg border-2 transition-all ${
                    isActive ? 'border-primary shadow-primary/20' : 'border-transparent hover:border-border'
                  }`}
                    style={{ backgroundColor: slide.slideBgColor || '#000000' }}
                  >
                    {/* Background image layer */}
                    {bg.url && (
                      <div className="absolute inset-0" style={{
                        backgroundImage: `url('${bg.url}')`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: `${bg.posX} ${bg.posY}`,
                        backgroundSize: bg.size,
                        opacity: bg.opacity,
                        transform: bg.flip ? 'scaleX(-1)' : undefined,
                      }} />
                    )}
                    {/* Overlay */}
                    <div className="absolute inset-0" style={{
                      background: slide.overlayStyle === 'gradient'
                        ? `linear-gradient(to bottom, transparent 20%, rgba(0,0,0,${slide.overlayOpacity}))`
                        : slide.overlayStyle === 'vignette'
                        ? `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${slide.overlayOpacity}) 100%)`
                        : `rgba(0,0,0,${slide.overlayOpacity})`
                    }} />

                    {/* Live preview: 1080px source scaled to fit via ResizeObserver */}
                    <div className="absolute inset-0 overflow-hidden"
                      ref={(container) => {
                        if (!container) return;
                        const inner = container.firstElementChild as HTMLElement;
                        if (!inner) return;
                        const update = () => {
                          const s = container.offsetWidth / 1080;
                          inner.style.transform = `scale(${s})`;
                        };
                        update();
                        const ro = new ResizeObserver(update);
                        ro.observe(container);
                        (container as any)._ro?.disconnect();
                        (container as any)._ro = ro;
                      }}
                    >
                      <div style={{
                          width: '1080px',
                          height: previewH,
                          transformOrigin: 'top left',
                        }}
                        dangerouslySetInnerHTML={{ __html: buildSlideHtml(
                          { ...slide, slideNumber: idx + 1, totalSlides: slides.length },
                          { aspectRatio, brandLogoUrl, brandName, globalStyle }
                        ) }}
                      />
                    </div>

                    {/* Slide number badge */}
                    <div className={`absolute top-3 left-3 px-2 py-1 rounded-md text-[11px] font-bold ${
                      isActive ? 'bg-primary text-white' : 'bg-black/50 text-white'
                    }`}>
                      {idx + 1}
                    </div>

                    {/* Rendered badge */}
                    {slide.renderedUrl && (
                      <div className="absolute top-3 right-10 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">OK</div>
                    )}

                    {/* Delete button */}
                    {slides.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); removeSlide(slide.id); }}
                        className="absolute top-3 right-3 w-6 h-6 bg-black/50 hover:bg-red-500 rounded-md text-white flex items-center justify-center transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add slide button */}
            <div className="flex-shrink-0 h-full"
              style={{ aspectRatio: aspectRatio === '9:16' ? '9/16' : aspectRatio === '4:5' ? '4/5' : '1/1' }}>
              <div className="w-full h-full rounded-xl border-2 border-dashed border-border hover:border-primary text-text-muted hover:text-primary flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
                onClick={() => addSlide('content')}>
                <Plus className="w-8 h-8" />
                <span className="text-sm font-semibold">Novo slide</span>
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mt-2 px-4 py-2 rounded-lg border text-sm flex-shrink-0 ${messageType === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-status-published' : 'bg-red-500/10 border-red-500/20 text-status-failed'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
