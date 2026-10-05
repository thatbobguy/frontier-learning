# Frontier Learning

A prototype of a learning program that teaches the big picture first, from first principles. Lessons are narrated, animated explainers drawn entirely in code, where parts of the scene turn into games you play. A live AI tutor, Pip the owl, sits beside the lesson: it can see the screen, hear questions, and give hints rather than answers.

The first lesson is **The Frameworks of Mathematics**, written for a second grader:

1. **Why math was born.** A shepherd with no number words keeps track of her flock by matching pebbles to sheep.
2. **The map of math.** The four big questions: how many, how amounts change, what comes next, and how big or what shape.
3. **Numbers are names.** An amount is the idea, and a numeral is just a name for it. Introduces the number line.
4. **Bundling by ten.** Place value, with a twist round where an alien bundles by four.
5. **Together and apart.** Adding and taking away with bundles, balanced on a seesaw.
6. Two sneak-peek branches: **What comes next?** and **How big? What shape?**

## Run it locally

```sh
npm install
npm run dev
```

Handy links while testing:

- `?stop=3&beat=2` opens stop 3 at step 2 (both counted from 1).
- `&start=1` skips the start card.
- `&mute=1` turns the voice off.

## Pip, the tutor

Pip answers using Claude (`claude-opus-5-5` at low effort), called straight from the browser. GitHub Pages has no server, so open Pip's settings (the gear) and paste an Anthropic API key. The key stays in that browser's local storage and is sent only to Anthropic. Without a key, Pip still gives each game's built-in hints.

Before real students use this, put a small server or proxy in front of the API so no key lives in the browser.

## Voices

Narration and Pip use the browser's built-in speech for now. Students talk to Pip using the browser's speech recognition, which works in Chrome, Edge and Safari; anyone can also type a question.

## How it is built

- `src/engine`: the lesson player.
  - It steps through beats: a narrated line plus its animation.
  - It waits on "Now you try" games.
  - It notices when a student is stuck and asks Pip to help.
- `src/scenes`: one file per stop. Each scene is an SVG `1600 x 900` stage animated with a GSAP timeline that has a label per beat.
- `src/art`: the shared art kit and colours.
- `src/tutor`: Pip's panel, speech input, and the Claude call.

Pushing to `main` builds the site and publishes it to the `gh-pages` branch, which GitHub Pages serves.
