import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { MicButton } from '../../components/MicButton';
import { BigButton } from '../../components/BigButton';
import { TEMPLATES } from '../../lib/templates';
import { NEW_MAP_TITLE } from '../../lib/mapFactory';
import { useReadAloud } from '../../hooks/useReadAloud';
import type { MapTemplate } from '../../types/map';

interface Props {
  onCreate(title: string, template: MapTemplate): void;
  onClose(): void;
}

export function NewMapDialog({ onCreate, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<MapTemplate>('libera');
  const { readText } = useReadAloud();

  return (
    <Dialog title="Nuova mappa" onClose={onClose} className="new-map-dialog">
      <label className="setting">
        <span>Di che cosa parla?</span>
        <div className="search-row">
          <input
            className="text-field"
            value={title}
            maxLength={1000}
            autoFocus
            placeholder="es. Il ciclo dell'acqua"
            onChange={(e) => setTitle(e.target.value)}
          />
          <MicButton onText={setTitle} />
        </div>
      </label>

      <p className="setting-label">Scegli come iniziare</p>
      <div className="template-grid">
        {TEMPLATES.map((t) => (
          <div key={t.id} className={`template-card${template === t.id ? ' is-selected' : ''}`}>
            <button type="button" className="template-pick" onClick={() => setTemplate(t.id)} aria-pressed={template === t.id}>
              <span className="template-icon" aria-hidden>
                {t.icon}
              </span>
              <span className="template-name">{t.name}</span>
              <span className="template-desc">{t.description}</span>
            </button>
            <button type="button" className="icon-button" aria-label={`Leggi: ${t.name}`} onClick={() => void readText(`${t.name}. ${t.description}`)}>
              🔊
            </button>
          </div>
        ))}
      </div>

      <div className="dialog-actions">
        <BigButton icon="✖️" label="Annulla" onClick={onClose} />
        <BigButton icon="✅" label="Crea" variant="primary" onClick={() => onCreate(title.trim() || NEW_MAP_TITLE, template)} />
      </div>
    </Dialog>
  );
}
