import { useCallback } from 'react';
import { speech } from '../services/speech';
import { useSettings } from '../store/settingsStore';
import { useReading } from '../store/readingStore';
import { useMapStore } from '../store/mapStore';
import { readingOrder, type ReadingStep } from '../lib/readingOrder';

/** Incremented on every new read/stop so an older loop knows it was cancelled. */
let runId = 0;

export function useReadAloud() {
  const active = useReading((s) => s.active);

  const readSteps = useCallback(async (steps: ReadingStep[]) => {
    const myRun = ++runId;
    const { speechRate, voiceId, highlightWords } = useSettings.getState();
    const reading = useReading.getState();
    await speech().stopSpeaking();
    reading.set({ active: true });
    for (const step of steps) {
      if (myRun !== runId) return;
      const label = useMapStore.getState().map?.nodes.find((n) => n.id === step.nodeId)?.label ?? '';
      reading.set({ nodeId: step.nodeId, word: null, offset: step.text.length - label.length });
      await speech().speak(step.text, {
        rate: speechRate,
        voiceId,
        onWord: highlightWords && myRun === runId ? (start, end) => reading.set({ word: { start, end } }) : undefined,
      });
    }
    if (myRun === runId) reading.set({ active: false, nodeId: null, word: null });
  }, []);

  const readMap = useCallback(() => {
    const map = useMapStore.getState().map;
    if (map) void readSteps(readingOrder(map));
  }, [readSteps]);

  const readNode = useCallback(
    (nodeId: string) => {
      const node = useMapStore.getState().map?.nodes.find((n) => n.id === nodeId);
      if (node) void readSteps([{ nodeId, text: node.label }]);
    },
    [readSteps],
  );

  /** Reads arbitrary UI text (titles, buttons) without highlighting nodes. */
  const readText = useCallback(async (text: string) => {
    runId++;
    useReading.getState().set({ active: false, nodeId: null, word: null });
    const { speechRate, voiceId } = useSettings.getState();
    await speech().speak(text, { rate: speechRate, voiceId });
  }, []);

  const stop = useCallback(async () => {
    runId++;
    useReading.getState().set({ active: false, nodeId: null, word: null });
    await speech().stopSpeaking();
  }, []);

  return { active, readMap, readNode, readSteps, readText, stop };
}
