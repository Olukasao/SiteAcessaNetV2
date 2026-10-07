import { Suspense, lazy } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import ErrorBoundary from "../components/ErrorBoundary";

const Home = lazy(() => import("../pages/HomePage"));
const Contratos = lazy(() => import("../pages/Contratos"));
const Historia = lazy(() => import("../pages/Historia"));
const TrabalheConosco = lazy(() => import("../pages/TrabalheConosco"));
const Contatos = lazy(() => import("../pages/Contatos"));
const Planos = lazy(() => import("../pages/Planos"));
const Disponibilidade = lazy(() => import("../pages/Disponibilidade"));
const LGPD = lazy(() => import("../pages/LGPD"));
const ClienteMundiale = lazy(() => import("../pages/ClienteMundiale"));
const AssinarDocumento = lazy(() => import("../pages/AssinarDocumento"));
const GuiaWifi = lazy(() => import("../pages/GuiaWifi"));
const ClienteArea = lazy(() => import("../pages/ClienteArea"));
const AdminArea = lazy(() => import("../pages/AdminArea"));

const routeFallback = (
    <div
        style={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            color: "#061b35",
            background: "linear-gradient(180deg, #f7fbff 0%, #eef7fd 100%)",
            fontWeight: 800
        }}
    >
        Carregando AcessaNet
    </div>
);

export default function AppRoutes() {
    const location = useLocation();

    return (
      // key=pathname: se uma rota quebrar (ex.: chunk de import dinamico
      // sumiu depois de um deploy) e o usuario navegar para outra pagina, o
      // boundary "reseta" em vez de continuar preso na tela de erro.
      <ErrorBoundary key={location.pathname}>
        <Suspense fallback={routeFallback}>
          <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/planos" element={<Planos />} />
              <Route path="/historia" element={<Historia />} />
              <Route path="/trabalhe-conosco" element={<TrabalheConosco />} />
              <Route path="/contatos" element={<Contatos />} />
              <Route path="/disponibilidade" element={<Disponibilidade />} />
              <Route path="/contratos" element={<Contratos />} />
              <Route path="/assinar-documento" element={<AssinarDocumento />} />

              <Route path="/cliente/guia-wifi" element={<GuiaWifi />} />
              <Route path="/cliente/*" element={<ClienteArea />} />
              <Route path="/admin/*" element={<AdminArea />} />
              <Route path="/dados/mundiale/preencher" element={<ClienteMundiale />} />
              <Route path="/lgpd" element={<LGPD />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
}
