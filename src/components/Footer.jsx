import "../styles/components-styles/footer.css";
import logo from "../assets/logo.png";
import { FaPhoneAlt, FaWhatsapp } from "react-icons/fa";
import { Link } from "react-router-dom";

export default function Footer() {
    return (
        <footer className="footer">

            <div className="footer-container">

                {/* Empresa */}
                <div className="footer-col">
                    <img src={logo} alt="Acessa Net" className="footer-logo" />

                    <p>
                        Acessanet é um provedor de internet de fibra óptica comprometido
                        em oferecer serviços de alta qualidade e velocidade superior.
                    </p>

                    <p>
                        Desde sua fundação em 2015, nossa missão tem sido levar inovação
                        tecnológica e um atendimento humanizado para todas as regiões
                        onde atuamos.
                    </p>

                    <span>23.094.376.0001-08</span>
                    <span>ACESSANET TELECON LTDA</span>
                </div>

                {/* Atendimento */}
                <div className="footer-col">
                    <h3>ATENDIMENTO</h3>

                    {/* Telefone fixo */}
                    <p>
                        <FaPhoneAlt />{" "}
                        <a href="tel:08004445799">0800 444 5799</a>
                    </p>
                    <span>Segunda à Segunda<br />24H</span>

                    {/* WhatsApp */}
                    <p className="whats">
                        <FaWhatsapp />{""}
                        <a
                            href="https://wa.me/5508004445799"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Assistente Virtual
                        </a>
                    </p>
                    <span>24 horas por dia, 7 dias por semana</span>
                </div>

                {/* Acessos */}
                <div className="footer-col">
                    <h3>ACESSOS</h3>
                    <Link to="https://acessanet.sgp.net.br/accounts/central/login" >Área do Cliente</Link>
                    <Link to="/planos" >Planos</Link>
                    <Link to="/contratos" >Contratos</Link>
                    <Link to="/historia" >Nossa História</Link>
                    <Link to="/trabalhe-conosco" >Trabalhe Conosco</Link>
                    <Link to="/contatos" >Contatos</Link>
                    <Link to="/lgpd" >LGPD</Link>
                    <Link to="/disponibilidade" >Disponibilidade</Link>
                </div>
                {/* Área */}
                <div className="footer-col">
                    <h3>ÁREA DE ATENDIMENTO</h3>
                    <p>Caieiras, Francisco Morato e Franco da Rocha.</p>
                </div>

            </div>
            <div className="footer-bottom">
                © {new Date().getFullYear()} Acessa Net — Todos os direitos reservados
            </div>

        </footer>
    );
}