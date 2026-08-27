'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

      // Visibility threshold: 240px
      if (scrollTop > 240) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }

      // Calculate progress percentage (0 to 100)
      if (scrollHeight > 0) {
        const progress = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
        setScrollProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  // SVG circular progress math (Radius = 18, Circumference = 2 * PI * 18 ≈ 113.1)
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scrollProgress / 100) * circumference;

  return (
    <div className="fixed z-50 animate-in fade-in zoom-in-95 duration-200 right-4 sm:right-8 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-8">
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className="relative group w-12 h-12 sm:w-12 sm:h-12 rounded-2xl bg-white/90 backdrop-blur-xl border border-border/80 shadow-xl hover:shadow-2xl hover:border-primary/40 hover:-translate-y-1 active:translate-y-0 active:scale-95 transition-all duration-300 flex items-center justify-center cursor-pointer select-none"
      >
        {/* SVG Circular Scroll Progress Ring */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-1"
          viewBox="0 0 44 44"
        >
          {/* Background Ring */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            className="stroke-slate-200/60"
            strokeWidth="2.5"
            fill="transparent"
          />
          {/* Active Progress Ring */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            className="stroke-primary transition-all duration-150"
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Arrow Icon with Hover Micro-Lift */}
        <ArrowUp className="w-5 h-5 text-foreground group-hover:text-primary transition-all duration-300 group-hover:-translate-y-0.5" />

        {/* Tooltip on Hover */}
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md">
          Back to Top ({Math.round(scrollProgress)}%)
        </div>
      </button>
    </div>
  );
}
