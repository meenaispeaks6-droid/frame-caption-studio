/* Native alignment recovery. Merge overlapping/zero-duration tokens into a
 * phrase using only emitted boundaries; never fabricate per-word timestamps. */
function recoverShrutiTiming(result, duration, offset) {
  var tokens = Array.isArray(result.words) ? result.words : []
  var text = String(result.text || '').trim()
  var normalize = function (s) { return s.replace(/[\s\p{P}]/gu, '').toLowerCase() }
  if (!text && !tokens.length) return []
  if (!tokens.length || normalize(tokens.map(function (w) { return w.word || w.text || '' }).join(' ')) !== normalize(text)) {
    throw new Error('Shruti recognized speech but could not time every word. The transcript is saved; try Whisper Base or import subtitles.')
  }
  var groups = [], pending = null
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i], word = String(token.word || token.text || '').trim()
    if (!word) continue
    var a = token.start, b = token.end
    if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b) || a < -.1 || b < a || b > duration + .1 || a > duration + .1) {
      throw new Error('Shruti returned unusable alignment boundaries. The transcript is saved; try Whisper Base or import subtitles.')
    }
    a = Math.max(0, Math.min(duration, a)); b = Math.max(a, Math.min(duration, b))
    var current = {text:word,start:a,end:b,timing:'word',probability:typeof token.probability==='number'&&Number.isFinite(token.probability)&&token.probability>=0&&token.probability<=1?token.probability:undefined}
    if (pending) { current.probability = current.probability===undefined&&pending.probability===undefined?undefined:Math.min(current.probability??1,pending.probability??1); current.text = pending.text + ' ' + word; current.start = Math.min(pending.start,a); current.end = Math.max(pending.end,b); current.timing = 'segment'; pending = null }
    while (groups.length && (current.start < groups[groups.length-1].end || current.end === current.start)) {
      var previous = groups.pop()
      current = {text:previous.text+' '+current.text,start:Math.min(previous.start,current.start),end:Math.max(previous.end,current.end),timing:'segment',probability:previous.probability===undefined&&current.probability===undefined?undefined:Math.min(previous.probability??1,current.probability??1)}
    }
    if (current.end <= current.start) pending = current
    else groups.push(current)
  }
  if (pending) {
    if (!groups.length) throw new Error('Shruti recognized speech without a usable time interval. The transcript is saved; try Whisper Base.')
    var last = groups[groups.length-1];last.probability = last.probability===undefined&&pending.probability===undefined?undefined:Math.min(last.probability??1,pending.probability??1);last.text += ' '+pending.text;last.end = Math.max(last.end,pending.end);last.timing = 'segment'
  }
  return groups.map(function (g) {return {id:self.crypto.randomUUID(),text:g.text,start:g.start+offset,end:g.end+offset,timing:g.timing,probability:g.probability}})
}
