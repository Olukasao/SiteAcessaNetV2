import {
  Camera,
  Gamepad2,
  Laptop,
  Router,
  Smartphone,
  Tablet,
  Tv,
  Wifi,
} from "lucide-react";

const devices = [
  { className: "shared-node-tv", label: "Smart TV", Icon: Tv },
  { className: "shared-node-phone", label: "Celular", Icon: Smartphone },
  { className: "shared-node-laptop", label: "Notebook", Icon: Laptop },
  { className: "shared-node-game", label: "Videogame", Icon: Gamepad2 },
  { className: "shared-node-tablet", label: "Tablet", Icon: Tablet },
  { className: "shared-node-camera", label: "Câmera", Icon: Camera },
];

const tags = ["TV 4K", "Download", "Jogos", "Celulares", "Câmeras"];

export function SharedConnectionIllustration() {
  return (
    <article className="shared-connection-illustration">
      <div className="shared-connection-top">
        <span className="shared-connection-badge">Dispositivos</span>

        <span className="shared-connection-corner-icon" aria-hidden="true">
          <Router strokeWidth={2.1} />
          <Wifi strokeWidth={2.1} />
        </span>
      </div>

      <h2 className="shared-connection-title">
        <span>TODOS UTILIZAM A</span>{" "}
        <span>MESMA CONEXÃO</span>
      </h2>

      <div
        className="shared-connection-diagram"
        aria-label="Roteador central conectado a seis dispositivos"
      >
        <svg
          className="shared-connection-lines"
          viewBox="0 0 520 360"
          aria-hidden="true"
          focusable="false"
        >
          <circle className="shared-signal-ring ring-one" cx="260" cy="180" r="74" />
          <circle className="shared-signal-ring ring-two" cx="260" cy="180" r="126" />
          <circle className="shared-signal-ring ring-three" cx="260" cy="180" r="178" />
          <circle className="shared-signal-ring ring-four" cx="260" cy="180" r="218" />
          <path d="M260 180 L130 52" />
          <path d="M260 180 L410 62" />
          <path d="M260 180 L58 188" />
          <path d="M260 180 L462 188" />
          <path d="M260 180 L148 316" />
          <path d="M260 180 L392 316" />
        </svg>

        <div className="shared-router-center">
          <Router aria-hidden="true" strokeWidth={2.1} />
          <span>Roteador</span>
        </div>

        {devices.map((device) => {
          const DeviceIcon = device.Icon;

          return (
            <div className={`shared-device-node ${device.className}`} key={device.label}>
              <DeviceIcon aria-hidden="true" strokeWidth={2.1} />
              <span>{device.label}</span>
            </div>
          );
        })}
      </div>

      <div className="shared-connection-tags" aria-hidden="true">
        {tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

    </article>
  );
}
