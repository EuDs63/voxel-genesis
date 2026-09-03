import './style.css'
import { VoxelScene } from './render/voxelScene'
import { readHashState, toSerializedState, writeHashState, fromSerializedState } from './state'
import { VoxelAutomaton } from './sim/grid'
import { RULE_PRESETS, parseRuleNotation } from './sim/rules'
import { SEED_PRESETS, stampSeed } from './sim/seeds'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('App container not found')

app.innerHTML = `
<div class="layout">
  <aside class="panel">
    <h1>Voxel Genesis</h1>
    <p class="subtitle">Cinematic 3D cellular automaton in a void.</p>

    <div class="row stats"><span>Gen</span><strong id="generation">0</strong><span>Pop</span><strong id="population">0</strong></div>

    <div class="row buttons">
      <button id="play">Pause</button>
      <button id="step">Step</button>
      <button id="reset">Reset</button>
      <button id="randomize">Randomize</button>
    </div>

    <label>Speed <input id="speed" type="range" min="1" max="30" value="8" /></label>
    <label>Grid Size <select id="size"><option>16</option><option>20</option><option selected>24</option><option>28</option></select></label>
    <label>Density <input id="density" type="range" min="0.02" max="0.55" step="0.01" value="0.17" /></label>

    <label>Rule Preset <select id="rulePreset"></select></label>
    <label>B/S Rule <input id="ruleInput" type="text" value="B6/S5,6,7" /></label>
    <button id="applyRule">Apply Rule</button>
    <small id="ruleLabel"></small>

    <label>Seed Preset <select id="seedPreset"></select></label>
    <button id="applySeed">Stamp Seed</button>

    <div class="row">
      <label><input id="autoOrbit" type="checkbox" /> Auto-orbit</label>
    </div>

    <div class="row">
      <label>Slice Z <input id="slice" type="range" min="0" max="23" value="12" /></label>
      <span id="sliceValue">12</span>
    </div>

    <div class="row">
      <label><input name="paintMode" type="radio" value="paint" checked /> Paint</label>
      <label><input name="paintMode" type="radio" value="erase" /> Erase</label>
    </div>

    <div class="row buttons">
      <button id="copyState">Copy JSON</button>
      <button id="loadState">Load JSON</button>
    </div>
  </aside>

  <main class="viewport-wrap">
    <div id="viewport"></div>
    <div id="hint" class="hint hidden">
      <p><strong>First run tip:</strong> drag to orbit, right-drag to pan, wheel to zoom. Paint or erase on the glowing slice.</p>
      <button id="dismissHint">Got it</button>
    </div>
  </main>
</div>
`

type PaintMode = 'paint' | 'erase'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const speedInput = document.querySelector<HTMLInputElement>('#speed')!
const densityInput = document.querySelector<HTMLInputElement>('#density')!
const sizeInput = document.querySelector<HTMLSelectElement>('#size')!
const sliceInput = document.querySelector<HTMLInputElement>('#slice')!
const sliceValue = document.querySelector<HTMLElement>('#sliceValue')!
const rulePresetInput = document.querySelector<HTMLSelectElement>('#rulePreset')!
const ruleInput = document.querySelector<HTMLInputElement>('#ruleInput')!
const ruleLabel = document.querySelector<HTMLElement>('#ruleLabel')!
const seedPresetInput = document.querySelector<HTMLSelectElement>('#seedPreset')!
const generationLabel = document.querySelector<HTMLElement>('#generation')!
const populationLabel = document.querySelector<HTMLElement>('#population')!
const autoOrbitInput = document.querySelector<HTMLInputElement>('#autoOrbit')!

RULE_PRESETS.forEach((preset, index) => {
  const option = document.createElement('option')
  option.value = `${index}`
  option.textContent = `${preset.name} (${preset.notation})`
  rulePresetInput.append(option)
})

SEED_PRESETS.forEach((preset, index) => {
  const option = document.createElement('option')
  option.value = `${index}`
  option.textContent = preset.name
  seedPresetInput.append(option)
})

