import { speech } from './speech';

/** Long enough to explain a concept, short enough to keep map files small. */
export const MAX_NOTE_MS = 120_000;

export interface Recording {
  /** Resolves with the finished note (null if nothing was recorded). */
  done: Promise<{ dataUrl: string; durationMs: number } | null>;
  stop(): void;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function pickMimeType(): string | undefined {
  // Opus in WebM on Chrome/Android, AAC in MP4 on Safari/iOS.
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
}

export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/** Starts recording from the microphone; asks for permission the first time. */
export async function startRecording(): Promise<Recording> {
  stopPlayback();
  await speech().stopSpeaking();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 });
  const chunks: Blob[] = [];
  const startedAt = Date.now();
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

  const done = new Promise<{ dataUrl: string; durationMs: number } | null>((resolve, reject) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      clearTimeout(limit);
      if (chunks.length === 0) return resolve(null);
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
      blobToDataUrl(blob).then((dataUrl) => resolve({ dataUrl, durationMs: Date.now() - startedAt }), reject);
    };
  });
  const stop = () => recorder.state !== 'inactive' && recorder.stop();
  const limit = setTimeout(stop, MAX_NOTE_MS);
  recorder.start();
  return { done, stop };
}

let current: HTMLAudioElement | null = null;

/** Plays a note; starting another one (or the voice reader) stops it. */
export async function playNote(dataUrl: string, onEnd?: () => void): Promise<void> {
  stopPlayback();
  await speech().stopSpeaking();
  const audio = new Audio(dataUrl);
  current = audio;
  audio.onended = audio.onpause = () => {
    if (current === audio) current = null;
    onEnd?.();
  };
  await audio.play();
}

export function stopPlayback(): void {
  current?.pause();
  current = null;
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
