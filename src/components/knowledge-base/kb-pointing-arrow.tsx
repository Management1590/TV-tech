'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';

export interface KbPointingArrowProps {
  containerRef: React.RefObject<HTMLElement | null>;
  startRef: React.RefObject<HTMLElement | null>;
  targetRef: React.RefObject<HTMLElement | null>;
  colorScheme?: 'blue' | 'violet' | 'emerald';
  className?: string;
}

const COLOR_CONFIGS = {
  blue: {
    gradientId: 'ios-blue-gradient',
    glowColor: 'rgba(37, 99, 235, 0.45)',
    stops: [
      { offset: '0%', color: '#38bdf8' },
      { offset: '50%', color: '#2563eb' },
      { offset: '100%', color: '#4f46e5' },
    ],
    fill: '#2563eb',
  },
  violet: {
    gradientId: 'ios-violet-gradient',
    glowColor: 'rgba(124, 58, 237, 0.45)',
    stops: [
      { offset: '0%', color: '#e879f9' },
      { offset: '50%', color: '#8b5cf6' },
      { offset: '100%', color: '#7c3aed' },
    ],
    fill: '#7c3aed',
  },
  emerald: {
    gradientId: 'ios-emerald-gradient',
    glowColor: 'rgba(5, 150, 105, 0.45)',
    stops: [
      { offset: '0%', color: '#34d399' },
      { offset: '50%', color: '#059669' },
      { offset: '100%', color: '#0d9488' },
    ],
    fill: '#059669',
  },
};

export function KbPointingArrow({
  containerRef,
  startRef,
  targetRef,
  colorScheme = 'blue',
  className = '',
}: KbPointingArrowProps) {
  const uniqueId = useId().replace(/:/g, '');
  const [coords, setCoords] = useState<{ pathD: string; headD: string } | null>(null);

  const calculatePath = useCallback(() => {
    if (!containerRef.current || !startRef.current || !targetRef.current) {
      return;
    }

    const card = containerRef.current.getBoundingClientRect();
    const start = startRef.current.getBoundingClientRect();
    const target = targetRef.current.getBoundingClientRect();

    // Start directly under the subtext, slightly right of center
    const x1 = start.left + start.width * 0.7 - card.left;
    const y1 = start.top - card.top + 2;

    // Target the upper-left quadrant / top edge of the highlighted action button
    const x2 = target.left + target.width * 0.45 - card.left;
    const y2 = target.top - card.top - 6;

    const dx = x2 - x1;
    const dy = y2 - y1;

    // Safety fallback if dimensions are collapsed
    if (dy <= 0 || card.width === 0) {
      setCoords(null);
      return;
    }

    // Dynamic loop dimensions bounded for optimal visual rhythm
    const loopW = Math.min(64, Math.max(38, dx * 0.45));
    const loopH = Math.min(58, Math.max(36, dy * 0.32));

    // Loop center positioned in the lower-right quadrant
    const loopCenterX = x1 + dx * 0.65;
    const loopCenterY = y1 + dy * 0.58;

    const pStart = `${x1},${y1}`;
    // 1. Diagonal swoop down-right towards loop entry
    const c1 = `${x1 + dx * 0.25},${y1 + dy * 0.22}`;
    const c2 = `${loopCenterX - loopW * 0.45},${loopCenterY - loopH * 0.45}`;
    const pLoopEntry = `${loopCenterX + loopW * 0.45},${loopCenterY - loopH * 0.25}`;

    // 2. Clockwise loop top and around
    const c3 = `${loopCenterX + loopW * 0.85},${loopCenterY - loopH * 0.05}`;
    const c4 = `${loopCenterX + loopW * 0.65},${loopCenterY + loopH * 0.65}`;
    const pLoopBottom = `${loopCenterX},${loopCenterY + loopH * 0.55}`;

    // 3. Loop exit: curving left then crossing over and swooping down into button
    const c5 = `${loopCenterX - loopW * 0.55},${loopCenterY + loopH * 0.35}`;
    const c6 = `${loopCenterX - loopW * 0.3},${loopCenterY - loopH * 0.3}`;
    const pCross = `${loopCenterX + loopW * 0.15},${loopCenterY + loopH * 0.1}`;

    // 4. Final descent straight into the FAB top
    const c7 = `${loopCenterX + loopW * 0.35},${loopCenterY + loopH * 0.5}`;
    const c8 = `${x2 - 14},${y2 - dy * 0.22}`;
    const pEnd = `${x2},${y2}`;

    const pathD = `M ${pStart} C ${c1} ${c2} ${pLoopEntry} C ${c3} ${c4} ${pLoopBottom} C ${c5} ${c6} ${pCross} C ${c7} ${c8} ${pEnd}`;

    // Arrowhead angle computed from arrival vector tangent
    const tangentDx = x2 - (x2 - 14);
    const tangentDy = y2 - (y2 - dy * 0.22);
    const angle = Math.atan2(tangentDy, tangentDx);
    const headLen = 14;
    const headWidth = 8.5;
    const xTip = x2;
    const yTip = y2;
    const xLeft = xTip - headLen * Math.cos(angle) + headWidth * Math.sin(angle);
    const yLeft = yTip - headLen * Math.sin(angle) - headWidth * Math.cos(angle);
    const xRight = xTip - headLen * Math.cos(angle) - headWidth * Math.sin(angle);
    const yRight = yTip - headLen * Math.sin(angle) + headWidth * Math.cos(angle);
    const xBase = xTip - headLen * 0.72 * Math.cos(angle);
    const yBase = yTip - headLen * 0.72 * Math.sin(angle);

    const headD = `M ${xTip} ${yTip} L ${xLeft} ${yLeft} Q ${xBase} ${yBase} ${xRight} ${yRight} Z`;

    setCoords({ pathD, headD });
  }, [containerRef, startRef, targetRef]);

  useEffect(() => {
    calculatePath();

    const handleResize = () => {
      calculatePath();
    };
    window.addEventListener('resize', handleResize);

    let ro: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        calculatePath();
      });
      ro.observe(containerRef.current);
    }

    const timer = setTimeout(calculatePath, 80);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
      clearTimeout(timer);
    };
  }, [calculatePath, containerRef]);

  if (!coords) return null;

  const config = COLOR_CONFIGS[colorScheme] || COLOR_CONFIGS.blue;
  const gradId = `${config.gradientId}-${uniqueId}`;
  const filterId = `ios-glow-${uniqueId}`;

  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20 transition-opacity duration-300 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          {config.stops.map((stop, idx) => (
            <stop key={idx} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>

        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="4"
            floodColor={config.glowColor}
          />
        </filter>
      </defs>

      <g
        className="animate-[pulse_3s_ease-in-out_infinite]"
        style={{ filter: `url(#${filterId})` }}
      >
        {/* Glowing underlayer matching add button */}
        <path
          d={coords.pathD}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.3}
        />

        {/* Primary crisp vector stroke */}
        <path
          d={coords.pathD}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Arrowhead */}
        <path d={coords.headD} fill={config.fill} />
      </g>
    </svg>
  );
}
