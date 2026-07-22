// ══════════════════════════════════════════════════════════════
// QUARK MOTION SYSTEM
// Central animation curves, duration tiers, and helpers.
// ══════════════════════════════════════════════════════════════

// ── Easing Curves ──
export const EASE_STANDARD   = 'cubic-bezier(0.4, 0, 0.2, 1)';
export const EASE_DECELERATE = 'cubic-bezier(0, 0, 0.2, 1)';
export const EASE_ACCELERATE = 'cubic-bezier(0.4, 0, 1, 1)';
export const EASE_PRECISE    = 'cubic-bezier(0.4, 0, 0.6, 1)';

// Legacy aliases
export const EASING_ENTRANCE = EASE_DECELERATE;
export const EASING_EXIT     = EASE_ACCELERATE;

// ── Duration Tiers ──
export const DURATION_INSTANT = 100; // hover states, focus rings
export const DURATION_FAST    = 200; // button feedback, tooltips, small transitions
export const DURATION_BASE    = 300; // modals, drawers, panels
export const DURATION_SLOW    = 500; // page transitions, large UI shifts
export const DURATION_BOOT    = 1400; // identity gate boot animation

// Legacy aliases
export const DURATION_MICRO    = DURATION_INSTANT;
export const DURATION_COMPONENT = DURATION_FAST;
export const DURATION_PAGE     = DURATION_BASE;

// ── Prefers Reduced Motion ──
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── Animation Helpers ──
export function fadeIn(duration: number = DURATION_FAST): string {
  return `opacity ${duration}ms ${EASE_DECELERATE}`;
}

export function slideUp(duration: number = DURATION_FAST): string {
  return `opacity ${duration}ms ${EASE_DECELERATE}, transform ${duration}ms ${EASE_DECELERATE}`;
}
