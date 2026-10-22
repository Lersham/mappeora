import { speech } from '../services/speech';
import { useSettings } from '../store/settingsStore';
import { useReading } from '../store/readingStore';
import { useMapStore } from '../store/mapStore';
import { readingOrder, type ReadingStep } from '../lib/readingOrder';
import { visiblePart } from '../lib/collapse';
import { templateInfo } from '../lib/templates';
import { ownsSpeech, reportSpeakError, stopAllSpeech, takeSpeechTurn } from './speechTurn';

// The reading functions live outside the hook: they only use the stores' getState(),
// so a component that just wants to read something (every concept has a speak
// button) can call them without subscribing to `active` and re-rendering whenever
// the reading starts or stops.

export async function readStepsAloud(steps: ReadingStep[]) {
  const myTurn = takeSpeechTurn();
  const { speechRate, voiceId, highlightWords } = useSettings.getState();
  const reading = useReading.getState();
  try {
    await speech().stopSpeaking();
    reading.set({ active: true });
    for (const step of steps) {
      if (!ownsSpeech(myTurn)) return;
      const label = useMapStore.getState().map?.nodes.find((n) => n.id === step.nodeId)?.label ?? '';
      reading.set({ nodeId: step.nodeId, label, word: null, offset: step.text.length - label.length });
      await speech().speak(step.text, {
        rate: speechRate,
        voiceId,
        onWord: highlightWords ? (start, end) => ownsSpeech(myTurn) && reading.set({ word: { start, end } }) : undefined,
      });
    }
  } catch (e) {
    if (ownsSpeech(myTurn)) reportSpeakError(e);
  } finally {
    if (ownsSpeech(myTurn)) reading.set({ active: false, nodeId: null, label: null, word: null });
  }
}

export function readMapAloud() {
  const map = useMapStore.getState().map;
  if (map) void readStepsAloud(readingOrder(visiblePart(map), { depthFirst: templateInfo(map.template).layout === 'foglio' }));
}

export function readNodeAloud(nodeId: string) {
  const node = useMapStore.getState().map?.nodes.find((n) => n.id === nodeId);
  if (node) void readStepsAloud([{ nodeId, text: node.label }]);
}

/** Reads arbitrary UI text (titles, buttons) without highlighting nodes. */
export async function readTextAloud(text: string) {
  const myTurn = takeSpeechTurn();
  const { speechRate, voiceId } = useSettings.getState();
  try {
    await speech().speak(text, { rate: speechRate, voiceId });
  } catch (e) {
    if (ownsSpeech(myTurn)) reportSpeakError(e);
  }
}

export function useReadAloud() {
  const active = useReading((s) => s.active);
  return { active, readMap: readMapAloud, readNode: readNodeAloud, readSteps: readStepsAloud, readText: readTextAloud, stop: stopAllSpeech };
}
