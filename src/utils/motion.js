/**
 * Respecting the user's motion preference from JavaScript.
 *
 * CSS can only cancel stylesheet- and inline-declared motion; smooth scrolling
 * is requested in JS, so it has to be opted out of explicitly. Every
 * programmatic scroll in the app goes through `scrollBehavior()`.
 */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function scrollBehavior() {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

export default scrollBehavior;
