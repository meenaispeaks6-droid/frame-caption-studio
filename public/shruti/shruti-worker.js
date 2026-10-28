/* Shruti in the browser: the Web Worker that runs the speech engine, so the page never freezes.
 *
 * It starts the Cactus needle engine (WebAssembly, Apache-2.0, in ./needle/), downloads shruti.cact from Hugging Face
 * once, checks its SHA-256, keeps it in this site's Cache Storage for the next visit, and transcribes the 16 kHz mono
 * float audio the page sends it. Audio and transcripts never leave the device: the only network requests are for the
 * engine files and the model file.
 *
 * Messages in                                   Messages out
 *   {type:'init', url, sha256, bytes}             {type:'progress', loaded, total}..., then {type:'ready', source, saved}
 *   {type:'transcribe', id, pcm, language}        {type:'result', id, text, language, seconds, ms}
 * language is 'hi', 'en', or null to detect it (recommended). Errors come back as {type:'error', stage, id, message}.
 *
 * The engine also has live (streaming) transcription: _needle_stream_transcribe_process and
 * _needle_stream_transcribe_stop take about one second of audio at a time. See needle.h in Cactus-Compute/needle3.
 */
'use strict'
importScripts('needle/needle.js') /* global createNeedle */

var CACHE_NAME = 'shruti-example-v1'
var MAGIC = [0x84, 0x2a, 0xe1, 0x05] // the first four bytes of every .cact file
var SR = 16000

var M = null // the engine (an Emscripten module)
var loaded = false
var encoder = new TextEncoder()

function send(msg) {
  self.postMessage(msg)
}

function isCact(b) {
  if (!b || b.length < 1024) return false
  for (var i = 0; i < MAGIC.length; i++) if (b[i] !== MAGIC[i]) return false
  return true
}

async function sha256Hex(bytes) {
  var d = new Uint8Array(await self.crypto.subtle.digest('SHA-256', bytes))
  return Array.from(d, function (x) { return x.toString(16).padStart(2, '0') }).join('')
}

async function openCache() {
  try {
    return self.caches ? await self.caches.open(CACHE_NAME) : null
  } catch (e) {
    return null // private windows and blocked storage: it still works, it just downloads again next time
  }
}

async function getModel(url, sha256, expectedBytes) {
  var cache = await openCache()
  if (cache) {
    var hit = await cache.match(url)
    if (hit) {
      var cached = new Uint8Array(await hit.arrayBuffer())
      if (isCact(cached)) return { bytes: cached, source: 'cache', saved: true }
      await cache.delete(url)
    }
  }
  var res = await fetch(url, { mode: 'cors', credentials: 'omit' })
  if (!res.ok) throw new Error('The model download failed (HTTP ' + res.status + ').')
  var total = Number(res.headers.get('content-length')) || expectedBytes || 0
  var parts = []
  var got = 0
  var last = 0
  var reader = res.body.getReader()
  for (;;) {
    var step = await reader.read()
    if (step.done) break
    parts.push(step.value)
    got += step.value.length
    if (Date.now() - last > 100) {
      last = Date.now()
      send({ type: 'progress', loaded: got, total: Math.max(total, got) })
    }
  }
  var bytes = new Uint8Array(got)
  var at = 0
  for (var i = 0; i < parts.length; i++) {
    bytes.set(parts[i], at)
    at += parts[i].length
  }
  if (!isCact(bytes)) throw new Error('The downloaded file is not a Shruti model.')
  // crypto.subtle exists only on https and localhost pages; elsewhere the magic-number check above has to do.
  if (sha256 && self.crypto && self.crypto.subtle) {
    var hex = await sha256Hex(bytes)
    if (hex !== sha256) throw new Error('The downloaded model has SHA-256 ' + hex + ', not the expected ' + sha256 + '.')
  }
  var saved = false
  if (cache) {
    try {
      await cache.put(url, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }))
      saved = true
    } catch (e) {
      /* storage full or blocked: it works now and downloads again next time */
    }
  }
  return { bytes: bytes, source: 'network', saved: saved }
}

async function startEngine() {
  // This build cannot be told where needle.wasm lives, so fetch it here and hand the bytes over.
  var r = await fetch(new URL('needle/needle.wasm', self.location.href).href)
  if (!r.ok) throw new Error('Could not load the speech engine (HTTP ' + r.status + ').')
  return createNeedle({ wasmBinary: await r.arrayBuffer(), print: function () {}, printErr: function () {} })
}

function lastError() {
  try {
    return M.UTF8ToString(M._needle_last_error()) || 'The engine reported an error.'
  } catch (e) {
    return 'The engine reported an error.'
  }
}

function alloc(n) {
  var p = M._malloc(n)
  if (!p) throw new Error('out of memory')
  return p
}

function copyIn(bytes) {
  var p = alloc(Math.max(4, bytes.length))
  M.HEAPU8.set(bytes, p) // always read HEAPU8 afresh: it is replaced when the heap grows
  return p
}

async function init(msg) {
  try {
    if (!loaded) {
      var both = await Promise.all([getModel(msg.url, msg.sha256, msg.bytes), startEngine()])
      var model = both[0]
      M = both[1]
      var ptr = copyIn(model.bytes)
      var rc = M._needle_load(ptr, BigInt(model.bytes.length))
      M._free(ptr) // the engine keeps its own copy
      if (rc < 0) throw new Error(lastError())
      if (!(M._needle_models() & 2)) throw new Error('This file has no speech model in it.')
      loaded = true
      send({ type: 'ready', source: model.source, saved: model.saved })
    } else send({ type: 'ready', source: 'memory', saved: true })
  } catch (e) {
    send({ type: 'error', stage: 'init', message: String((e && e.message) || e) })
  }
}

