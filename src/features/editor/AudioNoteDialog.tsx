import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { BigButton } from '../../components/BigButton';
import { useMapStore } from '../../store/mapStore';
import { MAX_NOTE_MS, canRecord, formatDuration, playNote, startRecording, stopPlayback, type Recording } from '../../services/audioNote';
import type { MapNode } from '../../types/map';

type State = { kind: 'idle' } | { kind: 'recording'; since: number } | { kind: 'playing' } | { kind: 'error'; message: string };

/** "Spiega": the child records the concept explained in their own words. */
export function AudioNoteDialog({ node, onClose }: { node: MapNode; onClose(): void }) {
  const updateNode = useMapStore((s) => s.updateNode);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [now, setNow] = useState(Date.now());
  const recording = useRef<Recording | null>(null);

  // Tick the timer while recording; stop everything when the dialog closes.
  useEffect(() => {
    if (state.kind !== 'recording') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [state.kind]);
  useEffect(
    () => () => {
      recording.current?.stop();
      stopPlayback();
    },
    [],
  );

  const record = async () => {
    try {
      const rec = await startRecording();
      recording.current = rec;
      setState({ kind: 'recording', since: Date.now() });
      const note = await rec.done;
      recording.current = null;
      if (note) updateNode(node.id, { audio: note });
      setState({ kind: 'idle' });
    } catch {
      recording.current = null;
      setState({ kind: 'error', message: 'Non riesco a usare il microfono. Controlla di aver dato il permesso.' });
    }
  };

  const play = () => {
    if (!node.audio) return;
    setState({ kind: 'playing' });
    playNote(node.audio.dataUrl, () => setState({ kind: 'idle' })).catch(() => setState({ kind: 'idle' }));
  };

  if (!canRecord()) {
    return (
      <Dialog title="Spiega a voce" onClose={onClose}>
        <p>Questo dispositivo non permette di registrare la voce.</p>
        <div className="dialog-actions">
          <BigButton icon="✅" label="Ok" variant="primary" onClick={onClose} />
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="Spiega a voce" onClose={onClose} className="audio-note">
      <p className="audio-note-concept">«{node.label}»</p>
      <p className="muted">Spiega questo concetto con parole tue. Riascoltarti ti aiuta a ricordare.</p>

      {state.kind === 'recording' ? (
        <div className="audio-note-recording" role="status">
          <span className="rec-dot" aria-hidden />
          {formatDuration(now - state.since)} / {formatDuration(MAX_NOTE_MS)}
        </div>
      ) : node.audio ? (
        <p className="audio-note-saved">🎧 Spiegazione registrata: {formatDuration(node.audio.durationMs)}</p>
      ) : null}
      {state.kind === 'error' && <p className="field-error">{state.message}</p>}

      <div className="dialog-actions">
        {state.kind === 'recording' ? (
          <BigButton icon="⏹️" label="Fine" variant="primary" onClick={() => recording.current?.stop()} />
        ) : (
          <>
            {node.audio && (
              <>
                <BigButton icon="🗑️" label="Cancella" variant="danger" onClick={() => updateNode(node.id, { audio: undefined })} />
                {state.kind === 'playing' ? (
                  <BigButton icon="⏹️" label="Ferma" onClick={stopPlayback} />
                ) : (
                  <BigButton icon="▶️" label="Ascolta" onClick={play} />
                )}
              </>
            )}
            <BigButton icon="🔴" label={node.audio ? 'Rifai' : 'Registra'} variant={node.audio ? 'default' : 'primary'} onClick={() => void record()} />
            <BigButton icon="✅" label="Fatto" variant={node.audio ? 'primary' : 'default'} onClick={onClose} />
          </>
        )}
      </div>
    </Dialog>
  );
}
