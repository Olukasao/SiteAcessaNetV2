import "../styles/components-styles/footer.css";
import logo from "../assets/logo acessa (2).png";
import {
    FaClock,
    FaMapMarkerAlt,
    FaPhoneAlt,
    FaWhatsapp,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { Ribbon } from "lucide-react";
import { seasonalCampaign } from "../theme/siteTheme";

export default function Footer() {
    return (
        <footer className="footer">

            <div className="footer-container">

                {/* Empresa */}
                <div className="footer-col footer-brand">
                    <Link to="/" className="footer-logo-link" aria-label="Voltar para a página inicial">
                        <img
                            src={logo}
                            alt="Acessa Net"
                            className="footer-logo"
                            width="4240"
                            height="1545"
                            decoding="async"
                        />
                    </Link>

                    <p>
                        Acessanet é um provedor de internet de fibra óptica comprometido
                        em oferecer serviços de alta qualidade e velocidade superior.
                    </p>

                    <p>
                        Desde sua fundação em 2015, nossa missão tem sido levar inovação
                        tecnológica e um atendimento humanizado para todas as regiões
                        onde atuamos.
                    </p>

                    <div className="footer-legal">
                        <span>23.094.376.0001-08</span>
                        <span>ACESSANET TELECON LTDA</span>
                    </div>
                </div>

                {/* Atendimento */}
                <div className="footer-col">
                    <h3>ATENDIMENTO</h3>

                    <div className="footer-contact-list">
                        <a href="tel:08004445799" className="footer-contact-item">
                            <span className="footer-contact-icon">
                                <FaPhoneAlt />
                            </span>
                            <span>
                                <strong>0800 444 5799</strong>
                                <small>Segunda a segunda, 24h</small>
                            </span>
                        </a>

                        <a
                            href="https://wa.me/5508004445799"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="footer-contact-item"
                        >
                            <span className="footer-contact-icon footer-contact-icon--whats">
                                <FaWhatsapp />
                            </span>
                            <span>
                                <strong>Assistente Virtual</strong>
                                <small>Atendimento pelo WhatsApp</small>
                            </span>
                        </a>
                    </div>
                </div>

                {/* Acessos */}
                <nav className="footer-col footer-links" aria-label="Links do rodapé">
                    <h3>ACESSOS</h3>
                    <Link to="/cliente">Área do Cliente</Link>
                    <Link to="/planos" >Planos</Link>
                    <Link to="/contratos" >Contratos e Termos</Link>
                    <Link to="/historia" >Nossa História</Link>
                    <Link to="/trabalhe-conosco" >Trabalhe Conosco</Link>
                    <Link to="/contatos" >Contatos</Link>
                    <Link to="/lgpd" >LGPD</Link>
                    <Link to="/disponibilidade" >Disponibilidade</Link>
                </nav>

                {/* Área */}
                <div className="footer-col">
                    <h3>ÁREA DE ATENDIMENTO</h3>
                    <div className="footer-service-area">
                        <FaMapMarkerAlt />
                        <p>Caieiras, Francisco Morato e Franco da Rocha.</p>
                    </div>

                    <div className="footer-service-area">
                        <FaClock />
                        <p>Suporte todos os dias para manter sua conexão sempre ativa.</p>
                    </div>
                </div>

            </div>

            {seasonalCampaign.enabled && (
                <div className="footer-campaign-note">
                    <Ribbon size={14} aria-hidden="true" />
                    <span>
                        Outubro Rosa • AcessaNet apoia a conscientização e a prevenção.
                    </span>
                </div>
            )}

            <div className="footer-bottom">
                <span>© {new Date().getFullYear()} AcessaNet - Todos os direitos reservados</span>
                <span>Internet fibra óptica com atendimento local.</span>
            </div>

        </footer>
    );
}
