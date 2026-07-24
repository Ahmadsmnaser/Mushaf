export const MOTION = {
  duration: {
    popover: 180,
    dialog: 240,
    panel: 280,
    page: 340,
    mushaf: 900,
  },
  easing: {
    standard: "cubic-bezier(0.22, 1, 0.36, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
  },
} as const;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
