/**
 * The hidden model behind Data Budget Tycoon (chapter 4).
 *
 * It is a toy, deliberately simple and documented so anyone can check why a mix wins.
 * The shape of every rule comes from the research notes (robot-data.md, sections 2 and 10);
 * the constants are tuned by hand so the lesson's three claims come out true:
 *   - all teleop fails (faithful, but only a handful of rooms: no diversity),
 *   - all video fails (cheap and diverse, but nothing grounds it in the robot's body),
 *   - a sensible mix passes (a thin robot layer on a wide base of cheap human data).
 *
 * How it works, in five steps:
 *  1. Dollars buy hours at each source's price (teleop $120/h, gloves $40/h, video $5/h,
 *     fleet $15/h once unlocked). Simulation is a $150k setup; past that, money buys
 *     authored scenes (assets, randomisation ranges) at $2,500 each, and the hours are free.
 *  2. Hours become DIVERSITY: how many distinct places each source covers. Teleop happens in
 *     a few staged rooms (it saturates at 20); a glove home gives ~25 h, a video place ~50 h,
 *     a fleet home ~40 h.
 *  3. GROUNDING: how much data comes from the robot's own body (teleop, fleet, and for rigid
 *     objects, simulation; gloves, built to match the robot, count 1%). Below ~40 h nothing
 *     transfers; grounding rises smoothly and saturates around 900 h. This is the
 *     minimum-robot-data threshold, and it multiplies everything.
 *  4. Each source's diversity counts at its FIDELITY for that task. Teleop and fleet: 1.0.
 *     Gloves: 0.6. Video: 0.05 rising to 0.2 as robot data grows (the emergent transfer
 *     Physical Intelligence reported). Simulation: 1.0 for rigid tidying,
 *     0.5 for the dishwasher, 0.05 for laundry (cloth is where sim is weakest).
 *  5. Success is a saturating power law in effective diversity, scaled by grounding:
 *        p = ceiling × grounding × E^0.8 / (E^0.8 + E0^0.8)
 *     then fleet corrections, which land on the robot's own mistakes, close part of the gap
 *     to the ceiling.
 *
 * Fleet practice is locked until a test run averages over 40%: nobody deploys a robot that
 * fails most of the time (the cold-start problem).
 */

export type Source = 'teleop' | 'gloves' | 'video' | 'sim' | 'fleet'
export const SOURCES: Source[] = ['teleop', 'gloves', 'video', 'sim', 'fleet']
export type Task = 'tidy' | 'laundry' | 'dishes'
export const TASKS: Task[] = ['tidy', 'laundry', 'dishes']

export const BUDGET = 1_000_000
export const TARGET = 0.6
export const FLEET_UNLOCK = 0.4

/** Price per hour of data (simulation: see SIM_SETUP and SIM_SCENE). */
export const PRICE: Record<Source, number> = { teleop: 120, gloves: 40, video: 5, sim: 0, fleet: 15 }
export const SIM_SETUP = 150_000
export const SIM_SCENE = 2_500

/** Hours a source spends in one distinct place before it repeats itself. */
const HOURS_PER_PLACE = { gloves: 25, video: 50, fleet: 40 }
/** Teleop: a handful of staged rooms (with their objects rearranged now and then). */
/** A start-up can only deploy so many robots: the fleet reaches at most 60 homes. */
const FLEET_HOMES = 60
const TELEOP_ROOMS = (h: number) => Math.min(20, 4 + h / 300)

/** How well a task can ever go with this robot (the hardware ceiling). */
const CEILING: Record<Task, number> = { tidy: 0.95, laundry: 0.85, dishes: 0.9 }
/** Effective places needed to get halfway up the curve, per task (laundry is hardest). */
const E0: Record<Task, number> = { tidy: 100, laundry: 260, dishes: 170 }
const ALPHA = 0.8
/** How much of simulation's authored diversity is real, per task. */
const SIM_FIDELITY: Record<Task, number> = { tidy: 1, laundry: 0.05, dishes: 0.5 }

export type Alloc = Record<Source, number>

