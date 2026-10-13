import { Link } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import { MapPin, Phone } from "lucide-react";
import logo from "../assets/logo-acessanet-3d.png";
import { company, coveredCitiesLabel, whatsappLink, wifiGuideUrl } from "../data/site";
import "./footer.css";

export default function Footer() {
  return (
    <footer className="ftr">
      <div className="container">
        <div className="ftr-top">
          <div className="ftr-brand">
            <img src={logo} alt="AcessaNet" width="877" height="327" loading="lazy" />
            <p>
              Internet fibra óptica com atendimento humanizado, levando tecnologia para {coveredCitiesLabel} desde {company.since}.
            </p>
          </div>

          <div className="ftr-col">
            <h2>Atendimento</h2>
            <a href={company.phoneHref} className="ftr-contact">
              <Phone size={18} aria-hidden="true" />
              <span>
                <strong>{company.phone}</strong>
                <small>{company.supportHours}</small>
              </span>
            </a>
            <a href={whatsappLink("Olá! Vim pelo site da AcessaNet.")} target="_blank" rel="noreferrer" className="ftr-contact">
              <FaWhatsapp size={18} aria-hidden="true" />
              <span>
                <strong>WhatsApp</strong>
                <small>Assistente virtual</small>
              </span>
            </a>
          </div>

          <nav className="ftr-col" aria-label="Rodapé">
            <h2>Navegação</h2>
            <Link to="/planos">Planos residenciais</Link>
            <Link to="/empresas">Para empresas</Link>
            <a href={company.centralUrl}>Central do Assinante</a>
            <Link to="/contratos">Contratos e termos</Link>
            <Link to={wifiGuideUrl}>Boas práticas Wi-Fi</Link>
            <a href="https://acessanet.com.br/lgpd">LGPD</a>
            <a href="https://acessanet.com.br/trabalhe-conosco">Trabalhe conosco</a>
          </nav>

          <div className="ftr-col">
            <h2>Área de cobertura</h2>
            <p className="ftr-area">
              <MapPin size={18} aria-hidden="true" /> {coveredCitiesLabel}.
            </p>
          </div>
        </div>

        <div className="ftr-bottom">
          <span>© {new Date().getFullYear()} {company.legalName} · CNPJ {company.cnpj}</span>
          <span>Versão de testes (lab) — não indexada</span>
        </div>
      </div>
    </footer>
  );
}
