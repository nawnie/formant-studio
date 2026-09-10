# FORMANT design specification

The user delegated creative direction and requested no approval questions. `concept.png` is the full-screen reference selected for implementation. Native reference size: 1536 × 1024. The product is a synthesis-based local groove workstation, not a full VST host.

## Design system

Warm near-black `#151617`, surfaces `#1b1d1f` and `#222528`, neutral hairlines `#303336`, offwhite text `#e5e6e7`, restrained coral `#ef8970`. Instrument colors: coral, sand, sage, blue, lavender, teal. Inter for the interface; IBM Plex Mono for technical values. Typography deliberately defined for every control. No external font network requests after installation.

A 72px navigation rail, 236px sound library, 72px header, 88px transport, and 61px workspace tab strip frame the arrangement. The timeline and pattern editor are the visual center. Track colors convey instrument identity, active steps and selection. Reusable buttons, icon buttons, mute/solo controls, circular range controls, modal dialogs and channel strips share the same tokens. SVG and CSS depict code-native instrument and musical data, not raster UI.

## Component and copy inventory

Header: FORMANT, project name, SESSION 001, LOCAL STUDIO, Undo, Redo, Save project, Export audio.
Rail: Sounds, Mixer, AI, Projects, Help, Settings. Sound library: Find a sound, All, Drums, Synths; Analog kick, Soft clap, Dusty hats, Sub bass, Glass keys, Air pad; Made for the after hours; Space to play.
Transport: Play/Pause, Stop, Loop, BAR/BEAT/STEP, BPM, D minor, 4/4, MASTER.
Workspace: Arrangement, Mixer, bar count, AI connection. Tracks reflect real session content and actual MIDI events.
Pattern editor: instrument, bar tabs, Clear, Humanize, Copy to all bars, Edit note & velocity, 1/16 resolution, STEP, VELOCITY, LEVEL, PAN, TONE, DECAY.
Footer: actual audio runtime, device sample rate after unlock, Stereo, saved/disconnected state.

## Necessary deviations from the generated reference

- Functional bar selectors, note/velocity editor, explicit sound preview buttons and copy-to-all-bars were added to make composition reviewable and usable.
- The decorative instrument/effects rail items were replaced with Mixer and Help navigation, each opening an implemented surface.
- Track clips are separate per bar so selection maps directly to an editable pattern.
- Device sample rate and audio state are reported truthfully; the reference's static Audio ready and 48 kHz labels are not assumed before playback. Export always uses 48 kHz.
- SESSION 001 is a session label, not an invented analytics count. LOCAL STUDIO clarifies persistence scope.
- The bottom-left motif is a static decorative wave, distinct from the measured live output spectrum.

## Responsive model

At ≤1000px the library becomes a dismissible drawer. At ≤760px the transport wraps, the step grid becomes two rows of eight, and sound controls form a 2×2 grid. The arrangement and mixer retain deliberate local horizontal scrolling rather than compressing musical data into unreadable controls. The document itself must not overflow. Dialogs keep focus contained, Escape dismisses, and reduced motion disables transitions.

## Verification contract

Four passes by a separate vision reviewer using actual saved browser screenshots. Each pass records scores and specific defects, fixes and evidence in `docs/reviews/`. Numerical scores are independent judgement, not a claim of exhaustive usability testing. Functional verification separately covers UI edits, playback runtime, non-silent PCM export, MCP initialization/tool discovery/calls, persistence, rejected invalid input and undo/redo.
