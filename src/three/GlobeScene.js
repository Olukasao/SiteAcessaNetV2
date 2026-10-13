// Globo de dados da AcessaNet: esfera de pontos + atmosfera + rotas de luz
// partindo de Franco da Rocha (sede) para cidades do mundo. Three.js puro
// (sem R3F) pra manter o chunk pequeno e o loop sob controle total:
// pausa fora da tela, aba oculta e respeita o "tier" do aparelho.
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  CubicBezierCurve3,
  Group,
  Mesh,
  PerspectiveCamera,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
  DoubleSide,
  MeshBasicMaterial,
  LineSegments,
  LineBasicMaterial,
} from "three";

const R = 1;
const DEG = Math.PI / 180;

const HOME = { name: "Franco da Rocha", lat: -23.32, lon: -46.73 };
const DESTINATIONS = [
  { lat: 40.71, lon: -74.0 }, // Nova York
  { lat: 38.72, lon: -9.14 }, // Lisboa
  { lat: 51.5, lon: -0.12 }, // Londres
  { lat: 25.76, lon: -80.19 }, // Miami
  { lat: -34.6, lon: -58.38 }, // Buenos Aires
  { lat: -33.45, lon: -70.67 }, // Santiago
  { lat: 4.71, lon: -74.07 }, // Bogotá
  { lat: -33.92, lon: 18.42 }, // Cidade do Cabo
  { lat: 6.52, lon: 3.38 }, // Lagos
  { lat: 40.4, lon: -3.7 }, // Madri
  { lat: -3.73, lon: -38.52 }, // Fortaleza
  { lat: 34.05, lon: -118.24 }, // Los Angeles
  { lat: 19.43, lon: -99.13 }, // Cidade do México
  { lat: 48.85, lon: 2.35 }, // Paris
];
// rotas secundárias (não passam pela sede) -- dão sensação de rede global
const SECONDARY = [
  [0, 2], [3, 6], [1, 8], [11, 12], [4, 5], [13, 9], [2, 0], [7, 8],
];

export function latLonToVec3(lat, lon, r = R) {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function arcCurve(a, b) {
  const angle = a.angleTo(b);
  const alt = 0.12 + 0.42 * (angle / Math.PI);
  const c1 = a.clone().lerp(b, 0.25).normalize().multiplyScalar(R * (1 + alt));
  const c2 = a.clone().lerp(b, 0.75).normalize().multiplyScalar(R * (1 + alt));
  return new CubicBezierCurve3(a, c1, c2, b);
}

const dotsVertex = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vFacing;
  varying float vTwinkle;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normalize(position));
    vFacing = dot(n, vec3(0.0, 0.0, 1.0));
    vTwinkle = 0.65 + 0.35 * sin(uTime * 1.6 + aSeed * 40.0);
    gl_PointSize = aSize * uPixelRatio * (3.2 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const dotsFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vFacing;
  varying float vTwinkle;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.1, d);
    float front = smoothstep(-0.15, 0.6, vFacing);
    vec3 col = mix(uColorA, uColorB, front);
    gl_FragColor = vec4(col, alpha * mix(0.22, 1.0, front) * vTwinkle);
    #include <colorspace_fragment>
  }
