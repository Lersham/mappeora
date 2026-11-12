import { useState } from 'react';
import { Dialog } from './Dialog';
import { BigButton } from './BigButton';

/**
 * A question a grown-up answers at once and a younger child does not:
 * a two-digit number times a one-digit one (e.g. 37 × 6).
 */
export function adultQuestion(random = Math.random): { a: number; b: number } {
  return { a: 12 + Math.floor(random() * 87), b: 3 + Math.floor(random() * 7) };
}

interface Props {
  /** What the grown-up is letting through, e.g. «aprire Google Immagini». */
  what: string;
  onPass(): void;
  onClose(): void;
}

/**
 * «Chiedi a un adulto» before leaving the app for the web. In the apps for
 * children of the App Store and of Google Play («Famiglie»), a link out of
 * the app needs a grown-up's say. Only in the installed app: on the web the
 * child is already in a browser.
 */
export function AdultGate({ what, onPass, onClose }: Props) {
  const [{ a, b }, setQuestion] = useState(() => adultQuestion());
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);

  const check = () => {
    if (Number(answer.trim()) === a * b) return onPass();
    setWrong(true);
    setAnswer('');
    setQuestion(adultQuestion());
  };

  return (
    <Dialog title="Chiedi a un adulto" onClose={onClose}>
      <p>
        Per {what} serve il permesso di un adulto. Adulto: scrivi il risultato e premi «Continua».
      </p>
      <label className="setting">
        <span>
          Quanto fa {a} × {b}?
        </span>
        <input
          className="text-field"
          inputMode="numeric"
          autoComplete="off"
          value={answer}
          autoFocus
          enterKeyHint="go"
          onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') check();
          }}
        />
      </label>
      {wrong && (
        <p className="field-error" role="alert">
          Non è giusto. Ecco un’altra domanda.
        </p>
      )}
      <div className="dialog-actions">
        <BigButton icon="close" label="Annulla" onClick={onClose} />
        <BigButton icon="check" label="Continua" variant="primary" disabled={!answer} onClick={check} />
      </div>
    </Dialog>
  );
}
