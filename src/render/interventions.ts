import * as THREE from 'three';
import type { Interventions } from '../sim/interventions';

export class InterventionRenderer {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(.82,.82,.82);
  private readonly source: THREE.InstancedMesh;
  private readonly barrier: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  constructor(capacity: number) {
    this.source = new THREE.InstancedMesh(this.geometry, new THREE.MeshBasicMaterial({ color:0x3de0ff, wireframe:true, transparent:true, opacity:.9 }), capacity);
    this.barrier = new THREE.InstancedMesh(this.geometry, new THREE.MeshBasicMaterial({ color:0xff4058, wireframe:true, transparent:true, opacity:.9 }), capacity);
    this.group.add(this.source,this.barrier);
  }
  sync(state: Interventions): void {
    const half=(state.size-1)/2;
    for (const [kind,mesh] of [['source',this.source],['barrier',this.barrier]] as const) {
      const indices=state.indices(kind); mesh.count=indices.length;
      indices.forEach((index,i)=>{ const x=index%state.size,y=Math.floor(index/state.size)%state.size,z=Math.floor(index/state.size**2); this.matrix.makeTranslation(x-half,y-half,z-half); mesh.setMatrixAt(i,this.matrix); });
      mesh.instanceMatrix.needsUpdate=true;
    }
  }
  dispose(): void { this.geometry.dispose(); (this.source.material as THREE.Material).dispose(); (this.barrier.material as THREE.Material).dispose(); }
}
