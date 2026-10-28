import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGES, readLanguageSettings } from '../src/languages';
import { romanizeWords } from '../src/romanize';

describe('optional Shruti ASR integration', () => {
  it('keeps existing Whisper Small as the default for saved and new projects', () => {
    expect(DEFAULT_LANGUAGES.model).toBe('small');
    expect(readLanguageSettings(null).model).toBe('small');
    expect(readLanguageSettings({ spoken: 'hindi', caption: 'same', model: 'base' }).model).toBe('base');
  });
  it('accepts Shruti as a separate saved choice', () => {
    expect(readLanguageSettings({ spoken: 'hinglish', caption: 'same', model: 'shruti' })).toMatchObject({
      spoken: 'hinglish', caption: 'same', model: 'shruti', audioMode: 'original'
    });
  });
  it('does not translate recognized Hindi or English words when romanizing', () => {
    const words = [{ id: '1', text: 'मुझे', start: 0, end: 0.4 }, { id: '2', text: 'AI', start: 0.5, end: 0.8 }];
    expect(romanizeWords(words).map(w => w.text)).toEqual(['mujhe', 'AI']);
  });
  it('rejects unknown engine names instead of silently changing the selected engine', () => {
    expect(() => readLanguageSettings({ spoken: 'hindi', caption: 'same', model: 'unknown' })).toThrow();
  });
});
