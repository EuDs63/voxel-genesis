/**
 * Handcrafted evocative seeds — sparse, sculptural, not noise blobs.
 */

import { Grid3D } from './grid';

export interface SeedDefinition {
  id: string;
  name: string;
  description: string;
  category?: 'geometry' | 'surface' | 'fractal' | 'organic';
  /** Paint into a cleared grid of any size (centered). */
  apply: (grid: Grid3D) => void;
}

function centeredEach(grid: Grid3D, fn: (x: number, y: number, z: number, r: number) => boolean): void {
  const [cx, cy, cz] = center(grid);
  const r = Math.max(3, Math.floor(grid.size * 0.32));
  for (let z = -r; z <= r; z++) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (fn(x, y, z, r)) setAge(grid, cx + x, cy + y, cz + z);
  }
}

function hollowSphere(grid: Grid3D): void {
  centeredEach(grid, (x, y, z, r) => Math.abs(Math.sqrt(x*x+y*y+z*z) - r * 0.72) <= 0.65);
}
function doubleShell(grid: Grid3D): void {
  centeredEach(grid, (x, y, z, r) => {
    const d = Math.sqrt(x*x+y*y+z*z);
    return Math.abs(d-r*.45)<=.5 || Math.abs(d-r*.82)<=.5;
  });
}
function tripleRings(grid: Grid3D): void {
  centeredEach(grid, (x, y, z, r) => {
    const R=r*.68, t=.55;
    return Math.abs(Math.sqrt(x*x+y*y)-R)<=t && Math.abs(z)<=t ||
      Math.abs(Math.sqrt(y*y+z*z)-R)<=t && Math.abs(x)<=t ||
      Math.abs(Math.sqrt(x*x+z*z)-R)<=t && Math.abs(y)<=t;
  });
}
function ringChain(grid: Grid3D): void {
  const [cx,cy,cz]=center(grid), R=Math.max(2,Math.floor(grid.size*.12));
  for(let n=-1;n<=1;n++) for(let a=0;a<96;a++){
    const t=a*Math.PI*2/96, axis=n%2===0;
    setAge(grid,cx+n*R*2+(axis?Math.round(Math.cos(t)*R):0),cy+Math.round(Math.sin(t)*R),cz+(axis?0:Math.round(Math.cos(t)*R)));
  }
}
function trefoilKnot(grid: Grid3D): void {
  const [cx,cy,cz]=center(grid), s=Math.max(1,grid.size*.075);
  for(let i=0;i<360;i++) { const t=i*Math.PI/180;
    setAge(grid,Math.round(cx+s*(Math.sin(t)+2*Math.sin(2*t))),Math.round(cy+s*(Math.cos(t)-2*Math.cos(2*t))),Math.round(cz-s*Math.sin(3*t)));
  }
}
function waveSheet(grid: Grid3D): void {
  const [cx,cy,cz]=center(grid), r=Math.max(3,Math.floor(grid.size*.3));
  for(let x=-r;x<=r;x++) for(let z=-r;z<=r;z++) setAge(grid,cx+x,Math.round(cy+Math.sin(x*.7)*2+Math.cos(z*.65)*2),cz+z);
}
function gyroidPatch(grid: Grid3D): void {
  centeredEach(grid,(x,y,z,r)=>{const k=Math.PI/Math.max(3,r*.62); const v=Math.sin(k*x)*Math.cos(k*y)+Math.sin(k*y)*Math.cos(k*z)+Math.sin(k*z)*Math.cos(k*x); return Math.abs(v)<.22;});
}
function mengerFrame(grid: Grid3D): void {
  const [cx,cy,cz]=center(grid), r=Math.max(3,Math.floor(grid.size*.28));
  for(let x=-r;x<=r;x++) for(let y=-r;y<=r;y++) for(let z=-r;z<=r;z++) {
    let ax=Math.abs(x),ay=Math.abs(y),az=Math.abs(z), keep=true;
    for(let scale=Math.max(1,Math.floor((2*r+1)/3));scale>=1;scale=Math.floor(scale/3)) { if ([ax,ay,az].filter(v=>Math.floor(v/scale)%3===1).length>=2) keep=false; if(scale===1) break; }
    if(keep && (Math.abs(x)===r||Math.abs(y)===r||Math.abs(z)===r)) setAge(grid,cx+x,cy+y,cz+z);
  }
}
function branchingTree(grid: Grid3D): void {
  const [cx,cy,cz]=center(grid), h=Math.max(4,Math.floor(grid.size*.48)), y0=cy-Math.floor(h*.45);
  for(let i=0;i<h;i++) { setAge(grid,cx,y0+i,cz); if(i>h/2) for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const) for(let j=1;j<=Math.floor((i-h/2)/2)+1;j++) setAge(grid,cx+dx*j,y0+i+j,cz+dz*j); }
}
function dome(grid: Grid3D): void {
  centeredEach(grid,(x,y,z,r)=>y<=0 && Math.abs(Math.sqrt(x*x+y*y+z*z)-r*.78)<=.65);
}
function spiralStaircase(grid: Grid3D): void {
  const [cx,cy,cz]=center(grid), h=Math.max(6,Math.floor(grid.size*.65)), R=Math.max(2,Math.floor(grid.size*.2)), y0=cy-Math.floor(h/2);
  for(let i=0;i<h;i++){const t=i*.65,x=Math.round(cx+Math.cos(t)*R),z=Math.round(cz+Math.sin(t)*R); for(let q=0;q<=R;q++) setAge(grid,Math.round(cx+(x-cx)*q/R),y0+i,z===cz?cz:Math.round(cz+(z-cz)*q/R));}
}
function honeycombColumns(grid: Grid3D): void {
  const [cx,cy,cz]=center(grid), d=Math.max(2,Math.floor(grid.size*.1)), h=Math.max(2,Math.floor(grid.size*.18));
  for(let q=-2;q<=2;q++) for(let r=-2;r<=2;r++) if(Math.abs(q+r)<=2){const x=cx+Math.round(d*1.7*(q+r/2)),z=cz+Math.round(d*1.5*r); for(let y=-h;y<=h;y++) if(Math.abs(y)===h||y%2===0) setAge(grid,x,cy+y,z);}
}
function latticeStarburst(grid: Grid3D): void {
  const [cx,cy,cz]=center(grid), r=Math.max(3,Math.floor(grid.size*.32));
  const dirs=[] as number[][]; for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)dirs.push([x,y,z]);
  for(const [dx,dy,dz] of dirs) for(let i=0;i<=r;i++) if(i%2===0||i===r)setAge(grid,cx+dx!*i,cy+dy!*i,cz+dz!*i);
}

