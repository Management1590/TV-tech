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

export function useKeyboardViewport(isActive: boolean = true): KeyboardViewportState {
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
