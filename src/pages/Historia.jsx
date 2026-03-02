import "../styles/historia.css";
import { FaNetworkWired, FaUsers, FaRocket, FaWifi } from "react-icons/fa";

export default function Historia() {
  return (
    <section className="historia">

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
          <img src="/empresa/equipe.jpg" alt="Equipe AcessaNet" />
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

      {/* LINHA DO TEMPO */}
      <div className="timeline container">
        <h2>Nossa Evolução</h2>

        <div className="timeline-item">
          <span>2018</span>
          <p>Fundação da empresa e primeiros clientes conectados.</p>
        </div>

        <div className="timeline-item">
          <span>2020</span>
          <p>Expansão da rede e implantação de fibra óptica.</p>
        </div>

        <div className="timeline-item">
          <span>2023</span>
          <p>Lançamento do Watch TV e novos serviços digitais.</p>
        </div>

        <div className="timeline-item">
          <span>Hoje</span>
          <p>Centenas de clientes conectados com alta performance.</p>
        </div>
      </div>

    </section>
  );
}