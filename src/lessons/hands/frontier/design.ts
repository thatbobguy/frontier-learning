/*
 * The design lab's scoring model (chapter 3, the course's capstone).
 *
 * Six choices, each tied to an earlier film, turn into six numbers, and three customer
 * contracts are checked against those numbers. The model is deliberately simple: every
 * number below is a small, readable formula with its reasoning next to it, so a learner
 * (or a teacher reading the code) can see why a design scored what it did.
 *
 * The numbers are ILLUSTRATIVE, anchored to the research where we have it (actuator
 * module prices, ~$1-5k linkage hands, 300k-1M cycle claims, 8,000-10,000 warehouse grips
 * a day, ORCA's skin wearing at 2-4k cycles, v + F/V tooling maths), not a real costing.
 *
 * Fairness: the three contracts pull against each other through real trades.
 *   - Warehouse needs millions of cycles cheaply: few motors, a self-locking linkage,
 *     moulded parts. That rules out backdrivable (home) and many-motor (research) hands.
 *   - Home needs backdrivable, light and nimble: tendons from forearm motors. Tendons
 *     wear and more motors mean more parts, so it can never last a warehouse year.
 *   - Research needs many motors and rich touch. Rich skins are wear surfaces, so a
 *     12+ motor tendon hand with skin can't survive a year of dishes.
 *   `checkFairness()` at the bottom enumerates every one of the 1,296 designs and proves
 *   no design signs more than one customer, and that each customer can be signed.
 */

export type Fingers = 3 | 4 | 5
export type Motors = 1 | 6 | 12 | 20
export type Place = 'joints' | 'palm' | 'forearm'
export type Drive = 'linkage' | 'tendon' | 'gear'
export type Skin = 'none' | 'pads' | 'arrays' | 'gel'
export type Build = 'print' | 'cnc' | 'mould'

export interface Design {
  fingers: Fingers
  motors: Motors
  place: Place
  drive: Drive
  skin: Skin
  build: Build
}

export const START: Design = { fingers: 5, motors: 6, place: 'palm', drive: 'linkage', skin: 'none', build: 'cnc' }

/** Which transmissions physically fit which motor locations (the lab nudges the other choice to match). */
export const FITS: Record<Drive, Place[]> = {
  // a gear train sits in the joint it turns
  gear: ['joints'],
  // a cable needs room to run: the motor sits back in the palm or the forearm
  tendon: ['palm', 'forearm'],
  // a screw pushes a rod: the motor sits in the palm, or at the base of each finger
  linkage: ['palm', 'joints'],
}

export interface Scores {
  /** Motors actually fitted: at most 4 per finger (thumb included). */
  active: number
  /** 0..100: how many independent ways the hand can move, with a bonus for fingers. */
  dex: number
  /** Whole-hand power grip, N. */
  grip: number
  /** Mass beyond the wrist, g. */
  weight: number
  /** Grasp cycles before the first part fails. */
  cycles: number
  /** Unit cost at 10,000 units, US$. */
  cost: number
  /** 0..1: how freely the fingers give way when pushed (backdrivability). */
  backdrive: number
  /** 0..1: how closely the real hand will match a simulation of it. */
  sim: number
  /** 0..100: how good a hand this is for a learning robot. */
  learn: number
  /** The cost broken down, for the readings and Pip. */
  parts: { actuators: number; assembly: number; sensors: number; structure: number }
}

/* ---------------------------------------------------------------- the formulas */

/**
 * Dexterity. Independent motors are what let fingers move separately, with diminishing
 * returns (a log curve: the first six motors matter more than the last eight). Linkages
 * couple joints along one fixed curl path, so they count for a little less. More fingers
 * add a little (a second opposing finger, a third for in-hand rolling).
 *   dex = 100 × [ 0.15 × (fingers − 2) / 3 + 0.85 × ln(1 + a·k) / ln(21) ]
 *   a = active motors, k = 0.8 for linkage, 1 otherwise
 */
