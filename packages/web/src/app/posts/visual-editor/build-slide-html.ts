import { SlideState, GlobalStyle, Position, OverlayStyle, BgPattern, CornerIcon, WordFormat, CORNER_ICONS } from './types';

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function getSafeZone(aspectRatio: string) {
  switch (aspectRatio) {
    case '9:16':
      return { top: 270, bottom: 270, left: 80, right: 80, cornerInset: 280, indicatorBottom: 280 };
    case '4:5':
      return { top: 100, bottom: 170, left: 80, right: 80, cornerInset: 64, indicatorBottom: 64 };
    default:
      return { top: 100, bottom: 100, left: 80, right: 80, cornerInset: 60, indicatorBottom: 60 };
  }
}

function buildOverlayCss(style: OverlayStyle, opacity: number): string {
  switch (style) {
    case 'gradient':
      return `linear-gradient(to bottom, transparent 20%, rgba(0,0,0,${opacity}))`;
    case 'vignette':
      return `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${opacity}) 100%)`;
    default:
      return `rgba(0,0,0,${opacity})`;
  }
}

function buildPatternSvg(pattern: BgPattern, color: string): string {
  const c = color + '20'; // low opacity
  switch (pattern) {
    case 'grid':
      return `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="g" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="${c}" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
    case 'dots':
      return `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="d" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="2" fill="${c}"/></pattern></defs><rect width="100%" height="100%" fill="url(#d)"/></svg>`;
    case 'h-lines':
      return `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="h" width="10" height="20" patternUnits="userSpaceOnUse"><line x1="0" y1="10" x2="10" y2="10" stroke="${c}" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#h)"/></svg>`;
    case 'd-lines':
      return `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="dl" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M0 20L20 0" stroke="${c}" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#dl)"/></svg>`;
    case 'checkerboard':
      return `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="cb" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="${c}"/><rect x="20" y="20" width="20" height="20" fill="${c}"/></pattern></defs><rect width="100%" height="100%" fill="url(#cb)"/></svg>`;
    default:
      return '';
  }
}

