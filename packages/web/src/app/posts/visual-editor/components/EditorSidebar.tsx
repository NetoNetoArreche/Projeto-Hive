'use client';

import { useState, useRef } from 'react';
import {
  SlideState,
  GlobalStyle,
  SavedTemplate,
  TemplateId,
  TEMPLATES,
  FONTS,
  POSITIONS,
  COLORS,
  HIGHLIGHT_COLORS,
  OVERLAY_STYLES,
  BG_PATTERNS,
  CORNER_ICONS,
  FONT_WEIGHTS,
} from '../types';
import { CollapsibleSection } from './CollapsibleSection';
import {
  Type,
  Image,
  Layers,
  PaintBucket,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Download,
  Save,
  Trash2,
  Upload,
  Clipboard,
  X,
  Copy,
  Badge,
  Palette,
  Send,
  Settings2,
  MousePointerClick,
  LayoutGrid,
  Wand2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
} from 'lucide-react';

interface EditorSidebarProps {
  slides: SlideState[];
  activeIdx: number;
  active: SlideState;
  updateActive: (patch: Partial<SlideState>) => void;
  globalStyle: GlobalStyle;
  setGlobalStyle: (gs: GlobalStyle) => void;
  brands: any[];
  brandId: string;
  setBrandId: (id: string) => void;
  brandLogoUrl: string;
  genLoading: string | null;
  handleUploadBg: (file: File) => void;
  handleGenerateBg: () => void;
  handleGenerateContent: () => void;
  handleRenderAll: () => void;
  handleSavePost: (action: 'draft' | 'schedule') => void;
  renderingAll: boolean;
  savingPost: boolean;
  caption: string;
  setCaption: (v: string) => void;
  hashtags: string;
  setHashtags: (v: string) => void;
  scheduledAt: string;
  setScheduledAt: (v: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  copyLayoutToNext: () => void;
  savedTemplates: SavedTemplate[];
  saveTemplate: (name: string) => void;
  deleteTemplate: (id: string) => void;
  loadTemplate: (tpl: SavedTemplate) => void;
  changeTemplate: (tpl: TemplateId) => void;
}

const labelClass = 'text-[10px] font-semibold text-text-muted uppercase';
const btnActive = 'bg-primary text-white border-primary';
const btnInactive = 'bg-bg-card border-border text-text-secondary';

export function EditorSidebar({
  slides,
  activeIdx,
  active,
  updateActive,
  globalStyle,
  setGlobalStyle,
  brands,
  brandId,
  setBrandId,
  brandLogoUrl,
  genLoading,
  handleUploadBg,
  handleGenerateBg,
  handleGenerateContent,
  handleRenderAll,
  handleSavePost,
  renderingAll,
  savingPost,
  caption,
  setCaption,
  hashtags,
  setHashtags,
  scheduledAt,
  setScheduledAt,
  fileInputRef,
  copyLayoutToNext,
  savedTemplates,
  saveTemplate,
  deleteTemplate,
  loadTemplate,
  changeTemplate,
}: EditorSidebarProps) {
  // Local UI state
  const [selectedWordIdx, setSelectedWordIdx] = useState<number | null>(null);
  const [selectedWordSource, setSelectedWordSource] = useState<'title' | 'subtitle'>('title');
  const [templateName, setTemplateName] = useState('');
  const [refinePrompt, setRefinePrompt] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const tplConfig = TEMPLATES.find((t) => t.id === active.template)!;

  // ── Helpers ──

  const titleWords = (active.title || '').split(/\s+/).filter(Boolean);
  const subtitleWords = (active.subtitle || '').split(/\s+/).filter(Boolean);

  const getSelectedHighlight = () => {
    if (selectedWordIdx === null) return null;
    return active.wordHighlights[selectedWordIdx] || {};
  };

  const setHighlightProp = (prop: keyof import('../types').WordFormat, value: any) => {
    if (selectedWordIdx === null) return;
    const current = active.wordHighlights[selectedWordIdx] || {};
    updateActive({
      wordHighlights: {
        ...active.wordHighlights,
        [selectedWordIdx]: { ...current, [prop]: value },
      },
    });
  };

  const handlePasteImage = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'pasted-image.png', { type: imageType });
          handleUploadBg(file);
          return;
        }
      }
    } catch {
      // clipboard read failed
    }
  };

  const handlePasteLogo = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const url = URL.createObjectURL(blob);
          updateActive({ customLogoUrl: url });
          return;
        }
      }
    } catch {
      // clipboard read failed
    }
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateActive({ customLogoUrl: url });
    }
  };

  const setGS = (patch: Partial<GlobalStyle>) => {
    setGlobalStyle({ ...globalStyle, ...patch });
  };

  const applyToAllSlides = (field: string, value: any) => {
    // This simply sets the value on the active slide; the parent can handle "all"
    updateActive({ [field]: value } as any);
  };

  return (
    <div className="fixed right-0 top-0 h-full w-[340px] bg-bg-card border-l border-border flex flex-col z-40 pt-6">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto pb-32 px-4">
        {/* ── 1. Conteudo — Slide N ── */}
        <CollapsibleSection
          title={`Conteudo — Slide ${activeIdx + 1}`}
          icon={<Type className="w-4 h-4" />}
          defaultOpen
        >
          {/* Template selector */}
          <div>
            <span className={labelClass}>TEMPLATE</span>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => changeTemplate(tpl.id)}
                  className={`text-[11px] py-2 px-1 rounded border transition-all ${
                    active.template === tpl.id ? btnActive : btnInactive
                  }`}
                >
                  <span className="block text-sm mb-0.5">{tpl.icon}</span>
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic fields based on template */}
          {tplConfig.fields.includes('label') && (
            <div>
              <span className={labelClass}>ROTULO</span>
              <input
                className="input-field text-xs w-full mt-1"
                value={active.label}
                onChange={(e) => updateActive({ label: e.target.value })}
                placeholder="Ex: Passo 1"
              />
            </div>
          )}

          {tplConfig.fields.includes('stat') && (
            <div>
              <span className={labelClass}>DADO / ESTATISTICA</span>
              <input
                className="input-field text-xs w-full mt-1 text-center text-2xl font-bold"
                value={active.stat}
                onChange={(e) => updateActive({ stat: e.target.value })}
                placeholder="+40%"
              />
            </div>
          )}

          {tplConfig.fields.includes('title') && (
            <div>
              <span className={labelClass}>TITULO</span>
              <textarea
                className="input-field text-xs w-full mt-1 resize-none"
                rows={2}
                value={active.title}
                onChange={(e) => updateActive({ title: e.target.value })}
                placeholder="Titulo principal"
              />
            </div>
          )}

          {tplConfig.fields.includes('subtitle') && (
            <div>
              <span className={labelClass}>SUBTITULO</span>
              <textarea
                className="input-field text-xs w-full mt-1 resize-none"
                rows={2}
                value={active.subtitle}
                onChange={(e) => updateActive({ subtitle: e.target.value })}
                placeholder="Subtitulo ou descricao"
              />
            </div>
          )}

          {/* Generate content with AI */}
          <button
            onClick={handleGenerateContent}
            disabled={genLoading === 'content'}
            className="w-full py-2 px-3 rounded border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {genLoading === 'content' ? 'Gerando...' : 'Gerar conteudo deste slide com IA'}
          </button>

          {/* Divider + Refine */}
          <div className="border-t border-border pt-3">
            <span className={labelClass}>REFINAR SLIDE COM IA</span>
            <textarea
              className="input-field text-xs w-full mt-1.5 resize-none"
              rows={2}
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              placeholder="Ex: Deixe mais curto e direto..."
            />
            <button
              onClick={() => {
                updateActive({ refinePrompt });
                setRefinePrompt('');
              }}
              className="mt-1.5 w-full py-1.5 px-3 rounded border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover transition-all flex items-center justify-center gap-2"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Refinar este slide
            </button>
          </div>
        </CollapsibleSection>

        {/* ── 2. Imagem de Fundo ── */}
        <CollapsibleSection
          title="Imagem de Fundo"
          icon={<Image className="w-4 h-4" />}
          defaultOpen
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadBg(file);
            }}
          />

          {/* Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <Upload className="w-6 h-6 mx-auto mb-2 text-text-muted" />
            <p className="text-xs text-text-muted">Clique ou arraste</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePasteImage}
              className="flex-1 py-1.5 px-2 rounded border border-border text-xs text-text-secondary hover:bg-bg-hover transition-all flex items-center justify-center gap-1.5"
            >
              <Clipboard className="w-3.5 h-3.5" />
              Colar Imagem
            </button>
            <button
              onClick={handleGenerateBg}
              disabled={genLoading === 'bg'}
              className="flex-1 py-1.5 px-2 rounded border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {genLoading === 'bg' ? 'Gerando...' : 'Gerar Imagem com IA'}
            </button>
          </div>

          {/* Background prompt (only if no bg image) */}
          {!active.backgroundUrl && (
            <div>
              <span className={labelClass}>PROMPT DA IMAGEM</span>
              <textarea
                className="input-field text-xs w-full mt-1 resize-none"
                rows={2}
                value={active.backgroundPrompt}
                onChange={(e) => updateActive({ backgroundPrompt: e.target.value })}
                placeholder="Descreva a imagem de fundo desejada..."
              />
            </div>
          )}

          {/* Preview + remove */}
          {active.backgroundUrl && (
            <div className="relative">
              <img
                src={active.backgroundUrl}
                alt="bg preview"
                className="w-full h-20 object-cover rounded border border-border"
              />
              <button
                onClick={() => updateActive({ backgroundUrl: '' })}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Position X */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>POSICAO &#8592;&#8594;</span>
              <span className="text-[10px] text-primary font-semibold">{active.backgroundX}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={active.backgroundX}
              onChange={(e) => updateActive({ backgroundX: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>

          {/* Position Y */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>POSICAO &#8593;&#8595;</span>
              <span className="text-[10px] text-primary font-semibold">{active.backgroundY}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={active.backgroundY}
              onChange={(e) => updateActive({ backgroundY: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>

          {/* Zoom */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>ZOOM %</span>
              <span className="text-[10px] text-primary font-semibold">{active.backgroundZoom}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={300}
              value={active.backgroundZoom}
              onChange={(e) => updateActive({ backgroundZoom: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>

          {/* Flip H */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-[12px] text-text-primary">Espelhar horizontalmente</span>
            <input
              type="checkbox"
              checked={active.backgroundFlipH || false}
              onChange={(e) => updateActive({ backgroundFlipH: e.target.checked })}
              className="w-4 h-4 rounded text-primary accent-primary"
            />
          </label>

          {/* Opacity */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>OPACIDADE %</span>
              <span className="text-[10px] text-primary font-semibold">{active.backgroundOpacity ?? 100}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={active.backgroundOpacity ?? 100}
              onChange={(e) => updateActive({ backgroundOpacity: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>

          {/* Infinite Carousel */}
          <div className="space-y-1.5">
            <button
              onClick={() => updateActive({ infiniteCarousel: !active.infiniteCarousel })}
              className={`w-full py-2 px-3 rounded-lg border text-[12px] font-semibold flex items-center justify-center gap-2 transition-all ${
                active.infiniteCarousel
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-text-secondary hover:border-primary/30'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              {active.infiniteCarousel ? 'Carrossel Infinito (ativo)' : 'Carrossel Infinito'}
            </button>
            {active.infiniteCarousel && (
              <p className="text-[10px] text-text-muted leading-relaxed">
                Metade esquerda neste slide, metade direita no slide {activeIdx + 2}. Use Zoom % para ajustar o tamanho.
              </p>
            )}
          </div>
        </CollapsibleSection>

        {/* ── 3. Sombra / Overlay ── */}
        <CollapsibleSection
          title="Sombra / Overlay"
          icon={<Layers className="w-4 h-4" />}
        >
          {/* Style select */}
          <div>
            <span className={labelClass}>ESTILO</span>
            <select
              className="input-field text-xs w-full mt-1"
              value={active.overlayStyle}
              onChange={(e) => updateActive({ overlayStyle: e.target.value as any })}
            >
              {OVERLAY_STYLES.map((os) => (
                <option key={os.id} value={os.id}>
                  {os.label}
                </option>
              ))}
            </select>
          </div>

          {/* Opacity slider */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>OPACIDADE</span>
              <span className="text-[10px] text-primary font-semibold">
                {Math.round(active.overlayOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(active.overlayOpacity * 100)}
              onChange={(e) => updateActive({ overlayOpacity: Number(e.target.value) / 100 })}
              className="w-full mt-1 accent-primary"
            />
          </div>
        </CollapsibleSection>

        {/* ── 4. Fundo do Slide ── */}
        <CollapsibleSection
          title="Fundo do Slide"
          icon={<PaintBucket className="w-4 h-4" />}
        >
          {/* Background color */}
          <div>
            <span className={labelClass}>COR DE FUNDO</span>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="color"
                value={active.slideBgColor}
                onChange={(e) => updateActive({ slideBgColor: e.target.value })}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
              <input
                className="input-field text-xs flex-1"
                value={active.slideBgColor}
                onChange={(e) => updateActive({ slideBgColor: e.target.value })}
                placeholder="#1a1a2e"
              />
            </div>
          </div>

          {/* Background pattern */}
          <div>
            <span className={labelClass}>PADRAO SOBRE O FUNDO</span>
            <div className="flex flex-col gap-1 mt-1.5">
              {BG_PATTERNS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => updateActive({ slideBgPattern: p.id })}
                  className={`text-left text-xs py-1.5 px-2.5 rounded border transition-all ${
                    active.slideBgPattern === p.id ? btnActive : btnInactive
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </CollapsibleSection>

        {/* ── 5. Titulo & Subtitulo ── */}
        <CollapsibleSection
          title="Titulo & Subtitulo"
          icon={<Type className="w-4 h-4" />}
        >
          {/* Layout / Position grid */}
          <div>
            <span className={labelClass}>LAYOUT & POSICAO</span>
            <div className="grid grid-cols-3 gap-1 mt-1.5">
              {POSITIONS.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => updateActive({ position: pos.id })}
                  className={`text-[10px] py-1.5 px-1 rounded border transition-all ${
                    active.position === pos.id ? btnActive : btnInactive
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text alignment */}
          <div>
            <span className={labelClass}>ALINHAMENTO</span>
            <div className="flex gap-1 mt-1.5">
              {([
                { id: 'left' as const, label: 'ESQ', icon: <AlignLeft className="w-3.5 h-3.5" /> },
                { id: 'center' as const, label: 'CENTRO', icon: <AlignCenter className="w-3.5 h-3.5" /> },
                { id: 'right' as const, label: 'DIR', icon: <AlignRight className="w-3.5 h-3.5" /> },
              ]).map((al) => (
                <button
                  key={al.id}
                  onClick={() => updateActive({ textAlign: al.id })}
                  className={`flex-1 flex items-center justify-center gap-1 text-[10px] py-1.5 rounded border transition-all ${
                    active.textAlign === al.id ? btnActive : btnInactive
                  }`}
                >
                  {al.icon}
                  {al.label}
                </button>
              ))}
            </div>
          </div>

          {/* Glass effect */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={active.glassEffect}
              onChange={(e) => updateActive({ glassEffect: e.target.checked })}
              className="accent-primary"
            />
            <span className="text-xs text-text-secondary">Glass ao redor do conteudo</span>
          </label>

          {/* Global scale */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>ESCALA GLOBAL — {active.globalScale}%</span>
              <span className="text-[10px] text-primary font-semibold">{active.globalScale}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={200}
              value={active.globalScale}
              onChange={(e) => updateActive({ globalScale: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>

          {/* Title font size */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>TITULO — {active.titleFontSize}PX</span>
              <span className="text-[10px] text-primary font-semibold">{active.titleFontSize}px</span>
            </div>
            <input
              type="range"
              min={20}
              max={200}
              value={active.titleFontSize}
              onChange={(e) => updateActive({ titleFontSize: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>

          {/* Title font family */}
          <div>
            <span className={labelClass}>FONTE DO TITULO</span>
            <div className="grid grid-cols-2 gap-1 mt-1.5">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => updateActive({ fontFamily: f.id })}
                  className={`text-xs py-1.5 px-2 rounded border transition-all ${
                    active.fontFamily === f.id ? btnActive : btnInactive
                  }`}
                  style={{ fontFamily: f.id }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title font weight */}
          <div>
            <span className={labelClass}>PESO DA FONTE</span>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {FONT_WEIGHTS.map((w) => (
                <button
                  key={w}
                  onClick={() => updateActive({ fontWeight: w })}
                  className={`text-[10px] py-1 px-2 rounded border transition-all ${
                    active.fontWeight === w ? btnActive : btnInactive
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Title color */}
          <div>
            <span className={labelClass}>COR DO TITULO</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateActive({ titleColor: c })}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    active.titleColor === c ? 'border-primary' : 'border-border'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Title letter spacing */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>ESPACAMENTO TITULO — {active.titleLetterSpacing}</span>
              <span className="text-[10px] text-primary font-semibold">{active.titleLetterSpacing}</span>
            </div>
            <input
              type="range"
              min={-0.1}
              max={0.3}
              step={0.01}
              value={active.titleLetterSpacing}
              onChange={(e) => updateActive({ titleLetterSpacing: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>

          {/* Subtitle font size */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>SUBTITULO — {active.subtitleFontSize}PX</span>
              <span className="text-[10px] text-primary font-semibold">{active.subtitleFontSize}px</span>
            </div>
            <input
              type="range"
              min={12}
              max={100}
              value={active.subtitleFontSize}
              onChange={(e) => updateActive({ subtitleFontSize: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>

          {/* Subtitle font family */}
          <div>
            <span className={labelClass}>FONTE DO SUBTITULO</span>
            <div className="grid grid-cols-2 gap-1 mt-1.5">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => updateActive({ subtitleFontFamily: f.id })}
                  className={`text-xs py-1.5 px-2 rounded border transition-all ${
                    active.subtitleFontFamily === f.id ? btnActive : btnInactive
                  }`}
                  style={{ fontFamily: f.id }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle font weight */}
          <div>
            <span className={labelClass}>PESO DO SUBTITULO</span>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {FONT_WEIGHTS.map((w) => (
                <button
                  key={w}
                  onClick={() => updateActive({ subtitleFontWeight: w })}
                  className={`text-[10px] py-1 px-2 rounded border transition-all ${
                    active.subtitleFontWeight === w ? btnActive : btnInactive
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle color */}
          <div>
            <span className={labelClass}>COR DO SUBTITULO</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateActive({ subtitleColor: c })}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    active.subtitleColor === c ? 'border-primary' : 'border-border'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Subtitle letter spacing */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>ESPACAMENTO SUBTITULO — {active.subtitleLetterSpacing}</span>
              <span className="text-[10px] text-primary font-semibold">{active.subtitleLetterSpacing}</span>
            </div>
            <input
              type="range"
              min={-0.1}
              max={0.3}
              step={0.01}
              value={active.subtitleLetterSpacing}
              onChange={(e) => updateActive({ subtitleLetterSpacing: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>

          {/* Subtitle line height */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>ESPACAMENTO ENTRE LINHAS</span>
              <span className="text-[10px] text-primary font-semibold">{active.subtitleLineHeight}</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={3.0}
              step={0.1}
              value={active.subtitleLineHeight}
              onChange={(e) => updateActive({ subtitleLineHeight: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>
        </CollapsibleSection>

        {/* ── 6. Destaque de Palavra ── */}
        <CollapsibleSection
          title="Destaque de Palavra"
          icon={<Palette className="w-4 h-4" />}
        >
          {/* Title words */}
          <div>
            <span className={labelClass}>TITULO</span>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {titleWords.map((word, i) => {
                const isSelected = selectedWordIdx === i && selectedWordSource === 'title';
                const hl = active.wordHighlights[i];
                return (
                  <button
                    key={`title-${i}`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedWordIdx(null);
                      } else {
                        setSelectedWordIdx(i);
                        setSelectedWordSource('title');
                      }
                    }}
                    className={`text-xs py-1 px-2 rounded border transition-all ${
                      isSelected ? btnActive : hl?.color ? 'border-primary/50 bg-primary/10 text-text-primary' : btnInactive
                    }`}
                    style={hl?.color && !isSelected ? { borderColor: hl.color, color: hl.color } : undefined}
                  >
                    {word}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subtitle words */}
          <div>
            <span className={labelClass}>SUBTITULO</span>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {subtitleWords.map((word, i) => {
                const globalIdx = titleWords.length + i;
                const isSelected = selectedWordIdx === globalIdx && selectedWordSource === 'subtitle';
                const hl = active.wordHighlights[globalIdx];
                return (
                  <button
                    key={`sub-${i}`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedWordIdx(null);
                      } else {
                        setSelectedWordIdx(globalIdx);
                        setSelectedWordSource('subtitle');
                      }
                    }}
                    className={`text-xs py-1 px-2 rounded border transition-all ${
                      isSelected ? btnActive : hl?.color ? 'border-primary/50 bg-primary/10 text-text-primary' : btnInactive
                    }`}
                    style={hl?.color && !isSelected ? { borderColor: hl.color, color: hl.color } : undefined}
                  >
                    {word}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Highlight editing controls */}
          {selectedWordIdx !== null ? (
            <div className="space-y-3 border-t border-border pt-3">
              {/* Color palette */}
              <div>
                <span className={labelClass}>COR DO DESTAQUE</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setHighlightProp('color', c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        getSelectedHighlight()?.color === c ? 'border-primary' : 'border-border'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="color"
                    value={getSelectedHighlight()?.color || '#FFD700'}
                    onChange={(e) => setHighlightProp('color', e.target.value)}
                    className="w-7 h-7 rounded border border-border cursor-pointer"
                  />
                  <input
                    className="input-field text-xs flex-1"
                    value={getSelectedHighlight()?.color || ''}
                    onChange={(e) => setHighlightProp('color', e.target.value)}
                    placeholder="#FFD700"
                  />
                </div>
              </div>

              {/* Formatting toggles */}
              <div>
                <span className={labelClass}>FORMATACAO</span>
                <div className="flex gap-1 mt-1.5">
                  <button
                    onClick={() => setHighlightProp('bold', !getSelectedHighlight()?.bold)}
                    className={`flex-1 py-1.5 rounded border text-xs font-bold transition-all ${
                      getSelectedHighlight()?.bold ? btnActive : btnInactive
                    }`}
                  >
                    <Bold className="w-3.5 h-3.5 mx-auto" />
                  </button>
                  <button
                    onClick={() => setHighlightProp('italic', !getSelectedHighlight()?.italic)}
                    className={`flex-1 py-1.5 rounded border text-xs transition-all ${
                      getSelectedHighlight()?.italic ? btnActive : btnInactive
                    }`}
                  >
                    <Italic className="w-3.5 h-3.5 mx-auto" />
                  </button>
                  <button
                    onClick={() => setHighlightProp('underline', !getSelectedHighlight()?.underline)}
                    className={`flex-1 py-1.5 rounded border text-xs transition-all ${
                      getSelectedHighlight()?.underline ? btnActive : btnInactive
                    }`}
                  >
                    <Underline className="w-3.5 h-3.5 mx-auto" />
                  </button>
                  <button
                    onClick={() => setHighlightProp('strikethrough', !getSelectedHighlight()?.strikethrough)}
                    className={`flex-1 py-1.5 rounded border text-xs transition-all ${
                      getSelectedHighlight()?.strikethrough ? btnActive : btnInactive
                    }`}
                  >
                    <Strikethrough className="w-3.5 h-3.5 mx-auto" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-text-muted italic">Selecione uma palavra acima</p>
          )}

          {/* Copy layout buttons */}
          <div className="flex gap-2 border-t border-border pt-3">
            <button
              onClick={copyLayoutToNext}
              className="flex-1 py-1.5 px-2 rounded border border-border text-xs text-text-secondary hover:bg-bg-hover transition-all flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Aplicar configuracoes no proximo slide
            </button>
          </div>
          <button
            onClick={copyLayoutToNext}
            className="w-full py-1.5 px-2 rounded border border-border text-xs text-text-secondary hover:bg-bg-hover transition-all flex items-center justify-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar layout
          </button>
        </CollapsibleSection>

        {/* ── 7. Badge ou Logo de Perfil ── */}
        <CollapsibleSection
          title="Badge ou Logo de Perfil"
          icon={<Badge className="w-4 h-4" />}
        >
          {/* Show profile badge */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={active.showProfileBadge}
                onChange={(e) => updateActive({ showProfileBadge: e.target.checked })}
                className="accent-primary"
              />
              <span className="text-xs text-text-secondary">
                Exibir — slide {activeIdx + 1}
              </span>
            </label>
            <button
              onClick={() => {
                // Apply to all slides via updating active; parent handles propagation
                updateActive({ showProfileBadge: !active.showProfileBadge });
              }}
              className="text-[10px] py-1 px-2 rounded border border-border text-text-muted hover:bg-bg-hover transition-all"
            >
              Todos
            </button>
          </div>

          {/* Logo / Marca section */}
          <div className="border-t border-border pt-3">
            <span className={labelClass}>LOGO / MARCA (PNG)</span>

            {/* Show logo checkbox */}
            <div className="flex items-center gap-2 mt-2">
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={active.showLogo}
                  onChange={(e) => updateActive({ showLogo: e.target.checked })}
                  className="accent-primary"
                />
                <span className="text-xs text-text-secondary">
                  Exibir logo — slide {activeIdx + 1}
                </span>
              </label>
              <button
                onClick={() => {
                  updateActive({ showLogo: !active.showLogo });
                }}
                className="text-[10px] py-1 px-2 rounded border border-border text-text-muted hover:bg-bg-hover transition-all"
              >
                Todos
              </button>
            </div>

            {/* Logo file input */}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/svg+xml"
              className="hidden"
              onChange={handleLogoFile}
            />

            <div className="flex gap-2 mt-2">
              <div
                onClick={() => logoInputRef.current?.click()}
                className="flex-1 border-2 border-dashed border-border rounded p-3 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <Upload className="w-4 h-4 mx-auto mb-1 text-text-muted" />
                <p className="text-[10px] text-text-muted">Upload logo</p>
              </div>
              <button
                onClick={handlePasteLogo}
                className="py-2 px-3 rounded border border-border text-xs text-text-secondary hover:bg-bg-hover transition-all flex flex-col items-center justify-center gap-1"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span className="text-[10px]">Colar Imagem</span>
              </button>
            </div>

            {/* Logo preview */}
            {active.customLogoUrl && (
              <div className="relative mt-2">
                <img
                  src={active.customLogoUrl}
                  alt="Logo"
                  className="w-12 h-12 object-contain rounded border border-border bg-black/20"
                />
                <button
                  onClick={() => updateActive({ customLogoUrl: '' })}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}

            {/* Logo position */}
            <div className="mt-2">
              <span className={labelClass}>POSICAO DO LOGO</span>
              <div className="flex gap-1 mt-1.5">
                {([
                  { id: '' as const, label: 'Nao' },
                  { id: 'top-left' as const, label: 'S.E' },
                  { id: 'top-right' as const, label: 'S.D' },
                  { id: 'bottom-left' as const, label: 'I.E' },
                  { id: 'bottom-right' as const, label: 'I.D' },
                ] as { id: '' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; label: string }[]).map((lp) => (
                  <button
                    key={lp.id}
                    onClick={() => updateActive({ logoPosition: lp.id })}
                    className={`flex-1 text-[10px] py-1.5 rounded border transition-all ${
                      active.logoPosition === lp.id ? btnActive : btnInactive
                    }`}
                  >
                    {lp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* ── 8. Estilo Global ── */}
        <CollapsibleSection
          title="Estilo Global"
          icon={<Settings2 className="w-4 h-4" />}
          subtitle="— APLICA A TODOS OS SLIDES"
        >
          {/* Corners subsection */}
          <div>
            <span className={labelClass}>CANTOS</span>

            {/* 2x2 corner inputs */}
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {/* Top-left */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateActive({ cornerTopLeftEnabled: !active.cornerTopLeftEnabled })}
                  className={`text-[9px] py-0.5 px-1.5 rounded border transition-all ${
                    active.cornerTopLeftEnabled ? 'bg-primary text-white border-primary' : 'bg-bg-card border-border text-text-muted'
                  }`}
                >
                  {active.cornerTopLeftEnabled ? 'ON' : 'OFF'}
                </button>
                <input
                  className="input-field text-xs flex-1 min-w-0"
                  value={active.cornerTopLeft}
                  onChange={(e) => updateActive({ cornerTopLeft: e.target.value })}
                  placeholder="Sup.Esq"
                />
              </div>

              {/* Top-right */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateActive({ cornerTopRightEnabled: !active.cornerTopRightEnabled })}
                  className={`text-[9px] py-0.5 px-1.5 rounded border transition-all ${
                    active.cornerTopRightEnabled ? 'bg-primary text-white border-primary' : 'bg-bg-card border-border text-text-muted'
                  }`}
                >
                  {active.cornerTopRightEnabled ? 'ON' : 'OFF'}
                </button>
                <input
                  className="input-field text-xs flex-1 min-w-0"
                  value={active.cornerTopRight}
                  onChange={(e) => updateActive({ cornerTopRight: e.target.value })}
                  placeholder="Sup.Dir"
                />
              </div>

              {/* Bottom-left */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateActive({ cornerBottomLeftEnabled: !active.cornerBottomLeftEnabled })}
                  className={`text-[9px] py-0.5 px-1.5 rounded border transition-all ${
                    active.cornerBottomLeftEnabled ? 'bg-primary text-white border-primary' : 'bg-bg-card border-border text-text-muted'
                  }`}
                >
                  {active.cornerBottomLeftEnabled ? 'ON' : 'OFF'}
                </button>
                <input
                  className="input-field text-xs flex-1 min-w-0"
                  value={active.cornerBottomLeft}
                  onChange={(e) => updateActive({ cornerBottomLeft: e.target.value })}
                  placeholder="Inf.Esq"
                />
              </div>

              {/* Bottom-right */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateActive({ cornerBottomRightEnabled: !active.cornerBottomRightEnabled })}
                  className={`text-[9px] py-0.5 px-1.5 rounded border transition-all ${
                    active.cornerBottomRightEnabled ? 'bg-primary text-white border-primary' : 'bg-bg-card border-border text-text-muted'
                  }`}
                >
                  {active.cornerBottomRightEnabled ? 'ON' : 'OFF'}
                </button>
                <input
                  className="input-field text-xs flex-1 min-w-0"
                  value={active.cornerBottomRight}
                  onChange={(e) => updateActive({ cornerBottomRight: e.target.value })}
                  placeholder="Inf.Dir"
                />
              </div>
            </div>
          </div>

          {/* Show corners checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={globalStyle.showCorners}
              onChange={(e) => setGS({ showCorners: e.target.checked })}
              className="accent-primary"
            />
            <span className="text-xs text-text-secondary">Exibir cantos</span>
          </label>

          {/* Show indicators checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={globalStyle.showIndicators}
              onChange={(e) => setGS({ showIndicators: e.target.checked })}
              className="accent-primary"
            />
            <span className="text-xs text-text-secondary">Indicadores de quantidade (bolinhas)</span>
          </label>

          {/* Corner font size */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>TAMANHO DA FONTE</span>
              <span className="text-[10px] text-primary font-semibold">{globalStyle.cornerFontSize}px</span>
            </div>
            <input
              type="range"
              min={10}
              max={40}
              value={globalStyle.cornerFontSize}
              onChange={(e) => setGS({ cornerFontSize: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>

          {/* Corner edge distance */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>DISTANCIA DAS BORDAS</span>
              <span className="text-[10px] text-primary font-semibold">{globalStyle.cornerEdgeDistance}px</span>
            </div>
            <input
              type="range"
              min={20}
              max={120}
              value={globalStyle.cornerEdgeDistance}
              onChange={(e) => setGS({ cornerEdgeDistance: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>

          {/* Corner opacity */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>OPACIDADE</span>
              <span className="text-[10px] text-primary font-semibold">{globalStyle.cornerOpacity}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={globalStyle.cornerOpacity}
              onChange={(e) => setGS({ cornerOpacity: Number(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </div>

          {/* Glass / Border checkboxes */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={globalStyle.cornerGlass}
              onChange={(e) => setGS({ cornerGlass: e.target.checked })}
              className="accent-primary"
            />
            <span className="text-xs text-text-secondary">Estilo glass (glassmorphism)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={globalStyle.cornerBorder}
              onChange={(e) => setGS({ cornerBorder: e.target.checked })}
              className="accent-primary"
            />
            <span className="text-xs text-text-secondary">Borda minimalista</span>
          </label>

          {/* Bottom-right icon */}
          <div>
            <span className={labelClass}>ICONE — CANTO INFERIOR DIREITO</span>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {CORNER_ICONS.map((ci) => (
                <button
                  key={ci.id}
                  onClick={() => setGS({ bottomRightIcon: ci.id })}
                  className={`text-xs py-1.5 px-2.5 rounded border transition-all ${
                    globalStyle.bottomRightIcon === ci.id ? btnActive : btnInactive
                  }`}
                >
                  {ci.label}
                </button>
              ))}
            </div>
          </div>
        </CollapsibleSection>

        {/* ── 9. Botoes / CTAs ── */}
        <CollapsibleSection
          title="Botoes / CTAs"
          icon={<MousePointerClick className="w-4 h-4" />}
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={active.showCTA}
              onChange={(e) => updateActive({ showCTA: e.target.checked })}
              className="accent-primary"
            />
            <span className="text-xs text-text-secondary">Mostrar botoes</span>
          </label>

          {active.showCTA && (
            <div>
              <span className={labelClass}>TEXTO DO BOTAO</span>
              <input
                className="input-field text-xs w-full mt-1"
                value={active.ctaText}
                onChange={(e) => updateActive({ ctaText: e.target.value })}
                placeholder="Saiba mais"
              />
            </div>
          )}
        </CollapsibleSection>

        {/* ── 10. Templates de Estilo ── */}
        <CollapsibleSection
          title="Templates de Estilo"
          icon={<LayoutGrid className="w-4 h-4" />}
        >
          {/* Save template */}
          <div>
            <span className={labelClass}>NOME DO TEMPLATE</span>
            <div className="flex gap-1.5 mt-1">
              <input
                className="input-field text-xs flex-1"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Meu estilo..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && templateName.trim()) {
                    saveTemplate(templateName.trim());
                    setTemplateName('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (templateName.trim()) {
                    saveTemplate(templateName.trim());
                    setTemplateName('');
                  }
                }}
                className="py-1.5 px-2.5 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List saved templates */}
          {savedTemplates.length > 0 ? (
            <div className="space-y-1">
              {savedTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded border border-border hover:bg-bg-hover transition-all"
                >
                  <span className="text-xs text-text-primary flex-1 truncate">{tpl.name}</span>
                  <button
                    onClick={() => loadTemplate(tpl)}
                    className="text-[10px] py-0.5 px-2 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    className="text-text-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-text-muted italic">Nenhum template salvo ainda.</p>
          )}
        </CollapsibleSection>

        {/* ── 11. Publicacao ── */}
        <CollapsibleSection
          title="Publicacao"
          icon={<Send className="w-4 h-4" />}
        >
          {/* Brand selector */}
          {brands.length > 0 && (
            <div>
              <span className={labelClass}>MARCA / PERFIL</span>
              <select
                className="input-field text-xs w-full mt-1"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
              >
                <option value="">Selecione uma marca</option>
                {brands.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>LEGENDA</span>
              <span className="text-[10px] text-text-muted">{caption.length}/2200</span>
            </div>
            <textarea
              className="input-field text-xs w-full mt-1 resize-none"
              rows={4}
              maxLength={2200}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escreva a legenda do post..."
            />
          </div>

          {/* Hashtags */}
          <div>
            <span className={labelClass}>HASHTAGS</span>
            <input
              className="input-field text-xs w-full mt-1"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#marketing #design #conteudo"
            />
          </div>

          {/* Schedule */}
          <div>
            <span className={labelClass}>AGENDAR PARA</span>
            <input
              type="datetime-local"
              className="input-field text-xs w-full mt-1"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        </CollapsibleSection>
      </div>

      {/* ── Bottom actions (sticky) ── */}
      <div className="sticky bottom-0 bg-bg-card border-t border-border p-3 space-y-2">
        {/* Download current slide */}
        <button
          onClick={handleRenderAll}
          disabled={renderingAll}
          className="w-full py-2.5 px-4 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          {renderingAll ? 'Renderizando...' : `Baixar Slide ${activeIdx + 1}`}
        </button>

        {/* Save + Download All row */}
        <div className="flex gap-2">
          <button
            onClick={() => handleSavePost(scheduledAt ? 'schedule' : 'draft')}
            disabled={savingPost}
            className="flex-1 py-2 px-3 rounded-lg border border-border text-text-primary text-sm font-semibold hover:bg-bg-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingPost ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            onClick={handleRenderAll}
            disabled={renderingAll}
            className="flex-1 py-2 px-3 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {renderingAll ? 'Baixando...' : 'Baixar Todos'}
          </button>
        </div>
      </div>
    </div>
  );
}
