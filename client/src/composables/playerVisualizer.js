export function createPlayerVisualizer({ audio }) {
  let visualizerNode = null;
  let visualizerDisabled = null;

  function getAudioContextCtor() {
    if (typeof window === 'undefined') return null;
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function isVisualizerDisabled() {
    if (visualizerDisabled !== null) return visualizerDisabled;
    if (!getAudioContextCtor()) {
      visualizerDisabled = true;
      return visualizerDisabled;
    }

    visualizerDisabled = /iP(ad|hone|od)/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    return visualizerDisabled;
  }

  function getVisualizerNode() {
    if (visualizerNode) return visualizerNode;
    if (isVisualizerDisabled()) return null;

    const AudioContextCtor = getAudioContextCtor();
    if (!AudioContextCtor) return null;

    const ctx = new AudioContextCtor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;

    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);

    visualizerNode = { ctx, analyser, source };
    return visualizerNode;
  }

  function getVisualizerAnalyser() {
    return getVisualizerNode()?.analyser ?? null;
  }

  function getVisualizerGraph() {
    return getVisualizerNode();
  }

  function resumeVisualizerContext() {
    const ctx = getVisualizerNode()?.ctx;
    if (!ctx || ctx.state !== 'suspended') return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    ctx.resume().catch(() => {});
  }

  function maybeResumeVisualizerContext() {
    resumeVisualizerContext();
  }

  return {
    getVisualizerAnalyser,
    getVisualizerGraph,
    resumeVisualizerContext,
    maybeResumeVisualizerContext,
  };
}
