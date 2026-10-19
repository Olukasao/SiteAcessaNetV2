// Player de quadros WebP em <canvas> — fallback da intro quando não há WebCodecs nem autoplay.
// O relógio manda: pula quadros em vez de desacelerar.
// Arquivo .frames: "HFSEQ1" + uint32 LE (tamanho do JSON) + JSON {fps,width,height,frames:[[offset,length]]} + bytes.

const LOOKAHEAD = 8;
const PREROLL = 6;

export async function loadFrameSequence(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder();
  if (text.decode(new Uint8Array(buf, 0, 6)) !== "HFSEQ1") throw new Error("formato inválido");
  const jsonLength = new DataView(buf).getUint32(6, true);
  const meta = JSON.parse(text.decode(new Uint8Array(buf, 10, jsonLength)));
  const base = 10 + jsonLength;
  return {
    fps: meta.fps,
    width: meta.width,
    height: meta.height,
    frames: meta.frames.map(
      ([offset, length]) => new Blob([new Uint8Array(buf, base + offset, length)], { type: "image/webp" }),
    ),
  };
}

async function decodeFrame(blob) {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const img = new Image();
  const url = URL.createObjectURL(blob);
  img.src = url;
  try {
    await img.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
  return img;
}

function releaseFrame(frame) {
  if ("close" in frame) frame.close();
}

export function playFrameSequence(canvas, seq, onEnd) {
  const ctx = canvas.getContext("2d");
  canvas.width = seq.width;
  canvas.height = seq.height;
  const total = seq.frames.length;
  const durationMs = (total / seq.fps) * 1000;
  const requested = new Set();
  const ready = new Map();
  let stopped = false;
  let raf = 0;
  let shown = -1;
  let t0;

  const want = (i) => {
    const blob = seq.frames[i];
    if (!blob || requested.has(i)) return undefined;
    requested.add(i);
    return decodeFrame(blob).then((frame) => {
      if (stopped || i <= shown) releaseFrame(frame);
      else ready.set(i, frame);
    });
  };

  const show = (i) => {
    const frame = ready.get(i);
    if (!frame || !ctx) return;
    ctx.drawImage(frame, 0, 0, seq.width, seq.height);
    for (const [k, f] of ready) {
      if (k <= i) {
        if (k !== i) releaseFrame(f);
        ready.delete(k);
      }
    }
    releaseFrame(frame);
    shown = i;
  };

  const loop = (now) => {
    if (stopped) return;
    t0 ??= now;
    const elapsed = now - t0;
    const target = Math.min(total - 1, Math.floor((elapsed / 1000) * seq.fps));
    for (let i = target; i > shown; i--) {
      if (ready.has(i)) {
        show(i);
        break;
      }
    }
    for (let i = target + 1; i <= target + LOOKAHEAD; i++) want(i);
    if (elapsed >= durationMs) {
      onEnd();
      return;
    }
    raf = requestAnimationFrame(loop);
  };

  const started = (async () => {
    const preroll = [];
    for (let i = 0; i < Math.min(PREROLL, total); i++) {
      const p = want(i);
      if (p) preroll.push(p);
    }
    for (let i = PREROLL; i < LOOKAHEAD; i++) want(i);
    await Promise.all(preroll);
    if (stopped) return;
    show(0);
    raf = requestAnimationFrame(loop);
  })();

  return {
    started,
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      for (const f of ready.values()) releaseFrame(f);
      ready.clear();
    },
  };
}