function dexterity(fingers: Fingers, active: number, drive: Drive) {
  const k = drive === 'linkage' ? 0.8 : 1
  const motorPart = Math.log(1 + active * k) / Math.log(21)
  return 100 * Math.min(1, 0.15 * ((fingers - 2) / 3) + 0.85 * motorPart)
}

/**
 * Grip. Fingertip force per finger depends on how big the motor can be (in a joint it must
 * be tiny; in the forearm it can be big) and on the transmission (a fine-lead screw
 * multiplies force; tendons lose some to capstan friction at every bend). One or two big
 * motors driving all the fingers together, gripper-style, grip harder.
 *   grip = f_place × m_drive × fingers × (1.6 if one motor)
 */
const TIP_FORCE: Record<Place, number> = { joints: 8, palm: 12, forearm: 20 }
const DRIVE_FORCE: Record<Drive, number> = { linkage: 1.3, tendon: 0.8, gear: 1 }
function gripForce(d: Design, active: number) {
  return TIP_FORCE[d.place] * DRIVE_FORCE[d.drive] * d.fingers * (active <= 1 ? 1.6 : 1)
}

/**
 * Weight beyond the wrist. Structure scales with fingers and material (printed nylon is
 * light, machined aluminium heavy); each actuator module weighs ~28 g, and only the part
 * of it that sits beyond the wrist counts (motors in the forearm leave only spools and
 * cables in the hand). Sensors add their own mass; camera tips are the heaviest.
 *   weight = (120 + 55 × fingers) × ρ_build + 28 × a × w_place + skin
 */
const DENSITY: Record<Build, number> = { print: 0.6, cnc: 1.25, mould: 1 }
const MOTOR_MASS_HERE: Record<Place, number> = { joints: 1.25, palm: 1, forearm: 0.15 }
const SKIN_MASS: Record<Skin, number> = { none: 0, pads: 3, arrays: 10, gel: 25 }
function weightAtWrist(d: Design, active: number) {
  return (120 + 55 * d.fingers) * DENSITY[d.build] + 28 * active * MOTOR_MASS_HERE[d.place] + SKIN_MASS[d.skin] * d.fingers
}

/**
 * Durability: grasp cycles before the first failure. Start from a reference hand (6
 * motors, metal or moulded parts, no skin) for each transmission: a self-locking screw and
 * linkage is the toughest, gears in the joints take impacts on their teeth, tendons creep,
 * fray and need re-tensioning. Then:
 *   - every extra motor is another thing to fail (series reliability): × (6 / a)^0.6
 *   - printed parts fatigue: × 0.2
 *   - wires flexing through every joint (motors in the joints): × 0.8;
 *     tendons crossing the wrist from the forearm: × 0.9
 *   - the skin is the wear surface: pads × 0.95, dense arrays × 0.5, camera gel × 0.35
 */
const BASE_CYCLES: Record<Drive, number> = { linkage: 4_000_000, gear: 1_500_000, tendon: 1_000_000 }
const BUILD_LIFE: Record<Build, number> = { print: 0.2, cnc: 1, mould: 1 }
const PLACE_LIFE: Record<Place, number> = { joints: 0.8, palm: 1, forearm: 0.9 }
const SKIN_LIFE: Record<Skin, number> = { none: 1, pads: 0.95, arrays: 0.5, gel: 0.35 }
function lifeCycles(d: Design, active: number) {
  return BASE_CYCLES[d.drive] * Math.pow(6 / active, 0.6) * BUILD_LIFE[d.build] * PLACE_LIFE[d.place] * SKIN_LIFE[d.skin]
}

