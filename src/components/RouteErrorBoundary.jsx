import { Component } from "react";
import { useLocation } from "react-router-dom";

class PageBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
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
  return <PageBoundary key={pathname}>{children}</PageBoundary>;
}
