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
const ClienteArea = lazy(() => import("./cliente/ClienteArea"));

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

// A Central do Assinante é um app à parte (menu lateral próprio, sem o
// header/rodapé do site). O guia Wi-Fi mora em /cliente/guia-wifi mas é
// página do site.
function isCentralPath(pathname) {
  return /^\/cliente(\/|$)/.test(pathname) && pathname !== "/cliente/guia-wifi" && pathname !== "/cliente/guia-wifi/";
}

export default function App() {
  const { pathname } = useLocation();

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