/**
 * Unit cost at 10,000 units: cost = actuators + assembly + sensors + structure, where
 * structure = v × parts + F / V (the tooling formula from film 5).
 *   - actuator module (motor, reducer or screw, encoder, driver channel): linkage servo $180,
 *     tendon motor $140 + $40 for routing and tensioning, gear-in-joint $220;
 *     motors in the joints need wiring through every joint: + $20 each
 *   - assembly and test: $60 + $25 a motor
 *   - sensors per finger: pads $15, dense arrays $250, camera gel $180 (+ $150 to process video)
 *   - parts = 12 + 8 × fingers + 2 × a; printed: v = $4, F = 0; CNC: v = $30, F = 0;
 *     moulded and die cast: v = $2, F = $600,000 of tools spread over V = 10,000 hands
 */
const ACTUATOR: Record<Drive, number> = { linkage: 180, tendon: 180, gear: 220 }
const SENSOR: Record<Skin, number> = { none: 0, pads: 15, arrays: 250, gel: 180 }
const PROCESS: Record<Build, { v: number; F: number }> = { print: { v: 4, F: 0 }, cnc: { v: 30, F: 0 }, mould: { v: 2, F: 600_000 } }
export const VOLUME = 10_000
function unitCost(d: Design, active: number) {
  const actuators = active * (ACTUATOR[d.drive] + (d.place === 'joints' ? 20 : 0))
  const assembly = 60 + 25 * active
  const sensors = SENSOR[d.skin] * d.fingers + (d.skin === 'gel' ? 150 : 0)
  const nParts = 12 + 8 * d.fingers + 2 * active
  const p = PROCESS[d.build]
  const structure = p.v * nParts + p.F / VOLUME
  return { total: actuators + assembly + sensors + structure, parts: { actuators, assembly, sensors, structure } }
}

/**
 * Backdrivability: can a push on a fingertip turn the motor back? A self-locking screw:
 * never. A tiny motor in a joint needs a high gear ratio: only a little. A tendon from a big
 * forearm motor runs at ~5-15:1 (like 1X's NEO hand): freely. From the palm: mostly.
 */
function backdrivability(d: Design) {
  if (d.drive === 'linkage') return 0
  if (d.drive === 'gear') return 0.5
  return d.place === 'forearm' ? 1 : 0.75
}

/**
 * Simulatability: will the real hand behave like its simulation? Stiff gears at each joint
 * are the most deterministic; linkages are stiff but couple joints; tendons add friction
 * that depends on the path and direction (hysteresis), worse the longer the cable.
 */
function simulatability(d: Design) {
  if (d.drive === 'gear') return 1
  if (d.drive === 'linkage') return 0.8
  return d.place === 'forearm' ? 0.4 : 0.5
}

/**
 * Learnability, the lime score: what a learning robot wants from its hand.
 *   learn = 100 × (0.35 × backdrivable + 0.35 × simulatable + 0.30 × sensing)
 * Sensing: none 0, pads 0.35, dense arrays 1, camera gel 0.9 (rich but slow).
 */
const SENSE: Record<Skin, number> = { none: 0, pads: 0.35, arrays: 1, gel: 0.9 }

export function score(d: Design): Scores {
  const active = Math.min(d.motors, 4 * d.fingers)
  const backdrive = backdrivability(d)
  const sim = simulatability(d)
  const c = unitCost(d, active)
  return {
    active,
    dex: dexterity(d.fingers, active, d.drive),
    grip: gripForce(d, active),
    weight: weightAtWrist(d, active),
    cycles: lifeCycles(d, active),
    cost: c.total,
    backdrive,
    sim,
    learn: 100 * (0.35 * backdrive + 0.35 * sim + 0.3 * SENSE[d.skin]),
    parts: c.parts,
  }
}

/* ---------------------------------------------------------------- the customers */

export type CustomerId = 'warehouse' | 'home' | 'lab'

/** Which number (or choice) a customer's verdict hinged on, so the lab can point at it. */
export type Metric = 'cost' | 'cycles' | 'grip' | 'weight' | 'dex' | 'learn' | 'skin' | 'backdrive'

export interface Verdict {
  ok: boolean
  key?: Metric
  /** What the customer says (shown on their card, not voiced). */
  line: string
  /** Which requirement decided it, for Pip. */
  why: string
}

