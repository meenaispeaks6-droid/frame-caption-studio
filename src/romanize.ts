import Sanscript from '@indic-transliteration/sanscript';
import anyAscii from 'any-ascii';

// These are spelling conventions for the same spoken words, not translations.
// In particular, Hindi loan words keep their familiar English spelling.
const HINDI_SPELLINGS:Record<string,string>={
 'आज':'aaj','मैं':'main','में':'mein','हमें':'hume','हमे':'hume',
 'हूँ':'hoon','हूं':'hoon','है':'hai','हैं':'hain','हाँ':'haan','हां':'haan','नहीं':'nahi','नही':'nahi',
 'यह':'yeh','ये':'ye','वह':'woh','वो':'woh','वे':'ve','इस':'is','उस':'us','इसे':'ise','उसे':'use',
 'मैंने':'maine','मुझे':'mujhe','मुझको':'mujhko','मेरी':'meri','मेरा':'mera','मेरे':'mere',
 'तुम':'tum','तुम्हें':'tumhe','तुम्हे':'tumhe','तुम्हारा':'tumhara','तुम्हारी':'tumhari','तुम्हारे':'tumhare',
 'आप':'aap','आपको':'aapko','आपका':'aapka','आपकी':'aapki','आपके':'aapke',
 'हम':'hum','हमारा':'hamara','हमारी':'hamari','हमारे':'hamare','हमने':'humne',
 'अपना':'apna','अपनी':'apni','अपने':'apne','अपनेआप':'apne-aap',
 'एक':'ek','दो':'do','तीन':'teen','चार':'chaar','पाँच':'paanch','पांच':'paanch',
 'की':'ki','कि':'ki','के':'ke','को':'ko','का':'ka','से':'se','पर':'par','और':'aur','या':'ya',
 'भी':'bhi','ही':'hi','तो':'to','तक':'tak','बस':'bas','लिए':'liye','साथ':'saath',
 'क्या':'kya','क्यों':'kyun','क्यूं':'kyun','कैसे':'kaise','कैसा':'kaisa','कहाँ':'kahan','कहां':'kahan',
 'कौन':'kaun','कब':'kab','कभी':'kabhi','अभी':'abhi','फिर':'phir','कोई':'koi','कुछ':'kuch',
 'ऐसा':'aisa','ऐसे':'aise','ऐसी':'aisi','वैसा':'waisa','जैसे':'jaise','जैसा':'jaisa',
 'बहुत':'bahut','कम':'kam','ज्यादा':'zyada','ज़्यादा':'zyada','कमाल':'kamaal',
 'नया':'naya','नए':'naye','नई':'nayi','मिला':'mila','मिली':'mili','मिले':'mile',
 'बताने':'batane','बताता':'batata','बताऊंगा':'bataunga','दिखाने':'dikhane','दिखाऊंगा':'dikhaunga',
 'वाला':'wala','वाली':'wali','वाले':'wale','हो':'ho','होना':'hona','होता':'hota','होती':'hoti',
 'होगा':'hoga','होगी':'hogi','होंगे':'honge','था':'tha','थी':'thi','थे':'the',
 'करना':'karna','करते':'karte','करता':'karta','करती':'karti','किया':'kiya','किए':'kiye',
 'करेंगे':'karenge','करो':'karo','चाहिए':'chahiye','चाहता':'chahta','चाहती':'chahti',
 'अच्छा':'achha','अच्छी':'achhi','अच्छे':'achhe','सही':'sahi','बड़ा':'bada','बड़ी':'badi','धीरे':'dheere',
 'एआई':'AI','टूल':'tool','टूल्स':'tools','ट्रिक':'trick','ट्रिक्स':'tricks','वीडियो':'video',
 'कैप्शन':'caption','कैप्शन्स':'captions','एडिटर':'editor','अमेजिंग':'amazing','क्रेजी':'crazy',
 'फ़ोन':'phone','फोन':'phone','मोबाइल':'mobile','कंप्यूटर':'computer','ऐप':'app','ऐप्स':'apps',
 'वेबसाइट':'website','फाइल':'file','फ़ाइल':'file','एडिट':'edit','एडिटिंग':'editing',
 'डाउनलोड':'download','अपलोड':'upload','इंटरनेट':'internet',
 'गाइज':'Guys','गाइज़':'Guys','चैटजीपीटी':'ChatGPT','ओपनएआई':'OpenAI','गूगल':'Google',
 'यूट्यूब':'YouTube','इंस्टाग्राम':'Instagram','फेसबुक':'Facebook','व्हाट्सएप':'WhatsApp',
 'हिंदी':'Hindi','हिन्दी':'Hindi','इंग्लिश':'English','हिंग्लिश':'Hinglish','ॐ':'Om',
};

