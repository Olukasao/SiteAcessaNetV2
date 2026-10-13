import { useEffect } from "react";
import Empresas from "../sections/Empresas";
import Central from "../sections/Central";
import "../sections/sections.css";

export default function EmpresasPage() {
  useEffect(() => {
    document.title = "Internet para empresas | AcessaNet";
  }, []);
  return (
    <>
      <section className="page-hero" aria-labelledby="emp-title">
        <div className="container">
          <span className="eyebrow">Empresas</span>
          <h1 id="emp-title">Conectividade para o seu negócio não parar.</h1>
          <p>Plano comercial para o dia a dia ou link dedicado com banda 100% garantida, IP fixo e SLA com prioridade.</p>
        </div>
      </section>
      <Empresas full />
      <Central />
    </>
  );
}
