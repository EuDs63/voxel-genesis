import { stepInPlace } from './ca';
import { Grid3D, type BoundaryMode } from './grid';
import type { Rule } from './rules';

export const MUTATION_PREVIEW_STEPS = 24;

export type MutationKind = 'offset-copy'|'mirror'|'perforate'|'thicken'|'twist'|'scatter';

export interface MutationCandidate {
  id: MutationKind;
  labelId: string;
  grid: Grid3D;
  initialPopulation: number;
  populationAfterPreview: number | null;
  previewSteps: typeof MUTATION_PREVIEW_STEPS;
}

export interface MutationEvaluationOptions {
  signal?: AbortSignal;
  yieldEverySteps?: number;
  onYield?: (completedSteps: number) => void | Promise<void>;
}

function hashSeed(seed: number | string): number {
  let h=2166136261;
  for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}
function rngFor(seed:number|string,salt:number):()=>number { let s=(hashSeed(seed)^Math.imul(salt,0x9e3779b1))>>>0; return()=>{s+=0x6d2b79f5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}; }
function aliveCoords(g:Grid3D):Array<[number,number,number]> { const out:Array<[number,number,number]>=[]; const s=g.size; for(let z=0;z<s;z++)for(let y=0;y<s;y++)for(let x=0;x<s;x++)if(g.cells[g.index(x,y,z)]!>0)out.push([x,y,z]); return out; }
function baseCandidate(id:MutationKind, grid:Grid3D):MutationCandidate { return{id,labelId:`breeding.mutation.${id}`,grid,initialPopulation:grid.population,populationAfterPreview:null,previewSteps:MUTATION_PREVIEW_STEPS}; }
function ensureDistinctSeed(g:Grid3D,kind:number):void { if(g.population>0)return; const c=Math.floor(g.size/2); if(kind===0)g.set(c,c,c,1); else if(kind===1){g.set(c-1,c,c,1);g.set(c+1,c,c,1);} else if(kind===2){g.set(c,c-1,c,1);g.set(c,c+1,c,1);g.set(c,c,c,1);} else for(let i=0;i<=kind;i++)g.set(c+i%3-1,c+Math.floor(i/3),c,1); }
function shapeKey(g:Grid3D):string { const live:number[]=[]; for(let i=0;i<g.cells.length;i++)if(g.cells[i]!>0)live.push(i); return live.join(','); }
function ensureUnique(g:Grid3D, seen:Set<string>, seed:number|string, kind:number):void {
  ensureDistinctSeed(g,kind);
  let key=shapeKey(g);
  if(!seen.has(key)){seen.add(key);return;}
  const volume=g.volume, start=((hashSeed(seed)+Math.imul(kind+1,2654435761))>>>0)%volume;
  // Each cumulative toggle changes the shape. At most `seen.size + 1` attempts
  // are needed because there are only that many earlier candidates to avoid.
  for(let attempt=0;attempt<=seen.size;attempt++){
    const index=(start+attempt*8191)%volume;
    const x=index%g.size, y=Math.floor(index/g.size)%g.size, z=Math.floor(index/(g.size*g.size));
    g.toggle(x,y,z);
    if(g.population===0)g.set((x+1)%g.size,y,z,1);
    key=shapeKey(g);
    if(!seen.has(key)){seen.add(key);return;}
  }
  throw new Error('Unable to construct a unique mutation candidate');
}

/** Create up to six deterministic structural variants without changing source. */
export function createMutations(source:Grid3D, seed:number|string, maxCandidates=6):MutationCandidate[] {
  const s=source.size, c=(s-1)/2, coords=aliveCoords(source), made:MutationCandidate[]=[], seen=new Set<string>();
  const add=(id:MutationKind,g:Grid3D,k:number)=>{ensureUnique(g,seen,seed,k);made.push(baseCandidate(id,g));};
  let g=source.clone(); for(const [x,y,z] of coords)g.set(x+1,y,z,1); add('offset-copy',g,0);
  g=source.clone(); for(const [x,y,z] of coords)g.set(s-1-x,y,z,1); add('mirror',g,1);
  g=new Grid3D(s); {const rnd=rngFor(seed,3); for(const [x,y,z] of coords)if(rnd()>.24)g.set(x,y,z,1);} add('perforate',g,2);
  g=source.clone(); for(const [x,y,z] of coords)for(const [dx,dy,dz] of [[1,0,0],[0,1,0],[0,0,1]] as const)if(((x*3+y*5+z*7+hashSeed(seed))&3)===0)g.set(x+dx,y+dy,z+dz,1); add('thicken',g,3);
  g=new Grid3D(s); for(const [x,y,z] of coords){const a=(y-c)*.12,dx=x-c,dz=z-c;g.set(Math.round(c+dx*Math.cos(a)-dz*Math.sin(a)),y,Math.round(c+dx*Math.sin(a)+dz*Math.cos(a)),1);} add('twist',g,4);
  g=source.clone(); {const rnd=rngFor(seed,6), n=Math.max(4,Math.min(32,Math.ceil(Math.max(1,coords.length)*.08))); for(let i=0;i<n;i++){const origin=coords.length?coords[Math.floor(rnd()*coords.length)]!:[c,c,c] as [number,number,number];g.set(Math.round(origin[0]+(rnd()-.5)*6),Math.round(origin[1]+(rnd()-.5)*6),Math.round(origin[2]+(rnd()-.5)*6),1);}} add('scatter',g,5);
  return made.slice(0,Math.max(0,Math.min(6,Math.floor(maxCandidates))));
}

export async function evaluateMutationAsync(candidate:MutationCandidate, rule:Rule, boundary:BoundaryMode, options:MutationEvaluationOptions={}):Promise<MutationCandidate> {
  const work=candidate.grid.clone(), scratch=new Grid3D(work.size), every=Math.max(1,options.yieldEverySteps??1);
  for(let i=1;i<=candidate.previewSteps;i++){
    if(options.signal?.aborted)throw new DOMException('Mutation evaluation aborted','AbortError');
    stepInPlace(work,scratch,rule,boundary);
    if(i%every===0){await options.onYield?.(i);await new Promise<void>(resolve=>setTimeout(resolve,0));}
  }
  if(options.signal?.aborted)throw new DOMException('Mutation evaluation aborted','AbortError');
  return{...candidate,populationAfterPreview:work.population};
}

/** Synchronous pure convenience API; UI code should prefer createMutations + evaluateMutationAsync. */
export function proposeMutations(source:Grid3D, rule:Rule, boundary:BoundaryMode, seed:number|string):MutationCandidate[] {
  return createMutations(source,seed).map(candidate=>{
    const work=candidate.grid.clone(),scratch=new Grid3D(work.size);
    for(let i=0;i<candidate.previewSteps;i++)stepInPlace(work,scratch,rule,boundary);
    return{...candidate,populationAfterPreview:work.population};
  });
}