// NFC deliberately does not compose these canonical-exclusion characters.
// Sanscript recognizes the precomposed forms; normalize the pairs explicitly.
const NUKTA:Record<string,string>={'क़':'क़','ख़':'ख़','ग़':'ग़','ज़':'ज़','ड़':'ड़','ढ़':'ढ़','फ़':'फ़','य़':'य़','ऱ':'ऱ','ऩ':'ऩ','ऴ':'ऴ'};
function normalizeHindi(text:string){return text.normalize('NFC').replace(/[कखगजडढफयरनळ]़/g,pair=>NUKTA[pair]??pair);}
const hindiSpellings=new Map(Object.entries(HINDI_SPELLINGS).map(([from,to])=>[normalizeHindi(from),to]));
const C='(?:j~n|kh|gh|ch|Ch|jh|Th|Dh|th|dh|ph|bh|sh|Sh|[kgcjTDtdnpbmyrlvszNLfqh])';
const medialSchwa=new RegExp(`([aAiIuUeo]${C})a(?=${C}[aAiIuUeo])`,'g');

function hindiToLatin(source:string):string{
 const token=normalizeHindi(source),known=hindiSpellings.get(token);if(known)return known;
 let out=Sanscript.t(token,'devanagari','itrans');
 // The final implicit schwa is normally silent in Hindi; explicit vowel marks
 // remain intact. Medial deletion is restricted to a single consonant on
 // either side so a valid cluster such as "samarthan" is not over-shortened.
 if(/[क-हक़-य़]$/.test(token)&&out.length>1)out=out.replace(/a$/,'');
 out=out.replace(medialSchwa,'$1');
 return out.replace(/R\^I|RRI/g,'ri').replace(/R\^i|RRi/g,'ri')
  .replace(/L\^I|LLI|L\^i|LLi/g,'lri').replace(/j~n/g,'gy').replace(/~N/g,'ng').replace(/~n/g,'ny')
  .replace(/\.Dh/g,'dh').replace(/\.D/g,'d').replace(/Ch/g,'chh').replace(/Sh/g,'sh')
  .replace(/\.N/g,'n').replace(/M(?=[bmp])/g,'m').replace(/M/g,'n')
  .replace(/A/g,'aa').replace(/I/g,'i').replace(/U/g,'u').replace(/[TDNL]/g,v=>v.toLowerCase());
}

function otherToLatin(source:string):string{
 // The broad table omits bare Arabic alef because its sound is contextual.
 // Keep the explicit vowel letter rather than silently losing it.
 source=source.replace(/ا/g,'a');
 // AnyAscii intentionally omits unknown code points. Fail visibly instead
 // when that would remove a spoken letter. Combining marks can legitimately
 // disappear when their base character has been converted.
 for(const char of source)if(/\p{L}/u.test(char)&&!anyAscii(char).trim())throw new Error('This script cannot be romanized reliably on this device. Enter Latin-script captions manually.');
 return anyAscii(source);
}

function romanizeRaw(text:string):string{
 const out=text.replace(/[।॥。]/g,'.').replace(/[\u200c\u200d\uFEFF]/g,'')
  .replace(/[\p{L}\p{M}\p{N}]+/gu,token=>{
   if(/^[A-Za-z0-9]+$/.test(token))return token;
   // Keep embedded English names/acronyms verbatim, including their casing.
   return token.replace(/[^A-Za-z0-9]+/g,run=>/^[\u0900-\u097f]+$/.test(run)?hindiToLatin(run):otherToLatin(run));
  });
 if(/[^A-Za-z\P{L}]/u.test(out)||/[\p{M}]/u.test(out))throw new Error('Some words could not be converted to Latin script. Please correct those captions manually.');
 return out;
}

function startsWithNonLatinLetter(text:string){const first=text.match(/\p{L}/u)?.[0];return !!first&&!/\p{Script=Latin}/u.test(first);}
function capitalizeFirst(text:string){return text.replace(/[A-Za-z]/,letter=>letter.toUpperCase());}

/** Change writing script only. Existing ASCII words and brand casing survive. */
export function romanizeText(text:string):string{
 const out=romanizeRaw(text);return startsWithNonLatinLetter(text)?capitalizeFirst(out):out;
}

/** One input timing token produces exactly one output timing token. */
export function romanizeWords<T extends{text:string}>(words:T[]):T[]{
 let sentenceStart=true;
 return words.map(word=>{
  let text=romanizeRaw(word.text);
  if(sentenceStart&&startsWithNonLatinLetter(word.text))text=capitalizeFirst(text);
  if(/\p{L}/u.test(word.text))sentenceStart=/[.!?।॥。]\s*$/.test(word.text);
  return {...word,text};
 });
}
