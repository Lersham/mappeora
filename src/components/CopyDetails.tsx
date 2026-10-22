import { useEffect, useRef, useState } from 'react';
import { errorReport } from '../services/errorLog';

/**
 * «Copia i dettagli per chi ti aiuta»: version, device and the last errors,
 * in the clipboard to paste into a message. Nothing is sent from here.
 * Without clipboard access the same text is shown, ready to select.
 */
export function CopyDetails() {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [report, setReport] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);

  const copy = async () => {
    const text = errorReport();
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      // No clipboard (blocked, or the page is not secure): the child copies by hand.
      setReport(text);
      setState('manual');
    }
  };

  useEffect(() => {
    if (state === 'manual') {
      box.current?.focus();
      box.current?.select();
    }
  }, [state]);

  return (
    // The room above keeps the link's touch area (see .link-button) off the buttons over it.
    <div style={{ marginTop: 16 }}>
      <button type="button" className="link-button" onClick={() => void copy()}>
        Copia i dettagli per chi ti aiuta
      </button>
      {/* Always in the page: a live region must be there before it speaks. */}
      <div role="status">
        {state === 'copied' && <p className="muted small">Copiato: incollalo in un messaggio a chi ti aiuta.</p>}
        {state === 'manual' && (
          <>
            <p className="muted small">Non riesco a copiare da solo. Seleziona il testo qui sotto e copialo.</p>
            <textarea
              ref={box}
              className="text-field"
              style={{ width: '100%', minHeight: '9em' }}
              readOnly
              value={report}
              aria-label="Dettagli per chi ti aiuta"
              onFocus={(e) => e.currentTarget.select()}
            />
          </>
        )}
      </div>
    </div>
  );
}
