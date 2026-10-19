// Player da intro via WebCodecs: decodifica H.264 no navegador e desenha num <canvas>
// (sem <video>, a política de autoplay não se aplica). O relógio manda: pula quadros se atrasar.
// Arquivo .h264seq: "HFH264" + uint32 LE (tamanho do JSON) + JSON + bytes.

const AHEAD = 6;
const PREROLL = 3;

export function supportsWebCodecs() {
  return typeof window.VideoDecoder === "function" && typeof window.EncodedVideoChunk === "function";
}

export async function loadH264Sequence(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder();
  if (text.decode(new Uint8Array(buf, 0, 6)) !== "HFH264") throw new Error("formato inválido");
  const jsonLength = new DataView(buf).getUint32(6, true);
  const meta = JSON.parse(text.decode(new Uint8Array(buf, 10, jsonLength)));
  const base = 10 + jsonLength;
  const [descOffset, descLength] = meta.description;
  const config = {
    codec: meta.codec,
    codedWidth: meta.width,
    codedHeight: meta.height,
    description: new Uint8Array(buf, base + descOffset, descLength),
    optimizeForLatency: true,
  };
  const support = await VideoDecoder.isConfigSupported(config);
  if (!support.supported) throw new Error(`codec ${meta.codec} não suportado`);
  const frameUs = 1e6 / meta.fps;
  return {
    config,
    width: meta.width,
    height: meta.height,
    durationMs: (meta.samples.length * frameUs) / 1000,
    chunks: meta.samples.map(
      ([offset, length, key, timestamp]) =>
        new EncodedVideoChunk({
          type: key ? "key" : "delta",
          timestamp,
          duration: frameUs,
          data: new Uint8Array(buf, base + offset, length),
        }),
    ),
  };
}

export function playH264Sequence(canvas, seq, onEnd) {
  const ctx = canvas.getContext("2d");
  canvas.width = seq.width;
  canvas.height = seq.height;
  const queue = [];
  let next = 0;
  let flushed = false;
  let stopped = false;
  let raf = 0;
  let t0;
  let onFrame;
  let fail;

  const decoder = new VideoDecoder({
    output: (frame) => {
      if (stopped) {
        frame.close();
        return;
      }
      queue.push(frame);
      onFrame?.();
    },
    error: (err) => fail?.(err instanceof Error ? err : new Error(String(err))),
  });
  decoder.configure(seq.config);

  const feed = () => {
    if (decoder.state !== "configured") return;
    while (!stopped && next < seq.chunks.length && queue.length + decoder.decodeQueueSize < AHEAD) {
      decoder.decode(seq.chunks[next++]);
    }
    if (!stopped && next >= seq.chunks.length && !flushed) {
      flushed = true;
      decoder.flush().catch(() => undefined);
    }
  };

  const draw = (frame) => {
    ctx?.drawImage(frame, 0, 0, seq.width, seq.height);
    frame.close();
  };

  const loop = (now) => {
    if (stopped) return;
    t0 ??= now;
    const elapsedUs = (now - t0) * 1000;
    let latest;
    while (queue.length && queue[0].timestamp <= elapsedUs) {
      latest?.close();
      latest = queue.shift();
    }
    if (latest) draw(latest);
    feed();
    if (now - t0 >= seq.durationMs) {
      onEnd();
      return;
    }
    raf = requestAnimationFrame(loop);
  };

  const started = new Promise((resolve, reject) => {
    fail = (err) => {
      stopped = true;
      reject(err);
    };
    onFrame = () => {
      if (queue.length < PREROLL && next < seq.chunks.length) return;
      onFrame = undefined;
      const first = queue.shift();
      if (first) draw(first);
      raf = requestAnimationFrame(loop);
      resolve();
    };
    feed();
  });

  return {
    started,
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      queue.splice(0).forEach((f) => f.close());
      if (decoder.state !== "closed") decoder.close();
    },
  };
}