`;

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vNormal;
  void main() {
    float i = pow(max(0.0, 0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0))), uPower);
    gl_FragColor = vec4(uColor, 1.0) * i * uIntensity;
    #include <colorspace_fragment>
  }
`;
const coreFragment = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uLit;
  uniform vec3 uRim;
  varying vec3 vNormal;
  void main() {
    vec3 L = normalize(vec3(-0.55, 0.55, 0.65));
    float diff = smoothstep(-0.2, 1.0, dot(vNormal, L));
    float f = 1.0 - max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
    vec3 col = mix(uDeep, uLit, diff * 0.85);
    col += uRim * pow(f, 3.0) * 0.9;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const arcVertex = /* glsl */ `
  varying float vProg;
  void main() {
    vProg = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const arcFragment = /* glsl */ `
  uniform float uHead;
  uniform float uTrail;
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uBase;
  varying float vProg;
  void main() {
    float behind = uHead - vProg;
    float trail = behind >= 0.0 ? 1.0 - behind / uTrail : 0.0;
    trail = clamp(trail, 0.0, 1.0);
    trail = pow(trail, 2.2);
    float head = 1.0 - smoothstep(0.0, 0.02, abs(behind));
    vec3 col = mix(uColor, uHot, trail * trail + head);
    float a = max(uBase, trail * 0.95 + head);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

export class GlobeScene {
  constructor(canvas, { tier = "full", onReady } = {}) {
    this.canvas = canvas;
    this.tier = tier;
    this.running = false;
    this.visible = true;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.clock = new Clock();

    const lite = tier === "lite";
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 1.75);

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: !lite,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.failed = false;
    this.renderer.debug.onShaderError = () => {
      this.failed = true;
    };
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 0.35, 4.6);

    this.root = new Group();
    this.globe = new Group();
    this.root.add(this.globe);
    this.scene.add(this.root);

    // Núcleo escuro com borda azulada (lê como "planeta" mesmo sem textura)
    const core = new Mesh(
      new SphereGeometry(R * 0.985, lite ? 48 : 72, lite ? 48 : 72),
      new ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: coreFragment,
        uniforms: {
          uDeep: { value: new Color("#071338") },
          uLit: { value: new Color("#1c4fd8") },
          uRim: { value: new Color("#3ad6ff") },
        },
      })
    );
    this.globe.add(core);

    // Pontos (distribuição Fibonacci -- uniforme, sem textura de continente
    // proprietária). Densidade cai no "tier" lite.
    const count = lite ? 2600 : 5200;
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const seed = new Float32Array(count);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * i;
      pos[i * 3] = Math.cos(th) * rad * R;
      pos[i * 3 + 1] = y * R;
      pos[i * 3 + 2] = Math.sin(th) * rad * R;
      size[i] = 2.8 + Math.random() * 2.6;
      seed[i] = Math.random();
    }
    const dotsGeo = new BufferGeometry();
    dotsGeo.setAttribute("position", new BufferAttribute(pos, 3));
    dotsGeo.setAttribute("aSize", new BufferAttribute(size, 1));
    dotsGeo.setAttribute("aSeed", new BufferAttribute(seed, 1));
    this.dotsMat = new ShaderMaterial({
      vertexShader: dotsVertex,
      fragmentShader: dotsFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: this.pixelRatio },
        uColorA: { value: new Color("#3d6fe0") },
        uColorB: { value: new Color("#e6faff") },
      },
    });
    this.globe.add(new Points(dotsGeo, this.dotsMat));

    const grat = [];
    const seg = 96;
    const pushCircle = (fn) => {
      for (let k = 0; k < seg; k++) grat.push(...fn(k / seg), ...fn((k + 1) / seg));
    };
    for (let lat = -60; lat <= 60; lat += 30) {
      pushCircle((t) => latLonToVec3(lat, t * 360 - 180, R * 1.002).toArray());
    }
    for (let lon = -180; lon < 180; lon += 30) {
      pushCircle((t) => latLonToVec3(t * 180 - 90, lon, R * 1.002).toArray());
    }
    const gratGeo = new BufferGeometry();
    gratGeo.setAttribute("position", new BufferAttribute(new Float32Array(grat), 3));
    this.globe.add(
      new LineSegments(
        gratGeo,
        new LineBasicMaterial({ color: "#6f9cff", transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false })
      )
    );

    // Atmosfera (fresnel, face de trás, aditiva) -- a "iluminação cinematográfica"
    const atmosphere = new Mesh(
      new SphereGeometry(R * 1.14, 64, 64),
      new ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        side: BackSide,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uColor: { value: new Color("#2f6bff") },
          uPower: { value: 5.0 },
          uIntensity: { value: 0.95 },
        },
      })
    );
    this.root.add(atmosphere);

    // Rotas de luz
    this.arcs = [];
    const home = latLonToVec3(HOME.lat, HOME.lon, R * 1.003);
    const dests = DESTINATIONS.map((d) => latLonToVec3(d.lat, d.lon, R * 1.003));
    const routes = dests.map((d) => [home, d]);
    if (!lite) SECONDARY.forEach(([a, b]) => routes.push([dests[a], dests[b]]));

    routes.forEach(([a, b], i) => {
      const curve = arcCurve(a, b);
      const geo = new TubeGeometry(curve, lite ? 48 : 96, i < dests.length ? 0.005 : 0.0032, lite ? 3 : 5, false);
      const mat = new ShaderMaterial({
        vertexShader: arcVertex,
        fragmentShader: arcFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uHead: { value: 0 },
          uTrail: { value: 0.42 },
          uColor: { value: new Color(i < dests.length ? "#2f6bff" : "#1d4fd6") },
          uHot: { value: new Color("#bff3ff") },
          uBase: { value: i < dests.length ? 0.12 : 0.05 },
        },
      });
      this.globe.add(new Mesh(geo, mat));
      this.arcs.push({ mat, speed: 0.16 + Math.random() * 0.12, offset: Math.random() * 1.6 });
    });

    // Pulsos nos pontos de chegada + sede em destaque
    this.pulses = [];
    const ringGeo = new RingGeometry(0.6, 1, 40);
    const addPulse = (v, scale, color, delay) => {
      const mat = new MeshBasicMaterial({ color, transparent: true, side: DoubleSide, depthWrite: false, blending: AdditiveBlending });
      const m = new Mesh(ringGeo, mat);
      m.position.copy(v.clone().multiplyScalar(1.004));
      m.lookAt(v.clone().multiplyScalar(2));
      this.globe.add(m);
      this.pulses.push({ m, mat, scale, delay });
    };
    addPulse(home, 0.09, "#8ae8ff", 0);
    addPulse(home, 0.09, "#8ae8ff", 0.5);
    dests.forEach((d, i) => addPulse(d, 0.022, "#8ae8ff", (i * 0.37) % 1));

    const homeDot = new Mesh(new SphereGeometry(0.014, 16, 16), new MeshBasicMaterial({ color: "#ffffff" }));
    homeDot.position.copy(home);
    this.globe.add(homeDot);

    // Orientação inicial: Brasil virado para a câmera
    this.baseRotY = -((HOME.lon + 180) * DEG) + Math.PI / 2 - 0.55;
    this.globe.rotation.y = this.baseRotY;
    this.root.rotation.x = -0.12;
    this.root.rotation.z = -0.08;

    this.onResize = this.onResize.bind(this);
    this.tick = this.tick.bind(this);
    this.onPointer = this.onPointer.bind(this);

    this.ro = new ResizeObserver(this.onResize);
    this.ro.observe(canvas.parentElement);
    this.onResize();
    if (tier === "full") window.addEventListener("pointermove", this.onPointer, { passive: true });

    this.intro = 0; // 0..1 entrada da câmera
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
    if (this.failed || this.renderer.getContext().isContextLost()) throw new Error("globe-shader");
    onReady?.();
  }

  onPointer(e) {
    this.pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }

  onResize() {
    const el = this.canvas.parentElement;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Em telas estreitas afasta a câmera pra não cortar o globo de forma estranha
    this.camera.position.z = w / h < 0.9 ? 5.6 : 4.6;
    this.camera.updateProjectionMatrix();
    if (!this.running) this.renderer.render(this.scene, this.camera);
  }

  setVisible(v) {
    this.visible = v;
    if (v) this.start();
    else this.stop();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  tick() {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    this.intro = Math.min(1, this.intro + dt / 2.4);
    const e = 1 - Math.pow(1 - this.intro, 4); // easeOutQuart

    this.globe.rotation.y += dt * 0.045;
    this.root.scale.setScalar(0.86 + 0.14 * e);

    // Câmera: deriva lenta + paralaxe suave do ponteiro (lerp)
    const p = this.pointer;
    p.x += (p.tx - p.x) * 0.04;
    p.y += (p.ty - p.y) * 0.04;
    this.camera.position.x = Math.sin(t * 0.12) * 0.22 + p.x * 0.18;
    this.camera.position.y = 0.35 + Math.cos(t * 0.09) * 0.12 - p.y * 0.12 + (1 - e) * 0.6;
    this.camera.lookAt(0, 0, 0);

    this.dotsMat.uniforms.uTime.value = t;
    for (const a of this.arcs) {
      const cycle = ((t * a.speed + a.offset) % 1.8) / 1.8; // pausa natural entre disparos
      a.mat.uniforms.uHead.value = cycle * 1.8 - 0.2;
    }
    for (const p2 of this.pulses) {
      const k = (t * 0.55 + p2.delay) % 1;
      p2.m.scale.setScalar(p2.scale * (0.4 + k * 1.6));
      p2.mat.opacity = (1 - k) * (p2.scale > 0.05 ? 0.85 : 0.5);
    }

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  }

  dispose() {
    this.stop();
    this.ro.disconnect();
    window.removeEventListener("pointermove", this.onPointer);
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      o.material?.dispose?.();
    });
    this.renderer.dispose();
  }
}
