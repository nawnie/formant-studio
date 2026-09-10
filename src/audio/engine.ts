import type { Session, Track } from "../types";
import {
  isAudible,
  stepSeconds,
  stepTime,
  keyOffset,
} from "../../shared/session.mjs";

type Context = AudioContext | OfflineAudioContext;
type Bus = { gain: GainNode; pan: StereoPannerNode; filter: BiquadFilterNode };
type Graph = {
  master: GainNode;
  analyser: AnalyserNode;
  limiter: DynamicsCompressorNode;
  tracks: Map<string, Bus>;
};
const db = (value: number) => 10 ** (value / 20);
const frequency = (note: number) => 440 * 2 ** ((note - 69) / 12);
const noises = new WeakMap<Context, AudioBuffer>();

function noise(context: Context) {
  let cached = noises.get(context);
  if (!cached) {
    cached = context.createBuffer(
      1,
      context.sampleRate * 2,
      context.sampleRate,
    );
    const samples = cached.getChannelData(0);
    let seed = 4711;
    for (let i = 0; i < samples.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      samples[i] = (seed / 4294967296) * 2 - 1;
    }
    noises.set(context, cached);
  }
  return cached;
}
function updateGraph(
  context: Context,
  graph: Graph,
  session: Session,
  immediate = false,
) {
  const set = (param: AudioParam, value: number) =>
    immediate
      ? param.setValueAtTime(value, context.currentTime)
      : param.setTargetAtTime(value, context.currentTime, 0.018);
  set(graph.master.gain, db(session.master));
  for (const track of session.tracks) {
    const bus = graph.tracks.get(track.id)!;
    set(bus.gain.gain, isAudible(track, session.tracks) ? db(track.level) : 0);
    set(bus.pan.pan, track.pan);
    set(
      bus.filter.frequency,
      Math.min(
        context.sampleRate * 0.45,
        180 + (track.tone / 100) ** 1.4 * 18000,
      ),
    );
  }
}
function createGraph(context: Context, session: Session): Graph {
  const master = context.createGain(),
    analyser = context.createAnalyser(),
    limiter = context.createDynamicsCompressor();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  limiter.threshold.value = -3;
  limiter.knee.value = 3;
  limiter.ratio.value = 16;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;
  master.connect(limiter);
  limiter.connect(analyser);
  analyser.connect(context.destination);
  const tracks = new Map<string, Bus>();
  for (const track of session.tracks) {
    const gain = context.createGain(),
      pan = context.createStereoPanner(),
      filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.5;
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(master);
    tracks.set(track.id, { gain, pan, filter });
  }
  const graph = { master, analyser, limiter, tracks };
  updateGraph(context, graph, session, true);
  return graph;
}
function disconnectGraph(graph: Graph) {
  graph.master.disconnect();
  graph.limiter.disconnect();
  graph.analyser.disconnect();
  for (const bus of graph.tracks.values()) {
    bus.filter.disconnect();
    bus.gain.disconnect();
    bus.pan.disconnect();
  }
}

