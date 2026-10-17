import { Component } from "react";
import { useLocation } from "react-router-dom";

class PageBoundary extends Component {
  state = { failed: false, pathname: this.props.pathname };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // Trocar de rota limpa a falha sem remontar o app inteiro (um `key` por
  // rota remontava o UIProvider e perdia o CEP consultado, por exemplo).
  static getDerivedStateFromProps(props, state) {
    if (props.pathname !== state.pathname) return { failed: false, pathname: props.pathname };
    return null;
  }

  componentDidCatch(error) {
    console.error("Falha ao carregar página AcessaNet", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--surface-2)", color: "var(--ink)" }}>
        <section role="alert" style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-display)", marginBottom: 16 }}>Vamos tentar novamente?</h1>
          <p style={{ marginBottom: 24 }}>Não foi possível carregar esta página. Atualize para tentar novamente.</p>
          <button className="btn btn--primary" type="button" onClick={() => window.location.reload()}>Atualizar página</button>
        </section>
      </main>
    );
  }
}

export default function RouteErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <PageBoundary pathname={pathname}>{children}</PageBoundary>;
}
