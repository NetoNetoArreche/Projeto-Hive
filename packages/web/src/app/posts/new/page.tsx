'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Zap, Image as ImageIcon, Clock, Send, Save, Loader2, X, Heart, MessageCircle, Share, ChevronLeft, ChevronRight, Layers, Plus, Trash2, Upload, FileText, Link as LinkIcon, Wand2, ArrowRight, Sparkles, Instagram, Facebook, Linkedin, Twitter, Palette } from 'lucide-react';

type Platform = 'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'X';

const PLATFORM_OPTIONS: { value: Platform; label: string; icon: typeof Instagram; color: string }[] = [
  { value: 'INSTAGRAM', label: 'Instagram', icon: Instagram, color: 'bg-gradient-to-br from-purple-500 to-pink-500' },
  { value: 'FACEBOOK', label: 'Facebook', icon: Facebook, color: 'bg-blue-600' },
  { value: 'LINKEDIN', label: 'LinkedIn', icon: Linkedin, color: 'bg-sky-700' },
  { value: 'X', label: 'X/Twitter', icon: Twitter, color: 'bg-neutral-800' },
];
import { emptySlide, SlideState, AspectRatio, defaultGlobalStyle } from '../visual-editor/types';
import { useEffect } from 'react';

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1', desc: 'Feed' },
  { value: '4:5', label: '4:5', desc: 'Retrato' },
  { value: '9:16', label: '9:16', desc: 'Stories/Reels' },
];

interface CarouselImage {
  url: string;
  prompt?: string;
}