function setAge(grid: Grid3D, x: number, y: number, z: number, age = 1): void {
  if (grid.inBounds(x, y, z)) grid.set(x, y, z, age);
}

function center(grid: Grid3D): [number, number, number] {
  const c = Math.floor(grid.size / 2);
  return [c, c, c];
}

/** Compact glowing core — the first spark (kept small so rules can breathe). */
function genesisSpark(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const r = Math.max(2, Math.floor(grid.size * 0.1));
  for (let z = -r; z <= r; z++) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.sqrt(x * x + y * y + z * z);
        if (d <= r * 0.9) setAge(grid, cx + x, cy + y, cz + z, 1);
      }
    }
  }
}

/** Two offset spheres destined to dance. */
function twinStars(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const offset = Math.max(3, Math.floor(grid.size * 0.2));
  const r = Math.max(1, Math.floor(grid.size * 0.07));
  for (const ox of [-offset, offset]) {
    for (let z = -r; z <= r; z++) {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y + z * z <= r * r) {
            setAge(grid, cx + x + ox, cy + y, cz + z, 1);
          }
        }
      }
    }
  }
}

/** DNA-like double helix along Y. */
function spiralHelix(grid: Grid3D): void {
  const [cx, , cz] = center(grid);
  const height = Math.floor(grid.size * 0.65);
  const y0 = Math.floor((grid.size - height) / 2);
  const radius = Math.max(2, Math.floor(grid.size * 0.14));
  const turns = 2.2;
  for (let i = 0; i < height; i++) {
    const t = (i / height) * turns * Math.PI * 2;
    const y = y0 + i;
    for (const phase of [0, Math.PI]) {
      const x = Math.round(cx + Math.cos(t + phase) * radius);
      const z = Math.round(cz + Math.sin(t + phase) * radius);
      setAge(grid, x, y, z, 1);
      setAge(grid, x + 1, y, z, 1);
    }
  }
}

/** Octahedral crystal seed — sharp diamond for Crystal Veins. */
function crystalSeed(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const r = Math.max(2, Math.floor(grid.size * 0.14));
  for (let z = -r; z <= r; z++) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (Math.abs(x) + Math.abs(y) + Math.abs(z) === r) {
          setAge(grid, cx + x, cy + y, cz + z, 1);
        }
      }
    }
  }
  // tiny core
  setAge(grid, cx, cy, cz, 1);
}

/** Toroidal ember ring in the XZ plane. */
function emberRing(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const R = Math.max(3, Math.floor(grid.size * 0.26));
  const tube = Math.max(1, Math.floor(grid.size * 0.04));
  for (let z = -R - tube; z <= R + tube; z++) {
    for (let y = -tube; y <= tube; y++) {
      for (let x = -R - tube; x <= R + tube; x++) {
        const dist = Math.sqrt(x * x + z * z);
        const d = Math.sqrt((dist - R) ** 2 + y * y);
        if (d <= tube + 0.35) setAge(grid, cx + x, cy + y, cz + z, 1);
      }
    }
  }
}

/** Sparse radial mandala — eight spokes + rings. */
function voidMandala(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const maxR = Math.max(4, Math.floor(grid.size * 0.32));
  for (let r = 2; r <= maxR; r += 2) {
    for (let a = 0; a < 8; a++) {
      const t = (a / 8) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(t) * r);
      const z = Math.round(cz + Math.sin(t) * r);
      setAge(grid, x, cy, z, 1);
      setAge(grid, x, cy + 1, z, 1);
    }
  }
  // vertical axis accent
  const h = Math.floor(maxR * 0.6);
  for (let y = -h; y <= h; y++) {
    if (y % 2 === 0) setAge(grid, cx, cy + y, cz, 1);
  }
}

