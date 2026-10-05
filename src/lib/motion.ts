/** How long a camera move takes: none when the system asks for less motion. */
export function motion(ms: number): number {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
}