function voice(
  context: Context,
  input: AudioNode,
  track: Track,
  time: number,
  velocity: number,
  note: number,
  duration: number,
  chordThird = 3,
) {
  const amp = context.createGain();
  amp.connect(input);
  const decay = track.decay / 1000;
  let length = decay,
    peak = velocity;
  const sources: AudioScheduledSourceNode[] = [];
  const extra: AudioNode[] = [];
  const oscillator = (
    type: OscillatorType,
    freq: number,
    detune = 0,
    destination: AudioNode = amp,
  ) => {
    const source = context.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(freq, time);
    source.detune.value = detune;
    source.connect(destination);
    sources.push(source);
    return source;
  };
  const hiss = (filterType: BiquadFilterType, cutoff: number) => {
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter();
    source.buffer = noise(context);
    filter.type = filterType;
    filter.frequency.value = cutoff;
    source.connect(filter);
    filter.connect(amp);
    sources.push(source);
    extra.push(filter);
  };
  if (track.kind === "kick") {
    const source = oscillator("sine", 145);
    source.frequency.exponentialRampToValueAtTime(
      43,
      time + Math.min(0.15, decay),
    );
    peak *= 1.5;
    length = Math.max(decay, 0.12);
  } else if (track.kind === "clap") {
    hiss("bandpass", 1300 + track.tone * 15);
    peak *= 2.1;
    length = Math.max(decay, 0.05);
  } else if (track.kind === "hat") {
    hiss("highpass", 6500);
    peak *= 1.8;
    length = decay;
  } else if (track.kind === "bass") {
    oscillator("triangle", frequency(note));
    oscillator("sine", frequency(note) / 2);
    peak *= 0.45;
    length = Math.min(decay + 0.12, duration * 3);
  } else if (track.kind === "keys") {
    oscillator("sine", frequency(note));
    const overtone = context.createGain();
    overtone.gain.value = 0.18;
    overtone.connect(amp);
    extra.push(overtone);
    oscillator("sine", frequency(note) * 2.005, 0, overtone);
    peak *= 0.65;
    length = decay;
  } else {
    for (const interval of [0, chordThird, 7])
      oscillator(
        "triangle",
        frequency(note + interval),
        interval === 3 ? -5 : 5,
      );
    peak *= 0.18;
    length = duration * 14 + decay * 0.5;
  }
  const attack =
    track.kind === "pad" ? 0.18 : track.kind === "bass" ? 0.012 : 0.003;
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + attack);
  if (track.kind === "clap") {
    amp.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, peak * 0.4),
      time + 0.011,
    );
    amp.gain.setValueAtTime(peak * 0.8, time + 0.018);
    amp.gain.setValueAtTime(peak * 0.55, time + 0.031);
  }
  amp.gain.exponentialRampToValueAtTime(
    0.0001,
    time + Math.max(attack + 0.01, length),
  );
  for (const source of sources) {
    source.start(time);
    source.stop(time + length + 0.03);
  }
  let ended = 0;
  for (const source of sources)
    source.onended = () => {
      source.disconnect();
      if (++ended === sources.length) {
        amp.disconnect();
        for (const node of extra) node.disconnect();
      }
    };
}
function schedule(
  context: Context,
  graph: Graph,
  session: Session,
  index: number,
  time: number,
) {
  for (const track of session.tracks)
    if (track.steps[index] > 0 && isAudible(track, session.tracks))
      voice(
        context,
        graph.tracks.get(track.id)!.filter,
        track,
        time,
        track.steps[index],
        track.notes[index] + keyOffset(session.key),
        stepSeconds(session.tempo),
        [0, 5, 10].includes(track.notes[index] % 12) ? 4 : 3,
      );
}

