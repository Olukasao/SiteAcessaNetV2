import { Helmet } from "react-helmet-async";
import "../styles/contratos.css";
import contratoACS from "../assets/docs/ACS.pdf";
import contratoCDE from "../assets/docs/CDE.pdf"
import contratoDEC from "../assets/docs/DEC.pdf"


import { FaFileContract, FaDownload } from "react-icons/fa";

export default function Contratos() {
  return (
    <section className="contratos">
      <Helmet>
        <title>Contratos | Acessanet Telecom</title>

        <meta
          name="description"
          content="Acesse e gerencie seus contratos com a Acessanet Telecom de forma rápida e segura."
        />

        {/* Open Graph */}
        <meta property="og:title" content="Contratos | Acessanet Telecom" />
        <meta
          property="og:description"
          content="Visualize e acompanhe seus contratos com facilidade."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://acessanet.com.br/contratos" />

        {/* Extras */}
        <meta name="robots" content="index, follow" />
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
            <h3>Contrato de Prestação de Serviço A.S.C</h3>

            <p>
              Documento que estabelece as condições gerais para
              fornecimento de internet banda larga.
            </p>

            <a href={contratoACS} target="_blank">
              <FaDownload /> Baixar PDF
            </a>
          </div>

          {/* TERMOS */}
          <div className="contrato-card">
            <h3>Contrato de Prestação de Serviço C.D.E</h3>

            <p>
              Regras e responsabilidades para utilização dos
              serviços disponibilizados pelo provedor.
            </p>

            <a href={contratoCDE} target="_blank">
              <FaDownload /> Baixar PDF
            </a>
          </div>

          {/* PRIVACIDADE */}
          <div className="contrato-card">
            <h3>Contrato de Prestação de Serviço D.E.C</h3>

            <p>
              Documento que define as condições, direitos e responsabilidades relacionadas à prestação de serviços entre as partes.
            </p>

            <a href={contratoDEC} target="_blank">
              <FaDownload /> Baixar PDF
            </a>
          </div>

        </div>

      </div>

    </section>
  );
}