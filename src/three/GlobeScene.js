// Terra realista da AcessaNet: texturas NASA (Blue Marble dia / Black Marble
// noite -- domínio público), terminador dia/noite com luzes das cidades,
// reflexo do sol nos oceanos, atmosfera e rotas de luz saindo de Franco da
// Rocha (sede). Three.js puro (sem R3F) pra manter o loop sob controle:
// pausa fora da tela, aba oculta e respeita o "tier" do aparelho.
import {
  AdditiveBlending,
  BackSide,
  Clock,
  Color,
  CubicBezierCurve3,
  DoubleSide,
  Group,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

const R = 1;
const DEG = Math.PI / 180;

const HOME = { lat: -23.32, lon: -46.73 }; // Franco da Rocha
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
const SECONDARY = [
  [0, 2], [3, 6], [1, 8], [11, 12], [4, 5], [13, 9], [7, 8],
];

// Sol fixo no espaço do mundo (vem da esquerda/frente): o lado visível fica
// iluminado e o terminador cai na borda direita, mostrando as luzes das
// cidades conforme a Terra gira.
const SUN = new Vector3(-0.75, 0.32, 0.58).normalize();

// Mesma convenção de UV da SphereGeometry (u=0 em lon -180), então os pontos
// das rotas caem exatamente sobre as cidades da textura.
export function latLonToVec3(lat, lon, r = R) {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function arcCurve(a, b) {
  const angle = a.angleTo(b);
  const alt = 0.1 + 0.38 * (angle / Math.PI);
  const c1 = a.clone().lerp(b, 0.25).normalize().multiplyScalar(R * (1 + alt));
  const c2 = a.clone().lerp(b, 0.75).normalize().multiplyScalar(R * (1 + alt));
  return new CubicBezierCurve3(a, c1, c2, b);
}

const worldVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const earthFragment = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uWater;
  uniform vec3 uSun;
  uniform vec3 uAtmo;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    float sunDot = dot(N, uSun);
    float dayMix = smoothstep(-0.18, 0.22, sunDot);

    vec3 day = texture2D(uDay, vUv).rgb;
    vec3 night = texture2D(uNight, vUv).rgb;
    float water = texture2D(uWater, vUv).r;

    // Dia: difuso com piso (nunca fica chapado preto)
    vec3 dayCol = day * (0.16 + 1.08 * max(sunDot, 0.0));
    // Noite: luzes das cidades em tom âmbar
    vec3 nightCol = night * vec3(1.0, 0.82, 0.55) * 1.8 + vec3(0.004, 0.008, 0.02);
    vec3 col = mix(nightCol, dayCol, dayMix);

    // Reflexo do sol só nos oceanos
    vec3 H = normalize(uSun + V);
    float spec = pow(max(dot(N, H), 0.0), 900.0) * water * dayMix;
    col += vec3(0.8, 0.9, 1.0) * spec * 0.35;

    // Brilho atmosférico na borda (fresnel), mais forte no lado iluminado
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    col = mix(col, uAtmo, fres * (0.2 + 0.6 * dayMix));

    // Terminador levemente alaranjado (pôr do sol)
    float dusk = smoothstep(-0.05, 0.12, sunDot) * (1.0 - smoothstep(0.12, 0.35, sunDot));
    col += vec3(0.35, 0.14, 0.04) * dusk * 0.07;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const atmoFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSun;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    // c = 0 na borda externa do halo, ~0.47 rente ao limbo da Terra
    float c = clamp(-dot(N, V), 0.0, 1.0);
    float rim = pow(smoothstep(0.0, 0.47, c), 1.6);
    float lit = 0.25 + 0.75 * smoothstep(-0.35, 0.6, dot(N, uSun));
    float a = rim * lit;
    gl_FragColor = vec4(uColor * a * 1.4, a);
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
    trail = pow(clamp(trail, 0.0, 1.0), 2.2);
    float head = 1.0 - smoothstep(0.0, 0.02, abs(behind));
    vec3 col = mix(uColor, uHot, trail * trail + head);
    float a = max(uBase, trail * 0.95 + head);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

function loadTexture(loader, url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

export class GlobeScene {
  // Use GlobeScene.create(): carrega as texturas antes de montar a cena,
  // assim o crossfade do fallback só acontece com a Terra pronta.
  static async create(canvas, opts = {}) {
    const res = opts.tier === "lite" ? "1k" : "2k";
    const loader = new TextureLoader();
    const [day, night, water] = await Promise.all([
      loadTexture(loader, `/earth/day-${res}.webp`),
      loadTexture(loader, `/earth/night-${res}.webp`),
      loadTexture(loader, "/earth/water-1k.webp"),
    ]);
    return new GlobeScene(canvas, { ...opts, textures: { day, night, water } });
  }

  constructor(canvas, { tier = "full", onReady, textures }) {
    this.canvas = canvas;
    this.tier = tier;
    this.running = false;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.clock = new Clock();

    const lite = tier === "lite";
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 1.75);

    this.renderer = new WebGLRenderer({ canvas, antialias: !lite, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setClearColor(0x000000, 0);
    this.failed = false;
    this.renderer.debug.onShaderError = () => {
      this.failed = true;
    };

    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    textures.day.colorSpace = SRGBColorSpace;
    textures.night.colorSpace = SRGBColorSpace;
    textures.water.colorSpace = NoColorSpace;
    for (const t of Object.values(textures)) {
      t.anisotropy = aniso;
      t.minFilter = LinearMipmapLinearFilter;
    }

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 0.2, 4.6);

    this.root = new Group();
    this.globe = new Group();
    this.root.add(this.globe);
    this.scene.add(this.root);

    const seg = lite ? 64 : 128;
    this.globe.add(
      new Mesh(
        new SphereGeometry(R, seg, seg),
        new ShaderMaterial({
          vertexShader: worldVertex,
          fragmentShader: earthFragment,
          uniforms: {
            uDay: { value: textures.day },
            uNight: { value: textures.night },
            uWater: { value: textures.water },
            uSun: { value: SUN },
            uAtmo: { value: new Color("#5aa8ff") },
          },
        })
      )
    );

    // Halo de atmosfera (face de trás, aditivo) -- não gira com a Terra
    this.root.add(
      new Mesh(
        new SphereGeometry(R * 1.13, 64, 64),
        new ShaderMaterial({
          vertexShader: worldVertex,
          fragmentShader: atmoFragment,
          side: BackSide,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          uniforms: { uColor: { value: new Color("#3b8cff") }, uSun: { value: SUN } },
        })
      )
    );

    // Rotas de luz (fibra) sobre a Terra
    this.arcs = [];
    const home = latLonToVec3(HOME.lat, HOME.lon, R * 1.002);
    const dests = DESTINATIONS.map((d) => latLonToVec3(d.lat, d.lon, R * 1.002));
    const routes = dests.map((d) => [home, d]);
    if (!lite) SECONDARY.forEach(([a, b]) => routes.push([dests[a], dests[b]]));
    routes.forEach(([a, b], i) => {
      const primary = i < dests.length;
      const mat = new ShaderMaterial({
        vertexShader: arcVertex,
        fragmentShader: arcFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uHead: { value: 0 },
          uTrail: { value: 0.4 },
          uColor: { value: new Color(primary ? "#4f9bff" : "#2f6bff") },
          uHot: { value: new Color("#d8f6ff") },
          uBase: { value: primary ? 0.1 : 0.04 },
        },
      });
      const geo = new TubeGeometry(arcCurve(a, b), lite ? 48 : 96, primary ? 0.0042 : 0.0028, lite ? 3 : 5, false);
      this.globe.add(new Mesh(geo, mat));
      this.arcs.push({ mat, speed: 0.15 + Math.random() * 0.1, offset: Math.random() * 1.6 });
    });

    // Pulsos: sede (maior) e chegadas
    this.pulses = [];
    const ringGeo = new RingGeometry(0.6, 1, 40);
    const addPulse = (v, scale, color, delay) => {
      const mat = new MeshBasicMaterial({ color, transparent: true, side: DoubleSide, depthWrite: false, blending: AdditiveBlending });
      const m = new Mesh(ringGeo, mat);
      m.position.copy(v.clone().multiplyScalar(1.003));
      m.lookAt(v.clone().multiplyScalar(2));
      this.globe.add(m);
      this.pulses.push({ m, mat, scale, delay });
    };
    addPulse(home, 0.055, "#8ae8ff", 0);
    addPulse(home, 0.055, "#8ae8ff", 0.5);
    dests.forEach((d, i) => addPulse(d, 0.018, "#8ae8ff", (i * 0.37) % 1));
    const homeDot = new Mesh(new SphereGeometry(0.011, 16, 16), new MeshBasicMaterial({ color: "#ffffff" }));
    homeDot.position.copy(home);
    this.globe.add(homeDot);

    // Eixo levemente inclinado + Brasil de frente no início
    this.root.rotation.z = 23.4 * DEG * 0.6;
    this.root.rotation.x = -0.22;
    this.globe.rotation.y = -((HOME.lon + 180) * DEG) + Math.PI / 2 - 0.5;

    this.onResize = this.onResize.bind(this);
    this.tick = this.tick.bind(this);
    this.onPointer = this.onPointer.bind(this);
    this.ro = new ResizeObserver(this.onResize);
    this.ro.observe(canvas.parentElement);
    this.onResize();
    if (tier === "full") window.addEventListener("pointermove", this.onPointer, { passive: true });

    this.intro = 0;
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
    if (this.failed || this.renderer.getContext().isContextLost()) {
      this.dispose();
      throw new Error("globe-shader");
    }
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
    this.camera.position.z = w / h < 0.9 ? 5.6 : 4.6;
    this.camera.updateProjectionMatrix();
    if (!this.running) this.renderer.render(this.scene, this.camera);
  }

  setVisible(v) {
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
    const e = 1 - Math.pow(1 - this.intro, 4);

    // Rotação oeste -> leste (sentido real da Terra)
    this.globe.rotation.y += dt * 0.06;
    this.root.scale.setScalar(0.9 + 0.1 * e);

    const p = this.pointer;
    p.x += (p.tx - p.x) * 0.04;
    p.y += (p.ty - p.y) * 0.04;
    this.camera.position.x = Math.sin(t * 0.1) * 0.18 + p.x * 0.16;
    this.camera.position.y = 0.2 + Math.cos(t * 0.08) * 0.1 - p.y * 0.1 + (1 - e) * 0.5;
    this.camera.lookAt(0, 0, 0);

    for (const a of this.arcs) {
      const cycle = ((t * a.speed + a.offset) % 1.8) / 1.8;
      a.mat.uniforms.uHead.value = cycle * 1.8 - 0.2;
    }
    for (const q of this.pulses) {
      const k = (t * 0.55 + q.delay) % 1;
      q.m.scale.setScalar(q.scale * (0.4 + k * 1.6));
      q.mat.opacity = (1 - k) * (q.scale > 0.04 ? 0.85 : 0.6);
    }

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  }

  dispose() {
    this.stop();
    this.ro?.disconnect();
    window.removeEventListener("pointermove", this.onPointer);
    this.scene?.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        for (const u of Object.values(o.material.uniforms || {})) u.value?.dispose?.();
        o.material.dispose?.();
      }
    });
    this.renderer.dispose();
  }
}
