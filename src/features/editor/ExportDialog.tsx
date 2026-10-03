import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { BigButton } from '../../components/BigButton';
import type { ExportFormat } from '../../services/export';

const FORMATS: { value: ExportFormat; icon: string; label: string }[] = [
  { value: 'pdf-a4', icon: '📄', label: 'PDF A4' },
  { value: 'pdf-a3', icon: '🗞️', label: 'PDF A3 (grande)' },
  { value: 'png', icon: '🖼️', label: 'Immagine' },
];

interface Props {
  busy: boolean;
  onExport(format: ExportFormat, simple: boolean): void;
  onClose(): void;
}

export function ExportDialog({ busy, onExport, onClose }: Props) {
  const [format, setFormat] = useState<ExportFormat>('pdf-a4');
  const [simple, setSimple] = useState(false);

  return (
    <Dialog title="Esporta o stampa" onClose={onClose}>
      <div className="choice-row">
        {FORMATS.map((f) => (
          <button key={f.value} type="button" className="choice" aria-pressed={format === f.value} onClick={() => setFormat(f.value)}>
            {f.icon} {f.label}
          </button>
        ))}
      </div>
      <label className="setting toggle export-simple-toggle">
        <input type="checkbox" checked={simple} onChange={(e) => setSimple(e.target.checked)} />
        <span>
          <strong>Versione per la verifica</strong>
          <br />
          <span className="muted">Sfondo bianco, senza colori né decorazioni.</span>
        </span>
      </label>
      <div className="dialog-actions">
        <BigButton icon="✖️" label="Annulla" onClick={onClose} />
        <BigButton icon="📤" label={busy ? 'Preparo…' : 'Esporta'} variant="primary" disabled={busy} onClick={() => onExport(format, simple)} />
      </div>
    </Dialog>
  );
}
