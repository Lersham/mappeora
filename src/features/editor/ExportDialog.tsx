import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { BigButton } from '../../components/BigButton';
import { isNative } from '../../services/platform';
import type { PageCount, Paper } from '../../lib/pagePlan';

export type ExportKind = 'pdf' | 'png' | 'file';

export interface ExportChoice {
  kind: ExportKind;
  paper: Paper;
  pages: PageCount;
  simple: boolean;
  print: boolean;
}

const KINDS: { value: ExportKind; icon: string; label: string; desc: string }[] = [
  { value: 'pdf', icon: '📄', label: 'PDF da stampare', desc: 'Per il quaderno, la verifica, l’esame.' },
  { value: 'png', icon: '🖼️', label: 'Immagine', desc: 'Da mandare in chat o mettere in una presentazione.' },
  { value: 'file', icon: '✏️', label: 'File modificabile', desc: 'Per continuare la mappa su un altro dispositivo o mandarla all’insegnante.' },
];

const PAGES: { value: PageCount; label: string }[] = [
  { value: 1, label: '1 foglio' },
  { value: 2, label: '2 fogli' },
  { value: 4, label: '4 fogli' },
];

interface Props {
  busy: boolean;
  /** The last attempt failed (not cancelled by the child). */
  error?: boolean;
  onExport(choice: ExportChoice): void;
  onClose(): void;
}

export function ExportDialog({ busy, error, onExport, onClose }: Props) {
  const [kind, setKind] = useState<ExportKind>('pdf');
  const [paper, setPaper] = useState<Paper>('a4');
  const [pages, setPages] = useState<PageCount>(1);
  const [simple, setSimple] = useState(false);
  const run = (print: boolean) => onExport({ kind, paper, pages, simple, print });

  return (
    <Dialog title="Salva, esporta o stampa" onClose={onClose} className="export-dialog">
      <div className="export-kinds">
        {KINDS.map((k) => (
          <button key={k.value} type="button" className="review-option" aria-pressed={kind === k.value} onClick={() => setKind(k.value)}>
            <span className="template-icon" aria-hidden>
              {k.icon}
            </span>
            <span className="template-name">{k.label}</span>
            <span className="template-desc">{k.desc}</span>
          </button>
        ))}
      </div>

      {kind === 'pdf' && (
        <>
          <fieldset>
            <legend>Foglio</legend>
            <div className="choice-row">
              <button type="button" className="choice" aria-pressed={paper === 'a4'} onClick={() => setPaper('a4')}>
                A4
              </button>
              <button type="button" className="choice" aria-pressed={paper === 'a3'} onClick={() => setPaper('a3')}>
                A3 (grande)
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>Dividi la mappa</legend>
            <div className="choice-row">
              {PAGES.map((p) => (
                <button key={p.value} type="button" className="choice" aria-pressed={pages === p.value} onClick={() => setPages(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
            <p className="muted">Fogli verticali. Con più fogli le scritte sono più grandi: si uniscono uno sotto l’altro con lo scotch.</p>
          </fieldset>
        </>
      )}

      {kind !== 'file' && (
        <label className="setting toggle export-simple-toggle">
          <input type="checkbox" checked={simple} onChange={(e) => setSimple(e.target.checked)} />
          <span>
            <strong>Versione per la verifica</strong>
            <br />
            <span className="muted">Sfondo bianco, senza colori né decorazioni.</span>
          </span>
        </label>
      )}

      {error && (
        <p className="field-error" role="alert">
          Non sono riuscito a preparare il file. Riprova.
        </p>
      )}

      <div className="dialog-actions">
        <BigButton icon="✖️" label="Annulla" onClick={onClose} />
        {kind === 'pdf' && !isNative() && <BigButton icon="🖨️" label="Stampa" disabled={busy} onClick={() => run(true)} />}
        <BigButton
          icon={isNative() ? '📤' : '💾'}
          label={busy ? 'Preparo…' : isNative() ? 'Condividi' : 'Salva'}
          variant="primary"
          disabled={busy}
          onClick={() => run(false)}
        />
      </div>
    </Dialog>
  );
}
