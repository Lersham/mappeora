import type { ReactNode } from 'react';
import type { MapTemplate } from '../types/map';

/**
 * The shape of the map each template starts with, drawn small: the oval is
 * the idea of the map, the rest is where the concepts go. Same line and
 * size as the icons of the commands (Icon.tsx), so they sit together.
 */
const SHAPES: Record<MapTemplate, ReactNode> = {
  // One idea, and room to add.
  libera: (
    <>
      <ellipse cx="8.5" cy="12" rx="6.5" ry="4.5" />
      <path d="M20 9.5v5M17.5 12h5" />
    </>
  ),
  // Five questions side by side under the idea, like the branches on the sheet.
  '5w': (
    <>
      <ellipse cx="12" cy="5" rx="6" ry="3.5" />
      <path d="M12 8.5V12M3 12h18M3 12v8M7.5 12v8M12 12v8M16.5 12v8M21 12v8" />
    </>
  ),
  // The causes above go into the idea, the effects come out below.
  'causa-effetto': (
    <>
      <circle cx="4.5" cy="3.5" r="2" />
      <circle cx="19.5" cy="3.5" r="2" />
      <ellipse cx="12" cy="12" rx="5.5" ry="3" />
      <circle cx="4.5" cy="20.5" r="2" />
      <circle cx="19.5" cy="20.5" r="2" />
      <path d="m6 5 3.5 4.5M18 5l-3.5 4.5M9.5 14.5 6 19M14.5 14.5 18 19" />
    </>
  ),
  // Facts one under the other, in order.
  timeline: (
    <>
      <path d="M5 4v16" />
      <circle cx="5" cy="4" r="2" />
      <circle cx="5" cy="12" r="2" />
      <circle cx="5" cy="20" r="2" />
      <path d="M10 4h10M10 12h10M10 20h7" />
    </>
  ),
  // Two things side by side, and what they share below.
  confronto: (
    <>
      <rect x="2" y="3" width="8" height="6" rx="1.5" />
      <rect x="14" y="3" width="8" height="6" rx="1.5" />
      <rect x="8" y="15" width="8" height="6" rx="1.5" />
      <path d="m6 9 4 6M18 9l-4 6" />
    </>
  ),
};

export function TemplateIcon({ template }: { template: MapTemplate }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
    >
      {SHAPES[template]}
    </svg>
  );
}
