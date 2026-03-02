import { Helmet } from "react-helmet";
import "../styles/contratos.css";
import contratoPDF from "../assets/docs/ACS-CONTRATO-DE-PRESTACAO-DE-SERVICOS.pdf";
import { FaFileContract, FaDownload } from "react-icons/fa";

export default function Contratos() {
  return (
    <section className="contratos">
      <Helmet>
        <title>Acessanet - Contratos</title>
      </Helmet>
      <div className="contratos-container">

        <h1>
          <FaFileContract /> Contratos e Termos
        </h1>

        <p className="subtitle">
          Consulte nossos documentos oficiais, termos de uso e políticas
          relacionadas aos serviços prestados.
        </p>

        <div className="contratos-grid">

          {/* CONTRATO */}
          <div className="contrato-card">
            <h3>Contrato de Prestação de Serviço</h3>

            <p>
              Documento que estabelece as condições gerais para
              fornecimento de internet banda larga.
            </p>

            <a href={contratoPDF} target="_blank">
              <FaDownload /> Baixar PDF
            </a>
          </div>

          {/* TERMOS */}
          <div className="contrato-card">
            <h3>Termos de Uso</h3>

            <p>
              Regras e responsabilidades para utilização dos
              serviços disponibilizados pelo provedor.
            </p>

            <a href="/docs/termos.pdf" target="_blank">
              <FaDownload /> Baixar PDF
            </a>
          </div>

          {/* PRIVACIDADE */}
          <div className="contrato-card">
            <h3>Política de Privacidade</h3>

            <p>
              Informações sobre coleta, uso e proteção dos dados
              pessoais conforme a LGPD.
            </p>

            <a href="/docs/privacidade.pdf" target="_blank">
              <FaDownload /> Baixar PDF
            </a>
          </div>

        </div>

      </div>

    </section>
  );
}