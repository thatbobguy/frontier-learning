import { C } from '../../../cine/palette'
import { Figure, Formula, H, Lede, List, Note, Numbers, P, Sources, Table, Think } from '../../../flow/Reading'
import type { Reading } from '../../../flow/types'

/* ------------------------------------------------------------------ */
/* Chapter 1: what a hand costs                                         */
/* ------------------------------------------------------------------ */

const PRICES: [string, number, string][] = [
  ['Shadow Dexterous Hand', 100000, '> $100k'],
  ['WUJI Hand', 16000, '~ $16k'],
  ['Allegro Hand', 15500, '~ $15–16k'],
  ['Inspire RH56', 7000, '~ $4.5–10k'],
  ['Unitree Dex5-S', 6500, 'from $6.5k'],
  ['LEAP Hand (kit)', 2000, '~ $2k'],
  ['Linkerbot O6', 930, '~ $930'],
  ['TetherIA Aero (kit)', 314, '$314'],
]

function CostBody() {
  const lx = (v: number) => 200 + ((Math.log10(v) - 2) / 3.2) * 360
  return (
    <>
      <Lede>Where the money in a humanoid goes, why the hand is such a big slice, and how fast hand prices are falling.</Lede>
      <P>
        A bill of materials (BOM) is the list of every part in a product and what each one costs to buy or make. It is not the price you pay: it leaves out assembly labour, testing, the factory, warranty and profit. But it is the best single view of where the money goes, and analysts have started publishing BOMs for humanoid robots.
      </P>
      <H>The whole robot</H>
      <P>
        Bank of America estimated a Chinese-made humanoid’s BOM at about $35,000 at the end of 2025, falling to roughly $13,000–17,000 by 2030–2035, a decline of about 14% a year. The same bank put Western pilot-stage production at $90,000–100,000 a unit. Morgan Stanley costed Tesla’s Optimus Gen 2 at about $46,000 using Chinese suppliers and $131,000 without them.
      </P>
      <P>
        Inside that BOM, actuators dominate. Morgan Stanley put actuators across the body at about 56% of the Optimus BOM. A humanoid is mostly a collection of 30–70 motion modules, and each one stacks a motor with magnets, a precision gearbox or screw, an encoder, a driver board, bearings and a housing, each precision-made and each with its own supplier margin. Batteries, compute and the frame are a much smaller share.
      </P>
      <H>The hands</H>
      <P>
        Morgan Stanley estimated the hands at about 17% of the Optimus BOM (roughly $9,500 on a $50–60k BOM). Other estimates land in the same range: 10–20% is typical, above 20% for hands with dense touch sensing, and a Chinese industry estimate in 2026 put a dexterous hand at about 20% of a complete machine. A report from China’s WAIC show in July 2026 gave 18–25%.
      </P>
      <Note title="Read these splits as rough">
        The secondary source that reports Morgan Stanley’s percentage table adds up to more than 100%, so the body-segment splits are approximate. Treat “about a sixth” as the message, not the decimal place.
      </Note>
      <H>The per-joint arithmetic</H>
      <P>
        Bank of America’s framing makes the challenge concrete. Take 30 actuators (16 rotary and 14 linear) carrying 56% of a $50–60k BOM: that is $930–1,120 per joint today. To reach a $13–17k robot, each joint has to cost $240–320, a cut of about 73%. Hands make this harder, because a dexterous hand can have as many actuators as the rest of the body.
      </P>
      <Numbers
        items={[
          ['~17%', 'hands’ share of the Optimus BOM (Morgan Stanley)'],
          ['~56%', 'actuators’ share of the whole BOM'],
          ['$930–1,120', 'cost per joint today (BofA framing)'],
          ['$240–320', 'cost per joint needed for a $13–17k robot'],
        ]}
      />
      <H>What real hands cost</H>
      <Figure caption="List prices of real hands, log scale. Prices are dated 2023–2026 and come from papers, makers and retailers; kits (LEAP, TetherIA) are sold as parts to assemble yourself.">
        <svg viewBox="0 0 600 290" role="img" aria-label="A bar chart of robot hand prices from about 300 dollars to over 100,000 dollars on a log scale.">
          <rect width={600} height={290} fill={C.ink1} />
          {[100, 1000, 10000, 100000].map((v) => (
            <g key={v}>
              <line x1={lx(v)} x2={lx(v)} y1={14} y2={262} stroke={C.ink4} strokeDasharray="3 5" />
              <text x={lx(v)} y={280} fill={C.mist} fontSize={12} textAnchor="middle">
                {v >= 1000 ? `$${v / 1000}k` : `$${v}`}
              </text>
            </g>
          ))}
          {PRICES.map(([name, v, label], i) => (
            <g key={name}>
              <text x={192} y={30 + i * 30} fill={C.paper} fontSize={13} textAnchor="end">
                {name}
              </text>
              <rect x={200} y={18 + i * 30} width={Math.max(4, lx(v) - 200)} height={16} rx={3} fill={C.gold} opacity={0.85} />
              <text x={lx(v) + 6} y={31 + i * 30} fill={C.goldLight} fontSize={12}>
                {label}
              </text>
            </g>
          ))}
        </svg>
      </Figure>
      <P>
        The spread is huge, and it tracks the iron triangle: the research-grade Shadow hand is dexterous and robust but costs over $100,000; LEAP, ORCA (under 2,000 CHF in materials) and TetherIA’s kit are dexterous and cheap but not industrial-tough; six-actuator linkage hands like Inspire’s RH56 or Linkerbot’s O6 are cheap and robust but less dexterous.
      </P>
      <H>Prices are falling fast</H>
      <P>
        In China, average dexterous-hand prices fell from about RMB 50,000–100,000 (roughly $7,000–15,000) to about RMB 20,000–35,000 (roughly $3,000–5,000) by 2026. Linkerbot’s O6 lists at RMB 6,666 (about $930), and the WAIC report describes prices heading toward ¥10,000 (about $1,400). Whole robots fell too: Unitree’s average humanoid price went from about RMB 593,000 (around $85k) in 2023 to about RMB 168,000 (around $25k) in 2025, while keeping a gross margin of about 60%.
      </P>
      <P>
        Volume is still tiny by car standards. In 2025 the world shipped somewhere around 13,000–18,000 humanoids and over 30,000 dexterous hands. One Chinese estimate puts 2025 hand production at about 19,200 against 2026 demand of about 70,200, a large shortfall. That gap, between hands people want and hands anyone can build, is the wall this film is about.
      </P>
      <Think q="If hands are about 17% of the BOM, why do companies treat them as the hardest part rather than a medium-sized line item?">
        Cost is only one side. The hand also has the most actuators in the smallest space, the most contact with the world (so the most wear), and the most design churn. Tesla paused Optimus production in 2025 with bodies waiting for hands. A part can be a sixth of the cost and most of the schedule risk.
      </Think>
      <Sources
        items={[
          ['Xenospectrum: humanoid BOM and actuator cost (BofA, Morgan Stanley figures)', 'https://xenospectrum.com/en/humanoid-robot-bom-actuator-cost/'],
          ['ITES China: dexterous hand cost share, prices, supply and demand', 'https://global.iteschina.com/en/news/details/2994'],
          ['Cloudnews: Optimus BOM with and without Chinese suppliers', 'https://cloudnews.tech/teslas-optimus-chain-looks-to-the-u-s-but-remains-tied-to-chinese-suppliers/'],
          ['Gasgoo: WAIC 2026, how much longer until dexterous hands are good enough', 'https://autonews.gasgoo.com/articles/news/dextrous-hands-how-much-longer-until-they-are-good-enough-2081759214195150849'],
          ['Gasgoo: have humanoid robot prices really crashed?', 'https://autonews.gasgoo.com/articles/other/humanoid-robots-have-prices-really-crashed-2067224018745425921'],
          ['Rest of World: Unitree’s IPO and prices', 'https://restofworld.org/2026/unitree-china-humanoid-robot-shanghai-ipo/'],
          ['LEAP Hand paper (prices of Shadow, Allegro, LEAP)', 'https://ar5iv.arxiv.org/html/2309.06440'],
          ['Fortune: Bank of America humanoid forecast', 'https://fortune.com/2026/03/13/bank-of-america-humanoid-robot-forecast-3-billion-2060'],
        ]}
      />
    </>
  )
}

