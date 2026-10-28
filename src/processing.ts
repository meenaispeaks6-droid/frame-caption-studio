export type ProcessingMode='auto'|'mobile'|'standard';
export function processingProfile(mode:ProcessingMode='auto',memory=(navigator as Navigator & {deviceMemory?:number}).deviceMemory,mobile=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)){
 const constrained=mode==='mobile'||(mode==='auto'&&(mobile||(memory!==undefined&&memory<=4)));
 return {constrained,model:(constrained?(memory===undefined||memory<=4?'tiny':'base'):'small') as 'tiny'|'base'|'small',preview:constrained?480:720};
}
