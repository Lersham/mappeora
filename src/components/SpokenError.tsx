import type { ReactNode } from 'react';
import { Listenable } from './OptionCard';

interface Props {
  /** The message: shown and read aloud, word for word. */
  children: string;
  /** Class of the message; «field-error» is the red text under a field. */
  className?: string;
  /** «alert» for a problem, «status» for a hint that is not urgent. */
  role?: 'alert' | 'status';
  /** In a row of a field and its microphone: goes on a line of its own below them. */
  inline?: boolean;
  /** Buttons that belong to the message (they stay inside the alert, after the text). */
  actions?: ReactNode;
}

/**
 * A problem or a hint with a 🔊 to hear it: a child who reads slowly gets it
 * read to them, but only if they ask (nothing is read on its own). The 🔊 is
 * outside the alert, so the screen reader does not announce it with the message.
 */
export function SpokenError({ children, className = 'field-error', role = 'alert', inline = false, actions }: Props) {
  const message = (
    <Listenable text={children}>
      {actions ? (
        <div className={className} role={role}>
          <span>{children}</span>
          {actions}
        </div>
      ) : (
        <p className={className} role={role}>
          {children}
        </p>
      )}
    </Listenable>
  );
  return inline ? <div className="spoken-error-line">{message}</div> : message;
}
