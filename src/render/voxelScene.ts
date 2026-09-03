import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class VoxelScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private readonly liveMesh: THREE.InstancedMesh
  private readonly ghostMesh: THREE.InstancedMesh
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly tmpMatrix = new THREE.Matrix4()
  private readonly tmpPosition = new THREE.Vector3()
  private readonly tmpScale = new THREE.Vector3()
  private readonly tmpColor = new THREE.Color()
  private readonly slicePlane: THREE.Mesh

  constructor(
    private readonly container: HTMLElement,
    public size: number,
    private readonly reducedMotion: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setClearColor(0x05070e, 1)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(0x060915, 18, 60)

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200)
    this.camera.position.set(24, 19, 22)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = !reducedMotion
    this.controls.dampingFactor = 0.08
    this.controls.autoRotate = false
    this.controls.autoRotateSpeed = 0.35
    this.controls.maxDistance = 70
    this.controls.minDistance = 8
    this.controls.target.set(0, 0, 0)

    this.scene.add(new THREE.AmbientLight(0x5577aa, 0.5))
    const key = new THREE.DirectionalLight(0x88eeff, 1.1)
    key.position.set(15, 25, 12)
    this.scene.add(key)
    const fill = new THREE.PointLight(0xff7722, 0.8, 50)
    fill.position.set(-12, -4, 12)
    this.scene.add(fill)

    const maxInstances = size * size * size
    const liveMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.3,
      metalness: 0.05,
      emissive: new THREE.Color(0x0b1925),
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.95,
    })
    const ghostMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.33,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const cube = new THREE.BoxGeometry(0.88, 0.88, 0.88)
    this.liveMesh = new THREE.InstancedMesh(cube, liveMaterial, maxInstances)
    this.liveMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.liveMesh.frustumCulled = false
    this.scene.add(this.liveMesh)

    this.ghostMesh = new THREE.InstancedMesh(cube, ghostMaterial, maxInstances)
    this.ghostMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.ghostMesh.frustumCulled = false
    this.scene.add(this.ghostMesh)

    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x33ccff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.slicePlane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), planeMaterial)
    this.scene.add(this.slicePlane)

    window.addEventListener('resize', this.onResize)
    this.setSlice(0)
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize)
    this.controls.dispose()
    this.renderer.dispose()
    this.liveMesh.geometry.dispose()
    ;(this.liveMesh.material as THREE.Material).dispose()
    ;(this.ghostMesh.material as THREE.Material).dispose()
    this.slicePlane.geometry.dispose()
    ;(this.slicePlane.material as THREE.Material).dispose()
    this.container.removeChild(this.renderer.domElement)
  }

  setAutoOrbit(enabled: boolean): void {
    this.controls.autoRotate = enabled && !this.reducedMotion
  }

  setSlice(slice: number): void {
    const half = this.size / 2
    const z = slice - half + 0.5
    this.slicePlane.position.set(0, 0, z)
  }

  pickCell(pointerEvent: PointerEvent, slice: number): { x: number; y: number; z: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((pointerEvent.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((pointerEvent.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObject(this.slicePlane, false)
    if (hits.length === 0) return null

    const point = hits[0].point
    const half = this.size / 2
    const x = Math.floor(point.x + half)
    const y = Math.floor(point.y + half)
    const z = Math.max(0, Math.min(this.size - 1, slice))

    if (x < 0 || y < 0 || x >= this.size || y >= this.size) {
      return null
    }

    return { x, y, z }
  }

  render(display: Float32Array, ages: Uint16Array, ghosts: Uint8Array, ghostFrames: number): void {
    const half = this.size / 2
    const ember = new THREE.Color(0xff5c2f)
    const cyan = new THREE.Color(0x3ce9ff)
    const ghostTone = new THREE.Color(0x5caeff)

    let liveCount = 0
    let ghostCount = 0

    for (let z = 0; z < this.size; z += 1) {
      for (let y = 0; y < this.size; y += 1) {
        for (let x = 0; x < this.size; x += 1) {
          const idx = x + y * this.size + z * this.size * this.size
          const alpha = display[idx]
          if (alpha > 0.03) {
            this.tmpPosition.set(x - half + 0.5, y - half + 0.5, z - half + 0.5)
            const scale = 0.15 + alpha * 0.85
            this.tmpScale.set(scale, scale, scale)
            this.tmpMatrix.compose(this.tmpPosition, new THREE.Quaternion(), this.tmpScale)
            this.liveMesh.setMatrixAt(liveCount, this.tmpMatrix)

            const ageNorm = Math.min(1, ages[idx] / 12)
            this.tmpColor.copy(ember).lerp(cyan, ageNorm)
            this.tmpColor.multiplyScalar(0.45 + alpha * 0.75)
            this.liveMesh.setColorAt(liveCount, this.tmpColor)
            liveCount += 1
          }

          const ghost = ghosts[idx]
          if (ghost > 0 && alpha < 0.2) {
            const fade = ghost / ghostFrames
            this.tmpPosition.set(x - half + 0.5, y - half + 0.5, z - half + 0.5)
            const gScale = 0.2 + fade * 0.45
            this.tmpScale.set(gScale, gScale, gScale)
            this.tmpMatrix.compose(this.tmpPosition, new THREE.Quaternion(), this.tmpScale)
            this.ghostMesh.setMatrixAt(ghostCount, this.tmpMatrix)

            this.tmpColor.copy(ghostTone).multiplyScalar(0.2 + fade * 0.8)
            this.ghostMesh.setColorAt(ghostCount, this.tmpColor)
            ghostCount += 1
          }
        }
      }
    }

    this.liveMesh.count = liveCount
    this.liveMesh.instanceMatrix.needsUpdate = true
    if (this.liveMesh.instanceColor) this.liveMesh.instanceColor.needsUpdate = true

    this.ghostMesh.count = ghostCount
    this.ghostMesh.instanceMatrix.needsUpdate = true
    if (this.ghostMesh.instanceColor) this.ghostMesh.instanceColor.needsUpdate = true

    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  private readonly onResize = (): void => {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }
}
