import { cn } from '@/lib/utils';

interface MascotCubeProps {
  size?: number;
  className?: string;
}

/**
 * Isometric cube mascot that adapts to the active theme via CSS variables
 * (--mascot-fill, --mascot-stroke, --mascot-eye). Rendered as inline SVG
 * so it reacts to light/dark without swapping image sources.
 */
export function MascotCube({ size = 48, className }: MascotCubeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('block', className)}
      aria-hidden
    >
      {/* Top face — slightly lighter for depth */}
      <polygon
        points="50,12 88,30 50,48 12,30"
        fill="var(--mascot-top)"
        stroke="var(--mascot-stroke)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Right face — darkest */}
      <polygon
        points="88,30 88,70 50,88 50,48"
        fill="var(--mascot-right)"
        stroke="var(--mascot-stroke)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Left face (front) — carries the eyes */}
      <polygon
        points="12,30 12,70 50,88 50,48"
        fill="var(--mascot-fill)"
        stroke="var(--mascot-stroke)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Eyes */}
      <ellipse cx="26" cy="58" rx="3.2" ry="4.2" fill="var(--mascot-eye)" />
      <ellipse cx="38" cy="64" rx="3.2" ry="4.2" fill="var(--mascot-eye)" />
    </svg>
  );
}
