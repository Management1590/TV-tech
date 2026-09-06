'use client';

import { useState, useEffect } from 'react';

export interface KeyboardViewportState {
  isKeyboardOpen: boolean;
  keyboardHeight: number;
  viewportHeight: number;
  viewportWidth: number;
  offsetTop: number;
  offsetLeft: number;
  containerStyle: React.CSSProperties;
}

/**
 * Completely locks background scrolling and rubber-banding on mobile (especially iOS Safari)
 * without displacing the body scroll position or breaking portals.
 */
export function useScrollLock(isActive: boolean = true) {
  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;

    const originalDocOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    // Global non-passive touchmove listener to completely prevent iOS background scrolling
    const preventBackgroundTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      // Allow user interaction on range sliders, explicitly marked modal scroll containers, or drag canvases
      if (
        (target?.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') ||
        target?.closest('[data-modal-scrollable="true"]') ||
        target?.closest('.touch-none') ||
        target?.closest('[data-touch-allow="true"]')
      ) {
        return;
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventBackgroundTouchMove, { passive: false });

    return () => {
      document.documentElement.style.overflow = originalDocOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      document.removeEventListener('touchmove', preventBackgroundTouchMove);
    };
  }, [isActive]);
}

export function useKeyboardViewport(isActive: boolean = true): KeyboardViewportState {
  // NOTE: Do NOT call useScrollLock here — callers handle scroll-locking themselves.
  // Calling it here causes a double-lock (two separate effect cleanups) which
  // leaves the touchmove block attached permanently after dialogs close.

  const [state, setState] = useState<KeyboardViewportState>(() => ({
    isKeyboardOpen: false,
    keyboardHeight: 0,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    offsetTop: 0,
    offsetLeft: 0,
    containerStyle: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      bottom: 'auto',
      right: 'auto',
    },
  }));

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;

    const update = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setState({
          isKeyboardOpen: false,
          keyboardHeight: 0,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
          offsetTop: 0,
          offsetLeft: 0,
          containerStyle: {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            bottom: 'auto',
            right: 'auto',
          },
        });
        return;
      }

      // Compute keyboard height from layout viewport vs visual viewport delta
      const offsetFromBottom = window.innerHeight - (vv.height + vv.offsetTop);
      const kbHeight = Math.max(0, Math.round(offsetFromBottom));
      const isKbOpen = kbHeight > 80;

      setState({
        isKeyboardOpen: isKbOpen,
        keyboardHeight: kbHeight,
        viewportHeight: Math.round(vv.height),
        viewportWidth: Math.round(vv.width),
        offsetTop: Math.round(vv.offsetTop),
        offsetLeft: Math.round(vv.offsetLeft),
        containerStyle: {
          position: 'fixed',
          top: `${Math.round(vv.offsetTop)}px`,
          left: `${Math.round(vv.offsetLeft)}px`,
          width: `${Math.round(vv.width)}px`,
          height: `${Math.round(vv.height)}px`,
          bottom: 'auto',
          right: 'auto',
        },
      });
    };

    update();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [isActive]);

  return state;
}

/**
 * Proximity touch handler for text-focused popups / sheets.
 * When the user touches any non-input, non-button area (whitespace, padding,
 * labels, headers), it calculates the nearest text input or textarea based on
 * Euclidean distance to the touch coordinates and immediately focuses it.
 * This keeps the virtual keyboard continuously open and selects the nearest field.
 */
export function handleProximityTouch(
  e: React.SyntheticEvent | Event,
  container: HTMLElement | null
) {
  if (!container) return;
  const target = e.target as HTMLElement | null;

  // If user touched an interactive element (button, link, select, or already inside an input/textarea),
  // let native behavior proceed without interference.
  if (target?.closest('button, [role="button"], a, input, textarea, select')) {
    return;
  }

  // Find all visible, enabled text inputs and textareas inside the container
  const inputs = Array.from(
    container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled])'
    )
  ).filter((el) => el.offsetParent !== null && !el.readOnly);

  if (inputs.length === 0) return;

  if (inputs.length === 1) {
    if ('preventDefault' in e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    inputs[0].focus();
    return;
  }

  // Determine touch/click client coordinates
  let clientX = 0;
  let clientY = 0;
  const nativeEvt = 'nativeEvent' in e ? (e as any).nativeEvent : e;
  if ('touches' in nativeEvt && nativeEvt.touches && nativeEvt.touches.length > 0) {
    clientX = nativeEvt.touches[0].clientX;
    clientY = nativeEvt.touches[0].clientY;
  } else if ('clientX' in nativeEvt && typeof nativeEvt.clientX === 'number') {
    clientX = nativeEvt.clientX;
    clientY = nativeEvt.clientY;
  } else if ('clientX' in e && typeof (e as any).clientX === 'number') {
    clientX = (e as any).clientX;
    clientY = (e as any).clientY;
  }

  // Find the input with the smallest distance to (clientX, clientY)
  let nearestInput = inputs[0];
  let minDistance = Infinity;

  for (const input of inputs) {
    const rect = input.getBoundingClientRect();
    // Clamp to input box edges to find the closest point
    const nearestX = Math.max(rect.left, Math.min(clientX, rect.right));
    const nearestY = Math.max(rect.top, Math.min(clientY, rect.bottom));
    const dist = Math.hypot(clientX - nearestX, clientY - nearestY);

    if (dist < minDistance) {
      minDistance = dist;
      nearestInput = input;
    }
  }

  if ('preventDefault' in e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  nearestInput.focus();
}

/**
 * Creates an onBlur handler that prevents the keyboard from closing unexpectedly.
 * If focus leaves an input without transferring to another input, textarea, or button,
 * it immediately restores focus to the input on the next animation frame.
 */
export function createPersistentBlurHandler(
  shouldPersist: boolean,
  isExiting: boolean
) {
  return (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!shouldPersist || isExiting) return;
    const related = e.relatedTarget as HTMLElement | null;
    // Allow focus transfer to other inputs, textareas, or buttons (e.g. Cancel, Submit)
    if (
      related &&
      (related.tagName === 'INPUT' ||
        related.tagName === 'TEXTAREA' ||
        related.tagName === 'BUTTON' ||
        related.closest('button, [role="button"]'))
    ) {
      return;
    }
    const target = e.target;
    requestAnimationFrame(() => {
      // Only refocus if the element is still mounted inside the document
      // and the modal hasn't been closed (shouldPersist is captured by closure —
      // but if the component unmounted, the element won't be in the DOM)
      if (
        shouldPersist &&
        !isExiting &&
        target &&
        document.body.contains(target)
      ) {
        target.focus();
      }
    });
  };
}

