import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakError } from '../services/speech/types';
import { useReading } from '../store/readingStore';

const service = vi.hoisted(() => ({ stopSpeaking: vi.fn(async () => {}), installVoice: undefined as (() => Promise<void>) | undefined }));
vi.mock('../services/speech', () => ({ speech: () => service }));

const { ownsSpeech, reportSpeakError, stopAllSpeech, takeSpeechTurn, useSpeechProblem } = await import('./speechTurn');

describe('speech turn', () => {
  beforeEach(() => {
    service.stopSpeaking.mockClear();
    service.installVoice = undefined;
    useSpeechProblem.setState({ problem: null });
  });

  it('only the newest speaker owns the voice', () => {
    const first = takeSpeechTurn();
    expect(ownsSpeech(first)).toBe(true);
    const second = takeSpeechTurn();
    expect(second).toBeGreaterThan(first);
    expect(ownsSpeech(first)).toBe(false);
    expect(ownsSpeech(second)).toBe(true);
  });

  it('taking the turn stops the highlighting of the map being read', () => {
    useReading.getState().set({ active: true, nodeId: 'n1', label: 'Acqua', word: { start: 0, end: 5 }, offset: 3 });
    takeSpeechTurn();
    expect(useReading.getState()).toMatchObject({ active: false, nodeId: null, label: null, word: null });
  });

  it('stopping everything silences the voice and ends every reading', async () => {
    const reading = takeSpeechTurn();
    await stopAllSpeech();
    expect(service.stopSpeaking).toHaveBeenCalledOnce();
    expect(ownsSpeech(reading)).toBe(false);
  });

  it('a missing Italian voice says so, and offers to install it where the phone can', () => {
    reportSpeakError(new SpeakError('no voice', true));
    expect(useSpeechProblem.getState().problem).toEqual({ message: expect.stringContaining('Manca la voce italiana'), canInstall: false });

    service.installVoice = async () => {};
    reportSpeakError(new SpeakError('no voice', true));
    expect(useSpeechProblem.getState().problem?.canInstall).toBe(true);
  });

  it('any other failure asks to try again, with nothing to install', () => {
    service.installVoice = async () => {};
    for (const e of [new SpeakError('busy', false), new Error('boom'), 'interrupted', undefined]) {
      reportSpeakError(e);
      expect(useSpeechProblem.getState().problem).toEqual({ message: expect.stringContaining('Riprova'), canInstall: false });
    }
  });
});
