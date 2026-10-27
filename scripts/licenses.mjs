import fs from 'node:fs';
import path from 'node:path';
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
const rows=[];let output='FRAME CAPTION STUDIO — THIRD-PARTY NOTICES\n\n';
output+='The application extends the unmodified MIT @tscaps/engine package; no code from Tscaps apps/studio, Kalakar, or whisper-web is distributed.\n\nMediabunny 1.62.1 is unmodified MPL-2.0 covered software. Its corresponding source is available at https://www.npmjs.com/package/mediabunny/v/1.62.1 and https://github.com/Vanilagy/mediabunny/tree/v1.62.1 . The MPL covers that library, not the independent application files.\n\nFonts are bundled under the SIL Open Font License. Whisper model weights are downloaded on demand from Xenova/whisper-tiny, Xenova/whisper-base or Xenova/whisper-small (Apache-2.0 model cards); OpenAI Whisper original code/weights use MIT. Explicit caption translation downloads Xenova/m2m100_418M, an ONNX conversion of facebook/m2m100_418M (MIT; https://huggingface.co/facebook/m2m100_418M). The model files are not included in this distribution.\n\n';
output+='\nSilero VAD model (MIT), from @ricky0123/vad-web@0.0.31. Source: https://github.com/snakers4/silero-vad\n'+fs.readFileSync('third_party/SILERO_LICENSE.txt','utf8')+'\n';
for(const [dir,meta] of Object.entries(lock.packages)){
 if(!dir||meta.dev||!dir.includes('node_modules/'))continue;
 const pkgPath=path.join(dir,'package.json');if(!fs.existsSync(pkgPath))continue;
 const pkg=JSON.parse(fs.readFileSync(pkgPath));const names=fs.readdirSync(dir).filter(n=>/^(license|licence|copying|notice|ofl)(\.|$)/i.test(n)&&fs.statSync(path.join(dir,n)).isFile());
 rows.push({name:pkg.name,version:pkg.version,license:pkg.license??meta.license??'UNKNOWN',noticeFiles:names,repository:typeof pkg.repository==='string'?pkg.repository:pkg.repository?.url});
 output+='\n'+'='.repeat(72)+'\n'+pkg.name+'@'+pkg.version+'\nLicense: '+(pkg.license??meta.license??'UNKNOWN')+'\n';
 for(const n of names)output+='\n'+n+'\n'+fs.readFileSync(path.join(dir,n),'utf8')+'\n';
}
fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/dependency-licenses.json',JSON.stringify(rows,null,2));fs.writeFileSync('public/THIRD_PARTY_NOTICES.txt',output);
const flagged=rows.filter(x=>/UNKNOWN|AGPL|GPL|SEE LICENSE/i.test(x.license));console.log(JSON.stringify({packages:rows.length,flagged},null,2));
