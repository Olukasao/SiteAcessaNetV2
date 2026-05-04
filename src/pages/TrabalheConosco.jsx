import "../styles/trabalhe.css";
import { FaBriefcase, FaUsers, FaRocket } from "react-icons/fa";
import { Helmet } from "react-helmet-async";
export default function TrabalheConosco() {
  return (
    <>

      <Helmet>
        <title>Trabalhe Conosco | Acessanet Telecom</title>

        <meta
          name="description"
          content="Faça parte da equipe Acessanet Telecom. Veja nossas oportunidades de emprego e cresça com a gente no setor de internet e tecnologia."
        />

        {/* SEO básico */}
        <meta
          name="keywords"
          content="trabalhe conosco, vagas Acessanet, empregos telecom, vagas TI, provedor internet empregos"
        />
        <meta name="author" content="Acessanet Telecom" />

        {/* Open Graph */}
        <meta property="og:title" content="Trabalhe Conosco | Acessanet Telecom" />
        <meta
          property="og:description"
          content="Confira vagas abertas e venha trabalhar na Acessanet Telecom."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://acessanet.com.br/trabalhe-conosco" />
       
        <meta property="og:locale" content="pt_BR" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Trabalhe Conosco | Acessanet Telecom" />
        <meta
          name="twitter:description"
          content="Venha fazer parte do nosso time e crescer com a Acessanet."
        />

        {/* Indexação */}
        <meta name="robots" content="index, follow" />
      </Helmet>
      <section className="trabalhe">

        {/* HERO */}
        <div className="trabalhe-hero">
          <h1>Trabalhe Conosco</h1>
          <p>
            Faça parte da equipe que conecta pessoas todos os dias.
          </p>
        </div>

        {/* BENEFÍCIOS */}
        <div className="container beneficios">

          <div className="beneficio">
            <FaRocket className="icon" />
            <h3>Crescimento Profissional</h3>
            <p>Ambiente focado em evolução e aprendizado constante.</p>
          </div>

          <div className="beneficio">
            <FaUsers className="icon" />
            <h3>Equipe Unida</h3>
            <p>Trabalho colaborativo e valorização das pessoas.</p>
          </div>

          <div className="beneficio">
            <FaBriefcase className="icon" />
            <h3>Oportunidades</h3>
            <p>Áreas técnicas, atendimento e administrativas.</p>
          </div>

        </div>

        {/* FORMULÁRIO */}
        <div className="container form-area">
          <h2>Envie seu currículo</h2>

          <form className="trabalhe-form">
            <input type="text" placeholder="Nome completo" required />
            <input type="email" placeholder="E-mail" required />
            <input type="tel" placeholder="Telefone" required />
            <select>
              <option>Área de interesse</option>
              <option>Suporte Técnico</option>
              <option>Instalador</option>
              <option>Atendimento</option>
              <option>Administrativo</option>
            </select>

            <textarea placeholder="Fale um pouco sobre você"></textarea>

            <input type="file" />

            <button type="submit">Enviar Currículo</button>
          </form>
        </div>

      </section>
    </>
  );
}