export interface Customer {
  id: CustomerId
  name: string
  role: string
  budget: number
  job: string
  /** The contract, in order of what the customer checks first. */
  terms: string[]
  judge: (s: Scores, d: Design) => Verdict
}

/** A year of warehouse picking: 10,000 grips a day. */
export const WAREHOUSE_CYCLES = 10_000 * 365
/** A year of a home robot's chores: about 1,000 grips a day. */
export const HOME_CYCLES = 1_000 * 365
/** A semester of clumsy training runs in a lab. */
export const LAB_CYCLES = 50_000

const days = (cycles: number, perDay: number) => Math.max(1, Math.round(cycles / perDay))

export const CUSTOMERS: Customer[] = [
  {
    id: 'warehouse',
    name: 'Rosa',
    role: 'warehouse manager',
    budget: 3000,
    job: 'boxes and totes, 10,000 grips a day for a year',
    terms: ['under $3,000', 'lasts 3.65M grips', 'grips a 5 kg box (60 N)'],
    judge: (s) => {
      if (s.cost > 3000) return { ok: false, line: `$${fmtK(s.cost)} a hand? I need it under three thousand.`, why: 'over the $3,000 budget', key: 'cost' }
      if (s.cycles < WAREHOUSE_CYCLES) {
        const d = days(s.cycles, 10_000)
        const span = d < 14 ? 'in a week' : d < 60 ? `in ${Math.round(d / 7)} weeks` : `in ${Math.round(d / 30)} months`
        return { ok: false, line: `It will break ${span} at our volumes.`, why: `lasts ${fmtCycles(s.cycles)} grips, needs ${fmtCycles(WAREHOUSE_CYCLES)}`, key: 'cycles' }
      }
      if (s.grip < 60) return { ok: false, line: 'It can’t hold a five-kilo box. Too weak.', why: `grip ${Math.round(s.grip)} N, needs 60 N`, key: 'grip' }
      return { ok: true, line: 'Cheap, strong, and it lasts. Where do I sign?', why: 'cheap, durable and strong enough' }
    },
  },
  {
    id: 'home',
    name: 'Sam',
    role: 'home-robot founder',
    budget: 6000,
    job: 'dishes, laundry, doors; safe around people',
    terms: ['under $6,000', 'backdrivable and under 700 g', 'nimble (dexterity 50+)', 'lasts a year of chores'],
    judge: (s, d) => {
      if (s.cost > 6000) return { ok: false, line: 'Beautiful, but it would cost more than the robot.', why: 'over the $6,000 budget', key: 'cost' }
      if (s.backdrive < 0.7)
        return {
          ok: false,
          line: d.drive === 'linkage' ? 'Those fingers lock solid. If it pinches a child, it won’t let go.' : 'Tiny geared motors don’t give way. It isn’t safe near people.',
          why: 'not backdrivable enough to be safe around people', key: 'backdrive',
        }
      if (s.weight > 700) return { ok: false, line: `${Math.round(s.weight)} grams at the wrist? Our arm can’t swing that near people.`, why: `${Math.round(s.weight)} g at the wrist, limit 700 g`, key: 'weight' }
      if (s.dex < 50) return { ok: false, line: 'It can’t open a door or fold a shirt.', why: `dexterity ${Math.round(s.dex)}, needs 50`, key: 'dex' }
      if (s.grip < 30) return { ok: false, line: 'Too weak for a full laundry basket.', why: `grip ${Math.round(s.grip)} N, needs 30 N`, key: 'grip' }
      if (s.cycles < HOME_CYCLES) {
        const m = Math.max(1, Math.round(days(s.cycles, 1000) / 30))
        return { ok: false, line: `It would wear out after ${m} month${m > 1 ? "s" : ""} of dishes and laundry.`, why: `lasts ${fmtCycles(s.cycles)} grips, needs ${fmtCycles(HOME_CYCLES)}`, key: 'cycles' }
      }
      return { ok: true, line: 'Gentle, light and nimble. Let’s build it.', why: 'safe, light, nimble and affordable' }
    },
  },
  {
    id: 'lab',
    name: 'Dr Mei',
    role: 'university lab lead',
    budget: 40000,
    job: 'in-hand manipulation; rich touch; learnable',
    terms: ['dexterity 75+', 'rich touch', 'learnable (65+)', 'survives a semester'],
    judge: (s, d) => {
      if (s.cost > 40000) return { ok: false, line: 'Even our grant can’t cover that.', why: 'over the $40,000 budget', key: 'cost' }
      if (s.dex < 75) return { ok: false, line: 'It can’t turn a pen in its fingers. We study dexterity.', why: `dexterity ${Math.round(s.dex)}, needs 75`, key: 'dex' }
      if (d.skin !== 'arrays' && d.skin !== 'gel') return { ok: false, line: 'Without rich touch there’s nothing new to learn.', why: 'needs dense tactile arrays or camera gel tips', key: 'skin' }
      if (s.learn < 65) return { ok: false, line: 'It locks up and won’t match the simulation. Our policies won’t transfer.', why: `learnability ${Math.round(s.learn)}, needs 65`, key: 'learn' }
      if (s.cycles < LAB_CYCLES) return { ok: false, line: 'It would break before the semester ends.', why: `lasts ${fmtCycles(s.cycles)} grips, needs ${fmtCycles(LAB_CYCLES)}`, key: 'cycles' }
      return { ok: true, line: 'Nimble, sensitive, learnable. We’ll take ten.', why: 'dexterous, touch-rich and learnable' }
    },
  },
]

