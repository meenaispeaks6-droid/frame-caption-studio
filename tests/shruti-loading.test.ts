import {it,expect,vi,afterEach} from 'vitest';
vi.mock('../src/vendor/needle/needle.js',()=>({default:vi.fn(async()=>({}))}));
import {loadShruti} from '../src/shruti';
afterEach(()=>vi.unstubAllGlobals());
it('downloads when cache access fails and rejects truncated weights before native model loading',async()=>{
 const fetcher=vi.fn(async(url:string)=>String(url).includes('huggingface.co')?new Response(new Uint8Array([1,2,3])):new Response(new Uint8Array(4)));
 vi.stubGlobal('fetch',fetcher);vi.stubGlobal('caches',{open:async()=>({match:async()=>{throw Error('Storage unavailable');}})});
 await expect(loadShruti(()=>{})).rejects.toThrow('incomplete');expect(fetcher).toHaveBeenCalledTimes(2);
});
it('continues to a fresh download when corrupt cached bytes cannot be evicted',async()=>{
 const fetcher=vi.fn(async()=>new Response(new Uint8Array(4)));
 vi.stubGlobal('fetch',fetcher);vi.stubGlobal('caches',{open:async()=>({match:async()=>new Response(new Uint8Array(3)),delete:async()=>{throw Error('Storage unavailable');}})});
 await expect(loadShruti(()=>{})).rejects.toThrow('incomplete');expect(fetcher).toHaveBeenCalledTimes(2);
});