if (reducedMotion) {
  autoOrbitInput.checked = false
  autoOrbitInput.disabled = true
}

let size = Number.parseInt(sizeInput.value, 10)
let currentRule = RULE_PRESETS[0]
let sim = new VoxelAutomaton(size, currentRule)
let display = new Float32Array(sim.cells.length)
let isPlaying = true
let paintMode: PaintMode = 'paint'

const viewport = document.querySelector<HTMLElement>('#viewport')!
let scene = new VoxelScene(viewport, size, reducedMotion)

const hashState = readHashState()
if (hashState) {
  size = hashState.size
  sizeInput.value = `${size}`
  currentRule = parseRuleNotation(hashState.rule)
  ruleInput.value = currentRule.notation
  sim = new VoxelAutomaton(size, currentRule)
  sim.loadCells(hashState.cellBuffer)
  sim.generation = hashState.generation
  densityInput.value = `${hashState.density}`
  display = new Float32Array(sim.cells)
  scene.dispose()
  scene = new VoxelScene(viewport, size, reducedMotion)
}

sliceInput.max = `${size - 1}`
sliceInput.value = `${Math.floor(size / 2)}`
sliceValue.textContent = sliceInput.value
scene.setSlice(Number.parseInt(sliceInput.value, 10))
ruleLabel.textContent = currentRule.notation

function updateHash(): void {
  const state = toSerializedState({
    size,
    density: Number.parseFloat(densityInput.value),
    rule: currentRule.notation,
    generation: sim.generation,
    cells: sim.cells,
  })
  writeHashState(state)
}

function setStats(): void {
  generationLabel.textContent = `${sim.generation}`
  populationLabel.textContent = `${sim.population}`
}

function rebuildForSize(nextSize: number): void {
  size = nextSize
  sim = new VoxelAutomaton(size, currentRule)
  sim.randomize(Number.parseFloat(densityInput.value))
  display = new Float32Array(sim.cells)
  scene.dispose()
  scene = new VoxelScene(viewport, size, reducedMotion)
  scene.setAutoOrbit(autoOrbitInput.checked)
  sliceInput.max = `${size - 1}`
  sliceInput.value = `${Math.floor(size / 2)}`
  sliceValue.textContent = sliceInput.value
  scene.setSlice(Number.parseInt(sliceInput.value, 10))
  setStats()
  updateHash()
  attachPainter()
}

function applySeed(): void {
  sim.clear()
  const selected = SEED_PRESETS[Number.parseInt(seedPresetInput.value, 10)] ?? SEED_PRESETS[0]
  for (const [x, y, z] of stampSeed(size, selected.cells)) {
    sim.set(x, y, z, true)
  }
  display = new Float32Array(sim.cells)
  setStats()
  updateHash()
}

function stepSimulation(): void {
  sim.step()
  setStats()
  updateHash()
}

function attachPainter(): void {
  scene.domElement.oncontextmenu = (event) => event.preventDefault()
  scene.domElement.onpointerdown = (event) => {
    const slice = Number.parseInt(sliceInput.value, 10)
    const hit = scene.pickCell(event, slice)
    if (!hit) return
    sim.set(hit.x, hit.y, hit.z, paintMode === 'paint')
    setStats()
    updateHash()
  }
}
attachPainter()

document.querySelector<HTMLButtonElement>('#play')!.addEventListener('click', (event) => {
  isPlaying = !isPlaying
  ;(event.currentTarget as HTMLButtonElement).textContent = isPlaying ? 'Pause' : 'Play'
})

document.querySelector<HTMLButtonElement>('#step')!.addEventListener('click', () => {
  stepSimulation()
})

document.querySelector<HTMLButtonElement>('#reset')!.addEventListener('click', () => {
  sim.clear()
  display.fill(0)
  setStats()
  updateHash()
})

document.querySelector<HTMLButtonElement>('#randomize')!.addEventListener('click', () => {
  sim.randomize(Number.parseFloat(densityInput.value))
  display = new Float32Array(sim.cells)
  setStats()
  updateHash()
})