/* ---------------------------------------------------------------- formatting */

export function fmtK(n: number) {
  return n >= 10000 ? `${Math.round(n / 1000)}k` : Math.round(n).toLocaleString('en-US')
}
export function fmtCycles(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`
  return `${Math.round(n)}`
}

export const LABELS = {
  place: { joints: 'in the joints', palm: 'in the palm', forearm: 'in the forearm' },
  drive: { linkage: 'linkage + screw', tendon: 'tendon', gear: 'gear in joint' },
  skin: { none: 'no touch', pads: 'fingertip pads', arrays: 'full fingertip arrays', gel: 'camera gel tips' },
  build: { print: '3D printed', cnc: 'CNC machined', mould: 'moulded and die cast' },
} as const

export function describe(d: Design) {
  return `${d.fingers} fingers, ${d.motors} motors ${LABELS.place[d.place]}, ${LABELS.drive[d.drive]}, ${LABELS.skin[d.skin]}, ${LABELS.build[d.build]}`
}

export const designKey = (d: Design) => `${d.fingers}-${d.motors}-${d.place}-${d.drive}-${d.skin}-${d.build}`

/* ---------------------------------------------------------------- fairness check */

export const ALL_DESIGNS: Design[] = (() => {
  const out: Design[] = []
  for (const fingers of [3, 4, 5] as Fingers[])
    for (const motors of [1, 6, 12, 20] as Motors[])
      for (const place of ['joints', 'palm', 'forearm'] as Place[])
        for (const drive of ['linkage', 'tendon', 'gear'] as Drive[])
          for (const skin of ['none', 'pads', 'arrays', 'gel'] as Skin[])
            for (const build of ['print', 'cnc', 'mould'] as Build[]) if (FITS[drive].includes(place)) out.push({ fingers, motors, place, drive, skin, build })
  return out
})()

/** Counts, for every set of customers, how many designs sign exactly that set. */
export function checkFairness() {
  const tally: Record<string, number> = {}
  for (const d of ALL_DESIGNS) {
    const s = score(d)
    const won = CUSTOMERS.filter((c) => c.judge(s, d).ok).map((c) => c.id)
    const k = won.join('+') || 'none'
    tally[k] = (tally[k] ?? 0) + 1
  }
  return tally
}
