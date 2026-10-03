import { useEffect, useState } from 'react';
import { useSettings, type FontChoice, type ThemeChoice } from '../../store/settingsStore';
import { speech, type Voice } from '../../services/speech';
import { BigButton } from '../../components/BigButton';

const FONTS: { value: FontChoice; label: string }[] = [
  { value: 'lexend', label: 'Lexend' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'sistema', label: 'Sistema' },
];

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'crema', label: 'Crema' },
  { value: 'bianco', label: 'Bianco' },
  { value: 'azzurro', label: 'Azzurro' },
  { value: 'scuro', label: 'Scuro' },
];

const SAMPLE = 'La fotosintesi trasforma la luce in energia.';

export function SettingsPanel({ onClose }: { onClose(): void }) {
  const s = useSettings();
  const [voices, setVoices] = useState<Voice[]>([]);

  useEffect(() => {
    void speech().getVoices().then(setVoices);
  }, []);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="overlay-card settings">
        <h2 id="settings-title">Aspetto e voce</h2>

        <fieldset>
          <legend>Carattere</legend>
          <div className="choice-row">
            {FONTS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`choice font-${f.value}`}
                aria-pressed={s.font === f.value}
                onClick={() => s.update({ font: f.value })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Sfondo</legend>
          <div className="choice-row">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`choice swatch theme-${t.value}`}
                aria-pressed={s.theme === t.value}
                onClick={() => s.update({ theme: t.value })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="setting">
          <span>Grandezza testo</span>
          <input
            type="range"
            min={0.9}
            max={1.8}
            step={0.05}
            value={s.textScale}
            onChange={(e) => s.update({ textScale: Number(e.target.value) })}
          />
        </label>

        <label className="setting toggle">
          <input type="checkbox" checked={s.uppercase} onChange={(e) => s.update({ uppercase: e.target.checked })} />
          <span>TUTTO IN STAMPATELLO MAIUSCOLO</span>
        </label>

        <label className="setting toggle">
          <input type="checkbox" checked={s.wideSpacing} onChange={(e) => s.update({ wideSpacing: e.target.checked })} />
          <span>Lettere e righe più distanziate</span>
        </label>

        <label className="setting toggle">
          <input
            type="checkbox"
            checked={s.highlightWords}
            onChange={(e) => s.update({ highlightWords: e.target.checked })}
          />
          <span>Evidenzia le parole mentre leggo</span>
        </label>

        <label className="setting">
          <span>Velocità della voce</span>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={s.speechRate}
            onChange={(e) => s.update({ speechRate: Number(e.target.value) })}
          />
        </label>

        {voices.length > 0 && (
          <label className="setting">
            <span>Voce</span>
            <select value={s.voiceId ?? ''} onChange={(e) => s.update({ voiceId: e.target.value || undefined })}>
              <option value="">Predefinita</option>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <p className="sample">{SAMPLE}</p>

        <div className="dialog-actions">
          <BigButton
            icon="🔊"
            label="Prova la voce"
            onClick={() => void speech().speak(SAMPLE, { rate: s.speechRate, voiceId: s.voiceId })}
          />
          <BigButton icon="↺" label="Ripristina" onClick={s.reset} />
          <BigButton icon="✅" label="Chiudi" variant="primary" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}
