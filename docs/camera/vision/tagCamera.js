// Copied from Soniphorm Centipede (Ed Devane). See ../README.md.
// A camera feeding the tag reader. Used by the Paper Tags module on the laptop
// and by the phone page, so both read tags the same way.
//
// Frames are grabbed only when a worker is free, so a slow scan skips frames
// instead of falling behind (same idea as the tracker's LatestFrame). Two
// workers read alternate frames: a read takes longer than a camera frame at
// Normal/Fine, so one worker alone only sees every other frame. A result older
// than one already delivered is dropped.
const WORKERS = 2;

// Capture and read size. Reading time grows with pixels: about 30 ms at 960,
// 45 ms at 1280, 100 ms at 1920 on this laptop. Bigger reads smaller tags:
// a tag needs about 34 px across to read reliably.
export const DETAIL_SIZES = {
  fast: { width: 960, height: 540 },
  normal: { width: 1280, height: 720 },
  fine: { width: 1920, height: 1080 },
};

export function createTagCamera({ onTags, onStatus } = {}) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const workers = Array.from({ length: WORKERS }, () => ({
    worker: new Worker(new URL('./tagReader.worker.js', import.meta.url), { type: 'module' }),
    busy: false,
  }));

  let stream = null;
  let running = false;
  let frameId = 0;
  let deliveredId = 0;
  let lastGrabbedFrame = -1;
  let readMs = 0;
  let fps = 0;
  let lastResultAt = 0;
  let startToken = 0;
  let status = 'off';
  let error = null;
  let colours = null; // { palette, tolerance } for colour strips, or null
  let wantBrackets = false; // loop brackets ("[" and "]") wanted
  let whiteBalanceLocked = false;
  let whiteBalanceTimer = null;

  function setStatus(next, message = null) {
    status = next;
    error = message;
    onStatus?.(status, error);
  }

  for (const slot of workers) {
    slot.worker.onmessage = (event) => {
      slot.busy = false;
      const { id, tags, strips, brackets, width, height, ms } = event.data;
      readMs = readMs * 0.9 + ms * 0.1;
      if (id > deliveredId) {
        deliveredId = id;
        const now = performance.now();
        if (lastResultAt) fps = fps * 0.9 + (1000 / Math.max(1, now - lastResultAt)) * 0.1;
        lastResultAt = now;
        if (running) onTags?.(tags, width, height, now, strips ?? null, brackets ?? null);
      }
      schedule();
    };
  }

  let scheduled = false;

  // mediaTime: the camera frame's own time, so the same frame isn't read twice.
  function grab(mediaTime = null) {
    scheduled = false;
    if (!running) return;
    const slot = workers.find((w) => !w.busy);
    if (!slot) return; // a finishing worker schedules the next grab
    if (mediaTime != null && mediaTime === lastGrabbedFrame) {
      schedule();
      return;
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height || video.readyState < 2) {
      schedule();
      return;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.drawImage(video, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    if (mediaTime != null) lastGrabbedFrame = mediaTime;
    slot.busy = true;
    frameId += 1;
    slot.worker.postMessage({ id: frameId, width, height, buffer: image.data.buffer, colours, brackets: wantBrackets }, [image.data.buffer]);
    // The other worker may be free: line it up for the next frame.
    schedule();
  }

  // Wait for a new camera frame where the browser can say when one arrives.
  function schedule() {
    if (!running || scheduled || !workers.some((w) => !w.busy)) return;
    scheduled = true;
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback((_, meta) => grab(meta?.mediaTime ?? null));
    else setTimeout(() => grab(), 15);
  }

  async function start({ deviceId = '', facingMode = null, detail = 'normal' } = {}) {
    stop();
    const token = ++startToken;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error', 'No camera access here (needs https or localhost)');
      return;
    }
    const size = DETAIL_SIZES[detail] ?? DETAIL_SIZES.normal;
    const video_ = { width: { ideal: size.width }, height: { ideal: size.height }, frameRate: { ideal: 60 } };
    if (deviceId) video_.deviceId = { exact: deviceId };
    else if (facingMode) video_.facingMode = { ideal: facingMode };
    setStatus('starting');
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: video_, audio: false });
      if (token !== startToken) {
        next.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = next;
      video.srcObject = stream;
      await video.play().catch(() => {});
      running = true;
      for (const slot of workers) slot.busy = false;
      scheduled = false;
      lastResultAt = 0;
      setStatus('on');
      schedule();
      // Let auto white balance settle on the scene before holding it.
      if (whiteBalanceLocked) whiteBalanceTimer = setTimeout(applyWhiteBalance, 1500);
    } catch (e) {
      if (token !== startToken) return;
      setStatus('error', e?.name === 'NotAllowedError' ? 'Camera permission denied' : e?.message || 'Camera failed to start');
    }
  }

  // Colour strips need steady colours: hold the camera's white balance where
  // it is (cameras that allow it, like the Brio). auto = let it adjust again.
  async function applyWhiteBalance() {
    const track = stream?.getVideoTracks()[0];
    if (!track?.getCapabilities) return;
    const caps = track.getCapabilities();
    if (!caps.whiteBalanceMode?.includes('manual')) return;
    try {
      if (whiteBalanceLocked) {
        const temp = track.getSettings().colorTemperature;
        await track.applyConstraints({ advanced: [{ whiteBalanceMode: 'manual', ...(temp ? { colorTemperature: temp } : {}) }] });
      } else if (caps.whiteBalanceMode.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ whiteBalanceMode: 'continuous' }] });
      }
    } catch (e) {
      // not every camera takes it; colours just drift a little more
    }
  }

  function stop() {
    startToken += 1;
    clearTimeout(whiteBalanceTimer);
    running = false;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    if (status !== 'off') setStatus('off');
  }

  return {
    video,
    start,
    stop,
    stats() {
      return { readMs, fps, status, error, width: video.videoWidth, height: video.videoHeight };
    },
    setColours(next) {
      colours = next?.palette?.length ? next : null;
    },
    setBrackets(on) {
      wantBrackets = !!on;
    },
    setWhiteBalanceLocked(locked) {
      if (locked === whiteBalanceLocked) return;
      whiteBalanceLocked = locked;
      applyWhiteBalance();
    },
    track() {
      return stream?.getVideoTracks()[0] ?? null;
    },
    dispose() {
      stop();
      for (const slot of workers) slot.worker.terminate();
    },
  };
}

export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'videoinput')
    .map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
}
