'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * RouteScrollRestorer ensures that navigating back (or using the back button)
 * instantly restores the exact scroll position and active folder/item in the viewport.
 */
export function RouteScrollRestorer() {
  const pathname = usePathname();
  const isRestoringRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedScrollYStr = sessionStorage.getItem('scroll_pos_' + pathname);
    const lastElementId = sessionStorage.getItem('last_active_element_id');
    const savedScrollY = savedScrollYStr ? parseInt(savedScrollYStr, 10) : 0;

    if (!savedScrollY && !lastElementId) return;

    isRestoringRef.current = true;
    let attempts = 0;
    const maxAttempts = 18; // Try over ~900ms to handle any streaming hydration or chunk loading

    const tryRestore = () => {
      attempts++;

      // 1. Priority 1: Find the exact folder or item element and scroll it into view
      if (lastElementId) {
        const el = document.getElementById(lastElementId);
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          isRestoringRef.current = false;
          return;
        }
      }

      // 2. Priority 2: Restore exact Y pixel coordinate
      if (savedScrollY > 0) {
        window.scrollTo({ top: savedScrollY, behavior: 'instant' });
      }

      if (attempts < maxAttempts) {
        setTimeout(tryRestore, 50);
      } else {
        isRestoringRef.current = false;
      }
    };

    // Kick off restoration
    requestAnimationFrame(tryRestore);

    // Save scroll position as user scrolls (ignore during active restoration phase)
    const handleScroll = () => {
      if (!isRestoringRef.current && window.scrollY > 0) {
        sessionStorage.setItem('scroll_pos_' + window.location.pathname, window.scrollY.toString());
      }
    };

    // User touches screen or uses mouse wheel -> user is manually scrolling, release lock
    const handleUserInteraction = () => {
      isRestoringRef.current = false;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('wheel', handleUserInteraction, { passive: true });
    window.addEventListener('pointerdown', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('wheel', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
    };
  }, [pathname]);

  return null;
}
