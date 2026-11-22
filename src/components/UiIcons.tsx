import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
}

const baseProps = (size: number, color: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth: 2,
  strokeLinecap: 'square' as const,
  strokeLinejoin: 'miter' as const,
  style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 },
  'aria-hidden': true,
});

export const TrafficLightIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <rect x="7" y="2" width="10" height="20" />
    <circle cx="12" cy="7" r="2" fill="#ef4444" stroke="none" />
    <circle cx="12" cy="12" r="2" fill="#f6c600" stroke="none" />
    <circle cx="12" cy="17" r="2" fill="#22c55e" stroke="none" />
  </svg>
);

export const KeyboardIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <rect x="2" y="5" width="20" height="14" />
    <line x1="6" y1="9" x2="8" y2="9" />
    <line x1="11" y1="9" x2="13" y2="9" />
    <line x1="16" y1="9" x2="18" y2="9" />
    <line x1="7" y1="15" x2="17" y2="15" />
  </svg>
);

export const SlidersIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
    <rect x="7" y="4" width="3" height="4" fill={color} />
    <rect x="14" y="10" width="3" height="4" fill={color} />
    <rect x="9" y="16" width="3" height="4" fill={color} />
  </svg>
);

export const VolumeOnIcon: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <polygon points="3,9 8,9 13,5 13,19 8,15 3,15" fill={color} stroke="none" />
    <path d="M16 9a4 4 0 0 1 0 6" />
    <path d="M19 6a8 8 0 0 1 0 12" />
  </svg>
);

export const VolumeOffIcon: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <polygon points="3,9 8,9 13,5 13,19 8,15 3,15" fill={color} stroke="none" />
    <line x1="16" y1="9" x2="21" y2="15" />
    <line x1="21" y1="9" x2="16" y2="15" />
  </svg>
);

export const CameraIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <rect x="2" y="6" width="14" height="12" />
    <polygon points="16,10 22,7 22,17 16,14" />
  </svg>
);

export const PauseIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <rect x="6" y="4" width="4" height="16" fill={color} stroke="none" />
    <rect x="14" y="4" width="4" height="16" fill={color} stroke="none" />
  </svg>
);

export const PlayIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <polygon points="6,4 20,12 6,20" fill={color} stroke="none" />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <polyline points="20,4 20,10 14,10" />
  </svg>
);

export const HomeIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <polyline points="3,11 12,3 21,11" />
    <polyline points="6,10 6,20 18,20 18,10" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 13, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <line x1="5" y1="5" x2="19" y2="19" />
    <line x1="19" y1="5" x2="5" y2="19" />
  </svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <path d="M12 2L4 5v6c0 5 3.5 9.2 8 11 4.5-1.8 8-6 8-11V5l-8-3z" />
  </svg>
);

export const MapPinIcon: React.FC<IconProps> = ({ size = 13, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z" />
    <circle cx="12" cy="10" r="2" />
  </svg>
);

export const AlertIcon: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <polygon points="12,3 22,20 2,20" />
    <line x1="12" y1="10" x2="12" y2="14" />
    <rect x="11" y="16.5" width="2" height="2" fill={color} stroke="none" />
  </svg>
);

export const TargetIcon: React.FC<IconProps> = ({ size = 13, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ArrowLeftIcon: React.FC<IconProps> = ({ size = 13, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <polygon points="15,5 5,12 15,19" fill={color} stroke="none" />
  </svg>
);

export const ArrowRightIcon: React.FC<IconProps> = ({ size = 13, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <polygon points="9,5 19,12 9,19" fill={color} stroke="none" />
  </svg>
);

export const HeadlightIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <path d="M12 6a6 6 0 0 1 0 12H9V6h3z" />
    <line x1="3" y1="8" x2="6" y2="8" />
    <line x1="3" y1="12" x2="6" y2="12" />
    <line x1="3" y1="16" x2="6" y2="16" />
  </svg>
);

export const HornIcon: React.FC<IconProps> = ({ size = 13, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <polygon points="3,10 10,10 17,6 17,18 10,14 3,14" />
    <line x1="20" y1="9" x2="22" y2="7" />
    <line x1="20" y1="15" x2="22" y2="17" />
  </svg>
);

export const MapGridIcon: React.FC<IconProps> = ({ size = 13, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <polygon points="2,6 8,4 16,6 22,4 22,18 16,20 8,18 2,20" />
    <line x1="8" y1="4" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="20" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <polyline points="4,12 10,18 20,6" />
  </svg>
);

export const BikeIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <circle cx="6" cy="17" r="3" />
    <circle cx="18" cy="17" r="3" />
    <polyline points="6,17 11,10 16,10 18,17" />
    <line x1="14" y1="7" x2="18" y2="7" />
  </svg>
);

export const CarIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <polygon points="4,12 7,7 17,7 20,12 20,17 4,17" />
    <circle cx="7.5" cy="17" r="2" fill={color} stroke="none" />
    <circle cx="16.5" cy="17" r="2" fill={color} stroke="none" />
  </svg>
);

export const InfinityIcon: React.FC<IconProps> = ({ size = 15, color = 'currentColor' }) => (
  <svg {...baseProps(size, color)}>
    <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

