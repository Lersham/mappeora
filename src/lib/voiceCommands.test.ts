import { describe, expect, it } from 'vitest';
import { parseQuizAnswer, parseVoiceCommand, QUIZ_VOICE_HINTS } from './voiceCommands';

describe('parseVoiceCommand', () => {
  it('recognises whole-sentence commands, ignoring case and final punctuation', () => {
    expect(parseVoiceCommand('Leggi la mappa.')).toEqual({ type: 'read' });
    expect(parseVoiceCommand('riordina')).toEqual({ type: 'tidy' });
    expect(parseVoiceCommand('Annulla!')).toEqual({ type: 'undo' });
    expect(parseVoiceCommand('rifai')).toEqual({ type: 'redo' });
  });

  it('strips the "nuovo concetto" prefix and capitalises', () => {
    expect(parseVoiceCommand('nuovo concetto il ciclo dell’acqua')).toEqual({ type: 'add', label: 'Il ciclo dell’acqua' });
  });

  it('treats anything else as a concept', () => {
    expect(parseVoiceCommand('annulla il viaggio')).toEqual({ type: 'add', label: 'Annulla il viaggio' });
    expect(parseVoiceCommand('evaporazione')).toEqual({ type: 'add', label: 'Evaporazione' });
    expect(parseVoiceCommand('constructor')).toEqual({ type: 'add', label: 'Constructor' });
  });

  it('returns null for silence', () => {
    expect(parseVoiceCommand('  ')).toBeNull();
  });
});

describe('parseQuizAnswer', () => {
  it('knows «lo sapevo» and «non lo sapevo», ignoring case and punctuation', () => {
    expect(parseQuizAnswer('Lo sapevo!')).toBe('knew');
    expect(parseQuizAnswer('sapevo')).toBe('knew');
    expect(parseQuizAnswer(' Non lo sapevo. ')).toBe('missed');
    expect(parseQuizAnswer('non sapevo')).toBe('missed');
    expect(parseQuizAnswer('non,  lo sapevo')).toBe('missed');
  });

  it('never takes a «non» for a «sì», nor the other way round', () => {
    for (const said of ['lo sapevo', 'sapevo']) expect(parseQuizAnswer(said)).toBe('knew');
    for (const said of ['non lo sapevo', 'non sapevo']) expect(parseQuizAnswer(said)).toBe('missed');
    // anything more than the answer is not taken as one
    expect(parseQuizAnswer('no lo sapevo')).toBeNull();
    expect(parseQuizAnswer('non lo sapevo ma lo so')).toBeNull();
    expect(parseQuizAnswer('sapevo non lo sapevo')).toBeNull();
  });

  it('ignores anything else, silence included', () => {
    expect(parseQuizAnswer('evaporazione')).toBeNull();
    expect(parseQuizAnswer('lo sapevo bene')).toBeNull();
    expect(parseQuizAnswer('constructor')).toBeNull();
    expect(parseQuizAnswer('')).toBeNull();
  });

  it('has a hint for each answer, and each hint works', () => {
    expect(QUIZ_VOICE_HINTS.map(parseQuizAnswer)).toEqual(['knew', 'missed']);
  });

  it('is not an editor command: there «lo sapevo» is still a concept', () => {
    expect(parseVoiceCommand('lo sapevo')).toEqual({ type: 'add', label: 'Lo sapevo' });
  });
});