function transcribe(msg) {
  var pcm = msg.pcm // Float32Array, 16 kHz mono, [-1, 1]
  var seconds = pcm.length / SR
  var p = copyIn(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.length * 4))
  var lp = msg.language ? copyIn(encoder.encode(msg.language + '\0')) : 0
  var cap = Math.max(1 << 16, Math.ceil(seconds) * 4096 + (1 << 14)) // room for the JSON result
  var out = alloc(cap)
  try {
    var t0 = performance.now()
    // needle_transcribe(samples, count, language, keywords, word_timestamps, out, out_size) -> bytes written, or < 0
    var n = M._needle_transcribe(p, pcm.length, lp, 0, 0, out, cap)
    var ms = performance.now() - t0
    if (n < 0) throw new Error(lastError())
    var r = JSON.parse(M.UTF8ToString(out))
    send({ type: 'result', id: msg.id, text: r.text, language: r.language, seconds: seconds, ms: ms })
  } finally {
    M._free(out)
    M._free(p)
    if (lp) M._free(lp)
  }
}

self.onmessage = function (e) {
  var msg = e.data || {}
  if (msg.type === 'init') return init(msg)
  if (msg.type === 'transcribe' && msg.audio instanceof Float32Array) { void runCaptionJob(msg); return }
  try {
    if (!loaded) throw new Error('The engine is not ready yet.')
    if (msg.type === 'transcribe') transcribe(msg)
  } catch (err) {
    send({ type: 'error', stage: msg.type, id: msg.id, message: String((err && err.message) || err) })
  }
}

// Frame Caption Studio adapter. Keep the original Shruti demo API above intact.
// Inference stays in this worker: only versioned model/engine assets are downloaded.
var SHRUTI_MODEL_URL = 'https://huggingface.co/udgamlabs/Shruti/resolve/main/shruti.cact'
var SHRUTI_SHA = 'b189e954aaed4a9fd41acbad3ac05e486381e96325b22a4c695b9ea5153d7065'
var SHRUTI_BYTES = 29546527

function transcribeCaptionWindow(pcm, language) {
  var p = copyIn(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength))
  var lp = language ? copyIn(encoder.encode(language + '\0')) : 0
  var cap = Math.max(131072, Math.ceil(pcm.length / SR) * 12000 + 65536)
  var out = alloc(cap)
  try {
    // Word timings come from the native engine. Never distribute words evenly.
    var n = M._needle_transcribe(p, pcm.length, lp, 0, 1, out, cap)
    if (n < 0) throw new Error(lastError())
    return JSON.parse(M.UTF8ToString(out))
  } finally {
    M._free(out)
    M._free(p)
    if (lp) M._free(lp)
  }
}

async function runCaptionJob(msg) {
  var transcript = []
  try {
    if (!loaded) {
      await init({ url: SHRUTI_MODEL_URL, sha256: SHRUTI_SHA, bytes: SHRUTI_BYTES })
      if (!loaded) return // init already posted a descriptive error
    }
    var audio = msg.audio
    if (!(audio instanceof Float32Array) || audio.length < SR / 4) throw new Error('No usable 16 kHz speech audio was supplied.')
    // The native needle API supports windows up to 30 seconds; leave headroom.
    var windowLength = 28 * SR
    var total = Math.ceil(audio.length / windowLength)
    var language = msg.language === 'english' ? 'en' : null
    var words = []
    var detectedLanguage = null
    var lastEnd = 0
    var started = performance.now()
    for (var i = 0; i < total; i++) {
      send({type:'stage', label:'Shruti · processing speech window ' + (i + 1) + ' of ' + total})
      var startSample = i * windowLength
      var segment = audio.subarray(startSample, Math.min(audio.length, startSample + windowLength))
      var result = transcribeCaptionWindow(segment, language)
      if (result.text && result.text.trim()) transcript.push(result.text.trim())
      if (result.language) detectedLanguage = result.language
      var segments = Array.isArray(result.words) ? result.words : []
      if (result.text && result.text.trim() && !segments.length) {
        throw new Error('Shruti produced text but no real word timestamps. Use Whisper or correct the saved draft.')
      }
      for (var j = 0; j < segments.length; j++) {
        var w = segments[j]
        var word = String(w.word || w.text || '').trim()
        if (!word) continue
        var a = Number(w.start) + startSample / SR
        var b = Number(w.end) + startSample / SR
        if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= a || a + 0.05 < lastEnd || b > audio.length / SR + 0.1) {
          throw new Error('Shruti returned invalid word timing. Its raw transcript was preserved.')
        }
        a = Math.max(a, lastEnd)
        if (b <= a) throw new Error('Shruti returned overlapping word times. Its raw transcript was preserved.')
        words.push({id: self.crypto.randomUUID(), text: word, start: a, end: b, timing: 'word'})
        lastEnd = b
      }
    }
    send({type:'done', words:words, translated:false, timingEstimated:false,
      usedPhraseTiming:false, detectedLanguage:detectedLanguage, elapsedMs: performance.now()-started,
      warnings: ['Shruti is experimental. Review word accuracy and timings, especially across 28-second boundaries.']})
  } catch (e) {
    send({type:'error', message: String(e && e.message || e), draftTranscript:transcript.join('\n') || undefined})
  }
}