function buildCornerIconSvg(icon: CornerIcon, color: string, size: number): string {
  const cfg = CORNER_ICONS.find((i) => i.id === icon);
  if (!cfg || !cfg.svg) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cfg.svg}</svg>`;
}

function buildWordHtml(text: string, highlights: Record<number, WordFormat>, defaultColor: string, font: string, fontSize: number, fontWeight: number, letterSpacing: number, shadow: string): string {
  const words = text.split(' ');
  if (Object.keys(highlights).length === 0) {
    return `<span style="font-size:${fontSize}px;font-weight:${fontWeight};color:${defaultColor};letter-spacing:${letterSpacing}em;font-family:${font};${shadow}">${escHtml(text)}</span>`;
  }
  return words.map((word, i) => {
    const h = highlights[i];
    const color = h?.color || defaultColor;
    const weight = h?.bold ? 900 : fontWeight;
    const style = h?.italic ? 'font-style:italic;' : '';
    const decoration: string[] = [];
    if (h?.underline) decoration.push('underline');
    if (h?.strikethrough) decoration.push('line-through');
    const dec = decoration.length ? `text-decoration:${decoration.join(' ')};` : '';
    return `<span style="font-size:${fontSize}px;font-weight:${weight};color:${color};letter-spacing:${letterSpacing}em;font-family:${font};${style}${dec}${shadow}">${escHtml(word)}</span>`;
  }).join(' ');
}

export function buildSlideHtml(
  s: SlideState,
  opts: { aspectRatio: string; brandLogoUrl: string; brandName?: string; globalStyle: GlobalStyle }
): string {
  const { aspectRatio, brandLogoUrl, brandName, globalStyle: gs } = opts;
  const font = `'${s.fontFamily}', sans-serif`;
  const subFont = `'${s.subtitleFontFamily}', sans-serif`;
  const color = s.titleColor;
  const shadow = 'text-shadow:0 6px 40px rgba(0,0,0,0.6);';
  const shadowSm = 'text-shadow:0 3px 16px rgba(0,0,0,0.5);';
  const sz = getSafeZone(aspectRatio);

  // Override corner distance from global style
  const edgeDist = gs.cornerEdgeDistance || sz.left;
  const ci = Math.max(edgeDist, sz.cornerInset);

  const glassOpen = s.glassEffect
    ? `<div style="background:rgba(0,0,0,0.35);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:24px;padding:48px;">`
    : '';
  const glassClose = s.glassEffect ? '</div>' : '';

  // Scale wrapper
  const scaleVal = (s.globalScale || 100) / 100;

  // Text alignment
  const alignMap = { left: 'left', center: 'center', right: 'right' };
  const textAlignCss = `text-align:${alignMap[s.textAlign || 'center']};`;

  // Position CSS
  const posMap: Record<Position, string> = {
    'top-left':      `top:${sz.top}px;left:${edgeDist}px;right:${edgeDist}px;${textAlignCss}`,
    'top-center':    `top:${sz.top}px;left:${edgeDist}px;right:${edgeDist}px;${textAlignCss}align-items:center;`,
    'top-right':     `top:${sz.top}px;left:${edgeDist}px;right:${edgeDist}px;${textAlignCss}align-items:flex-end;`,
    'middle-left':   `top:${sz.top}px;bottom:${sz.bottom}px;left:${edgeDist}px;right:${edgeDist}px;${textAlignCss}justify-content:center;`,
    'middle-center': `top:${sz.top}px;bottom:${sz.bottom}px;left:${edgeDist}px;right:${edgeDist}px;${textAlignCss}align-items:center;justify-content:center;`,
    'middle-right':  `top:${sz.top}px;bottom:${sz.bottom}px;left:${edgeDist}px;right:${edgeDist}px;${textAlignCss}align-items:flex-end;justify-content:center;`,
    'bottom-left':   `bottom:${sz.bottom}px;left:${edgeDist}px;right:${edgeDist}px;${textAlignCss}justify-content:flex-end;`,
    'bottom-center': `bottom:${sz.bottom}px;left:${edgeDist}px;right:${edgeDist}px;${textAlignCss}align-items:center;justify-content:flex-end;`,
    'bottom-right':  `bottom:${sz.bottom}px;left:${edgeDist}px;right:${edgeDist}px;${textAlignCss}align-items:flex-end;justify-content:flex-end;`,
  };
  const pos = posMap[s.position];

  // ── Corners ──
  const cfs = gs.cornerFontSize || 20;
  const cop = (gs.cornerOpacity || 85) / 100;
  const cornerShadow = gs.cornerGlass
    ? 'background:rgba(0,0,0,0.3);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:6px 12px;border-radius:8px;'
    : gs.cornerBorder
    ? `border:1px solid rgba(255,255,255,0.3);padding:4px 10px;border-radius:6px;`
    : '';

  const corners: string[] = [];
  if (gs.showCorners) {
    if (s.cornerTopLeft && s.cornerTopLeftEnabled)
      corners.push(`<div style="position:absolute;top:${ci}px;left:${edgeDist}px;font-size:${cfs}px;color:${color};opacity:${cop};font-family:${font};${shadowSm}${cornerShadow}">${escHtml(s.cornerTopLeft)}</div>`);
    if (s.cornerTopRight && s.cornerTopRightEnabled)
      corners.push(`<div style="position:absolute;top:${ci}px;right:${edgeDist}px;font-size:${cfs}px;color:${color};opacity:${cop};font-family:${font};${shadowSm}${cornerShadow}">${escHtml(s.cornerTopRight)}</div>`);
    if (s.cornerBottomLeft && s.cornerBottomLeftEnabled)
      corners.push(`<div style="position:absolute;bottom:${ci}px;left:${edgeDist}px;font-size:${cfs}px;color:${color};opacity:${cop};font-family:${font};${shadowSm}${cornerShadow}">${escHtml(s.cornerBottomLeft)}</div>`);
    if (s.cornerBottomRight && s.cornerBottomRightEnabled)
      corners.push(`<div style="position:absolute;bottom:${ci}px;right:${edgeDist}px;font-size:${cfs}px;color:${color};opacity:${cop};font-family:${font};${shadowSm}${cornerShadow}">${escHtml(s.cornerBottomRight)}</div>`);
  }

  // Corner icon (bottom-right)
  let cornerIconHtml = '';
  if (gs.bottomRightIcon && gs.bottomRightIcon !== 'none' && gs.showCorners) {
    const iconSvg = buildCornerIconSvg(gs.bottomRightIcon, color, cfs + 4);
    if (iconSvg) {
      cornerIconHtml = `<div style="position:absolute;bottom:${ci}px;right:${edgeDist}px;opacity:${cop};${cornerShadow}">${iconSvg}</div>`;
    }
  }

  // ── Brand logo ──
  let logoHtml = '';
  const logoUrl = s.customLogoUrl || brandLogoUrl;
  if (s.logoPosition && logoUrl && s.showLogo) {
    const logoSize = 44;
    const posStyle: Record<string, string> = {
      'top-left': `top:${ci}px;left:${edgeDist}px;`,
      'top-right': `top:${ci}px;right:${edgeDist}px;`,
      'bottom-left': `bottom:${ci}px;left:${edgeDist}px;`,
      'bottom-right': `bottom:${ci}px;right:${edgeDist}px;`,
    };
    logoHtml = `<img src="${logoUrl}" alt="logo" style="position:absolute;${posStyle[s.logoPosition] || ''}width:${logoSize}px;height:${logoSize}px;border-radius:50%;object-fit:cover;" crossorigin="anonymous"/>`;
  }

  // ── Slide indicators ──
  let indicatorsHtml = '';
  if (gs.showIndicators && s.showIndicators && s.totalSlides > 1) {
    const dots = Array.from({ length: s.totalSlides }, (_, i) =>
      `<span style="display:inline-block;width:${i + 1 === s.slideNumber ? '24px' : '8px'};height:8px;border-radius:4px;background:${i + 1 === s.slideNumber ? color : 'rgba(255,255,255,0.4)'};"></span>`
    ).join('');
    indicatorsHtml = `<div style="position:absolute;bottom:${sz.indicatorBottom}px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;">${dots}</div>`;
  }

  // ── Pattern overlay ──
  let patternHtml = '';
  if (s.slideBgPattern && s.slideBgPattern !== 'none') {
    const svg = buildPatternSvg(s.slideBgPattern, s.titleColor);
    if (svg) {
      patternHtml = `<div style="position:absolute;inset:0;pointer-events:none;">${svg}</div>`;
    }
  }

  // ── Content by template ──
  const titleHtml = buildWordHtml(s.title, s.wordHighlights || {}, color, font, s.titleFontSize || 72, s.fontWeight, s.titleLetterSpacing || -0.02, shadow);

  const labelHtml = s.label
    ? `<div style="font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:var(--brand-accent,${color});opacity:0.85;font-family:${font};${shadowSm}">${escHtml(s.label)}</div>`
    : '';

  const subtitleHtml = s.subtitle
    ? `<div style="font-size:${s.subtitleFontSize || 28}px;font-weight:${s.subtitleFontWeight || 400};color:${s.subtitleColor || color};opacity:0.9;line-height:${s.subtitleLineHeight || 1.4};font-family:${subFont};letter-spacing:${s.subtitleLetterSpacing || 0}em;${shadowSm}">${escHtml(s.subtitle)}</div>`
    : '';

  let content = '';
  switch (s.template) {
    case 'hero':
      content = `${labelHtml}<div style="line-height:1.05;">${titleHtml}</div>${subtitleHtml}`;
      break;
    case 'content':
    case 'list':
      content = `${labelHtml}<div style="line-height:1.1;">${titleHtml}</div>${subtitleHtml}`;
      break;
    case 'stat':
      content = `${labelHtml}<div style="font-size:140px;font-weight:900;line-height:1;font-family:${font};background:linear-gradient(135deg,var(--brand-primary,${color}),var(--brand-secondary,#E84393));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${escHtml(s.stat)}</div><div style="line-height:1.15;">${titleHtml}</div>${subtitleHtml}`;
      break;
    case 'quote':
      content = `<div style="font-size:120px;color:var(--brand-primary,${color});opacity:0.3;line-height:0.5;font-family:Georgia,serif;">&ldquo;</div><div style="font-size:${s.titleFontSize || 48}px;font-weight:400;font-style:italic;color:${color};line-height:1.35;font-family:Georgia,serif;${shadow}">${escHtml(s.title)}</div>${s.subtitle ? `<div style="font-size:22px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:var(--brand-accent,${color});font-family:${font};margin-top:24px;">${escHtml(s.subtitle)}</div>` : ''}`;
      break;
    case 'cta':
      content = `<div style="line-height:1.1;">${titleHtml}</div>${subtitleHtml}${s.label ? `<div style="margin-top:32px;display:inline-block;padding:16px 40px;background:var(--brand-primary,${color});color:#000;border-radius:999px;font-size:20px;font-weight:700;font-family:${font};">${escHtml(s.label)}</div>` : ''}`;
      break;
  }

  // CTA button
  if (s.showCTA && s.ctaText) {
    content += `<div style="margin-top:32px;display:inline-block;padding:14px 36px;background:${color};color:#000;border-radius:999px;font-size:18px;font-weight:700;font-family:${font};">${escHtml(s.ctaText)}</div>`;
  }

  // ── Profile badge ──
  let badgeHtml = '';
  if (s.showProfileBadge && (brandLogoUrl || brandName)) {
    const logoImg = brandLogoUrl
      ? `<img src="${brandLogoUrl}" alt="logo" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" crossorigin="anonymous"/>`
      : '';
    const nameSpan = brandName
      ? `<span style="font-size:18px;font-weight:700;color:#1a1a2e;font-family:'Inter',sans-serif;">${escHtml(brandName)}</span>`
      : '';
    badgeHtml = `<div style="position:absolute;bottom:${sz.indicatorBottom + 40}px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.95);padding:12px 18px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,0.3);z-index:10;">${logoImg}${nameSpan}</div>`;
  }

  return `
    ${patternHtml}
    ${corners.join('\n')}
    ${cornerIconHtml}
    ${logoHtml}
    ${badgeHtml}
    ${indicatorsHtml}
    <div style="position:absolute;${pos};display:flex;flex-direction:column;gap:20px;font-family:${font};transform:scale(${scaleVal});transform-origin:center;">
      ${glassOpen}
      ${content}
      ${glassClose}
    </div>
  `;
}
