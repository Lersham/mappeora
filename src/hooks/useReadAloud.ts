import { useCallback } from 'react';
import { speech } from '../services/speech';
import { useSettings } from '../store/settingsStore';
import { useReading } from '../store/readingStore';
import { useMapStore } from '../store/mapStore';
import { readingOrder, type ReadingStep } from '../lib/readingOrder';
import { visiblePart } from '../lib/collapse';
import { templateInfo } from '../lib/templates';
import { ownsSpeech, reportSpeakError, stopAllSpeech, takeSpeechTurn } from './speechTurn';

export function useReadAloud() {
  const active = useReading((s) => s.active);

  const readSteps = useCallback(async (steps: ReadingStep[]) => {
    const myTurn = takeSpeechTurn();
    const { speechRate, voiceId, highlightWords } = useSettings.getState();
    const reading = useReading.getState();
    try {
      await speech().stopSpeaking();
      reading.set({ active: true });
      for (const step of steps) {
        if (!ownsSpeech(myTurn)) return;
        const label = useMapStore.getState().map?.nodes.find((n) => n.id === step.nodeId)?.label ?? '';
        reading.set({ nodeId: step.nodeId, word: null, offset: step.text.length - label.length });
        await speech().speak(step.text, {
          rate: speechRate,
          voiceId,
          onWord: highlightWords ? (start, end) => ownsSpeech(myTurn) && reading.set({ word: { start, end } }) : undefined,
        });
      }
    } catch (e) {
      if (ownsSpeech(myTurn)) reportSpeakError(e);
    } finally {
      if (ownsSpeech(myTurn)) reading.set({ active: false, nodeId: null, word: null });
    }
  }, []);

  const readMap = useCallback(() => {
    const map = useMapStore.getState().map;
    if (map) void readSteps(readingOrder(visiblePart(map), { depthFirst: templateInfo(map.template).layout === 'foglio' }));
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
    const myTurn = takeSpeechTurn();
    const { speechRate, voiceId } = useSettings.getState();
    try {
      await speech().speak(text, { rate: speechRate, voiceId });
    } catch (e) {
      if (ownsSpeech(myTurn)) reportSpeakError(e);
    }
  }, []);

  const stop = stopAllSpeech;

  return { active, readMap, readNode, readSteps, readText, stop };
}