export const CostReading: Reading = {
  id: 'bom',
  title: 'What a robot hand costs, and why',
  blurb: 'Bills of materials, the per-joint arithmetic, real hand prices, and how fast they are falling.',
  minutes: 6,
  Body: CostBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 2: processes                                                 */
/* ------------------------------------------------------------------ */

function ProcessBody() {
  const X = (V: number) => 60 + ((Math.log10(V) - 1) / 4) * 500
  const Y = (c: number) => 230 - ((Math.log10(c) + 0.5) / 4.5) * 210
  const line = (F: number, v: number) => Array.from({ length: 41 }, (_, i) => Math.pow(10, 1 + i / 10)).map((V, i) => `${i ? 'L' : 'M'}${X(V).toFixed(1)} ${Y(v + F / V).toFixed(1)}`).join(' ')
  return (
    <>
      <Lede>A field guide to the ways hand parts get made, what each one costs, and how to tell when to switch from one to the next.</Lede>
      <P>
        Every process trades a fixed cost against a running cost. A CNC mill needs no special tooling, so the first part is cheap to start, but every part takes real machine time. A mould costs thousands of dollars before the first part, and then turns them out in seconds. Which is cheaper depends entirely on how many you make.
      </P>
      <Formula tex="unit cost = v + F / V">
        v is the cost of each part (material, machine time, labour), F the fixed tooling cost, V the number of parts the tool will make.
      </Formula>
      <H>The processes</H>
      <Table
        rows={[
          ['Process', 'Tooling', 'Lead time', 'Tolerance', 'Sweet spot'],
          ['CNC machining', 'none', 'days', '±0.01 mm common', 'prototypes, first units'],
          ['3D printing (SLS/MJF nylon, resin, FDM)', 'none', 'hours to days', 'looser', 'under ~1,000 units, research hands'],
          ['Injection moulding, rapid tool (aluminium or soft steel)', '~$2.5–5.5k', '2–4 weeks', '±0.05–0.1 mm', 'up to ~5,000 parts'],
          ['Injection moulding, production steel tool', '~$8–15k+ (complex: $30–100k+)', '8–12 weeks', '±0.05–0.1 mm', 'hundreds of thousands to 1M+ shots'],
          ['Metal injection moulding (MIM)', 'tens of thousands of dollars', 'weeks', 'fine; shrinks 15–20% in the furnace', '~100,000+ parts a year'],
          ['Die casting (aluminium, magnesium)', 'much more than a plastic mould', 'weeks', 'bores usually machined after', 'palms, forearm shells, housings'],
          ['Overmoulded skins (silicone, TPU)', 'a mould over a rigid core', 'weeks', 'soft', 'grip and protection; wears first'],
        ]}
      />
      <P>
        Injection-moulded plastic parts cost roughly $0.50–5 each at 1,000 units and $0.10–2 at 10,000. Typical hand plastics are glass-filled nylon, PA12, POM (acetal, for low-friction joints) and PEEK. Moulded parts hold about ±0.05–0.1 mm, while ±0.01 mm needs grinding or machining, so good designs put precision only where it matters, such as bearing seats.
      </P>
      <H>MIM: tiny metal parts at scale</H>
      <P>
        Metal injection moulding mixes fine metal powder with a binder, injects it like plastic, then removes the binder and sinters the part in a furnace, where it shrinks by about 15–20%. It makes small, complex, strong parts: gears down to about module 0.05, linkages, finger segments, walls around 0.2 mm thick, cross-holes. It uses over 95% of the material, against roughly 50% waste when machining. But its tooling costs tens of thousands of dollars, so it only becomes cost-effective at around 100,000 parts a year. At today’s hand volumes MIM barely makes sense; at millions it becomes essential.
      </P>
      <H>Printing: the research hand’s secret</H>
      <P>
        Printing has no tooling and a flat cost per part, which makes it ideal for small runs. CMU’s LEAP Hand was printed on a roughly $200 Ender 3 printer; it costs about $2,000, takes under four hours to assemble and two days to print. ORCA and TetherIA also use printed nylon. Printing lets a lab change the design every week, which is exactly what you want before the design is settled.
      </P>
      <H>Figure’s BotQ: from a week to seconds</H>
      <P>
        Figure says parts that “spent over a week on a CNC machine can now be manufactured in under 20 seconds” with tooled processes. Figure 03 moved from CNC to die casting and injection moulding, and its redesign “drastically reduced part count” to make the factory, BotQ, viable. An aggregator reported that this cut manufacturing cost per unit by about 90%; that figure is unverified. BotQ was announced in March 2025 with capacity for 12,000 robots a year at first; by July 2026 Figure reported its 1,000th Figure 03, at about one robot an hour. Its end-of-line first-pass yield was reported at 80%+, against 99.3% for its battery line, a reminder that complex electromechanical products yield far worse than mature lines.
      </P>
      <H>A worked crossover</H>
      <P>
        Using the numbers from the film’s game (illustrative, not quotes): a steel mould at F = $15,000 making parts at v = $0.40, against machining at v = $60 or printing at v = $12. The crossover volume, where the two cost the same, is
      </P>
      <Formula tex="V* = F / (v_other − v_mould)">With machining: 15,000 / 59.60 ≈ 250 parts. With printing: 15,000 / 11.60 ≈ 1,300 parts.</Formula>
      <Figure caption="Unit cost against volume for the worked example, log scales. The mould line starts high and falls; the crossings are where switching pays.">
        <svg viewBox="0 0 600 260" role="img" aria-label="Three cost curves: machining flat at 60 dollars, printing flat at 12 dollars, and a mould curve falling steeply and crossing both.">
          <rect width={600} height={260} fill={C.ink1} />
          <line x1={60} y1={230} x2={570} y2={230} stroke={C.fog} />
          <line x1={60} y1={230} x2={60} y2={14} stroke={C.fog} />
          {[10, 100, 1000, 10000, 100000].map((v) => (
            <text key={v} x={X(v)} y={250} fill={C.mist} fontSize={12} textAnchor="middle">
              {v >= 1000 ? `${v / 1000}k` : v}
            </text>
          ))}
          <path d={line(0, 60)} stroke={C.mist} strokeWidth={2.5} fill="none" />
          <path d={line(0, 12)} stroke={C.fog} strokeWidth={2.5} fill="none" />
          <path d={line(15000, 0.4)} stroke={C.gold} strokeWidth={3} fill="none" />
          <circle cx={X(15000 / 59.6)} cy={Y(60)} r={6} fill={C.gold} />
          <circle cx={X(15000 / 11.6)} cy={Y(12)} r={6} fill={C.gold} />
          <text x={565} y={Y(60) - 6} fill={C.mist} fontSize={13} textAnchor="end">machining $60</text>
          <text x={565} y={Y(12) - 6} fill={C.fog} fontSize={13} textAnchor="end">printing $12</text>
          <text x={X(30)} y={Y(500) - 10} fill={C.gold} fontSize={13}>steel mould</text>
        </svg>
      </Figure>
      <Note title="Soft tools wear out">
        A rapid aluminium or soft-steel tool suits runs up to about 5,000 parts. Past that you are buying a new tool every few thousand parts, so a cheap tool can be the expensive choice for a big order. Hardened production steel lasts hundreds of thousands to over a million shots.
      </Note>
      <Think q="Why might a company keep machining a part even after orders reach tens of thousands?">
        Because the design is still changing. A mould locks the shape in; every change means re-cutting or scrapping the tool and waiting 8–12 weeks. Tesla’s hand was redesigned after production plans were set, leaving bodies waiting for hands. Paying more per part can be cheaper than paying for tools twice.
      </Think>
      <Sources
        items={[
          ['Figure: BotQ, a high-volume manufacturing facility', 'https://figure.ai/news/botq'],
          ['AI2.work: Figure builds its 1,000th humanoid', 'https://ai2.work/blog/figure-builds-its-1-000th-humanoid-robot-as-botq-hits-one-per-hour'],
          ['Team Rapid Tooling: injection moulding cost for 1,000–10,000 parts', 'https://www.teamrapidtooling.com/injection-molding-cost-1000-10000-parts-a-680.html'],
          ['Stanford Advanced Materials: how MIM makes humanoids cheaper and lighter', 'https://powder.samaterials.com/how-powder-metallurgy-and-mim-are-making-humanoid-robots-cheaper-and-lighter.html'],
          ['LEAP Hand paper', 'https://ar5iv.arxiv.org/html/2309.06440'],
          ['ORCA Hand paper', 'https://arxiv.org/html/2504.04259v1'],
        ]}
      />
    </>
  )
}

export const ProcessReading: Reading = {
  id: 'processes',
  title: 'From CNC to moulds: a field guide to making hand parts',
  blurb: 'Tooling cost, part cost, lead time and tolerance for every process, MIM’s shrink, Figure’s BotQ, and a worked crossover.',
  minutes: 7,
  Body: ProcessBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 3: durability and reliability                                */
/* ------------------------------------------------------------------ */

function ReliabilityBody() {
  const X = (n: number) => 60 + (n / 100) * 510
  const Y = (r: number) => 220 - Math.max(0, (r - 0.75) / 0.25) * 200
  const curve = (r: number) => Array.from({ length: 101 }, (_, n) => `${n ? 'L' : 'M'}${X(n).toFixed(1)} ${Y(Math.pow(r, n)).toFixed(1)}`).join(' ')
  return (
    <>
      <Lede>Why a hand that survives half a million grips is not nearly enough, and why a robot with seventy good parts is a less reliable machine than any one of them.</Lede>
      <H>The grip arithmetic</H>
      <P>
        A warehouse humanoid grips something 8,000–10,000 times a day. Geek+, a warehouse-robot company, says leading hand suppliers rate their hands for 300,000–500,000 cycles. Divide one by the other and a hand lasts about one to two months. A million-cycle hand lasts three to four months. To match the roughly five-year life expected of factory equipment you would need about 15–18 million cycles.
      </P>
      <Numbers
        items={[
          ['8–10k', 'grips a day for a warehouse robot'],
          ['300–500k', 'cycles leading hands are rated for'],
          ['1–2 months', 'how long that lasts'],
          ['15–18M', 'cycles for a five-year life'],
        ]}
      />
      <H>Series reliability</H>
      <P>
        A humanoid has around 70 actuators, and for most jobs it needs all of them. When every part must work for the whole to work, reliabilities multiply:
      </P>
      <Formula tex="R_robot = R_1 × R_2 × … × R_n = r^n (if all parts are alike)">With r = 0.999 and n = 70, R ≈ 0.93. With r = 0.9999, R ≈ 0.993.</Formula>
      <Figure caption="Chance the whole robot gets through a shift, against the number of actuators, for three per-actuator reliabilities.">
        <svg viewBox="0 0 600 250" role="img" aria-label="Three curves falling as the number of actuators grows; the 99.9 percent curve reaches 93 percent at 70 actuators.">
          <rect width={600} height={250} fill={C.ink1} />
          <line x1={60} y1={220} x2={570} y2={220} stroke={C.fog} />
          <line x1={60} y1={220} x2={60} y2={14} stroke={C.fog} />
          {[0, 20, 40, 60, 80, 100].map((n) => (
            <text key={n} x={X(n)} y={238} fill={C.mist} fontSize={12} textAnchor="middle">
              {n}
            </text>
          ))}
          {[0.75, 0.85, 0.95, 1].map((r) => (
            <text key={r} x={52} y={Y(r) + 4} fill={C.mist} fontSize={12} textAnchor="end">
              {Math.round(r * 100)}%
            </text>
          ))}
          <path d={curve(0.9999)} stroke={C.lime} strokeWidth={2.5} fill="none" />
          <path d={curve(0.999)} stroke={C.amber} strokeWidth={2.5} fill="none" />
          <path d={curve(0.997)} stroke={C.danger} strokeWidth={2.5} fill="none" />
          <line x1={X(70)} x2={X(70)} y1={14} y2={220} stroke={C.fog} strokeDasharray="4 4" />
          <circle cx={X(70)} cy={Y(Math.pow(0.999, 70))} r={5} fill={C.amber} />
          <text x={X(70) + 8} y={Y(Math.pow(0.999, 70)) - 6} fill={C.amber} fontSize={12}>93% at 70</text>
          <text x={565} y={Y(Math.pow(0.9999, 100)) - 6} fill={C.lime} fontSize={12} textAnchor="end">99.99% each</text>
          <text x={565} y={Y(Math.pow(0.999, 100)) + 16} fill={C.amber} fontSize={12} textAnchor="end">99.9% each</text>
          <text x={300} y={Y(Math.pow(0.997, 50)) + 18} fill={C.danger} fontSize={12}>99.7% each</text>
        </svg>
      </Figure>
      <P>
        The vertical axis here only goes down to about 75% so the shapes are visible; at 99.7% per part the curve keeps falling below the chart. About 50 of a humanoid’s 70 actuators can be in the hands (Tesla’s patented design had about 25 per hand), so hand parts dominate the robot’s uptime. Adding a joint for dexterity is never free: it is one more term in the product.
      </P>
      <H>How factories judge machines</H>
      <P>
        Factory lines run in series too. A station that is down for 1% of a two-shift year loses about 40 hours, and if it blocks the line every station after it stops as well. Car plants judge equipment by OEE (overall equipment effectiveness: availability × speed × quality), and mature robot arms have a mean time between failures (MTBF) in the tens of thousands of hours. Public MTBF figures for humanoid hands essentially do not exist as of October 2026.
      </P>
      <H>What actually breaks</H>
      <P>The open-source ORCA hand (ETH Zurich, 2025) published an unusually honest failure log:</P>
      <List
        items={[
          'the silicone fingertip skin wore out after 2,000–4,000 cycles, which also dulled its touch sensing;',
          'thin copper sensor wires snapped after 4,500–7,000 cycles where they crossed the knuckle and side-to-side joints;',
          'tendons went slack and needed re-tensioning by hand.',
        ]}
      />
      <P>
        Other common failure modes (engineering background): tendon creep and fraying at pulleys, gear-tooth wear, lead-screw nut wear, coreless motors overheating when holding a grip (gripping is a near-stall load, so current and heat peak while no work is done), connector fretting, encoder drift, dust and oil getting in, and impact fractures. In a separate test, LEAP’s authors report the Allegro hand failed after 15 minutes of a repetitive load test while LEAP lasted 60; ORCA’s headline was 10,000+ cycles (about 20 hours) without failure.
      </P>
      <H>The lab-versus-field gap</H>
      <P>
        Inspire (Yinshi) has claimed up to a million cycles under load testing, yet in warehouse logistics some of its hands broke after about 50 grips of 5 kg items; in July 2026 it switched some models from hard plastic shells to all-metal. Others claim big numbers too: Sharpa reports 2.5 million press cycles, WUJI 300,000+ grasp cycles (about a million internally) and 80 cm drop survival, Ruiyan over a million. Targets cited at WAIC 2026 were about 200,000 operations for consumer hands and 300,000+ for industrial ones.
      </P>
      <Note title="There is no agreed test">
        A “cycle” can mean a light squeeze on foam or a twisting grip on a heavy box. Without a shared benchmark that fixes the load, speed and object, these numbers cannot be compared, and a lab count says little about the field. Building that benchmark, and the test rigs for it, is an open opportunity.
      </Note>
      <H>Design for repair</H>
      <P>
        If parts will fail, make failure cheap. Four identical fingers share one mould (amortising the tooling four times, eight if left and right hands share parts) and become a field-replaceable unit (FRU) you swap in minutes. ORCA’s joints pop out under overload and snap back instead of breaking; AnySkin’s sensor skin swaps in about 12 seconds; WUJI uses joints that release under heavy impact; Boston Dynamics avoids cables crossing joints at all.
      </P>
      <Think q="Which helps a 70-actuator robot more: making every actuator ten times less likely to fail, or cutting the actuator count in half?">
        Ten times better parts. At 99.9% each, halving 70 to 35 actuators lifts the robot from about 93% to about 96.6%. Going to 99.99% each with all 70 lifts it to about 99.3%. Both help, and real designs do both: fewer joints where dexterity is not needed, and better parts where it is.
      </Think>
      <Sources
        items={[
          ['Tiger Brokers / Geek+: hand durability and the 50-grip field report', 'https://www.itiger.com/news/1123099345'],
          ['ORCA Hand paper (failure log)', 'https://arxiv.org/html/2504.04259v1'],
          ['LEAP Hand paper (durability test vs Allegro)', 'https://ar5iv.arxiv.org/html/2309.06440'],
          ['Sharpa mass production and durability claims', 'https://letsdatascience.com/news/sharpa-robotics-begins-sharpawave-mass-production-56967aa7'],
          ['WUJI Hand specs', 'https://humanoid.guide/product/wuji-hand/'],
          ['Gasgoo: WAIC 2026 durability targets', 'https://autonews.gasgoo.com/articles/news/dextrous-hands-how-much-longer-until-they-are-good-enough-2081759214195150849'],
          ['Tesla Optimus hand patent: 25 actuators, 22 DoF', 'https://www.basenor.com/blogs/news/tesla-optimus-gen-3-hand-patents-revealed-25-actuators-22-dof'],
        ]}
      />
    </>
  )
}

export const ReliabilityReading: Reading = {
  id: 'reliability',
  title: 'Durability and series reliability',
  blurb: 'Grips per day, 0.999 to the 70th, what actually breaks, the lab-versus-field gap, and designing for repair.',
  minutes: 7,
  Body: ReliabilityBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 4: the supply chain                                          */
/* ------------------------------------------------------------------ */

function SupplyBody() {
  return (
    <>
      <Lede>The handful of tiny, precise parts inside every robot hand, who makes them, where the chokepoints are, and why costs should keep falling.</Lede>
      <H>Micro motors</H>
      <P>
        Hands mostly use coreless (ironless) brushed or brushless DC micro-motors, about 8–16 mm across. With no iron core they have no cogging and very little inertia, but they cannot shed heat well, which limits their continuous torque. The incumbents are Maxon and Portescap (Switzerland) and Faulhaber (Germany); Chinese challengers include Moons’, Zhaowei and Dingzhi. Shadow’s DEX-EE hand uses 15 Maxon DCX16 motors. A Chinese industry analysis put coreless micro-motors at about 6.7% of a humanoid’s hardware value.
      </P>
      <H>Screws, gears and the machines that make them</H>
      <P>
        Linear actuators use ball screws or planetary roller screws; Optimus uses roller screws because they carry more load and survive shocks better. Roller screws need precision thread grinding, and the grinding machines come from a handful of European and Japanese firms whose output, as Bank of America put it in April 2025, “cannot be expanded at will.” That is the chokepoint behind the chokepoint. Chinese domestic roller-screw prices have fallen from tens of thousands of yuan to thousands, and one maker, Wuzhou Xinchun, announced capacity for 980,000 sets.
      </P>
      <P>
        Wrists and arms use harmonic drives, a market where Harmonic Drive Systems (Japan) holds about 80% and Leaderdrive (China) about 10%. Imported units cost RMB 2,000–3,000, domestic ones RMB 800–1,500. A humanoid uses 20–40 reducers.
      </P>
      <H>Rare-earth magnets</H>
      <Figure caption="China’s share of rare earths in 2025: mined (270 of 390 thousand tonnes) and processed (up to about 90%).">
        <svg viewBox="0 0 600 150" role="img" aria-label="Two bars: China mined 69 percent and processed about 90 percent of rare earths.">
          <rect width={600} height={150} fill={C.ink1} />
          {[
            ['mined', 0.69, '~69%'],
            ['processed', 0.9, '~90%'],
          ].map(([name, v, label], i) => (
            <g key={name as string}>
              <text x={100} y={52 + i * 50} fill={C.paper} fontSize={14} textAnchor="end">
                {name}
              </text>
              <rect x={110} y={36 + i * 50} width={440} height={22} rx={4} fill={C.ink3} />
              <rect x={110} y={36 + i * 50} width={440 * (v as number)} height={22} rx={4} fill={C.gold} />
              <text x={116 + 440 * (v as number)} y={52 + i * 50} fill={C.goldLight} fontSize={13}>
                {label}
              </text>
            </g>
          ))}
        </svg>
      </Figure>
      <P>
        The strongest permanent magnets are neodymium-iron-boron (NdFeB). A humanoid holds about 2–4 kg of them, so a million robots would need roughly 2,000–4,000 tonnes. Hand micro-motors run hot in tight spaces, so they want magnets that keep working when warm; those get small additions of dysprosium and terbium, which are exactly the heavy rare earths China controls most tightly.
      </P>
      <P>
        China mined about 69% of the world’s rare earths in 2025 and processes up to about 90%. On April 4, 2025 it began requiring export licences for seven medium and heavy rare earths (samarium, gadolinium, terbium, dysprosium, lutetium, scandium, yttrium) and related magnets; Elon Musk confirmed Optimus was affected. Wider controls announced in October 2025 were suspended for 12 months in November 2025; that suspension expires around November 10, 2026, while the April 2025 licences stay in force.
      </P>
      <H>The China gap</H>
      <P>
        Morgan Stanley estimated Optimus Gen 2 at about $46,000 to build with Chinese suppliers and $131,000 without them, close to three times as much. Actuators alone went from $22,000 to $58,000 and the chip and software module from about $3,000 to about $7,000. Unitree, which makes most of its own core components, imports only about 20% of its supply chain. But concentration cuts both ways: one supplier, Inspire (Yinshi), provided 96.19% of Unitree’s hand purchases in the first three quarters of 2025.
      </P>
      <Numbers
        items={[
          ['$46k vs $131k', 'Optimus BOM with and without Chinese suppliers'],
          ['~80% / ~10%', 'Harmonic Drive Systems vs Leaderdrive share of harmonic reducers'],
          ['2–4 kg', 'NdFeB magnets per humanoid'],
          ['19%', 'battery cost drop per doubling of production'],
        ]}
      />
      <H>Wright’s law</H>
      <P>
        In 1936 the engineer Theodore Wright noticed that each time aircraft production doubled, the labour per plane fell by a steady share. The pattern, now called Wright’s law, shows up across manufacturing. Lithium-ion cells went from $9,200 per kWh in 1991 to $78 in 2024, falling about 19% for every doubling of cumulative production.
      </P>
      <Formula tex="cost after n doublings = C0 × (1 − rate)^n">At a 19% rate that is C0 × 0.81^n. Ten doublings (×1,024 in volume) gives 0.81^10 ≈ 0.12.</Formula>
      <P>
        Humanoids are at roughly 10,000 cumulative units, so going to about 10 million is about ten doublings; if the battery rate held, a $50,000 robot would become about $6,000. In the film’s play, a hand starting at $5,000 after 30,000 have been built needs log(0.2) / log(0.81) ≈ 7.6 doublings to get under $1,000, about 6 million hands. At a 25% rate it takes about 5.6 doublings (about 1.4 million hands); at 10% about 15 doublings (over a billion). Those starting numbers are illustrative, but the sensitivity is the point.
      </P>
      <Note title="Why the battery rate may not hold">
        Batteries are mostly chemistry and materials. Hands are mechanical assemblies, so their learning comes from fewer parts, better tooling, automation and supplier scale, and the grinding machines for screws and gears can cap how fast volume grows. Real-world signs of the curve so far: Bank of America’s ~14% a year BOM decline, and Unitree’s average price falling about 3.5 times in two years.
      </Note>
      <Think q="If Chinese suppliers make robots almost three times cheaper today, why do Western makers try to build their own supply chains anyway?">
        Risk. Export licences on heavy rare earths already hit Optimus in 2025, the suspension of wider controls ends in November 2026, and single-source dependencies can stop a line. Paying more for parts can be the price of being sure you can build at all. Volume also matters: whoever builds the most climbs Wright’s curve fastest.
      </Think>
      <Sources
        items={[
          ['SMM: coreless DC motor industry for humanoid robots', 'https://news.metal.com/newscontent/103368966-[Analysis-of-the-Development-of-Coreless-DC-Motor-Industry-for-Humanoid-Robot-Parts]-%7C-MIR-DATABANK'],
          ['Precision machine tools as a potential bottleneck', 'https://moodywriter13.substack.com/p/precision-machine-tools-as-a-potential'],
          ['China humanoid robot supply chain 2026', 'https://faxiangongchang.com/en/reports/china-humanoid-robot-supply-chain-2026'],
          ['Yahoo Finance: China’s rare-earth export pause', 'https://finance.yahoo.com/markets/commodities/articles/china-rare-earth-export-pause-123614106.html'],
          ['TrendForce: Tesla’s robot plans and rare-earth curbs', 'https://www.trendforce.com/news/2025/04/23/news-teslas-robot-plans-stumble-amid-chinas-rare-earth-export-curbs/'],
          ['Stockhead: robots and rare-earth demand', 'https://stockhead.com.au/resources/how-the-dawn-of-the-robot-age-could-send-rare-earth-demand-ballistic'],
          ['Cloudnews: Optimus supply chain and Chinese suppliers', 'https://cloudnews.tech/teslas-optimus-chain-looks-to-the-u-s-but-remains-tied-to-chinese-suppliers/'],
          ['Our World in Data: battery price decline', 'https://ourworldindata.org/battery-price-decline'],
          ['ITES China: Unitree’s hand sourcing', 'https://global.iteschina.com/en/news/details/2994'],
        ]}
      />
    </>
  )
}

export const SupplyReading: Reading = {
  id: 'supply-chain',
  title: 'The supply chain behind every hand',
  blurb: 'Micro motors, screws and grinders, harmonic drives, rare-earth magnets, the $46k vs $131k gap, and Wright’s law.',
  minutes: 7,
  Body: SupplyBody,
}
