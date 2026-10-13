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

export default function App() {
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
