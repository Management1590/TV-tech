'use client';

import React from 'react';
import { getHighlightedRanges } from '@/lib/search-utils';

interface HighlightedTextProps {
  text: string;
  query: string;
  className?: string;
  highlightClassName?: string;
}

export function HighlightedText({
  text,
  query,
  className = 'break-words [word-break:normal] [overflow-wrap:anywhere]',
  highlightClassName = 'bg-amber-300/80 text-amber-950 dark:bg-amber-400/40 dark:text-amber-100 rounded-[4px] px-0.5 py-0.2 font-black shadow-2xs break-words [word-break:normal] [overflow-wrap:anywhere]',
}: HighlightedTextProps) {
  if (!text) return null;
  if (!query || !query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const ranges = getHighlightedRanges(text, query);
  if (ranges.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  ranges.forEach(([start, end], i) => {
    if (start > lastIndex) {
      elements.push(
        <React.Fragment key={`text-${lastIndex}`}>
          {text.slice(lastIndex, start)}
        </React.Fragment>
      );
    }
    elements.push(
      <mark key={`mark-${start}-${i}`} className={highlightClassName}>
        {text.slice(start, end)}
      </mark>
    );
    lastIndex = end;
  });

  if (lastIndex < text.length) {
    elements.push(
      <React.Fragment key={`text-${lastIndex}`}>
        {text.slice(lastIndex)}
      </React.Fragment>
    );
  }

  return <span className={className}>{elements}</span>;
}
