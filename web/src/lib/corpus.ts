import catalog from '../../../data/corpus/catalog.json';
export const REAL_CORPUS=catalog;
const assets=import.meta.glob(['../../../data/corpus/*.csv','!../../../data/corpus/*.source.csv'],{query:'?raw',import:'default'});
export async function corpusCsv(id:string):Promise<{dataset:typeof catalog.datasets[number];text:string}> {
  const dataset=catalog.datasets.find(item=>item.id===id);
  if(!dataset)throw new Error('Unknown frozen dataset.');
  const asset=assets['../../../data/corpus/'+dataset.csv];if(!asset)throw new Error('Dataset asset is missing.');
  const text=await asset() as string;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(hash!==dataset.csvSha256)throw new Error('Dataset bytes do not match retained provenance.');
  return {dataset,text};
}