export interface Result {
  hours: Record<Source, number>
  places: Record<Source, number>
  grounding: Record<Task, number>
  success: Record<Task, number>
  average: number
  /** The biggest thing holding each task back, in words, for the on-screen diagnosis. */
  why: Record<Task, string>
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function hoursBought(a: Alloc, fleetOpen: boolean): Record<Source, number> {
  return {
    teleop: a.teleop / PRICE.teleop,
    gloves: a.gloves / PRICE.gloves,
    video: a.video / PRICE.video,
    // Past setup, simulated hours are effectively free; we show a big number to make the point.
    sim: a.sim >= SIM_SETUP ? 50_000 + ((a.sim - SIM_SETUP) / SIM_SCENE) * 2_000 : 0,
    fleet: fleetOpen ? a.fleet / PRICE.fleet : 0,
  }
}

export function simulate(a: Alloc, fleetOpen: boolean): Result {
  const hours = hoursBought(a, fleetOpen)
  const simScenes = a.sim >= SIM_SETUP ? (a.sim - SIM_SETUP) / SIM_SCENE : 0
  const places: Record<Source, number> = {
    teleop: hours.teleop > 0 ? TELEOP_ROOMS(hours.teleop) : 0,
    gloves: hours.gloves / HOURS_PER_PLACE.gloves,
    video: hours.video / HOURS_PER_PLACE.video,
    sim: simScenes,
    fleet: Math.min(FLEET_HOMES, hours.fleet / HOURS_PER_PLACE.fleet),
  }
  const success = {} as Record<Task, number>
  const grounding = {} as Record<Task, number>
  const why = {} as Record<Task, string>
  for (const k of TASKS) {
    // Robot-body hours for this task. Sim counts only as far as it is faithful to the task.
    // Gloves are built to match the robot, so they ground a little on their own (1%).
    const R = hours.teleop + hours.fleet + Math.min(600, simScenes * 12) * SIM_FIDELITY[k] + hours.gloves * 0.01
    const g = 0.05 + 0.95 * smooth(40, 900, R)
    grounding[k] = g
    const fGloves = 0.6
    const fVideo = 0.05 + 0.15 * smooth(200, 1200, R)
    const E =
      places.teleop * 1 +
      places.fleet * 1 +
      places.gloves * fGloves +
      places.video * fVideo +
      places.sim * SIM_FIDELITY[k]
    const div = Math.pow(E, ALPHA) / (Math.pow(E, ALPHA) + Math.pow(E0[k], ALPHA))
    let p = CEILING[k] * g * div
    // Corrections land exactly on the robot's mistakes: they close part of the remaining gap.
    p += (CEILING[k] - p) * 0.45 * (1 - Math.exp(-hours.fleet / 2500))
    success[k] = Math.max(0, Math.min(CEILING[k], p))
    // Diagnosis: whichever is weaker, grounding or diversity.
    const simHeavy = a.sim >= SIM_SETUP && a.sim >= 0.3 * BUDGET
    if (g < 0.5 && !(k === 'laundry' && simHeavy)) why[k] = 'too little robot data to ground it'
    else if (success[k] >= TARGET) why[k] = 'good'
    else if (k === 'laundry' && simHeavy) why[k] = 'sim can’t fold cloth'
    else if (k !== 'laundry' && simHeavy && g < 0.5) why[k] = 'too little robot data to ground it'
    else if (div < 0.65) why[k] = 'not enough different homes'
    else why[k] = 'close: more homes, or fleet fixes'
  }
  const average = (success.tidy + success.laundry + success.dishes) / 3
  return { hours, places, grounding, success, average, why }
}

/**
 * Which of the 50 test homes succeed: home i passes task k when its (fixed) difficulty is
 * below the success rate. The difficulties are a fixed shuffle, so results are stable and
 * look like a scatter rather than a bar.
 */
export function homesLit(p: number, task: Task): boolean[] {
  const off = TASKS.indexOf(task) * 17
  return Array.from({ length: 50 }, (_, i) => {
    const d = (((i * 37 + off) % 50) + 0.5) / 50
    return d < p
  })
}
