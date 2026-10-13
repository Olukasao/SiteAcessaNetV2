import {
  ArrowDown,
  Ban,
  Bluetooth,
  BrickWall,
  Cable,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Gauge,
  HouseWifi,
  Info,
  Laptop,
  MapPin,
  Power,
  Router,
  ShieldCheck,
  Signal,
  Smartphone,
  Tv,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react";

function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="guide-section-heading">
      {eyebrow && <span>{eyebrow}</span>}
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

function StatusLabel({ type, children }) {
  const Icon = type === "good" ? CheckCircle2 : XCircle;

  return (
    <span className={`status-label ${type}`}>
      <Icon aria-hidden="true" size={18} />
      {children}
    </span>
  );
}

function WaveStack({ strength = "strong" }) {
  const barCount = strength === "weak" ? 2 : 4;

  return (
    <div className={`wave-stack ${strength}`} aria-hidden="true">
      {Array.from({ length: barCount }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

function ObstacleSignalStep({ strength }) {
  return (
    <div className={`obstacle-signal-step ${strength}`} aria-hidden="true">
      <span className="signal-flow-line" />
      <span className="signal-pulse-bars">
        <span />
        <span />
        <span />
        <span />
      </span>
      <ArrowDown size={17} />
    </div>
  );
}

function SvgWifiSignal({ strength, tone, x, y, scale = 1, badge = true }) {
  return (
    <g className={`svg-wifi-signal tone-${tone}`} transform={`translate(${x} ${y}) scale(${scale})`}>
      {badge && <ellipse className="svg-wifi-badge" cx="28" cy="25" rx="23" ry="19" />}
      {strength >= 3 && <path className="svg-wifi-arc" d="M7 14 Q28 -3 49 14" />}
      {strength >= 2 && <path className="svg-wifi-arc" d="M14 22 Q28 10 42 22" />}
      {strength >= 1 && <path className="svg-wifi-arc" d="M21 30 Q28 24 35 30" />}
      <circle className="svg-wifi-dot" cx="28" cy="38" r="4.2" />
    </g>
  );
}

function SvgDeviceIcon({ type }) {
  if (type === "phone") {
    return <Smartphone className="svg-device-icon" x="30" y="15" width="22" height="32" aria-hidden="true" />;
  }

  if (type === "laptop") {
    return <Laptop className="svg-device-icon" x="23" y="18" width="36" height="27" aria-hidden="true" />;
  }

  if (type === "tv") {
    return <Tv className="svg-device-icon" x="22" y="17" width="38" height="28" aria-hidden="true" />;
  }

  return (
    <g className="svg-device-icon svg-router-device-icon" aria-hidden="true">
      <rect x="30" y="15" width="22" height="33" rx="5" />
      <circle cx="41" cy="23" r="2.3" />
      <path d="M36 31 H46" />
      <path d="M36 38 H46" />
    </g>
  );
}

function SvgDeviceCard({ x, y, label, type, strength, tone, signalScale = 1 }) {
  const cardWidth = 82;
  const signalX = x + cardWidth / 2 - 28 * signalScale;
  const signalY = y - 50 * signalScale;

  return (
    <g className={`svg-house-device svg-house-device-${type}`}>
      <SvgWifiSignal strength={strength} tone={tone} x={signalX} y={signalY} scale={signalScale} />
      <g transform={`translate(${x} ${y})`}>
        <rect className="svg-device-card-bg" width="82" height="78" rx="13" />
        <SvgDeviceIcon type={type} />
        <text className="svg-device-label" x="41" y="64" textAnchor="middle">
          {label}
        </text>
      </g>
    </g>
  );
}

function CoverageHouseIllustration() {
  return (
    <svg
      className="coverage-house-svg"
      viewBox="0 0 688 540"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="coverage-house-clip">
          <path d="M82 175 L331 49 Q344 42 357 49 L606 175 V500 Q606 516 590 516 H98 Q82 516 82 500 Z" />
        </clipPath>
        <filter id="coverage-house-device-shadow" x="-35%" y="-35%" width="170%" height="180%">
          <feDropShadow dx="0" dy="11" stdDeviation="11" floodColor="#0b4f93" floodOpacity="0.14" />
        </filter>
        <filter id="coverage-house-soft-glow" x="-12%" y="-12%" width="124%" height="124%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <linearGradient id="coverage-house-roof" x1="72" y1="42" x2="606" y2="176" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0b75dc" />
          <stop offset="0.5" stopColor="#0a64cb" />
          <stop offset="1" stopColor="#1e8cff" />
        </linearGradient>
        <linearGradient id="coverage-house-warm-top" x1="0" y1="58" x2="0" y2="320" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fb7185" stopOpacity="0.24" />
          <stop offset="0.36" stopColor="#fed7aa" stopOpacity="0.2" />
          <stop offset="0.72" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="coverage-house-body-fill" x1="82" y1="84" x2="606" y2="516" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#eaf8ff" stopOpacity="0.74" />
        </linearGradient>
      </defs>

      <rect className="svg-house-card-backdrop" x="6" y="16" width="676" height="508" rx="34" />

      <g className="svg-house-main">
        <path className="svg-house-chimney" d="M508 86 H550 Q556 86 556 92 V172 H508 Z" />

        <g clipPath="url(#coverage-house-clip)">
          <path
            className="svg-house-fill"
            d="M82 175 L331 49 Q344 42 357 49 L606 175 V500 Q606 516 590 516 H98 Q82 516 82 500 Z"
          />

          <g className="svg-coverage-lower" filter="url(#coverage-house-soft-glow)">
            <circle className="coverage-level coverage-level-5" cx="344" cy="424" r="296" />
            <circle className="coverage-level coverage-level-4" cx="344" cy="424" r="236" />
            <circle className="coverage-level coverage-level-3" cx="344" cy="424" r="176" />
            <circle className="coverage-level coverage-level-2" cx="344" cy="424" r="122" />
            <circle className="coverage-level coverage-level-1" cx="344" cy="424" r="72" />
          </g>

          <g className="svg-coverage-upper">
            <path className="coverage-upper coverage-upper-3" d="M82 175 L331 49 Q344 42 357 49 L606 175 V224 C514 188 429 170 344 170 C259 170 174 188 82 224 Z" />
            <path className="coverage-upper coverage-upper-2" d="M82 175 H606 V276 C508 232 424 211 344 211 C264 211 180 232 82 276 Z" />
            <path className="coverage-upper coverage-upper-1" d="M82 175 H606 V334 C509 286 424 263 344 263 C264 263 179 286 82 334 Z" />
            <rect className="coverage-upper-fade" x="82" y="49" width="524" height="286" />
          </g>

          <g className="svg-room-lineart">
            <g className="room-art upper-left">
              <rect x="120" y="238" width="124" height="38" rx="7" />
              <path d="M124 238 V222 H145 V238" />
              <path d="M154 252 H232" />
              <rect x="134" y="205" width="44" height="28" rx="3" />
              <path d="M284 275 V237" />
              <path d="M284 248 C270 237 270 223 284 211" />
              <path d="M284 250 C298 239 300 225 292 214" />
              <rect x="269" y="276" width="31" height="22" rx="3" />
            </g>

            <g className="room-art upper-right">
              <path d="M404 278 V247 H512 V278" />
              <rect x="440" y="226" width="42" height="25" rx="3" />
              <path d="M456 252 V264 H468 V252" />
              <path d="M399 282 C413 273 417 254 410 240" />
              <path d="M394 282 H425" />
              <path d="M552 282 V238" />
              <path d="M552 254 C539 243 540 229 552 218" />
              <path d="M552 254 C566 243 567 229 558 216" />
              <rect x="535" y="283" width="35" height="24" rx="4" />
            </g>

            <g className="room-art lower-left">
              <path d="M127 455 H258 Q267 455 267 464 V482 H116 V466 Q116 455 127 455 Z" />
              <path d="M135 455 V426 H202 Q215 426 215 455" />
              <path d="M106 479 H276" />
              <path d="M120 433 C105 419 108 397 126 389" />
              <path d="M126 389 C140 399 143 418 132 433" />
              <path d="M146 410 V455" />
              <path d="M91 476 V436" />
              <path d="M91 452 C77 440 78 421 91 410" />
              <path d="M91 452 C104 441 106 423 97 411" />
            </g>

            <g className="room-art lower-right">
              <path d="M556 314 V348" />
              <path d="M540 352 Q556 336 572 352" />
              <path d="M506 472 H586 V428 H506 Z" />
              <path d="M506 444 H586" />
              <path d="M533 444 V472" />
              <path d="M558 444 V472" />
              <path d="M422 484 H480 V441 H422 Z" />
              <path d="M432 441 V419 H470 V441" />
              <circle cx="520" cy="419" r="5" />
              <circle cx="543" cy="414" r="4" />
            </g>
          </g>
        </g>

        <g className="svg-room-dividers">
          <line x1="82" y1="305" x2="606" y2="305" />
          <line x1="344" y1="54" x2="344" y2="516" />
          <line x1="492" y1="305" x2="492" y2="516" />
        </g>

        <g className="svg-router-table">
          <path d="M270 452 H418" />
          <path d="M286 452 V500" />
          <path d="M402 452 V500" />
          <path d="M252 502 H436" />
        </g>

        <g className="svg-router">
          <SvgWifiSignal strength={3} tone="router" x={320} y={355} scale={0.86} badge={false} />
          <path className="svg-router-antenna left" d="M314 393 V366" />
          <path className="svg-router-antenna right" d="M374 393 V366" />
          <rect className="svg-router-body" x="300" y="394" width="88" height="48" rx="10" />
          <circle className="svg-router-led" cx="322" cy="419" r="3" />
          <circle className="svg-router-led" cx="337" cy="419" r="3" />
          <circle className="svg-router-led" cx="359" cy="419" r="3" />
          <circle className="svg-router-led active" cx="374" cy="419" r="3" />
        </g>

        <SvgDeviceCard x={198} y={199} label="Celular" type="phone" strength={1} tone="red" />
        <SvgDeviceCard x={430} y={199} label="Notebook" type="laptop" strength={2} tone="orange" />
        <SvgDeviceCard x={154} y={371} label="Smart TV" type="tv" strength={3} tone="blue" signalScale={1.18} />
        <SvgDeviceCard x={498} y={371} label="Wi-Fi" type="wifi" strength={3} tone="blue" signalScale={1.08} />

        <path className="svg-house-body-outline" d="M82 175 V500 Q82 516 98 516 H590 Q606 516 606 500 V175" />
        <path className="svg-house-roof-line" d="M70 178 L331 49 Q344 42 357 49 L618 178" />
        <path className="svg-house-roof-highlight" d="M86 182 L333 60 Q344 54 355 60 L602 182" />
      </g>
    </svg>
  );
}

export function SpeedVsRange() {
  return (
    <section className="guide-section speed-range-section" id="dicas">
      <span className="guide-anchor-point" id="velocidade" aria-hidden="true" />
      <div className="guide-shell">
        <SectionHeading
          eyebrow="Conceito essencial"
          title="VELOCIDADE NÃO É A MESMA COISA QUE ALCANCE"
          subtitle="Essa diferença explica por que um plano mais rápido não faz o sinal chegar automaticamente mais longe."
        />

        <div className="speed-range-grid">
          <article className="guide-card concept-card speed-card">
            <div className="card-icon">
              <Gauge aria-hidden="true" size={30} />
            </div>
            <h3>VELOCIDADE</h3>
            <p>Velocidade é a rapidez com que os dados chegam aos seus dispositivos.</p>
            <div className="speed-data-flow" aria-label="Dados sendo transmitidos rapidamente até um dispositivo">
              <div className="data-flow-row">
                <div className="data-source" aria-hidden="true">
                  <span className="data-source-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                  <strong>Dados</strong>
                </div>
                <div className="data-stream" aria-hidden="true">
                  <span className="data-stream-line" />
                  <span className="data-packet packet-one" />
                  <span className="data-packet packet-two" />
                  <span className="data-packet packet-three" />
                </div>
                <div className="data-device" aria-hidden="true">
                  <Smartphone size={28} />
                </div>
              </div>
              <strong className="speed-example">
                800 <span>Mbps</span>
              </strong>
            </div>
            <span className="speed-support-note">Mais agilidade para navegar, assistir, baixar arquivos e jogar.</span>
          </article>

          <article className="guide-card concept-card range-card">
            <div className="card-icon">
              <HouseWifi aria-hidden="true" size={30} />
            </div>
            <h3>ALCANCE</h3>
            <p>É a distância em que o sinal consegue chegar com boa qualidade.</p>
            <strong className="range-alert">MAIS MEGA NÃO SIGNIFICA WI-FI MAIS LONGE</strong>
            <div className="coverage-compare">
              <div>
                <span>400 Mega</span>
                <CoverageLine />
              </div>
              <div>
                <span>800 Mega</span>
                <CoverageLine />
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function CoverageLine() {
  return (
    <div className="coverage-line" aria-label="Área de cobertura semelhante">
      <Router aria-hidden="true" size={28} />
      <WaveStack strength="medium" />
      <HouseWifi aria-hidden="true" size={30} />
    </div>
  );
}

export function RouterCare() {
  return (
    <section className="guide-section" id="roteador">
      <div className="guide-shell">
        <SectionHeading
          eyebrow="Equipamento"
          title="CUIDE BEM DO SEU ROTEADOR"
          subtitle="Alguns cuidados simples evitam problemas e ajudam seu equipamento a funcionar corretamente."
        />

        <div className="router-care-grid">
          <article className="guide-card reset-card">
            <div className="split-card-header">
              <div>
                <span className="guide-mini-label">Atenção</span>
                <h3>NÃO APERTE O BOTÃO RESET</h3>
              </div>
              <Ban aria-hidden="true" size={34} />
            </div>

            <div className="router-back-visual" aria-label="Roteador visto de frente com botão reset destacado">
              <div className="router-back">
                <span className="router-brand-line" aria-hidden="true" />
                <span className="router-front-controls" aria-hidden="true">
                  <span className="router-port" />
                  <span className="router-port" />
                  <span className="router-port" />
                  <span className="reset-control">
                    <span className="reset-callout">RESET</span>
                    <span className="reset-pointer" />
                    <span className="router-reset-dot" />
                    <Ban className="reset-ban" size={56} />
                  </span>
                </span>
              </div>
            </div>

            <p>
              O botão RESET não serve apenas para reiniciar o equipamento. Ao
              pressioná-lo, o roteador pode voltar às configurações de fábrica e
              perder informações necessárias para sua conexão.
            </p>

            <div className="guide-alert bad">
              <CircleAlert aria-hidden="true" size={22} />
              <strong>Nunca utilize o botão RESET apenas para reiniciar o roteador.</strong>
            </div>

            <div className="reset-vs-grid">
              <div>
                <StatusLabel type="bad">RESETAR</StatusLabel>
                <strong>Apaga as configurações.</strong>
              </div>
              <div>
                <StatusLabel type="good">REINICIAR</StatusLabel>
                <strong>Desliga e liga novamente.</strong>
              </div>
            </div>
          </article>

          <article className="guide-card restart-flow-card">
            <div className="split-card-header">
              <div>
                <span className="guide-mini-label">Como fazer</span>
                <h3>COMO REINICIAR CORRETAMENTE</h3>
              </div>
              <Power aria-hidden="true" size={34} />
            </div>

            <ol className="restart-flow">
              <li>
                <span>1</span>
                <p>Desligue o roteador da energia.</p>
              </li>
              <li>
                <span>2</span>
                <p>Aguarde aproximadamente 10 segundos.</p>
              </li>
              <li>
                <span>3</span>
                <p>Ligue novamente.</p>
              </li>
              <li>
                <span>4</span>
                <p>Aguarde o equipamento inicializar.</p>
              </li>
            </ol>
          </article>
        </div>

        <div className="placement-grid">
          <article className="guide-card visual-comparison-card hide-router-card">
            <div className="split-card-header">
              <div>
                <span className="guide-mini-label">Posicionamento</span>
                <h3>NÃO ESCONDA O ROTEADOR</h3>
              </div>
              <Wifi aria-hidden="true" size={34} />
            </div>

            <div className="side-by-side-visual">
              <div className="wrong-place">
                <StatusLabel type="bad">ERRADO</StatusLabel>
                <div className="cabinet-visual" aria-label="Roteador escondido dentro de móvel fechado com sinal prejudicado">
                  <span className="hide-router-caption bad-hide-caption" aria-hidden="true">
                    Dentro do armário
                  </span>
                  <span className="cabinet-leak-signal cabinet-leak-one" aria-hidden="true" />
                  <span className="cabinet-leak-signal cabinet-leak-two" aria-hidden="true" />
                  <span className="cabinet-frame" aria-hidden="true">
                    <span className="cabinet-top" />
                    <span className="cabinet-back" />
                    <span className="cabinet-side cabinet-side-left" />
                    <span className="cabinet-side cabinet-side-right" />
                    <span className="cabinet-shelf" />
                    <span className="blocked-wifi-field" />
                    <span className="blocked-wifi-wave blocked-wave-one" />
                    <span className="blocked-wifi-wave blocked-wave-two" />
                    <span className="blocked-wifi-wave blocked-wave-three" />
                    <span className="blocked-wifi-wave blocked-wave-four" />
                    <span className="blocked-wifi-wave blocked-wave-five" />
                    <span className="cabinet-door" />
                    <span className="signal-blocker signal-blocker-one" />
                    <span className="signal-blocker signal-blocker-two" />
                    <span className="hidden-router-device">
                      <span className="hidden-router-leds">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="hidden-router-slots">
                        <span />
                        <span />
                        <span />
                      </span>
                    </span>
                    <span className="weak-signal weak-signal-one" />
                    <span className="weak-signal weak-signal-two" />
                  </span>
                </div>
              </div>
              <div className="right-place">
                <StatusLabel type="good">CERTO</StatusLabel>
                <div className="open-router-visual" aria-label="Roteador em local aberto com sinal se espalhando livremente">
                  <span className="hide-router-caption good-hide-caption" aria-hidden="true">
                    Em local aberto
                  </span>
                  <span className="open-router-surface" aria-hidden="true" />
                  <span className="open-signal open-signal-one" aria-hidden="true" />
                  <span className="open-signal open-signal-two" aria-hidden="true" />
                  <span className="open-signal open-signal-three" aria-hidden="true" />
                  <span className="open-signal open-signal-four" aria-hidden="true" />
                  <span className="coverage-bars" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="hidden-router-device open-router-device" aria-hidden="true">
                    <span className="hidden-router-leds">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="hidden-router-slots">
                      <span />
                      <span />
                      <span />
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <p>
              O sinal Wi-Fi precisa de espaço para se espalhar. Colocar o
              roteador dentro de armários, gavetas ou móveis fechados pode
              reduzir significativamente a cobertura.
            </p>
          </article>

          <article className="guide-card visual-comparison-card home-strategy-card">
            <div className="split-card-header">
              <div>
                <span className="guide-mini-label">Casa</span>
                <h3>ESCOLHA UM LOCAL ESTRATÉGICO</h3>
              </div>
              <MapPin aria-hidden="true" size={34} />
            </div>

            <div className="home-placement-visual" aria-label="Comparação de roteador na ponta da casa e roteador centralizado">
              <div className="home-floor bad-position" aria-label="Planta da casa com roteador em cômodo lateral e cobertura limitada">
                <StatusLabel type="bad">POSIÇÃO RUIM</StatusLabel>
                <span className="floor-plan floor-plan-bad" aria-hidden="true">
                  <span className="wifi-propagation wifi-propagation-bad">
                    <span className="wifi-signal-glow bad-signal-glow" />
                    <span className="wifi-dead-zone bad-dead-zone" />
                    <span className="wifi-wall-attenuation wall-attenuation-one" />
                    <span className="wifi-wall-attenuation wall-attenuation-two" />
                    <span className="wifi-wave wifi-wave-bad wifi-wave-bad-one" />
                    <span className="wifi-wave wifi-wave-bad wifi-wave-bad-two" />
                    <span className="wifi-wave wifi-wave-bad wifi-wave-bad-three" />
                    <span className="wifi-wave wifi-wave-bad wifi-wave-bad-four" />
                    <span className="wifi-wave wifi-wave-bad wifi-wave-bad-five" />
                    <span className="wifi-wave wifi-wave-bad wifi-wave-bad-six" />
                    <span className="wifi-wave wifi-wave-bad wifi-wave-bad-seven" />
                  </span>
                  <span className="room room-living">
                    <span className="room-label">Cômodo 1</span>
                    <span className="room-detail sofa-detail" />
                  </span>
                  <span className="room room-bedroom">
                    <span className="room-label">Cômodo 2</span>
                    <span className="room-detail bed-detail" />
                  </span>
                  <span className="room room-kitchen">
                    <span className="room-label">Cômodo 3</span>
                    <span className="room-detail counter-detail" />
                  </span>
                  <span className="room room-hall">
                    <span className="room-label">Cômodo 4</span>
                    <span className="room-detail table-detail" />
                  </span>
                  <span className="door-gap door-gap-one" />
                  <span className="door-gap door-gap-two" />
                  <span className="door-gap door-gap-three" />
                  <span className="door-gap door-gap-four" />
                  <span className="floor-router floor-router-bad">
                    <span />
                  </span>
                </span>
              </div>
              <div className="home-floor good-position" aria-label="Planta da casa com roteador centralizado e cobertura equilibrada">
                <StatusLabel type="good">POSIÇÃO IDEAL</StatusLabel>
                <span className="floor-plan floor-plan-good" aria-hidden="true">
                  <span className="wifi-propagation wifi-propagation-good">
                    <span className="wifi-signal-glow good-signal-glow" />
                    <span className="wifi-balanced-fill" />
                    <span className="wifi-wave wifi-wave-good wifi-wave-good-one" />
                    <span className="wifi-wave wifi-wave-good wifi-wave-good-two" />
                    <span className="wifi-wave wifi-wave-good wifi-wave-good-three" />
                    <span className="wifi-wave wifi-wave-good wifi-wave-good-four" />
                    <span className="wifi-wave wifi-wave-good wifi-wave-good-five" />
                    <span className="wifi-wave wifi-wave-good wifi-wave-good-six" />
                    <span className="wifi-wave wifi-wave-good wifi-wave-good-seven" />
                  </span>
                  <span className="room room-living">
                    <span className="room-label">Cômodo 1</span>
                    <span className="room-detail sofa-detail" />
                  </span>
                  <span className="room room-bedroom">
                    <span className="room-label">Cômodo 2</span>
                    <span className="room-detail bed-detail" />
                  </span>
                  <span className="room room-kitchen">
                    <span className="room-label">Cômodo 3</span>
                    <span className="room-detail counter-detail" />
                  </span>
                  <span className="room room-hall">
                    <span className="room-label">Cômodo 4</span>
                    <span className="room-detail table-detail" />
                  </span>
                  <span className="door-gap door-gap-one" />
                  <span className="door-gap door-gap-two" />
                  <span className="door-gap door-gap-three" />
                  <span className="door-gap door-gap-four" />
                  <span className="floor-router floor-router-good">
                    <span />
                  </span>
                </span>
              </div>
            </div>

            <p>
              Sempre que possível, deixe o roteador em uma região central da
              residência, em um ponto elevado, aberto e livre de obstáculos.
            </p>

            <div className="guide-chip-row">
              <span>Local aberto</span>
              <span>Mais alto</span>
              <span>Mais central</span>
              <span>Livre de obstáculos</span>
            </div>
          </article>

          <article className="guide-card ventilation-card">
            <div className="split-card-header">
              <div>
                <span className="guide-mini-label">Ventilação</span>
                <h3>DEIXE O ROTEADOR RESPIRAR</h3>
              </div>
              <ShieldCheck aria-hidden="true" size={34} />
            </div>

            <div className="router-breathing-grid">
              <div className="breathing-panel breathing-panel-bad">
                <StatusLabel type="bad">ERRADO</StatusLabel>
                <div className="covered-router" aria-label="Roteador com objetos bloqueando a ventilação">
                  <span className="vent-callout vent-callout-bad" aria-hidden="true">
                    Objeto sobre o roteador
                  </span>
                  <span className="vent-callout-arrow vent-callout-arrow-bad" aria-hidden="true" />
                  <span className="blocked-air-pocket" aria-hidden="true" />
                  <span className="trapped-heat" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="router-object router-book router-book-blocking" aria-hidden="true">
                    <span />
                  </span>
                  <span className="vent-router vent-router-blocked" aria-hidden="true">
                    <span className="vent-leds">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="vent-slots">
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                  </span>
                  <span className="vent-scene-caption bad-caption" aria-hidden="true">
                    Objeto bloqueando a saída de ar
                  </span>
                </div>
              </div>
              <div className="breathing-panel breathing-panel-good">
                <StatusLabel type="good">CERTO</StatusLabel>
                <div className="clear-router" aria-label="Roteador livre com circulação de ar">
                  <span className="vent-callout vent-callout-good" aria-hidden="true">
                    Parte superior livre
                  </span>
                  <span className="vent-callout-arrow vent-callout-arrow-good" aria-hidden="true" />
                  <span className="free-zone" aria-hidden="true" />
                  <span className="fresh-air fresh-air-left" aria-hidden="true" />
                  <span className="fresh-air fresh-air-center" aria-hidden="true" />
                  <span className="fresh-air fresh-air-right" aria-hidden="true" />
                  <span className="fresh-air fresh-air-soft" aria-hidden="true" />
                  <span className="vent-router vent-router-free" aria-hidden="true">
                    <span className="vent-leds">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="vent-slots">
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                  </span>
                  <span className="vent-scene-caption good-caption" aria-hidden="true">
                    Ventilação desobstruída
                  </span>
                </div>
              </div>
            </div>

            <p>
              Objetos sobre o equipamento podem bloquear a ventilação, aumentar
              sua temperatura e prejudicar seu funcionamento.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

export function WifiSignal() {
  const interferenceItems = [
    "Micro-ondas",
    "Telefone sem fio",
    "Dispositivos Bluetooth",
    "Babá eletrônica",
    "Outros roteadores",
    "Eletrônicos grandes",
  ];

  return (
    <section className="guide-section wifi-section" id="wifi">
      <div className="guide-shell">
        <SectionHeading
          eyebrow="Cobertura sem mistério"
          title="ENTENDA MELHOR O SINAL DO WI-FI"
          subtitle="Paredes, distância, objetos e frequências influenciam a qualidade percebida em cada cômodo."
        />

        <div className="wifi-grid">
          <article className="guide-card obstacle-card">
            <div className="split-card-header">
              <div>
                <span className="guide-mini-label">Obstáculos</span>
                <h3>PAREDES E OBJETOS ENFRAQUECEM O SINAL</h3>
              </div>
              <BrickWall aria-hidden="true" size={34} />
            </div>

            <div className="obstacle-diagram" aria-label="Sinal saindo do roteador, atravessando parede, espelho e móvel, e chegando mais fraco ao celular">
              <div className="diagram-node router-node">
                <span className="obstacle-device-visual obstacle-router-visual">
                  <Router aria-hidden="true" size={26} />
                  <span className="obstacle-router-leds">
                    <span />
                    <span />
                    <span />
                  </span>
                </span>
                <span>ROTEADOR</span>
              </div>
              <ObstacleSignalStep strength="strong" />
              <div className="signal-gate wall">
                <span className="gate-texture" />
                <strong>PAREDE</strong>
              </div>
              <ObstacleSignalStep strength="medium" />
              <div className="signal-gate mirror">
                <span className="gate-texture" />
                <strong>ESPELHO</strong>
              </div>
              <ObstacleSignalStep strength="low" />
              <div className="signal-gate furniture">
                <span className="gate-texture" />
                <strong>MÓVEL</strong>
              </div>
              <ObstacleSignalStep strength="weak" />
              <div className="diagram-node phone-node">
                <span className="obstacle-device-visual obstacle-phone-visual">
                  <Smartphone aria-hidden="true" size={24} />
                  <span className="phone-weak-signal">
                    <span />
                    <span />
                    <span />
                  </span>
                </span>
                <span>CELULAR</span>
              </div>
            </div>

            <p>
              Quanto mais obstáculos o sinal precisa atravessar, menor tende a
              ser a qualidade do Wi-Fi.
            </p>

            <div className="guide-chip-row">
              <span>Paredes grossas</span>
              <span>Concreto</span>
              <span>Lajes</span>
              <span>Metal</span>
              <span>Espelhos</span>
              <span>Móveis grandes</span>
              <span>Aquários</span>
            </div>
          </article>

          <article className="guide-card distance-card">
            <div className="split-card-header">
              <div>
                <span className="guide-mini-label">Distância</span>
                <h3>QUANTO MAIS LONGE, MAIS FRACO PODE FICAR O WI-FI</h3>
              </div>
              <Signal aria-hidden="true" size={34} />
            </div>

            <div className="distance-comparison">
              <div className="distance-tile near">
                <span>PERTO</span>
                <WaveStack strength="strong" />
                <strong>Sinal forte</strong>
                <small>Maior desempenho</small>
              </div>
              <div className="distance-tile far">
                <span>LONGE</span>
                <WaveStack strength="weak" />
                <strong>Sinal mais fraco</strong>
                <small>Menor desempenho</small>
              </div>
            </div>

            <p>
              Mesmo com um plano de alta velocidade, o desempenho pelo Wi-Fi
              pode diminuir conforme o aparelho se afasta do roteador.
            </p>
          </article>

          <article className="guide-card interference-card">
            <div className="split-card-header">
              <div>
                <span className="guide-mini-label">Radiofrequência</span>
                <h3>EVITE INTERFERÊNCIAS</h3>
              </div>
              <Bluetooth aria-hidden="true" size={34} />
            </div>

            <p>
              O Wi-Fi utiliza ondas de rádio e pode sofrer interferência de
              outros equipamentos eletrônicos próximos.
            </p>

            <div className="interference-list">
              {interferenceItems.map((item) => (
                <span key={item}>
                  <Zap aria-hidden="true" size={16} />
                  {item}
                </span>
              ))}
            </div>
          </article>
        </div>

        <article className="guide-card frequency-card">
          <div className="frequency-heading">
            <span className="guide-mini-label">Frequências</span>
            <h3>2,4 GHz OU 5 GHz?</h3>
            <p>Não existe uma frequência melhor em todas as situações. Cada uma possui uma finalidade.</p>
          </div>

          <div className="frequency-grid">
            <div className="frequency-option frequency-24">
              <div className="frequency-wave large-wave" aria-hidden="true" />
              <h4>2,4 GHz</h4>
              <ul>
                <li>Maior alcance</li>
                <li>Melhor capacidade de atravessar obstáculos</li>
                <li>Boa opção para aparelhos mais distantes</li>
              </ul>
            </div>

            <div className="frequency-option frequency-5">
              <div className="frequency-wave intense-wave" aria-hidden="true" />
              <h4>5 GHz</h4>
              <ul>
                <li>Maior velocidade</li>
                <li>Menor interferência</li>
                <li>Ideal para aparelhos próximos</li>
              </ul>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

export function SharedConnection() {
  return (
    <section className="guide-section shared-section" id="conexao">
      <div className="guide-shell">
        <SectionHeading
          eyebrow="Uso da rede"
          title="SUA INTERNET É COMPARTILHADA"
          subtitle="Streaming, downloads, jogos e câmeras podem utilizar parte da capacidade da sua internet ao mesmo tempo."
        />

        <div className="shared-grid">
          <article className="guide-card device-limits-card">
            <div className="split-card-header">
              <div>
                <span className="guide-mini-label">Aparelhos</span>
                <h3>SEU APARELHO TAMBÉM TEM LIMITES</h3>
              </div>
              <Info aria-hidden="true" size={34} />
            </div>

            <div className="device-limit-comparison">
              <div>
                <span className="device-age old">Aparelho mais antigo</span>
                <Wifi aria-hidden="true" size={34} />
                <strong>Wi-Fi antigo</strong>
                <p>Capacidade menor.</p>
              </div>
              <div>
                <span className="device-age new">Aparelho moderno</span>
                <Wifi aria-hidden="true" size={34} />
                <strong>Wi-Fi mais recente</strong>
                <p>Maior capacidade.</p>
              </div>
            </div>

            <p>
              Nem todo celular, notebook, televisão ou videogame consegue
              atingir a velocidade máxima disponível.
            </p>

            <div className="factor-list">
              <span>Tecnologia Wi-Fi</span>
              <span>Placa de rede</span>
              <span>Idade do aparelho</span>
              <span>Frequência</span>
              <span>Distância</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export function SpeedTestGuide() {
  const steps = [
    "Fique próximo ao roteador.",
    "Utilize 5 GHz quando disponível.",
    "Pause downloads.",
    "Evite outros aparelhos consumindo muita internet.",
    "Faça o teste.",
  ];

  return (
    <section className="guide-section test-section" id="teste">
      <div className="guide-shell">
        <SectionHeading
          eyebrow="Medição"
          title="COMO TESTAR SUA INTERNET CORRETAMENTE"
          subtitle="O jeito de testar influencia o resultado. Reduza variáveis antes de comparar velocidades."
        />

        <div className="speed-test-grid">
          <article className="guide-card test-steps-card">
            <ol className="test-steps">
              {steps.map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </article>

          <article className="guide-card wired-test-card">
            <div className="wired-visual" aria-label="Notebook conectado diretamente ao roteador por cabo Ethernet">
              <Laptop aria-hidden="true" size={54} />
              <span className="ethernet-line" />
              <Router aria-hidden="true" size={50} />
            </div>
            <span className="result-badge precise">
              <CheckCircle2 aria-hidden="true" size={18} />
              TESTE MAIS PRECISO
            </span>
            <h3>QUER UM RESULTADO MAIS CONFIÁVEL?</h3>
            <p>
              Faça o teste utilizando um computador conectado diretamente ao
              roteador por cabo de rede.
            </p>
            <div className="speedtest-recommendation">
              <span>Teste sua conexão em:</span>
              <a
                href="https://www.speedtest.net/pt"
                target="_blank"
                rel="noopener noreferrer"
              >
                Speedtest by Ookla
                <ExternalLink aria-hidden="true" size={15} />
              </a>
            </div>
            <div className="guide-alert good">
              <Info aria-hidden="true" size={22} />
              <strong>
                O teste por cabo ajuda a diferenciar uma limitação do Wi-Fi de
                um problema na própria conexão.
              </strong>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export function FiberCoverage() {
  return (
    <section className="guide-section coverage-section" id="cobertura">
      <div className="guide-shell">
        <SectionHeading
          eyebrow="Fibra e cobertura"
          title="CUIDADOS COM CABOS E EQUIPAMENTOS"
          subtitle="A fibra óptica e os cabos conectados ao equipamento exigem cuidado para manter a conexão estável."
        />

        <div className="fiber-grid">
          <article className="guide-card fiber-card">
            <div className="split-card-header">
              <div>
                <span className="guide-mini-label">Fibra óptica</span>
                <h3>TENHA CUIDADO COM O CABO DE FIBRA</h3>
              </div>
              <Cable aria-hidden="true" size={34} />
            </div>

            <div className="fiber-comparison">
              <div>
                <StatusLabel type="bad">ERRADO</StatusLabel>
                <svg
                  className="fiber-line sharp"
                  viewBox="0 0 320 116"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M6 30 H252 C258 30 261 32 261 34 C261 36 258 38 252 38 H58" />
                </svg>
              </div>
              <div>
                <StatusLabel type="good">CERTO</StatusLabel>
                <span className="fiber-line smooth" />
              </div>
            </div>

            <p>
              A fibra óptica é delicada. Evite puxar, esmagar, cortar, prender
              em móveis ou dobrar excessivamente.
            </p>
          </article>

          <article className="guide-card cables-card">
            <div className="split-card-header">
              <div>
                <span className="guide-mini-label">Conexões</span>
                <h3>NÃO RETIRE OS CABOS SEM NECESSIDADE</h3>
              </div>
              <Router aria-hidden="true" size={34} />
            </div>

            <div className="modem-back-visual" aria-label="Equipamento com cabos conectados nas portas traseiras">
              <svg className="connected-cable-paths" viewBox="0 0 360 210" aria-hidden="true" focusable="false">
                <defs>
                  <linearGradient id="cables-card-blue" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#7dd3fc" />
                    <stop offset="50%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>
                  <linearGradient id="cables-card-teal" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#67e8f9" />
                    <stop offset="55%" stopColor="#0ea5e9" />
                    <stop offset="100%" stopColor="#082f49" />
                  </linearGradient>
                  <linearGradient id="cables-card-power" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#fda4af" />
                    <stop offset="48%" stopColor="#fb7185" />
                    <stop offset="100%" stopColor="#111827" />
                  </linearGradient>
                </defs>
                <path className="connected-cable cable-power" d="M113 108 C103 126 82 142 78 191" stroke="url(#cables-card-power)" />
                <path className="connected-cable cable-lan-one" d="M156 108 C154 132 148 154 138 191" stroke="url(#cables-card-blue)" />
                <path className="connected-cable cable-lan-two" d="M202 108 C206 132 218 154 224 191" stroke="url(#cables-card-teal)" />
                <path className="connected-cable cable-fiber" d="M247 108 C265 126 287 150 292 191" stroke="url(#cables-card-blue)" />
              </svg>

              <div className="modem-device" aria-hidden="true">
                <span className="modem-top-light" />
                <span className="modem-brand-slot" />
                <div className="modem-leds">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="modem-vents">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="modem-port-panel">
                  <span className="modem-port power-port">
                    <span className="port-pin" />
                    <span className="cable-plug plug-power" />
                  </span>
                  <span className="modem-port">
                    <span className="port-pin" />
                    <span className="cable-plug plug-lan" />
                  </span>
                  <span className="modem-port">
                    <span className="port-pin" />
                    <span className="cable-plug plug-lan" />
                  </span>
                  <span className="modem-port fiber-port">
                    <span className="port-pin" />
                    <span className="cable-plug plug-fiber" />
                  </span>
                </div>
              </div>
            </div>

            <p>
              Retirar cabos sem saber a função de cada um pode interromper
              completamente sua conexão e dificultar o diagnóstico do suporte.
            </p>

            <div className="guide-alert warning">
              <CircleAlert aria-hidden="true" size={22} />
              <strong>Em caso de dúvida, fale conosco antes de desconectar qualquer cabo.</strong>
            </div>
          </article>
        </div>

        <article className="guide-card big-house-card">
          <div className="big-house-copy">
            <span className="guide-mini-label">Ambientes maiores</span>
            <h3>UM ROTEADOR PODE NÃO COBRIR TODA A CASA</h3>
            <p>
              Casas grandes, sobrados ou imóveis com muitas paredes podem
              precisar de mais de um ponto de Wi-Fi.
            </p>
          </div>

          <div className="two-floor-house" aria-label="Casa em corte frontal com cobertura Wi-Fi por intensidade">
            <CoverageHouseIllustration />
          </div>

          <div className="solution-grid">
            <span>WI-FI MESH</span>
            <span>PONTO DE ACESSO</span>
            <span>PONTO CABEADO</span>
          </div>
        </article>

        <article className="guide-card repeater-card">
          <div className="split-card-header">
            <div>
              <span className="guide-mini-label">Repetidor</span>
              <h3>E O REPETIDOR?</h3>
            </div>
            <Wifi aria-hidden="true" size={34} />
          </div>

          <p>
            Repetidores podem aumentar a área de cobertura, mas geralmente
            reduzem a qualidade e o desempenho da conexão.
          </p>

          <div className="repeater-warning-panel">
            <div className="repeater-warning-heading">
              <span>
                <CircleAlert aria-hidden="true" size={22} />
              </span>
              <strong>NÃO É A SOLUÇÃO QUE RECOMENDAMOS</strong>
            </div>

            <div
              className="repeater-signal-flow"
              aria-label="Roteador envia Wi-Fi para o repetidor, e o repetidor retransmite o sinal para o dispositivo"
            >
              <div className="repeater-flow-node router-node">
                <Router aria-hidden="true" size={31} />
                <span>ROTEADOR</span>
              </div>

              <div className="repeater-flow-link">
                <svg viewBox="0 0 128 52" aria-hidden="true" focusable="false">
                  <path d="M30 8 C54 18 54 34 30 44" />
                  <path d="M44 15 C59 22 59 30 44 37" />
                  <path d="M58 22 C65 25 65 27 58 30" />
                </svg>
                <ArrowDown aria-hidden="true" className="repeater-flow-arrow" size={22} />
                <span>Recebe o sinal</span>
              </div>

              <div className="repeater-flow-node extender-node">
                <Wifi aria-hidden="true" size={31} />
                <span>REPETIDOR</span>
              </div>

              <div className="repeater-flow-link retransmit">
                <svg viewBox="0 0 128 52" aria-hidden="true" focusable="false">
                  <path d="M30 8 C54 18 54 34 30 44" />
                  <path d="M44 15 C59 22 59 30 44 37" />
                  <path d="M58 22 C65 25 65 27 58 30" />
                </svg>
                <ArrowDown aria-hidden="true" className="repeater-flow-arrow" size={22} />
                <span>Retransmite o sinal</span>
              </div>

              <div className="repeater-flow-node device-node">
                <Smartphone aria-hidden="true" size={31} />
                <span>DISPOSITIVO</span>
              </div>
            </div>

            <div className="repeater-reason-grid">
              <div className="repeater-reason">
                <Gauge aria-hidden="true" size={22} />
                <div>
                  <strong>Pode reduzir a velocidade</strong>
                  <p>
                    O repetidor utiliza o próprio Wi-Fi para receber e
                    retransmitir os dados.
                  </p>
                </div>
              </div>

              <div className="repeater-reason">
                <Zap aria-hidden="true" size={22} />
                <div>
                  <strong>Aumenta a latência</strong>
                  <p>
                    Os dados precisam passar por uma etapa adicional antes de
                    chegar ao dispositivo.
                  </p>
                </div>
              </div>

              <div className="repeater-reason">
                <Signal aria-hidden="true" size={22} />
                <div>
                  <strong>Pode deixar a conexão menos estável</strong>
                  <p>
                    Interferências e um sinal fraco recebido pelo repetidor
                    também são retransmitidos.
                  </p>
                </div>
              </div>

              <div className="repeater-reason">
                <CircleAlert aria-hidden="true" size={22} />
                <div>
                  <strong>Não corrige a origem do problema</strong>
                  <p>
                    Se o sinal já chega fraco ao repetidor, ele não consegue
                    transformar esse sinal em uma conexão de alta qualidade.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="repeater-ideal-block">
            <div>
              <span>O IDEAL</span>
              <p>
                Para ampliar a cobertura com melhor desempenho, prefira um
                ponto de acesso conectado por cabo ou uma solução Wi-Fi Mesh
                adequada ao ambiente.
              </p>
            </div>

            <div className="repeater-ideal-list">
              <span>
                <CheckCircle2 aria-hidden="true" size={16} />
                Access Point cabeado
              </span>
              <span>
                <CheckCircle2 aria-hidden="true" size={16} />
                Wi-Fi Mesh
              </span>
              <span>
                <CheckCircle2 aria-hidden="true" size={16} />
                Melhor posicionamento do roteador
              </span>
            </div>
          </div>

          <p className="repeater-final-note">
            O repetidor pode ajudar em situações específicas, mas deve ser
            considerado apenas quando outras soluções não forem viáveis.
          </p>
        </article>
      </div>
    </section>
  );
}

export function InternetVsWifi() {
  const chain = ["INTERNET", "FIBRA", "ROTEADOR", "WI-FI", "APARELHOS"];

  return (
    <section className="guide-section internet-wifi-section" id="internet-wifi">
      <div className="guide-shell">
        <article className="guide-card internet-wifi-card">
          <div className="internet-copy">
            <span className="guide-mini-label">Diagnóstico</span>
            <h2>INTERNET E WI-FI NÃO SÃO EXATAMENTE A MESMA COISA</h2>
            <p>
              É possível que a internet esteja chegando normalmente até o
              roteador enquanto determinado ambiente possui cobertura Wi-Fi fraca.
            </p>
            <strong>SINAL WI-FI FRACO NEM SEMPRE SIGNIFICA PROBLEMA NA INTERNET</strong>
          </div>

          <div className="internet-diagram" aria-label="Fluxo de internet, fibra, roteador, Wi-Fi e aparelhos">
            {chain.map((item, index) => (
              <div className="internet-step" key={item}>
                <span>{item}</span>
                {index < chain.length - 1 && <ArrowDown aria-hidden="true" size={18} />}
              </div>
            ))}
          </div>

          <div className="internet-status-grid">
            <div>
              <StatusLabel type="good">INTERNET</StatusLabel>
              <strong>FUNCIONANDO NORMALMENTE</strong>
            </div>
            <div>
              <StatusLabel type="bad">QUARTO DISTANTE</StatusLabel>
              <strong>WI-FI FRACO</strong>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

export function SupportChecklist() {
  const checklist = [
    "O problema acontece em apenas um aparelho ou em todos?",
    "Acontece em toda a casa ou apenas em determinado cômodo?",
    "Outros aparelhos funcionam normalmente?",
    "O problema acontece apenas pelo Wi-Fi?",
    "Utilizando cabo também ocorre?",
    "O roteador está em local aberto?",
    "Existem objetos sobre o equipamento?",
    "Há muitos dispositivos fazendo downloads ou streaming?",
    "Os cabos parecem corretamente conectados?",
  ];

  return (
    <section className="guide-section support-check-section" id="suporte">
      <div className="guide-shell">
        <SectionHeading
          eyebrow="Antes do atendimento"
          title="ALGO NÃO ESTÁ FUNCIONANDO?"
          subtitle="Antes de falar com nosso suporte, observe algumas informações. Elas ajudam nossa equipe a identificar o problema mais rapidamente."
        />

        <div className="checklist-grid">
          {checklist.map((item) => (
            <div className="checklist-item" key={item}>
              <CheckCircle2 aria-hidden="true" size={22} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
