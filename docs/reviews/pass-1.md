# FORMANT visual review — pass 1

Evidence reviewed: `concept.png`, `pass-1-desktop.png` (1536×1024 viewport), `pass-1-full.png`, `pass-1-ai.png`, and `pass-1-mobile.png` (390×844 document capture). This is a visual rendering review only; no interaction, audio, MCP, or runtime behavior was tested.

## Scores

| Dimension                    | Score | Rationale                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual craft                 |  8/10 | Strong dark studio palette, restrained coral accent, clear waveform/pattern color coding, and a convincing product identity. Some tiny labels and controls become overly compressed outside the main desktop composition.                                                                                       |
| Hierarchy/readability        |  7/10 | Transport and arrangement lead well on desktop. The dense timeline plus pattern editor competes for attention, and the full capture exposes a large repeated editor region that makes page structure feel broken.                                                                                               |
| Interaction clarity          |  7/10 | Play/stop, arrangement/mixer, track mute/solo, and AI connection have recognizable affordances. The step editor does not make active versus inactive state, keyboard focus, or edit scope sufficiently explicit from visuals alone.                                                                             |
| Accessibility/responsiveness |  4/10 | Desktop contrast and large primary controls are promising, but the 390px capture is a clipped fixed-width desktop canvas: the library is mostly hidden, timeline cards run offscreen, and horizontal content is inaccessible without an obvious responsive strategy. Small secondary text is also low contrast. |
| Product completeness         |  7/10 | The composition communicates a coherent DAW surface, including transport, tracks, pattern editing, export, save state, and AI/MCP setup. The evidence does not establish functional completeness, and the mobile layout is not release-ready.                                                                   |

**Mean: 6.6/10.** The mean is descriptive only; the responsive failure remains a release-blocking visual issue regardless of average.

## Findings

- **[high] Mobile layout is a clipped desktop canvas.** At 390px, the left rail and a narrow slice of the timeline consume the viewport while track cards, library content, and controls extend offscreen. There is no visible compact navigation, stacked track view, or intentional horizontal timeline affordance. Add a deliberate mobile mode: collapse the library/rail behind controls, keep transport reachable, and make the timeline a clearly scrollable region with an exposed scroll cue.

- **[high] First viewport hides the primary editing payoff.** In the 1024px desktop viewport, the pattern editor begins at the bottom edge and its controls are cut off. A user lands on the arrangement but cannot see the full edit action without scrolling. Reduce vertical chrome or make the pattern editor a bounded panel/drawer so the active track’s editing controls remain visible in the first viewport.

- **[high] Full document capture appears to duplicate the pattern editor.** `pass-1-full.png` shows a complete pattern editor followed by a large blank area and a second repeated editor/control block. If this is an actual duplicate render, remove the duplicate; if it is a sticky/fixed element captured twice, constrain its positioning and document flow. This undermines trust in the editor’s structure.

- **[medium] Dense timeline labels are too small at practical desktop scale.** Bar/beat numerals, clip IDs, track metadata, and footer status text are difficult to parse in the 1536×1024 capture. Increase minimum text size/contrast for operational labels and reserve low contrast for nonessential metadata.

- **[medium] Step editor state needs stronger visual separation.** Active steps use coral, but inactive steps and velocity handles are close in luminance to the surrounding surface. Add a clearer selected/focused state and a visible indication of which track owns the editor, especially when keyboard or AI edits change the pattern.

- **[medium] AI modal is polished but code-first.** The modal communicates local connection, capabilities, and MCP configuration clearly, but the long JSON block dominates the task. Keep the copy action prominent and add a short copyable connection summary or platform-specific instructions before the raw config. Ensure the modal has a visible focus path and a clearly reachable close action at smaller heights.

- **[low] The visual system is slightly over-reliant on color.** Track identity is color-coded effectively, but state and category should also have text/icon or pattern differences for color-vision users and monochrome contexts.

## Top fixes for pass 2

1. Implement and capture a true 390px responsive layout with an intentional timeline scroll model.
2. Rework vertical composition so the active pattern editor is visible in the first desktop viewport.
3. Resolve the apparent duplicate/sticky pattern editor in the full-page capture, then recapture the complete document.
4. Raise operational label contrast/size and strengthen step focus/selection states.

**Visual verdict:** strong desktop concept and a credible DAW visual language, held back by a high-severity responsive failure and an apparent document-flow/editor duplication issue. No 10 scores are warranted in this pass.