sizeInput.addEventListener('change', () => {
  const parsed = Number.parseInt(sizeInput.value, 10)
  if (!Number.isInteger(parsed)) return
  rebuildForSize(parsed)
})

sliceInput.addEventListener('input', () => {
  sliceValue.textContent = sliceInput.value
  scene.setSlice(Number.parseInt(sliceInput.value, 10))
})

autoOrbitInput.addEventListener('change', () => {
  scene.setAutoOrbit(autoOrbitInput.checked)
})

rulePresetInput.addEventListener('change', () => {
  const preset = RULE_PRESETS[Number.parseInt(rulePresetInput.value, 10)]
  if (!preset) return
  currentRule = preset
  sim.rule = currentRule
  ruleInput.value = currentRule.notation
  ruleLabel.textContent = currentRule.notation
  updateHash()
})

document.querySelector<HTMLButtonElement>('#applyRule')!.addEventListener('click', () => {
  try {
    const parsed = parseRuleNotation(ruleInput.value)
    currentRule = parsed
    sim.rule = currentRule
    ruleLabel.textContent = currentRule.notation
    updateHash()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid rule'
    alert(message)
  }
})

document.querySelector<HTMLButtonElement>('#applySeed')!.addEventListener('click', applySeed)

document.querySelectorAll<HTMLInputElement>('input[name="paintMode"]').forEach((input) => {
  input.addEventListener('change', () => {
    if (input.checked) paintMode = input.value as PaintMode
  })
})

document.querySelector<HTMLButtonElement>('#copyState')!.addEventListener('click', async () => {
  const json = JSON.stringify(
    toSerializedState({
      size,
      density: Number.parseFloat(densityInput.value),
      rule: currentRule.notation,
      generation: sim.generation,
      cells: sim.cells,
    }),
  )

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(json)
    return
  }

  window.prompt('Copy state JSON:', json)
})

document.querySelector<HTMLButtonElement>('#loadState')!.addEventListener('click', () => {
  const input = window.prompt('Paste state JSON:')
  if (!input) return

  try {
    const parsed = fromSerializedState(JSON.parse(input))
    if (parsed.size !== size) {
      sizeInput.value = `${parsed.size}`
      rebuildForSize(parsed.size)
    }

    currentRule = parseRuleNotation(parsed.rule)
    sim.rule = currentRule
    ruleInput.value = currentRule.notation
    ruleLabel.textContent = currentRule.notation
    sim.loadCells(parsed.cellBuffer)
    sim.generation = parsed.generation
    densityInput.value = `${parsed.density}`
    display = new Float32Array(sim.cells)
    setStats()
    updateHash()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON state'
    alert(message)
  }
})

const hint = document.querySelector<HTMLElement>('#hint')!
if (!localStorage.getItem('voxel-genesis-hint-dismissed')) {
  hint.classList.remove('hidden')
}

document.querySelector<HTMLButtonElement>('#dismissHint')!.addEventListener('click', () => {
  hint.classList.add('hidden')
  localStorage.setItem('voxel-genesis-hint-dismissed', '1')
})

scene.setAutoOrbit(false)
sim.randomize(Number.parseFloat(densityInput.value))
setStats()
updateHash()

let accumulator = 0
let previousTime = performance.now()

function animate(now: number): void {
  const deltaSeconds = (now - previousTime) / 1000
  previousTime = now

  const smoothing = reducedMotion ? 0.12 : 0.2
  for (let i = 0; i < sim.cells.length; i += 1) {
    const target = sim.cells[i]
    display[i] += (target - display[i]) * smoothing
  }

  if (isPlaying) {
    accumulator += deltaSeconds
    const stepTime = 1 / Number.parseFloat(speedInput.value)
    while (accumulator >= stepTime) {
      stepSimulation()
      accumulator -= stepTime
    }
  }

  scene.render(display, sim.ages, sim.ghosts, sim.ghostFrames)
  requestAnimationFrame(animate)
}

requestAnimationFrame(animate)
