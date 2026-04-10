// ── Aspect Ratios ──
export type AspectRatio = '1:1' | '4:5' | '9:16';

// ── Templates ──
export type TemplateId = 'hero' | 'content' | 'stat' | 'quote' | 'cta' | 'list';

export type Position = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type OverlayStyle = 'base' | 'gradient' | 'vignette';

export type BgPattern = 'none' | 'grid' | 'dots' | 'h-lines' | 'v-lines' | 'd-lines' | 'd-lines-rev' | 'checkerboard' | 'triangles' | 'hexagons' | 'crosses' | 'zigzag' | 'waves' | 'diamonds' | 'stars';

export type CornerIcon = 'none' | 'bookmark' | 'arrow' | 'heart' | 'share' | 'chat' | 'sparkle';

// ── Word Highlight ──
export interface WordFormat {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

// ── Slide State ──
export interface SlideState {
  id: string;
  template: TemplateId;

  // Background image
  backgroundUrl: string;
  backgroundPrompt: string;
  backgroundX: number;
  backgroundY: number;
  backgroundZoom: number;
  backgroundOpacity: number;
  backgroundFlipH: boolean;
  infiniteCarousel: boolean;

  // Overlay
  overlayOpacity: number;
  overlayStyle: OverlayStyle;

  // Slide background (behind image)
  slideBgColor: string;
  slideBgPattern: BgPattern;
  slideBgPatternSize: number;
  slideBgPatternOpacity: number;

  // Content fields
  label: string;
  title: string;
  subtitle: string;
  stat: string;

  // Position & Alignment
  position: Position;
  textAlign: 'left' | 'center' | 'right';

  // Title style
  fontFamily: string;
  fontWeight: number;
  titleColor: string;
  titleFontSize: number;
  titleLetterSpacing: number;

  // Subtitle style (separate)
  subtitleFontFamily: string;
  subtitleFontWeight: number;
  subtitleColor: string;
  subtitleFontSize: number;
  subtitleLetterSpacing: number;
  subtitleLineHeight: number;

  // Global scale
  globalScale: number;

  // Glass
  glassEffect: boolean;

  // Corners
  cornerTopLeft: string;
  cornerTopRight: string;
  cornerBottomLeft: string;
  cornerBottomRight: string;
  cornerTopLeftEnabled: boolean;
  cornerTopRightEnabled: boolean;
  cornerBottomLeftEnabled: boolean;
  cornerBottomRightEnabled: boolean;

  // Logo
  logoPosition: '' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  customLogoUrl: string;
  showLogo: boolean;
  logoSize: number;
  showProfileBadge: boolean;

  // Indicators
  showIndicators: boolean;
  totalSlides: number;
  slideNumber: number;

  // CTA
  showCTA: boolean;
  ctaText: string;

  // Word highlights
  wordHighlights: Record<number, WordFormat>;

  // Refine
  refinePrompt: string;

