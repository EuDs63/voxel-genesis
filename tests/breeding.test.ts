import { describe, expect, it } from 'vitest';
import { Grid3D } from '../src/sim/grid';
import { createMutations, evaluateMutationAsync, proposeMutations } from '../src/sim/breeding';
import { getDefaultRule } from '../src/sim/rules';
import { stepInPlace } from '../src/sim/ca';

describe('shape breeding', () => {
  const source=()=>{const g=new Grid3D(12);for(let i=3;i<9;i++){g.set(i,6,6,1);g.set(6,i,6,1);}return g;};
  const signature=(grid:Grid3D)=>[...grid.cells].map((age,index)=>age?index:'').filter(String).join(',');

  it('creates six reproducible independent structural variants', () => {
    const original=source(), before=original.cells.slice();
    const a=createMutations(original,'lineage-7'), b=createMutations(original,'lineage-7');
    expect(a).toHaveLength(6);
    expect(original.cells).toEqual(before);
    expect(a.map(x=>[...x.grid.cells])).toEqual(b.map(x=>[...x.grid.cells]));
    expect(a.every(x=>x.grid!==original && x.initialPopulation>0)).toBe(true);
    expect(new Set(a.map(x=>signature(x.grid))).size).toBe(6);
  });

  it('reports the actual population after exactly 24 CA steps', () => {
    const rule=getDefaultRule(), candidate=proposeMutations(source(),rule,'clamp',42)[0]!;
    const manual=candidate.grid.clone(),scratch=new Grid3D(manual.size);
    for(let i=0;i<24;i++)stepInPlace(manual,scratch,rule,'clamp');
    expect(candidate.previewSteps).toBe(24);
    expect(candidate.populationAfterPreview).toBe(manual.population);
  });

  it('supports empty sources and asynchronous yielding', async () => {
    const candidates=createMutations(new Grid3D(12),1), yields:number[]=[];
    expect(candidates).toHaveLength(6);
    expect(new Set(candidates.map(x=>signature(x.grid))).size).toBe(6);
    const evaluated=await evaluateMutationAsync(candidates[0]!,getDefaultRule(),'wrap',{yieldEverySteps:6,onYield:n=>{yields.push(n);}});
    expect(yields).toEqual([6,12,18,24]);
    expect(evaluated.populationAfterPreview).not.toBeNull();
  });

  it.each([
    ['symmetric', () => { const g=new Grid3D(12); for(let i=2;i<10;i++){g.set(i,6,6,9);g.set(11-i,6,6,3);} return g; }],
    ['single cell', () => { const g=new Grid3D(12); g.set(6,6,6,200); return g; }],
    ['empty', () => new Grid3D(12)],
    ['full', () => { const g=new Grid3D(12); g.cells.fill(17); g.recount(); return g; }],
  ])('keeps candidates shape-distinct for a %s source', (_name, makeSource) => {
    const original=makeSource(), before=original.cells.slice(), candidates=createMutations(original,'edge-cases');
    expect(candidates).toHaveLength(6);
    expect(new Set(candidates.map(candidate=>signature(candidate.grid))).size).toBe(6);
    expect(original.cells).toEqual(before);
  });

  it('honors cancellation requested during the final yield', async () => {
    const controller=new AbortController(), candidate=createMutations(source(),9)[0]!;
    await expect(evaluateMutationAsync(candidate,getDefaultRule(),'clamp',{
      signal:controller.signal,
      yieldEverySteps:24,
      onYield:()=>controller.abort(),
    })).rejects.toMatchObject({name:'AbortError'});
  });
});
