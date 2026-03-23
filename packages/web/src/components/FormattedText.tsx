'use client';

import React from 'react';

/**
 * Renders plain text with basic markdown-like formatting:
 * - **bold** → <strong>
 * - *italic* → <em>
 * - Lines starting with "- " or "• " → bullet list items
 * - Lines starting with "  - " or "  • " → nested list items
 * - Empty lines → paragraph breaks
 */
export function FormattedText({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.type === 'list') {
          return (
            <ul key={i} className="list-disc list-inside space-y-1 my-2">
              {block.items.map((item, j) => (
                <li key={j} className={item.nested ? 'ml-4' : ''}>
                  <InlineFormatted text={item.text} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'paragraph') {
          return (
            <p key={i} className="my-1.5">
              <InlineFormatted text={block.text} />
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: Array<{ text: string; nested: boolean }> };

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let currentList: Array<{ text: string; nested: boolean }> | null = null;
  let currentParagraph: string[] = [];

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'paragraph', text: currentParagraph.join('\n') });
      currentParagraph = [];
    }
  }

  function flushList() {
    if (currentList && currentList.length > 0) {
      blocks.push({ type: 'list', items: currentList });
      currentList = null;
    }
  }

  for (const line of lines) {
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    // Check if line is a list item
    const isBullet = /^[-•*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed);

    if (isBullet) {
      flushParagraph();
      if (!currentList) currentList = [];
      const itemText = trimmed.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, '');
      currentList.push({ text: itemText, nested: indent >= 2 });
    } else if (trimmed === '') {
      flushList();
      flushParagraph();
    } else {
      flushList();
      currentParagraph.push(line);
    }
  }

  flushList();
  flushParagraph();

  return blocks;
}

function InlineFormatted({ text }: { text: string }) {
  const parts = parseInline(text);
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'bold') return <strong key={i} className="font-semibold">{part.text}</strong>;
        if (part.type === 'italic') return <em key={i}>{part.text}</em>;
        return <React.Fragment key={i}>{part.text}</React.Fragment>;
      })}
    </>
  );
}

type InlinePart = { type: 'text' | 'bold' | 'italic'; text: string };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  // Match **bold** and *italic* patterns
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      parts.push({ type: 'bold', text: match[1] });
    } else if (match[2] !== undefined) {
      parts.push({ type: 'italic', text: match[2] });
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', text: text.slice(lastIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', text });
  }

  return parts;
}
