import "../styles/historia.css";
import { FaNetworkWired, FaUsers, FaRocket, FaWifi } from "react-icons/fa";

import logo from "../assets/logo.png"
import { Helmet } from "react-helmet-async";

export default function Historia() {
  return (
    <section className="historia">
      <Helmet>
        <title>Nossa História | Acessanet Telecom</title>

        <meta
          name="description"
          content="Conheça a história da Acessanet Telecom e nossa trajetória levando internet de qualidade para a região."
        />

        {/* SEO básico */}
        <meta
          name="keywords"
          content="Acessanet Telecom, nossa história, provedor de internet, internet fibra SP"
        />
        <meta name="author" content="Acessanet Telecom" />

        {/* Open Graph (WhatsApp / Facebook) */}
        <meta property="og:title" content="Nossa História | Acessanet Telecom" />
        <meta
          property="og:description"
          content="Descubra como a Acessanet Telecom cresceu e se tornou referência em internet de qualidade."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://acessanet.com.br/sobre" />
        <meta property="og:locale" content="pt_BR" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Nossa História | Acessanet Telecom" />
        <meta
          name="twitter:description"
          content="Conheça a história da Acessanet Telecom."
        />

        {/* Indexação */}
        <meta name="robots" content="index, follow" />
      </Helmet>
      {/* HERO */}
      <div className="historia-hero">
        <div className="container">
          <h1>Nossa História</h1>
          <p>
            Conectando pessoas, empresas e sonhos através da tecnologia
            e da internet de alta qualidade.
          </p>
        </div>
      </div>

      {/* SOBRE */}
      <div className="container historia-content">

        <div className="historia-text">
          <h2>Como tudo começou</h2>

          <p>
            A <strong>AcessaNet</strong> nasceu com o objetivo de levar
            internet rápida e estável para regiões que precisavam de
            conectividade confiável. Desde o início, nosso foco sempre foi
            oferecer atendimento próximo ao cliente e tecnologia de ponta.
          </p>

          <p>
            Começamos com uma pequena estrutura, mas com uma grande visão:
            transformar a experiência de conexão das pessoas, oferecendo
            velocidade real, estabilidade e suporte humanizado.
          </p>

          <p>
            Hoje, seguimos expandindo nossa rede com fibra óptica,
            investindo constantemente em infraestrutura e inovação para
            garantir a melhor experiência digital aos nossos clientes.
          </p>
        </div>

        <div className="historia-image">
          <img src={logo} alt="Equipe AcessaNet" />
        </div>

      </div>

      {/* MISSÃO VISÃO VALORES */}
      <div className="valores">
        <div className="container valores-grid">

          <div className="valor-card">
            <FaRocket className="icon" />
            <h3>Missão</h3>
            <p>
              Levar internet rápida e confiável, conectando pessoas
              ao que realmente importa.
            </p>
          </div>

          <div className="valor-card">
            <FaNetworkWired className="icon" />
            <h3>Visão</h3>
            <p>
              Ser referência regional em conectividade e inovação
              tecnológica.
            </p>
          </div>

          <div className="valor-card">
            <FaUsers className="icon" />
            <h3>Valores</h3>
            <p>
              Transparência, qualidade, inovação e respeito
              com nossos clientes.
            </p>
          </div>

          <div className="valor-card">
            <FaWifi className="icon" />
            <h3>Tecnologia</h3>
            <p>
              Infraestrutura moderna com fibra óptica e
              monitoramento constante.
            </p>
          </div>

        </div>
      </div>


    </section>
  );
}