const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const monitorToggle = document.querySelector("#monitorToggle");
const sampleRateLabel = document.querySelector("#sampleRate");
const visibleRangeLabel = document.querySelector("#visibleRange");
const fftSizeLabel = document.querySelector("#fftSize");
const warning = document.querySelector("#warning");
const spectrogram = document.querySelector("#spectrogram");
const axis = document.querySelector("#axis");
const specCtx = spectrogram.getContext("2d", { alpha: false });
const axisCtx = axis.getContext("2d");

const targetTopHz = 48000;
const fftSize = 32768;

let stream = null;
let audioContext = null;
let analyser = null;
let source = null;
let gain = null;
let animationId = null;
let frequencyData = null;
let visibleTopHz = 24000;
let lastDraw = 0;

fftSizeLabel.textContent = fftSize.toLocaleString();
paintIdle();

startButton.addEventListener("click", startCapture);
stopButton.addEventListener("click", stopCapture);
monitorToggle.addEventListener("change", () => {
  if (gain) {
    gain.gain.value = monitorToggle.checked ? 1 : 0;
  }
});

window.addEventListener("resize", () => {
  resizeCanvases();
  drawAxis();
});

async function startCapture() {
  stopCapture();

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        channelCount: 2,
        sampleRate: 96000,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    if (!stream.getAudioTracks().length) {
      throw new Error("No audio track was shared. Start again and enable audio in the sharing prompt.");
    }

    stream.getVideoTracks().forEach((track) => track.stop());
    stream.getAudioTracks()[0].addEventListener("ended", stopCapture);

    audioContext = new AudioContext({
      sampleRate: 96000,
      latencyHint: "interactive"
    });

    source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.minDecibels = -118;
    analyser.maxDecibels = -18;
    analyser.smoothingTimeConstant = 0;

    gain = audioContext.createGain();
    gain.gain.value = monitorToggle.checked ? 1 : 0;

    source.connect(analyser);
    source.connect(gain);
    gain.connect(audioContext.destination);

    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    visibleTopHz = Math.min(targetTopHz, audioContext.sampleRate / 2);

    updateStatus();
    resizeCanvases();
    clearSpectrogram();
    drawAxis();
    setButtons(true);
    animationId = requestAnimationFrame(drawFrame);
  } catch (error) {
    stopCapture();
    showWarning(error.message || "Capture could not be started.");
  }
}

function stopCapture() {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  animationId = null;

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
  }

  stream = null;
  audioContext = null;
  analyser = null;
  source = null;
  gain = null;
  frequencyData = null;
  setButtons(false);
}

function drawFrame(now) {
  animationId = requestAnimationFrame(drawFrame);

  if (!analyser || !frequencyData) {
    return;
  }

  if (now - lastDraw < 33) {
    return;
  }

  lastDraw = now;
  analyser.getByteFrequencyData(frequencyData);

  const width = spectrogram.width;
  const height = spectrogram.height;
  const nyquist = audioContext.sampleRate / 2;
  const visibleBins = Math.max(1, Math.floor((visibleTopHz / nyquist) * frequencyData.length));

  specCtx.drawImage(spectrogram, 1, 0, width - 1, height, 0, 0, width - 1, height);

  for (let y = 0; y < height; y += 1) {
    const bin = Math.min(
      visibleBins - 1,
      Math.floor(((height - 1 - y) / (height - 1)) * visibleBins)
    );
    specCtx.fillStyle = colorForLevel(frequencyData[bin]);
    specCtx.fillRect(width - 1, y, 1, 1);
  }
}

function colorForLevel(value) {
  const x = value / 255;
  const r = Math.round(8 + 247 * smoothstep(0.48, 1, x));
  const g = Math.round(12 + 210 * smoothstep(0.16, 0.88, x));
  const b = Math.round(18 + 230 * smoothstep(0.02, 0.55, x) - 120 * smoothstep(0.72, 1, x));
  return `rgb(${r}, ${g}, ${Math.max(0, b)})`;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function resizeCanvases() {
  const ratio = window.devicePixelRatio || 1;
  const rect = spectrogram.parentElement.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));

  if (spectrogram.width === width && spectrogram.height === height) {
    return;
  }

  spectrogram.width = width;
  spectrogram.height = height;
  axis.width = width;
  axis.height = height;
  clearSpectrogram();
}

function clearSpectrogram() {
  specCtx.fillStyle = "#060708";
  specCtx.fillRect(0, 0, spectrogram.width, spectrogram.height);
}

function drawAxis() {
  const width = axis.width;
  const height = axis.height;
  const ratio = window.devicePixelRatio || 1;
  const labelPad = 58 * ratio;
  const rightPad = 10 * ratio;

  axisCtx.clearRect(0, 0, width, height);
  axisCtx.font = `${12 * ratio}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  axisCtx.textBaseline = "middle";
  axisCtx.lineWidth = 1 * ratio;

  const step = visibleTopHz > 24000 ? 12000 : 6000;
  for (let hz = 0; hz <= visibleTopHz; hz += step) {
    const y = height - (hz / visibleTopHz) * height;
    axisCtx.strokeStyle = hz === 0 ? "rgba(255,255,255,0.36)" : "rgba(255,255,255,0.13)";
    axisCtx.beginPath();
    axisCtx.moveTo(labelPad, y);
    axisCtx.lineTo(width - rightPad, y);
    axisCtx.stroke();

    axisCtx.fillStyle = "rgba(239,244,241,0.88)";
    axisCtx.textAlign = "right";
    axisCtx.fillText(`${Math.round(hz / 1000)} kHz`, labelPad - 9 * ratio, y);
  }

  axisCtx.strokeStyle = "rgba(94, 215, 255, 0.72)";
  axisCtx.beginPath();
  axisCtx.moveTo(labelPad, 0);
  axisCtx.lineTo(labelPad, height);
  axisCtx.stroke();
}

function updateStatus() {
  const sampleRate = audioContext.sampleRate;
  const visibleKhz = visibleTopHz / 1000;

  sampleRateLabel.textContent = `${sampleRate.toLocaleString()} Hz`;
  visibleRangeLabel.textContent = `0-${visibleKhz.toFixed(0)} kHz`;

  if (visibleTopHz < targetTopHz) {
    showWarning(
      `The browser provided ${sampleRate.toLocaleString()} Hz audio, so the visible limit is ${visibleKhz.toFixed(0)} kHz. For a true 48 kHz bandwidth, the capture path must provide at least 96 kHz.`
    );
  } else {
    hideWarning();
  }
}

function setButtons(isRunning) {
  startButton.disabled = isRunning;
  stopButton.disabled = !isRunning;
}

function showWarning(message) {
  warning.hidden = false;
  warning.textContent = message;
}

function hideWarning() {
  warning.hidden = true;
  warning.textContent = "";
}

function paintIdle() {
  resizeCanvases();

  const width = spectrogram.width;
  const height = spectrogram.height;
  const gradient = specCtx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0c1517");
  gradient.addColorStop(0.5, "#07090b");
  gradient.addColorStop(1, "#11100b");
  specCtx.fillStyle = gradient;
  specCtx.fillRect(0, 0, width, height);

  visibleTopHz = targetTopHz;
  sampleRateLabel.textContent = "Waiting";
  visibleRangeLabel.textContent = "0-48 kHz";
  drawAxis();
}
