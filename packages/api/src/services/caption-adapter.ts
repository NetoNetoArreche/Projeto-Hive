import type { SocialPlatform } from '@prisma/client';

interface BrandPreset {
  voiceTone?: string | null;
  defaultHashtags: string[];
  tonePrompt?: string | null;
}

interface AdaptedCaption {
  platform: SocialPlatform;
  caption: string;
}

export function adaptCaptionForPlatforms(
  baseCaption: string,
  platforms: SocialPlatform[],
  brand?: BrandPreset | null,
): AdaptedCaption[] {
  return platforms.map((platform) => ({
    platform,
    caption: adaptForPlatform(baseCaption, platform, brand),
  }));
}

function adaptForPlatform(
  caption: string,
  platform: SocialPlatform,
  brand?: BrandPreset | null,
): string {
  switch (platform) {
    case 'INSTAGRAM':
      return adaptForInstagram(caption, brand);
    case 'FACEBOOK':
      return adaptForFacebook(caption, brand);
    case 'LINKEDIN':
      return adaptForLinkedIn(caption, brand);
    case 'X':
      return adaptForX(caption, brand);
    default:
      return caption;
  }
}

function adaptForInstagram(caption: string, brand?: BrandPreset | null): string {
  let result = caption;
  if (brand?.defaultHashtags?.length) {
    const existingTags = caption.toLowerCase();
    const newTags = brand.defaultHashtags
      .filter((tag) => !existingTags.includes(`#${tag.toLowerCase()}`))
      .map((tag) => `#${tag}`);
    if (newTags.length > 0) {
      result = result.trim() + '\n\n' + newTags.join(' ');
    }
  }
  if (result.length > 2200) {
    result = result.slice(0, 2197) + '...';
  }
  return result;
}

function adaptForFacebook(caption: string, brand?: BrandPreset | null): string {
  let result = caption;
  if (brand?.defaultHashtags?.length) {
    const existingTags = caption.toLowerCase();
    const newTags = brand.defaultHashtags
      .filter((tag) => !existingTags.includes(tag.toLowerCase()));
    if (newTags.length > 0) {
      result = result.trim() + '\n\nTags: ' + newTags.join(', ');
    }
  }
  return result;
}

function adaptForLinkedIn(caption: string, brand?: BrandPreset | null): string {
  let result = caption;
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}✨🎉🔥💪🙏✅]/gu;
  const emojis = result.match(emojiRegex);
  if (emojis && emojis.length > 1) {
    let count = 0;
    result = result.replace(emojiRegex, () => {
      count++;
      return count > 1 ? '' : emojis[0];
    });
  }
  result = result.replace(/!{3,}/g, '!');
  result = result.replace(/\?{3,}/g, '?');
  if (brand?.defaultHashtags?.length) {
    const hashBlock = brand.defaultHashtags.slice(0, 3).map((t) => `#${t}`).join(' ');
    result = result.trim() + '\n\n' + hashBlock;
  }
  if (result.length > 3000) {
    result = result.slice(0, 2997) + '...';
  }
  return result;
}

function adaptForX(caption: string, brand?: BrandPreset | null): string {
  let result = caption;
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}✨🎉🔥💪🙏✅]/gu;
  result = result.replace(emojiRegex, '').trim();
  result = result.replace(/\n#[^\n]+/g, '').trim();
  if (brand?.defaultHashtags?.length) {
    const tags = brand.defaultHashtags.slice(0, 2).map((t) => `#${t}`).join(' ');
    result = result + ' ' + tags;
  }
  if (result.length > 280) {
    const sentences = result.split(/(?<=[.!?])\s+/);
    let truncated = '';
    for (const sentence of sentences) {
      if ((truncated + ' ' + sentence).trim().length <= 280) {
        truncated = (truncated + ' ' + sentence).trim();
      } else break;
    }
    result = truncated || result.slice(0, 277) + '...';
  }
  return result;
}
