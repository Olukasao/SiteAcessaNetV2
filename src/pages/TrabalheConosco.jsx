import "../styles/trabalhe.css";
import { FaBriefcase, FaUsers, FaRocket } from "react-icons/fa";

export default function TrabalheConosco() {
  return (
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
          <FaRocket className="icon"/>
          <h3>Crescimento Profissional</h3>
          <p>Ambiente focado em evolução e aprendizado constante.</p>
        </div>

        <div className="beneficio">
          <FaUsers className="icon"/>
          <h3>Equipe Unida</h3>
          <p>Trabalho colaborativo e valorização das pessoas.</p>
        </div>

        <div className="beneficio">
          <FaBriefcase className="icon"/>
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
  );
}