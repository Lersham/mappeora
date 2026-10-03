import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { BigButton } from '../../components/BigButton';
import { EXAMPLES, loadExample, type Example } from '../../services/examples';
import { storage } from '../../services/storage';

interface Props {
  onOpen(id: string): void;
  onClose(): void;
}

export function ExamplesDialog({ onOpen, onClose }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const open = async (example: Example) => {
    setLoading(example.file);
    setError(false);
    try {
      const map = await loadExample(example);
      await storage().save(map);
      onOpen(map.id);
    } catch {
      setError(true);
      setLoading(null);
    }
  };

  return (
    <Dialog title="Mappe di esempio" onClose={onClose}>
      <p className="muted">Guarda come è fatta una mappa, oppure usala come punto di partenza: si apre una copia tutta tua.</p>
      {EXAMPLES.map((e) => (
        <button key={e.file} type="button" className="review-option" disabled={loading !== null} onClick={() => void open(e)}>
          <span className="template-icon" aria-hidden>
            {e.icon}
          </span>
          <span className="template-name">
            {e.title} <span className="muted">· {e.subject}</span>
          </span>
          <span className="template-desc">{loading === e.file ? 'Apro la mappa…' : e.description}</span>
        </button>
      ))}
      {error && (
        <p className="field-error" role="alert">
          Non riesco ad aprire l’esempio. Controlla la connessione a internet.
        </p>
      )}
      <div className="dialog-actions">
        <BigButton icon="✖️" label="Chiudi" onClick={onClose} />
      </div>
    </Dialog>
  );
}
