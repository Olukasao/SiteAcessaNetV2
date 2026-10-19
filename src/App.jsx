import { Suspense, lazy, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import WhatsAppFloat from "./components/WhatsAppFloat";
import PlanModal from "./components/PlanModal";
import CoverageModal from "./components/CoverageModal";
import { UIProvider } from "./context/UIContext";
import Home from "./pages/Home";

const PlanosPage = lazy(() => import("./pages/PlanosPage"));
const EmpresasPage = lazy(() => import("./pages/EmpresasPage"));
const ContratosPage = lazy(() => import("./pages/ContratosPage"));
const GuiaWifiPage = lazy(() => import("./pages/GuiaWifiPage"));
const LgpdPage = lazy(() => import("./pages/LgpdPage"));
const TrabalheConoscoPage = lazy(() => import("./pages/TrabalheConoscoPage"));
const ContratarPage = lazy(() => import("./pages/ContratarPage"));
const ClienteArea = lazy(() => import("./cliente/ClienteArea"));
const AdminArea = lazy(() => import("./admin/AdminArea"));
const WifiPortalPage = lazy(() => import("./pages/WifiPortalPage"));

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ block: "start" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

// Painel admin: app à parte, também fora do header/rodapé do site.
function isAdminPath(pathname) {
  return /^\/admin(\/|$)/.test(pathname);
}

// A Central do Assinante é um app à parte (menu lateral próprio, sem o
// header/rodapé do site). O guia Wi-Fi mora em /cliente/guia-wifi mas é
// página do site.
function isCentralPath(pathname) {
  return /^\/cliente(\/|$)/.test(pathname) && pathname !== "/cliente/guia-wifi" && pathname !== "/cliente/guia-wifi/";
}

// Captive portal do Wi-Fi público: abre no mini-navegador do celular, sem header/rodapé.
function isWifiPortalPath(pathname) {
  return /^\/login-wifi-publico\/?$/.test(pathname);
}

export default function App() {
  const { pathname } = useLocation();

  if (isWifiPortalPath(pathname)) {
    return (
      <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--navy-900)" }} />}>
        <Routes>
          <Route path="/login-wifi-publico" element={<WifiPortalPage />} />
        </Routes>
      </Suspense>
    );
  }

  if (isAdminPath(pathname)) {
    return (
      <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--surface-2)" }} />}>
        <Routes>
          <Route path="/admin/*" element={<AdminArea />} />
        </Routes>
      </Suspense>
    );
  }

  if (isCentralPath(pathname)) {
    return (
      <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--navy-900)" }} />}>
        <Routes>
          <Route path="/cliente/*" element={<ClienteArea />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <UIProvider>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <ScrollManager />
      <Header />
      <main id="conteudo" tabIndex={-1}>
        <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--navy-900)" }} />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/planos" element={<PlanosPage />} />
            <Route path="/empresas" element={<EmpresasPage />} />
            <Route path="/contratos" element={<ContratosPage />} />
            <Route path="/boas-praticas-wifi" element={<GuiaWifiPage />} />
            <Route path="/cliente/guia-wifi" element={<GuiaWifiPage />} />
            <Route path="/lgpd" element={<LgpdPage />} />
            <Route path="/trabalhe-conosco" element={<TrabalheConoscoPage />} />
            <Route path="/contratar" element={<ContratarPage />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <WhatsAppFloat />
      <PlanModal />
      <CoverageModal />
    </UIProvider>
  );
}
