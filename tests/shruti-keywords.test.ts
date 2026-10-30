import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function createContext() {
  const context: any = {
    importScripts() {},
    self: {postMessage() {}, crypto: {randomUUID: () => 'word-id'}},
    TextEncoder,
    performance: {now: () => 0},
  };
  runInNewContext(readFileSync('public/shruti/shruti-worker.js','utf8'), context);
  return context;
}

describe('Shruti native vocabulary boosting', () => {
  it('normalizes, deduplicates and limits user hints', () => {
    const context = createContext();
    expect(context.normalizeKeywordHints(' ChatGPT, Gemini, ChatGPT\nCapzi ')).toBe('ChatGPT\nGemini\nCapzi');
    expect(context.normalizeKeywordHints(Array.from({length:60}, (_,i) => 'term' + i)).split('\n')).toHaveLength(32);
    expect(context.normalizeKeywordHints('A, Example\u0000bad, OK')).toBe('Example bad\nOK');
  });

  it('passes UTF-8 hints to the engine and retains its real confidence values', () => {
    const context = createContext();
    const heap = new Uint8Array(1024 * 1024), encoder = new TextEncoder(), decoder = new TextDecoder();
    let pointer = 16;
    const fromPtr = (p: number) => {
      let end = p;
      while (heap[end] !== 0) end++;
      return decoder.decode(heap.subarray(p,end));
    };
    const seen: any[] = [], freed: number[] = [];
    context.M = {
      HEAPU8: heap,
      _malloc(n: number) { const p = pointer; pointer += n + 16; return p; },
      _free(p: number) { freed.push(p); },
      _needle_transcribe(p: number, count: number, lp: number, kp: number, wordTimes: number, out: number) {
        seen.push({count, language: fromPtr(lp), keywords: fromPtr(kp), wordTimes});
        heap.set(encoder.encode(JSON.stringify({text:'ChatGPT Capzi',language:'hi',words:[
          {word:'ChatGPT',start:0.1,end:0.4,probability:0.95},
          {word:'Capzi',start:0.4,end:0.8,probability:0.42}
        ]}) + '\u0000'), out);
        return 100;
      },
      UTF8ToString: fromPtr,
      _needle_last_error() { return 0; }
    };
    const result = context.transcribeCaptionWindow(new Float32Array(16000), 'hi', context.normalizeKeywordHints('ChatGPT, Capzi'));
    expect(seen).toEqual([{count:16000,language:'hi',keywords:'ChatGPT\nCapzi',wordTimes:1}]);
    expect(result.words[1].probability).toBe(0.42);
    expect(freed).toHaveLength(4);

    runInNewContext(readFileSync('public/shruti/timing.js','utf8'), context);
    const timed = context.recoverShrutiTiming(result,1,0);
    expect(timed.map((w:any)=>w.confidence)).toEqual([0.95,0.42]);
  });
});
