import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { BigButton } from '../../components/BigButton';
import { OptionCard } from '../../components/OptionCard';
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
        <OptionCard
          key={e.file}
          icon={e.icon}
          name={e.title}
          extra={<span className="muted"> · {e.subject}</span>}
          description={loading === e.file ? 'Apro la mappa…' : e.description}
          disabled={loading !== null}
          onClick={() => void open(e)}
        />
      ))}
      {error && (
        <p className="field-error" role="alert">
          Non riesco ad aprire l’esempio. Controlla la connessione a internet.
        </p>
      )}
      <div className="dialog-actions">
        <BigButton icon="close" label="Chiudi" onClick={onClose} />
      </div>
    </Dialog>
  );
}