/** Open lattice cage — good for breathing rules. */
function breathingLattice(grid: Grid3D): void {
  const [cx, cy, cz] = center(grid);
  const half = Math.max(3, Math.floor(grid.size * 0.22));
  const step = Math.max(2, Math.floor(half / 2));
  for (let y = -half; y <= half; y += step) {
    for (let x = -half; x <= half; x += step) {
      setAge(grid, cx + x, cy + y, cz - half, 1);
      setAge(grid, cx + x, cy + y, cz + half, 1);
    }
    for (let z = -half; z <= half; z += step) {
      setAge(grid, cx - half, cy + y, cz + z, 1);
      setAge(grid, cx + half, cy + y, cz + z, 1);
    }
  }
  for (let z = -half; z <= half; z += step) {
    for (let x = -half; x <= half; x += step) {
      setAge(grid, cx + x, cy - half, cz + z, 1);
      setAge(grid, cx + x, cy + half, cz + z, 1);
    }
  }
}

export const SEEDS: readonly SeedDefinition[] = [
  {
    id: 'genesis-spark',
    name: 'Genesis Spark',
    description: 'A compact ember core — the first light in the void',
    category: 'geometry',
    apply: genesisSpark,
  },
  {
    id: 'twin-stars',
    name: 'Twin Stars',
    description: 'Two spheres destined to dance and collide',
    category: 'geometry',
    apply: twinStars,
  },
  {
    id: 'spiral-helix',
    name: 'Spiral Helix',
    description: 'A double helix climbing through empty space',
    category: 'organic',
    apply: spiralHelix,
  },
  {
    id: 'crystal-seed',
    name: 'Crystal Seed',
    description: 'An octahedral diamond — sharp edges for lattice growth',
    category: 'geometry',
    apply: crystalSeed,
  },
  {
    id: 'ember-ring',
    name: 'Ember Ring',
    description: 'A slender toroidal ring of fire',
    category: 'geometry',
    apply: emberRing,
  },
  {
    id: 'void-mandala',
    name: 'Void Mandala',
    description: 'Radial spokes and rings — ritual geometry in the dark',
    category: 'geometry',
    apply: voidMandala,
  },
  {
    id: 'breathing-lattice',
    name: 'Breathing Lattice',
    description: 'An open cage that expands and contracts under Ember Breath',
    category: 'geometry',
    apply: breathingLattice,
  },
  { id:'hollow-sphere', name:'Hollow Sphere', description:'A single thin spherical shell', category:'geometry', apply:hollowSphere },
  { id:'double-shell', name:'Double Shell', description:'Two concentric spherical shells with an empty gap', category:'geometry', apply:doubleShell },
  { id:'triple-rings', name:'Triple Rings', description:'Three perpendicular great-circle rings', category:'geometry', apply:tripleRings },
  { id:'ring-chain', name:'Ring Chain', description:'Three interlinked rings on alternating planes', category:'geometry', apply:ringChain },
  { id:'trefoil-knot', name:'Trefoil Knot', description:'A closed curve wound into a three-lobed knot', category:'geometry', apply:trefoilKnot },
  { id:'wave-sheet', name:'Wave Sheet', description:'A rippling height-field surface', category:'surface', apply:waveSheet },
  { id:'gyroid-patch', name:'Gyroid Patch', description:'A triply periodic saddle-like surface patch', category:'surface', apply:gyroidPatch },
  { id:'menger-frame', name:'Menger Frame', description:'A recursively perforated cubic frame', category:'fractal', apply:mengerFrame },
  { id:'branching-tree', name:'Branching Tree', description:'A trunk dividing into rising orthogonal branches', category:'organic', apply:branchingTree },
  { id:'dome', name:'Hemispherical Dome', description:'The lower half of a thin spherical shell', category:'geometry', apply:dome },
  { id:'spiral-staircase', name:'Spiral Staircase', description:'Radial treads climbing around a central axis', category:'geometry', apply:spiralStaircase },
  { id:'honeycomb-columns', name:'Honeycomb Columns', description:'A hexagonal cluster of segmented pillars', category:'organic', apply:honeycombColumns },
  { id:'lattice-starburst', name:'Lattice Starburst', description:'Twenty-six sparse rays along lattice directions', category:'geometry', apply:latticeStarburst },
] as const;

export const SEED_CATALOG: readonly SeedDefinition[] = SEEDS;

export const DEFAULT_SEED_ID = 'genesis-spark';

export function getSeedById(id: string): SeedDefinition | undefined {
  return SEEDS.find((s) => s.id === id);
}

export function applySeed(grid: Grid3D, seedId: string): boolean {
  const seed = getSeedById(seedId);
  if (!seed) return false;
  grid.clear();
  seed.apply(grid);
  return true;
}
