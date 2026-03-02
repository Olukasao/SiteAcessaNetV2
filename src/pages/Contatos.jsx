import "../styles/contatos.css";
import { FaWhatsapp, FaPhone, FaMapMarkerAlt, FaEnvelope } from "react-icons/fa";

export default function Contatos() {
    return (

        <section className="contato">

            <div className="contato-hero">
                <h1>Fale Conosco</h1>
                <p>Estamos prontos para atender você.</p>
            </div>

            <div className="container contato-grid">

                {/* INFORMAÇÕES */}
                <div className="contato-info">
                    <h2>Atendimento</h2>

                    <p><FaPhone /> (55) 0800 444 5799</p>
                    <p><FaWhatsapp /> WhatsApp: (11) 99999-9999</p>
                    <p><FaEnvelope /> contato@acessanet.com.br</p>
                    <p><FaMapMarkerAlt /> Franco da Rocha - SP</p>
                </div>

                {/* FORM */}
                <form className="contato-form">
                    <input type="text" placeholder="Seu nome" required />
                    <input type="email" placeholder="Seu e-mail" required />
                    <input type="text" placeholder="Assunto" />

                    <textarea placeholder="Digite sua mensagem"></textarea>

                    <button type="submit">Enviar Mensagem</button>
                </form>

            </div>

        </section>
    );
}