export default function NewPost() {
  const router = useRouter();
  const [caption, setCaption] = useState('');
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<CarouselImage[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [hashtags, setHashtags] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageCount, setImageCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genProgress, setGenProgress] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [showFullImage, setShowFullImage] = useState(false);
  const [driveLink, setDriveLink] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>(['INSTAGRAM']);
  const [brands, setBrands] = useState<{ id: string; name: string; primaryColor: string; defaultPlatforms: string[] }[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [postFile, setPostFile] = useState({ url: '', name: '' });
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function togglePlatform(p: Platform) {
    setPlatforms((prev) =>
      prev.includes(p) ? (prev.length > 1 ? prev.filter((x) => x !== p) : prev) : [...prev, p],
    );
  }

  useEffect(() => {
    api.listBrands().then((res) => {
      const items = (res.items || []) as any[];
      setBrands(items.map((b) => ({ id: b.id, name: b.name, primaryColor: b.primaryColor, defaultPlatforms: b.defaultPlatforms || ['INSTAGRAM'] })));
      const def = items.find((b: any) => b.isDefault);
      if (def) {
        setSelectedBrandId(def.id);
        setPlatforms((def.defaultPlatforms || ['INSTAGRAM']).filter((p: string) => PLATFORM_OPTIONS.some((o) => o.value === p)) as Platform[]);
      }
    }).catch(() => {});
  }, []);

  async function handleFileUpload(file: File) {
    setFileUploading(true);
    try {
      const result = await api.uploadFile(file);
      setPostFile({ url: result.fileUrl, name: result.fileName });
    } catch (err: any) {
      setMessage(err.message || 'Erro ao enviar arquivo');
      setMessageType('error');
    }
    setFileUploading(false);
  }

  async function handleGenerateImage() {
    if (!prompt) return;
    const remaining = 10 - images.length;
    const count = Math.min(imageCount, remaining);
    if (count <= 0) {
      setMessage('Maximo de 10 imagens por carrossel');
      setMessageType('error');
      return;
    }
    setGenLoading(true);
    setMessage('');
    setGenProgress(count > 1 ? `0/${count} imagens geradas...` : '');

    let generated = 0;
    const newImages: CarouselImage[] = [];

    // Generate images and caption in parallel
    const captionPromise = (async () => {
      // Only auto-generate caption if it's empty (don't overwrite what the user typed)
      if (caption.trim() || hashtags.trim()) return null;
      try {
        return await api.generateCaption(prompt, undefined, selectedBrandId);
      } catch {
        return null;
      }
    })();

    const imagePromises = Array.from({ length: count }, async (_, i) => {
      try {
        const variation = count > 1 ? `${prompt} - variacao ${i + 1} de ${count}` : prompt;
        const result = await api.generateImage(variation, aspectRatio);
        newImages.push({ url: result.imageUrl, prompt: variation });
        generated++;
        if (count > 1) setGenProgress(`${generated}/${count} imagens geradas...`);
      } catch {
        // skip failed
      }
    });

    await Promise.all(imagePromises);

    if (newImages.length > 0) {
      setImages((prev) => [...prev, ...newImages]);
      setActiveImageIndex(images.length + newImages.length - 1);
    } else {
      setMessage('Nenhuma imagem gerada. Tente novamente.');
      setMessageType('error');
    }

    // Apply auto-generated caption if available and field is still empty
    const cap = await captionPromise;
    if (cap && !caption.trim() && !hashtags.trim()) {
      setCaption(cap.caption);
      setHashtags(cap.hashtags.join(', '));
    }

    setGenProgress('');
    setGenLoading(false);
  }

  async function handleGenerateForEditor() {
    if (!prompt) return;
    const count = Math.max(1, Math.min(imageCount, 10));
    setGenLoading(true);
    setMessage('');
    setGenProgress(`Gerando ${count} fundo(s) sem texto...`);

    try {
      // 1. Generate clean backgrounds (no text in the image)
      const bgPrompt = `${prompt}, fundo limpo, sem texto, no text, blank background, minimal composition`;
      const bgUrls: string[] = [];
      let done = 0;
      await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          try {
            const variation = count > 1 ? `${bgPrompt}, variacao ${i + 1}` : bgPrompt;
            const r = await api.generateImage(variation, aspectRatio);
            bgUrls.push(r.imageUrl);
            done++;
            setGenProgress(`${done}/${count} fundos gerados...`);
          } catch {
            // skip failed
          }
        }),
      );

      if (bgUrls.length === 0) {
        setMessage('Nao foi possivel gerar os fundos. Tente novamente.');
        setMessageType('error');
        setGenLoading(false);
        setGenProgress('');
        return;
      }

      // 2. Generate title/subtitle from the topic
      setGenProgress('Gerando titulo e subtitulo...');
      let title = prompt.slice(0, 60);
      let subtitle = '';
      let captionText = '';
      let captionHashtags: string[] = [];
      try {
        const cap = await api.generateCaption(prompt, undefined, selectedBrandId);
        captionText = cap.caption;
        captionHashtags = cap.hashtags;
        const parts = cap.caption.split(/\.\s*\n|\n\n|\n/);
        title = (parts[0] || title).replace(/^[^\w]+|[^\w]+$/g, '').slice(0, 60);
        subtitle = (parts[1] || '').replace(/^[^\w]+|[^\w]+$/g, '').slice(0, 100);
      } catch {
        // fall back to prompt-derived title
      }

      // 3. Build editorState
      const total = bgUrls.length;
      const slides: SlideState[] = bgUrls.map((url, i) => {
        const tpl = i === 0 ? 'hero' : 'content';
        const base = emptySlide(i, tpl);
        return {
          ...base,
          backgroundUrl: url,
          backgroundPrompt: bgPrompt,
          totalSlides: total,
          slideNumber: i + 1,
          title: i === 0 ? title : '',
          subtitle: i === 0 ? subtitle : '',
          label: tpl === 'content' ? `Passo ${i}` : '',
          overlayOpacity: 0.4,
        };
      });

      const editorState = {
        slides,
        aspectRatio,
        globalStyle: defaultGlobalStyle(),
      };

      // 4. Create the post
      setGenProgress('Criando post...');
      const isCarousel = bgUrls.length >= 2;
      const payload: Record<string, unknown> = {
        caption: captionText,
        hashtags: captionHashtags,
        nanoPrompt: prompt,
        aspectRatio,
        editorState,
        mediaType: isCarousel ? 'CAROUSEL' : 'IMAGE',
        imageUrl: bgUrls[0],
        platforms,
      };
      if (selectedBrandId) payload.brandId = selectedBrandId;
      if (isCarousel) {
        payload.isCarousel = true;
        payload.images = bgUrls.map((u, idx) => ({ imageUrl: u, order: idx }));
      }

      const post = (await api.createPost(payload)) as any;

      // 5. Redirect to visual editor
      router.push(`/posts/visual-editor?postId=${post.id}`);
    } catch (err: any) {
      setMessage(err.message || 'Erro ao gerar para o Editor Visual');
      setMessageType('error');
    } finally {
      setGenLoading(false);
      setGenProgress('');
    }
  }

  function handleRemoveImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (activeImageIndex >= images.length - 1) {
      setActiveImageIndex(Math.max(0, images.length - 2));
    }
  }

  async function handleSave(status: 'draft' | 'schedule' | 'publish') {
    setLoading(true);
    setMessage('');
    try {
      const isCarousel = images.length >= 2;
      const payload: Record<string, unknown> = {
        caption,
        hashtags: hashtags.split(',').map((h) => h.trim()).filter(Boolean),
        nanoPrompt: prompt || undefined,
        aspectRatio,
        platforms,
      };

      if (selectedBrandId) payload.brandId = selectedBrandId;

      if (driveLink) payload.driveLink = driveLink;
      if (postFile.url) payload.fileUrl = postFile.url;

      if (isCarousel) {
        payload.isCarousel = true;
        payload.images = images.map((img, idx) => ({
          imageUrl: img.url,
          order: idx,
          prompt: img.prompt,
        }));
      } else if (images.length === 1) {
        payload.imageUrl = images[0].url;
      }

      const post = (await api.createPost(payload)) as any;

      if (status === 'schedule' && scheduledAt) {
        await api.schedulePost(post.id, new Date(scheduledAt).toISOString());
        setMessage('Post agendado com sucesso!');
        setMessageType('success');
      } else if (status === 'publish') {
        await api.publishPost(post.id);
        setMessage('Post publicado com sucesso!');
        setMessageType('success');
      } else {
        setMessage('Rascunho salvo!');
        setMessageType('success');
      }
      setTimeout(() => router.push('/posts'), 1500);
    } catch (err: any) {
      setMessage(err.message || 'Erro ao salvar');
      setMessageType('error');
    }
    setLoading(false);
  }

  const previewAspect = aspectRatio === '4:5' ? 'aspect-[4/5]' : aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square';

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-page-title text-text-primary">Criar Post</h1>
        <p className="text-sm text-text-secondary mt-1">Gere imagens com IA ou abra o Editor Visual para um carrossel completo</p>
      </div>

      {/* Mode Entry — choose between AI generation here or Editor Visual */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="card p-4 border-2 border-primary bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Wand2 className="w-5 h-5 text-primary" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-text-primary">Gerar com IA</h2>
              <p className="text-[11px] text-text-secondary mt-0.5">Prompt + IA gera a imagem inteira (rápido)</p>
            </div>
          </div>
        </div>
        <Link href="/posts/visual-editor" className="card p-4 border-2 border-border hover:border-primary transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-bg-main flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
              <Layers className="w-5 h-5 text-text-secondary group-hover:text-primary transition-colors" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-text-primary">Editor Visual</h2>
              <p className="text-[11px] text-text-secondary mt-0.5">Carrossel editável, templates, brand, IA integrada</p>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-5">
          {/* AI generation */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent-pink/10">
                <Zap className="w-4 h-4 text-primary" strokeWidth={2} />
              </div>
              <h2 className="text-sm font-bold text-text-primary">Gerar Imagem com IA</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Descreva o tema do post... Ex: 'Post sobre produtividade com dicas de organizacao'"
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Quantidade de imagens</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setImageCount(n)}
                      disabled={n + images.length > 10}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        imageCount === n
                          ? 'bg-primary text-white shadow-sm'
                          : n + images.length > 10
                          ? 'bg-bg-main text-text-muted/30 cursor-not-allowed'
                          : 'bg-bg-main text-text-secondary hover:border-primary/50 hover:text-primary'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {imageCount >= 2 && (
                  <p className="text-[10px] text-primary mt-1.5 font-medium flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Vai gerar {imageCount} imagens (carrossel)
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleGenerateImage} disabled={genLoading || !prompt} className="btn-cta justify-center text-xs py-2.5 flex-col h-auto py-3 gap-1">
                  <div className="flex items-center gap-1.5">
                    {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : imageCount >= 2 ? <Layers className="w-4 h-4" strokeWidth={1.5} /> : <Wand2 className="w-4 h-4" strokeWidth={1.5} />}
                    <span className="font-bold">{genLoading ? (genProgress || 'Gerando...') : imageCount >= 2 ? `Imagem Completa (${imageCount})` : 'Imagem Completa'}</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-normal normal-case">IA gera tudo (texto + fundo) • não editável</span>
                </button>
                <button onClick={handleGenerateForEditor} disabled={genLoading || !prompt} className="btn-ghost justify-center text-xs py-2.5 flex-col h-auto py-3 gap-1 border-primary/40 text-primary hover:bg-primary/5">
                  <div className="flex items-center gap-1.5">
                    {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" strokeWidth={1.5} />}
                    <span className="font-bold">{genLoading ? (genProgress || 'Gerando...') : `Para Editor Visual${imageCount >= 2 ? ` (${imageCount})` : ''}`}</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-normal normal-case">Fundo limpo + texto separado • editável</span>
                </button>
              </div>
              <p className="text-[10px] text-text-muted text-center">Legenda + hashtags são geradas automaticamente. Você pode editar abaixo.</p>
              {images.length > 0 && (
                <div className="text-center">
                  <span className="text-xs text-text-muted">
                    {images.length}/10 imagens
                    {images.length === 1 && ' (adicione mais 1 para carrossel)'}
                    {images.length >= 2 && (
                      <span className="inline-flex items-center gap-1 ml-1.5 text-primary font-medium">
                        <Layers className="w-3 h-3" /> carrossel
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="card p-5">
            <label className="block text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Tamanho da imagem</label>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIOS.map((ar) => (
                <button
                  key={ar.value}
                  onClick={() => setAspectRatio(ar.value)}
                  className={`py-3 px-3 rounded-btn text-sm border transition-all duration-200 ${
                    aspectRatio === ar.value
                      ? 'bg-primary/[0.08] border-primary text-primary shadow-sm'
                      : 'bg-bg-card border-border text-text-secondary hover:border-primary/50'
                  }`}
                >
                  <span className="font-bold block">{ar.label}</span>
                  <span className="text-xs opacity-60 block mt-0.5">{ar.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Brand Selector */}
          {brands.length > 1 && (
            <div className="card p-5">
              <label className="block text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Brand</label>
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBrandId(b.id);
                      setPlatforms(b.defaultPlatforms.filter((p) => PLATFORM_OPTIONS.some((o) => o.value === p)) as Platform[]);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-badge text-xs font-semibold border transition-all ${
                      selectedBrandId === b.id
                        ? 'border-transparent text-white shadow-sm'
                        : 'border-border bg-bg-card text-text-secondary hover:border-primary/40'
                    }`}
                    style={selectedBrandId === b.id ? { background: b.primaryColor } : {}}
                  >
                    <Palette className="w-3 h-3" strokeWidth={2} />
                    {b.name}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-text-muted mt-2">Selecionar um brand preenche as plataformas automaticamente</p>
            </div>
          )}

          {/* Platform Selector */}
          <div className="card p-5">
            <label className="block text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Publicar em</label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORM_OPTIONS.map((p) => {
                const active = platforms.includes(p.value);
                const Icon = p.icon;
                return (
                  <button
                    key={p.value}
                    onClick={() => togglePlatform(p.value)}
                    className={`flex items-center gap-2.5 py-2.5 px-3 rounded-btn border transition-all duration-200 ${
                      active
                        ? 'border-primary bg-primary/[0.06] shadow-sm'
                        : 'border-border bg-bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? p.color : 'bg-bg-main'}`}>
                      <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-text-muted'}`} strokeWidth={2} />
                    </div>
                    <span className={`text-xs font-semibold ${active ? 'text-text-primary' : 'text-text-secondary'}`}>{p.label}</span>
                    {active && (
                      <span className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-text-muted mt-2">Selecione pelo menos 1 plataforma. O post será publicado em todas as selecionadas.</p>
          </div>

          {/* Caption */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Legenda</label>
              <span className="text-[11px] text-text-muted tabular-nums">{caption.length}/2200</span>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={2200}
              rows={5}
              placeholder="Escreva a legenda do post..."
              className="input-field resize-none"
            />
          </div>

          {/* Hashtags */}
          <div className="card p-5">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Hashtags</label>
            <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="IA, Tech, Programacao (separadas por virgula)" className="input-field" />
            {hashtags && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {hashtags.split(',').filter(h => h.trim()).map((h, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-badge bg-primary/10 text-primary font-medium">
                    #{h.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="card p-5">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Agendar para</label>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input-field" />
          </div>

          {/* File Upload */}
          <div className="card p-5">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Arquivo</label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp"
              onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); e.target.value = ''; }}
            />
            {postFile.url ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-bg-main border border-border">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={1.5} />
                <a href={postFile.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1">
                  {postFile.name || 'Arquivo'}
                </a>
                <button onClick={() => setPostFile({ url: '', name: '' })} className="p-1 rounded hover:bg-white transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5 text-text-muted" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={fileUploading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-xs font-medium text-text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                {fileUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" strokeWidth={2} />}
                {fileUploading ? 'Enviando...' : 'Anexar arquivo'}
              </button>
            )}
          </div>

          {/* Google Drive Link */}
          <div className="card p-5">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Link do Google Drive</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" strokeWidth={1.5} />
              <input
                type="url"
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="input-field pl-9"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => handleSave('draft')} disabled={loading} className="btn-ghost flex-1 justify-center">
              <Save className="w-4 h-4" strokeWidth={1.5} />
              Rascunho
            </button>
            <button onClick={() => handleSave('schedule')} disabled={loading || !scheduledAt} className="btn-ghost flex-1 justify-center text-status-scheduled border-status-scheduled/30 hover:bg-blue-500/10 hover:text-status-scheduled">
              <Clock className="w-4 h-4" strokeWidth={1.5} />
              Agendar
            </button>
            <button onClick={() => handleSave('publish')} disabled={loading} className="btn-cta flex-1 justify-center">
              <Send className="w-4 h-4" strokeWidth={1.5} />
              Publicar
            </button>
          </div>

          {/* Message */}
          {message && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-btn border animate-slide-up ${
              messageType === 'success'
                ? 'bg-emerald-500/10 border-emerald-200 text-status-published'
                : 'bg-red-500/10 border-red-200 text-status-failed'
            }`}>
              <p className="text-sm font-medium">{message}</p>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="card p-5">
            <p className="text-xs font-semibold text-text-secondary mb-4 uppercase tracking-wider">Preview do Post</p>
            <div className="bg-bg-card rounded-2xl overflow-hidden border border-border">
              {/* Instagram Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-primary to-accent-pink">
                  <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <span className="text-sm font-semibold text-text-primary">instapost.ai</span>
                  <p className="text-[10px] text-text-muted">Patrocinado</p>
                </div>
              </div>

              {/* Image / Carousel */}
              {images.length > 0 ? (
                <div className="relative">
                  <div className={`${previewAspect} max-h-[500px] bg-bg-main flex items-center justify-center overflow-hidden`}>
                    <img
                      src={images[activeImageIndex]?.url}
                      alt={`Imagem ${activeImageIndex + 1}`}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setShowFullImage(true)}
                    />
                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveImage(activeImageIndex)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Carousel navigation */}
                  {images.length > 1 && (
                    <>
                      {activeImageIndex > 0 && (
                        <button
                          onClick={() => setActiveImageIndex((i) => i - 1)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5 text-text-primary" />
                        </button>
                      )}
                      {activeImageIndex < images.length - 1 && (
                        <button
                          onClick={() => setActiveImageIndex((i) => i + 1)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                        >
                          <ChevronRight className="w-5 h-5 text-text-primary" />
                        </button>
                      )}
                      {/* Dots */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveImageIndex(idx)}
                            className={`h-2 rounded-full transition-all ${
                              idx === activeImageIndex ? 'bg-primary w-4' : 'bg-white/60 w-2'
                            }`}
                          />
                        ))}
                      </div>
                      {/* Counter */}
                      <div className="absolute top-3 left-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                        {activeImageIndex + 1}/{images.length}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="py-16 bg-bg-main flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-text-muted">
                    <ImageIcon className="w-10 h-10" strokeWidth={1} />
                    <span className="text-xs">Imagem aparecera aqui</span>
                  </div>
                </div>
              )}

              {/* Instagram Actions */}
              <div className="px-4 py-3 flex gap-4">
                <Heart className="w-6 h-6 text-text-primary" strokeWidth={1.5} />
                <MessageCircle className="w-6 h-6 text-text-primary" strokeWidth={1.5} />
                <Share className="w-6 h-6 text-text-primary" strokeWidth={1.5} />
              </div>

              {/* Caption */}
              <div className="px-4 pb-4">
                <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                  {caption || <span className="text-text-muted">Legenda aparecera aqui...</span>}
                </p>
                {hashtags && (
                  <p className="text-sm text-primary mt-2">
                    {hashtags.split(',').filter(h => h.trim()).map((h) => `#${h.trim()}`).join(' ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Image Modal */}
      {showFullImage && images.length > 0 && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 cursor-pointer modal-backdrop" onClick={() => setShowFullImage(false)}>
          <div className="relative modal-content">
            <img src={images[activeImageIndex]?.url} alt="Full size" className="max-w-full max-h-[85vh] object-contain rounded-card shadow-2xl" />
            <button onClick={() => setShowFullImage(false)} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