export class AudioEngine {
  context: AudioContext | null = null;
  graph: Graph | null = null;
  session: Session;
  playing = false;
  step = 0;
  peak = 0;
  onState: (() => void) | null = null;
  onFrame: ((step: number, bins: Uint8Array, peak: number) => void) | null =
    null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private nextStep = 0;
  private nextTime = 0;
  private pending: { index: number; time: number }[] = [];
  private endTime: number | null = null;
  constructor(session: Session) {
    this.session = session;
  }
  async unlock() {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.graph = createGraph(this.context, this.session);
      this.context.onstatechange = () => {
        if (this.context?.state === "suspended" && this.playing) this.pause();
        this.onState?.();
      };
    }
    await this.context.resume();
    this.onState?.();
  }
  update(session: Session) {
    this.session = session;
    if (this.context && this.graph)
      updateGraph(this.context, this.graph, session);
    this.nextStep %= session.bars * 16;
  }
  async preview(track: Track) {
    await this.unlock();
    const context = this.context!,
      gain = context.createGain(),
      filter = context.createBiquadFilter();
    gain.gain.value = db(track.level);
    filter.type = "lowpass";
    filter.frequency.value = 180 + (track.tone / 100) ** 1.4 * 18000;
    filter.connect(gain);
    gain.connect(this.graph!.master);
    voice(
      context,
      filter,
      track,
      context.currentTime + 0.005,
      0.75,
      track.notes[0] + keyOffset(this.session.key),
      stepSeconds(this.session.tempo),
    );
    setTimeout(() => {
      gain.disconnect();
      filter.disconnect();
    }, 7000);
  }
  play() {
    if (!this.context || this.context.state !== "running")
      throw new Error("Click Play once to enable audio.");
    if (this.playing) return;
    this.playing = true;
    this.nextStep = this.step;
    this.nextTime = this.context.currentTime + 0.035;
    this.pending = [];
    this.endTime = null;
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
    this.animate();
    this.onState?.();
  }
  private tick() {
    const context = this.context!;
    if (this.endTime !== null) {
      if (context.currentTime >= this.endTime) this.stop();
      return;
    }
    // Bound recovery after a background-tab stall; never emit a burst of overdue notes.
    if (this.nextTime < context.currentTime - 0.15)
      this.nextTime = context.currentTime + 0.03;
    while (this.nextTime < context.currentTime + 0.1) {
      const index = this.nextStep,
        interval = stepSeconds(this.session.tempo);
      schedule(context, this.graph!, this.session, index, this.nextTime);
      this.pending.push({ index, time: this.nextTime });
      this.nextTime +=
        interval *
        (index % 2
          ? 1 - this.session.swing / 100
          : 1 + this.session.swing / 100);
      this.nextStep++;
      if (this.nextStep >= this.session.bars * 16) {
        this.nextStep = 0;
        if (!this.session.loop) {
          this.endTime = this.nextTime;
          break;
        }
      }
    }
  }
  private animate = () => {
    if (!this.playing) return;
    while (
      this.pending.length &&
      this.pending[0].time <= this.context!.currentTime
    )
      this.step = this.pending.shift()!.index;
    const bins = new Uint8Array(this.graph!.analyser.frequencyBinCount),
      waveform = new Float32Array(this.graph!.analyser.fftSize);
    this.graph!.analyser.getByteFrequencyData(bins);
    this.graph!.analyser.getFloatTimeDomainData(waveform);
    this.peak = waveform.reduce((max, x) => Math.max(max, Math.abs(x)), 0);
    this.onFrame?.(this.step, bins, this.peak);
    this.frame = requestAnimationFrame(this.animate);
  };
  pause() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    cancelAnimationFrame(this.frame);
    this.pending = [];
    // Replace the bus graph to silence scheduled voices and their release tails.
    if (this.context && this.graph) {
      disconnectGraph(this.graph);
      this.graph = createGraph(this.context, this.session);
    }
    this.onFrame?.(this.step, new Uint8Array(128), 0);
    this.onState?.();
  }
  stop() {
    this.step = 0;
    this.pause();
  }
  seek(index: number) {
    const wasPlaying = this.playing;
    this.pause();
    this.step = Math.min(this.session.bars * 16 - 1, Math.max(0, index));
    if (wasPlaying) this.play();
    else this.onFrame?.(this.step, new Uint8Array(128), 0);
  }
  async dispose() {
    this.pause();
    await this.context?.close();
  }
}

export async function renderWav(session: Session) {
  const sampleRate = 48000,
    loopSeconds = session.bars * 16 * stepSeconds(session.tempo),
    duration = loopSeconds + 2;
  const context = new OfflineAudioContext(
      2,
      Math.ceil(duration * sampleRate),
      sampleRate,
    ),
    graph = createGraph(context, session);
  for (let index = 0; index < session.bars * 16; index++)
    schedule(
      context,
      graph,
      session,
      index,
      stepTime(index, session.tempo, session.swing),
    );
  const rendered = await context.startRendering();
  const data = new ArrayBuffer(44 + rendered.length * 4),
    view = new DataView(data);
  const str = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, data.byteLength - 8, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, rendered.length * 4, true);
  let peak = 0,
    energy = 0;
  const left = rendered.getChannelData(0),
    right = rendered.getChannelData(1);
  for (let i = 0; i < rendered.length; i++)
    for (let ch = 0; ch < 2; ch++) {
      const sample = Math.max(-1, Math.min(1, ch ? right[i] : left[i]));
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
      view.setInt16(
        44 + (i * 2 + ch) * 2,
        Math.round(sample * (sample < 0 ? 32768 : 32767)),
        true,
      );
    }
  const waveform = Array.from({ length: 96 }, (_, i) => {
    let max = 0;
    const start = Math.floor((i * rendered.length) / 96),
      end = Math.floor(((i + 1) * rendered.length) / 96);
    for (let j = start; j < end; j++)
      max = Math.max(max, Math.abs(left[j]), Math.abs(right[j]));
    return max;
  });
  return {
    waveform,
    blob: new Blob([data], { type: "audio/wav" }),
    duration,
    sampleRate,
    peak,
    rms: Math.sqrt(energy / (rendered.length * 2)),
    frames: rendered.length,
  };
}
