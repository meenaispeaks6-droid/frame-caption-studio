import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({resolve:{alias:{'frame-vad-ort':new URL('./node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs',import.meta.url).pathname}},plugins:[react()],worker:{format:'es'},build:{target:'es2022',chunkSizeWarningLimit:1800},server:{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'credentialless'}}});
