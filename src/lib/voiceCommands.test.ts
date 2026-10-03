import { describe, expect, it } from 'vitest';
import { parseVoiceCommand } from './voiceCommands';

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
  });

  it('returns null for silence', () => {
    expect(parseVoiceCommand('  ')).toBeNull();
  });
});