  // Rendered result
  renderedUrl?: string;
}

// ── Global Style (shared across all slides) ──
export interface GlobalStyle {
  showCorners: boolean;
  showIndicators: boolean;
  cornerFontSize: number;
  cornerEdgeDistance: number;
  cornerOpacity: number;
  cornerGlass: boolean;
  cornerBorder: boolean;
  bottomRightIcon: CornerIcon;
}

// ── Saved Template ──
export interface SavedTemplate {
  id: string;
  name: string;
  style: Partial<SlideState>;
  createdAt: string;
}

// ── Template Config ──
export interface TemplateConfig {
  id: TemplateId;
  name: string;
  desc: string;
  icon: string;
  fields: ('label' | 'title' | 'subtitle' | 'stat')[];
  defaultPosition: Position;
}

// ── Constants ──

export const TEMPLATES: TemplateConfig[] = [
  { id: 'hero', name: 'Capa / Hook', desc: 'Titulo grande de impacto', icon: 'crosshair', fields: ['title', 'subtitle'], defaultPosition: 'bottom-left' },
  { id: 'content', name: 'Conteudo', desc: 'Rotulo + titulo + subtitulo', icon: 'file-text', fields: ['label', 'title', 'subtitle'], defaultPosition: 'middle-center' },
  { id: 'stat', name: 'Dado / Stat', desc: 'Numero em destaque + contexto', icon: 'bar-chart-3', fields: ['stat', 'title', 'subtitle'], defaultPosition: 'middle-center' },
  { id: 'quote', name: 'Citacao', desc: 'Frase em italico + autor', icon: 'message-circle', fields: ['title', 'subtitle'], defaultPosition: 'middle-center' },
  { id: 'cta', name: 'CTA Final', desc: 'Chamada pra acao + handle', icon: 'rocket', fields: ['title', 'subtitle', 'label'], defaultPosition: 'middle-center' },
  { id: 'list', name: 'Lista / Steps', desc: 'Rotulo + titulo + subtitulo longo', icon: 'list', fields: ['label', 'title', 'subtitle'], defaultPosition: 'middle-left' },
];

export const FONTS = [
  // Sans-serif
  { id: 'Inter', label: 'Inter' },
  { id: 'Roboto', label: 'Roboto' },
  { id: 'Open Sans', label: 'Open Sans' },
  { id: 'Montserrat', label: 'Montserrat' },
  { id: 'Poppins', label: 'Poppins' },
  { id: 'Outfit', label: 'Outfit' },
  { id: 'Nunito', label: 'Nunito' },
  { id: 'Raleway', label: 'Raleway' },
  { id: 'Lato', label: 'Lato' },
  { id: 'DM Sans', label: 'DM Sans' },
  { id: 'Manrope', label: 'Manrope' },
  { id: 'Urbanist', label: 'Urbanist' },
  { id: 'Sora', label: 'Sora' },
  { id: 'Syne', label: 'Syne' },
  { id: 'Plus Jakarta Sans', label: 'Jakarta Sans' },
  { id: 'Space Grotesk', label: 'Space Grotesk' },
  { id: 'Albert Sans', label: 'Albert Sans' },
  { id: 'Figtree', label: 'Figtree' },
  { id: 'Quicksand', label: 'Quicksand' },
  { id: 'Rubik', label: 'Rubik' },
  { id: 'Work Sans', label: 'Work Sans' },
  { id: 'Barlow', label: 'Barlow' },
  { id: 'Josefin Sans', label: 'Josefin Sans' },
  { id: 'Lexend', label: 'Lexend' },
  { id: 'Archivo', label: 'Archivo' },
  { id: 'Mulish', label: 'Mulish' },
  { id: 'Karla', label: 'Karla' },
  { id: 'Exo 2', label: 'Exo 2' },
  { id: 'Titillium Web', label: 'Titillium Web' },
  { id: 'Source Sans 3', label: 'Source Sans' },
  // Serif
  { id: 'Playfair Display', label: 'Playfair Display' },
  { id: 'Lora', label: 'Lora' },
  { id: 'Merriweather', label: 'Merriweather' },
  { id: 'PT Serif', label: 'PT Serif' },
  { id: 'Cormorant Garamond', label: 'Cormorant' },
  { id: 'Libre Baskerville', label: 'Libre Baskerville' },
  { id: 'EB Garamond', label: 'EB Garamond' },
  { id: 'Crimson Text', label: 'Crimson Text' },
  { id: 'Noto Serif', label: 'Noto Serif' },
  // Display
  { id: 'Bebas Neue', label: 'Bebas Neue' },
  { id: 'Oswald', label: 'Oswald' },
  { id: 'Anton', label: 'Anton' },
  { id: 'Righteous', label: 'Righteous' },
  { id: 'Abril Fatface', label: 'Abril Fatface' },
  { id: 'Alfa Slab One', label: 'Alfa Slab One' },
  { id: 'Bungee', label: 'Bungee' },
  { id: 'Fredoka', label: 'Fredoka' },
  { id: 'Permanent Marker', label: 'Permanent Marker' },
  { id: 'Staatliches', label: 'Staatliches' },
  // Handwriting / Script
  { id: 'Caveat', label: 'Caveat' },
  { id: 'Pacifico', label: 'Pacifico' },
  { id: 'Dancing Script', label: 'Dancing Script' },
  { id: 'Satisfy', label: 'Satisfy' },
  { id: 'Sacramento', label: 'Sacramento' },
  { id: 'Great Vibes', label: 'Great Vibes' },
  { id: 'Kalam', label: 'Kalam' },
  // Monospace
  { id: 'Fira Code', label: 'Fira Code' },
  { id: 'JetBrains Mono', label: 'JetBrains Mono' },
  { id: 'Space Mono', label: 'Space Mono' },
  { id: 'IBM Plex Mono', label: 'IBM Plex Mono' },
];

export const POSITIONS: { id: Position; label: string; icon?: string }[] = [
  { id: 'top-left', label: 'Sup.Esq' }, { id: 'top-center', label: 'Sup.Centro' }, { id: 'top-right', label: 'Sup.Dir' },
  { id: 'middle-left', label: 'Meio Esq' }, { id: 'middle-center', label: 'Meio' }, { id: 'middle-right', label: 'Meio Dir' },
  { id: 'bottom-left', label: 'Inf.Esq' }, { id: 'bottom-center', label: 'Inf.Centro' }, { id: 'bottom-right', label: 'Inf.Dir' },
];

export const COLORS = [
  '#ffffff', '#e0e0e0', '#333333', '#FFD700', '#EF4444',
  '#3B82F6', '#22C55E', '#F97316', '#A855F7', '#EC4899',
  '#14B8A6', '#000000',
];

export const HIGHLIGHT_COLORS = [
  '#FFD700', '#EF4444', '#3B82F6', '#22C55E',
  '#F97316', '#A855F7', '#EC4899', '#14B8A6',
];

export const OVERLAY_STYLES: { id: OverlayStyle; label: string }[] = [
  { id: 'base', label: 'Base' },
  { id: 'gradient', label: 'Gradiente' },
  { id: 'vignette', label: 'Vinheta' },
];

export const BG_PATTERNS: { id: BgPattern; label: string }[] = [
  { id: 'none', label: 'Nenhum' },
  { id: 'grid', label: 'Grade' },
  { id: 'dots', label: 'Bolinhas' },
  { id: 'h-lines', label: 'Linhas horizontais' },
  { id: 'v-lines', label: 'Linhas verticais' },
  { id: 'd-lines', label: 'Diagonais /' },
  { id: 'd-lines-rev', label: 'Diagonais \\' },
  { id: 'checkerboard', label: 'Xadrez' },
  { id: 'triangles', label: 'Triangulos' },
  { id: 'hexagons', label: 'Hexagonos' },
  { id: 'crosses', label: 'Cruzes +' },
  { id: 'zigzag', label: 'Zigzag' },
  { id: 'waves', label: 'Ondas' },
  { id: 'diamonds', label: 'Losangos' },
  { id: 'stars', label: 'Estrelas' },
];

export const CORNER_ICONS: { id: CornerIcon; label: string; svg: string }[] = [
  { id: 'none', label: '—', svg: '' },
  { id: 'bookmark', label: '🔖', svg: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' },
  { id: 'arrow', label: '→', svg: '<path d="M5 12h14M12 5l7 7-7 7"/>' },
  { id: 'heart', label: '♥', svg: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
  { id: 'share', label: '↗', svg: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' },
  { id: 'chat', label: '💬', svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
  { id: 'sparkle', label: '✨', svg: '<path d="M12 2L9 12l-7 0 5.5 4.5L5 22l7-5 7 5-2.5-5.5L22 12l-7 0z"/>' },
];

export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

// ── Helpers ──

export function makeId() { return Math.random().toString(36).slice(2); }

export function emptySlide(idx: number, tpl: TemplateId = idx === 0 ? 'hero' : 'content'): SlideState {
  const t = TEMPLATES.find((x) => x.id === tpl)!;
  return {
    id: makeId(),
    template: tpl,
    backgroundUrl: '',
    backgroundPrompt: '',
    backgroundX: 50,
    backgroundY: 50,
    backgroundZoom: 100,
    backgroundOpacity: 100,
    backgroundFlipH: false,
    infiniteCarousel: false,
    overlayOpacity: 0.4,
    overlayStyle: 'base',
    slideBgColor: '#000000',
    slideBgPattern: 'none',
    slideBgPatternSize: 40,
    slideBgPatternOpacity: 15,
    label: tpl === 'content' || tpl === 'list' ? `Passo ${idx}` : tpl === 'cta' ? 'Proximo passo' : '',
    title: idx === 0 ? 'Titulo do carrossel' : `Titulo do slide ${idx + 1}`,
    subtitle: idx === 0 ? 'Subtitulo que complementa' : 'Subtitulo do slide',
    stat: tpl === 'stat' ? '+40%' : '',
    position: t.defaultPosition,
    textAlign: 'center',
    fontFamily: 'Inter',
    fontWeight: 800,
    titleColor: '#ffffff',
    titleFontSize: 72,
    titleLetterSpacing: -0.02,
    subtitleFontFamily: 'Inter',
    subtitleFontWeight: 400,
    subtitleColor: '#ffffff',
    subtitleFontSize: 28,
    subtitleLetterSpacing: 0,
    subtitleLineHeight: 1.4,
    globalScale: 100,
    glassEffect: false,
    cornerTopLeft: '',
    cornerTopRight: '',
    cornerBottomLeft: '',
    cornerBottomRight: '',
    cornerTopLeftEnabled: true,
    cornerTopRightEnabled: true,
    cornerBottomLeftEnabled: true,
    cornerBottomRightEnabled: true,
    logoPosition: '',
    customLogoUrl: '',
    showLogo: true,
    logoSize: 44,
    showProfileBadge: false,
    showIndicators: true,
    totalSlides: 5,
    slideNumber: idx + 1,
    showCTA: false,
    ctaText: '',
    wordHighlights: {},
    refinePrompt: '',
    renderedUrl: undefined,
  };
}

export function defaultGlobalStyle(): GlobalStyle {
  return {
    showCorners: true,
    showIndicators: true,
    cornerFontSize: 20,
    cornerEdgeDistance: 80,
    cornerOpacity: 85,
    cornerGlass: false,
    cornerBorder: false,
    bottomRightIcon: 'none',
  };
}
