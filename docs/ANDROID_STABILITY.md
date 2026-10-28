# Android resource lifecycle changes

This patch addresses verified memory ownership problems; it does not establish that physical Android tab crashes have been eliminated. Production has not been deployed.

## Findings and changes

| Issue | Status | Root cause | Main files | Verification |
|---|---|---|---|---|
| Old decode continues after replacement/cancel | Fixed and Verified | UI cancellation suppressed state updates without stopping the decoder | media.ts, App.tsx | 180s audio session abort, no subsequent progress; serialized decoding |
| PCM retained/copied | Fixed and Verified | Module promise cache, component cache and full transfer copy | media.ts, App.tsx | Detached transfer; retired PCM collected after forced GC |
| Project parsing during playback | Fixed and Verified | readSaved evaluated as useRef argument on every render | App.tsx | 14 reads/3s baseline; zero during 3.1s playback after startup |
| Worker/model retention | Fixed and Verified for lifecycle | Idle WASM realm retained on mobile; model changes reused its high-water memory | speech-client.ts, translation.worker.ts | Immediate mobile termination, model replacement, translation handoff and late-message tests; controlled mobile UI |
| Decode/inference/export overlap | Fixed and Verified for tested paths | Preparation occurred outside the speech cache/gate; decode lacked cancellation | App.tsx, media.ts | Native job lifecycle, cancel/replace and cached generation checks |
| Export input cleanup and output buffering | Fixed and Verified | Coordinator omitted Input.dispose; full encoded output accumulated in BufferTarget | coordinator.ts, exporter.ts, export-storage.ts | Input disposal counters, OPFS and buffer fallback, fully decoded 30/60/180s MP4 |
| Full-duration filtering scratch | Fixed and Verified | Two Float64 arrays scaled with clip duration | audio-processing.ts | 17031-sample output byte-identical to original; SNR/timeline unit tests |
| Physical Android Aw, Snap | Blocked | Device OOM/native decoder/driver behavior cannot be established through emulation | — | Physical Moto/Android testing required |

The same-file caches previously referenced one array: those references alone were not two PCM allocations. At 180 seconds mono PCM is 11,520,000 bytes. The redundant generation copy is removed. Filtering's two duration-sized Float64 scratch arrays previously required 46,080,000 bytes at that duration; the overlap accumulators now total 8,192 bytes, plus fixed FFT buffers and the output PCM.

The baseline replaced decode continued for 13.9 seconds. In the first new stress run cancellation settled in 24.9 ms on desktop Chromium. These are lifecycle observations, not Android performance promises. Uninterruptible native Web Audio batches finish before the next decode starts.

## Behavior

Auto processing uses mobile-friendly mode on mobile or <=4 GB devices. New projects recommend Tiny for <=4 GB/unknown mobile memory, Base for higher-memory mobile, Small on unconstrained desktop. Existing projects and explicitly chosen models remain respected. All models remain selectable.

Mobile-friendly processing displays the last preview frame and releases the video element decoder while working, then restores the source/time without autoplay. Preview resolution is reduced independently of export resolution. Hidden/paused previews do not run a continuous draw loop. Caption styles, editing and local-first behavior remain available.

Audio has one source-scoped session. Cancellation propagates to packet scanning, native sample decoding, resampling and fallback segments. Native decoding is serialized, resampling batches are five seconds on mobile and Web Audio fallback segments ten seconds. The queue deliberately retains no completed PCM result. Speech cache hits skip audio preparation. Source offsets remain attached to cached results and are applied once.

Whisper is terminated before separately requested local translation loads; mobile workers terminate after results. Desktop retains its 30-second reuse window. Translation handoff is covered with controlled workers; new actual M2M execution has not been rerun in this patch. Actual Small-model English and Hindi recognition completed using cached public models, with valid word intervals and Latin output. Hindi substitutions remain; accuracy is not claimed improved. Timing under concurrent test load is recorded in the evidence and is not a first-inference speed improvement.

Exports retain existing bitrate, resolution, original audio and codec policy. OPFS uses local files and one-MiB positional writes with backpressure. Unsupported/denied OPFS uses the in-memory fallback. Storage exhaustion is surfaced with an actionable error. Completed files are checked for video dimensions, positive duration and required audio before success. Cancelled files are deleted; superseded downloads have a 30-second release grace period. Files older than 24 hours are cleaned only if a Web Lock confirms no active export owns them; without Locks, automatic stale deletion is skipped. Fatal tab termination may leave temporary files until this cleanup.

Local diagnostics contain only a bounded set of fixed lifecycle names, timestamps and numeric metadata. Nothing is uploaded. Project state and an interrupted-job marker survive reloads; reconnecting the source is still required. An interrupted marker does not prove an OOM.

## Validation and remaining limits

Run `npm run test`, `npm run build`, `npm run test:browser`, `node tests/android-stability.mjs`, `node tests/resource-cleanup.mjs`, `node tests/native-jobs.mjs`, `node tests/speech-fallback-ui.mjs`, `node tests/caption-drag.mjs`, `node tests/languages.mjs` and `node tests/media.mjs`. The stress test creates synthetic fixtures with FFmpeg. `STRESS_DURATIONS=30 STRESS_DETAILED=1 STRESS_REPORT=android-detailed.json node tests/android-stability.mjs` adds moving test-pattern footage. Build before browser checks and keep dist unchanged during a run: rebuilding hashed workers underneath an open test page can cause module-load failures.

Android checks are Pixel 7 Chromium emulation with 2 GB reported memory, not hardware OOM simulation. JS GC tests do not measure all GPU/native/WASM memory. Physical Android startup/idle, thermal/background behavior, 30/60/180s real-footage workflows, all selected models, memory pressure and sustained repeat cycles remain release validation requirements. HTML video decoder fallback still depends on browser/platform behavior and deserves device-specific stress testing. No new file-size limits or automatic export-quality reductions were added.

Final checks: 41 Vitest tests and the production build passed. Browser, language, caption-drag, native-job, recovery, media and audio-timeline regressions passed. Both flat 30/60/180-second exports and a separate 30-second moving-detail export fully decoded with expected dimensions, duration and audio. The detailed test initially exhausted the Node test runner by serializing the entire file as a number array; binary downloads corrected the harness and the rerun passed. Two earlier browser waits timed out while build artifacts were being replaced; both passed on fixed-build reruns. No failed final assertions remain. Evidence: `validation-evidence/android-stability.json`.
