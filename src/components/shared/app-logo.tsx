import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
  variation?: 'gradient' | 'solid-blue' | 'monochrome-dark' | 'monochrome-gray' | 'outline' | 'reverse-white';
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = 'w-6 h-6',
  size = 512,
  variation = 'gradient',
}) => {
  if (variation === 'outline') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width={size}
        height={size}
        className={className}
        fill="none"
      >
        <path
          d="
            M 112 60
            L 190 60
            C 224 60, 240 76, 256 108
            C 268 132, 284 142, 316 142
            L 404 142
            C 436 142, 456 162, 456 194
            L 456 392
            C 456 424, 436 444, 404 444
            L 108 444
            C 76 444, 56 424, 56 392
            L 56 116
            C 56 84, 76 60, 112 60
            Z
          "
          stroke="currentColor"
          strokeWidth="24"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="
            M 56 216
            L 202 292
            C 237 306, 275 306, 310 292
            L 456 216
          "
          stroke="currentColor"
          strokeWidth="24"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="logoTopBlue" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="40%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="logoBottomBlue" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="60%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#93C5FD" />
        </linearGradient>
        <filter id="logoLayerShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#1E3A8A" floodOpacity="0.20" />
        </filter>
      </defs>
      <clipPath id="logoFolderClip">
        <path
          d="
            M 112 60
            L 190 60
            C 224 60, 240 76, 256 108
            C 268 132, 284 142, 316 142
            L 404 142
            C 436 142, 456 162, 456 194
            L 456 392
            C 456 424, 436 444, 404 444
            L 108 444
            C 76 444, 56 424, 56 392
            L 56 116
            C 56 84, 76 60, 112 60
            Z
          "
        />
      </clipPath>
      <g clipPath="url(#logoFolderClip)">
        <rect x="0" y="0" width="512" height="512" fill="url(#logoBottomBlue)" />
        <path
          d="
            M 0 0
            L 512 0
            L 512 216
            L 310 292
            C 275 306, 237 306, 202 292
            L 0 216
            Z
          "
          fill="url(#logoTopBlue)"
          filter="url(#logoLayerShadow)"
        />
        <path
          d="
            M 0 208
            L 202 284
            C 237 298, 275 298, 310 284
            L 512 208
            L 512 226
            L 310 302
            C 275 316, 237 316, 202 302
            L 0 226
            Z
          "
          fill="#FFFFFF"
          opacity="0.96"
        />
      </g>
    </svg>
  );
};
