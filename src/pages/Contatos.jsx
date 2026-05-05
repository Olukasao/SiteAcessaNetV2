import { Helmet } from "react-helmet-async";
import "../styles/contatos.css";
import { FaWhatsapp, FaPhone, FaMapMarkerAlt, FaEnvelope } from "react-icons/fa";

export default function Contatos() {
    return (
        <>
            <Helmet>
                <title>Contato | Acessanet Telecom</title>

                <meta
                    name="description"
                    content="Entre em contato com a Acessanet Telecom e contrate planos de internet rápida e estável em sua região."
                />

                {/* SEO básico */}
                <meta name="keywords" content="internet fibra, contato, Acessanet, planos de internet" />
                <meta name="author" content="Acessanet Telecom" />

                {/* Open Graph (WhatsApp / Facebook) */}
                <meta property="og:title" content="Contato | Acessanet Telecom" />
                <meta
                    property="og:description"
                    content="Fale com a Acessanet Telecom e descubra o melhor plano de internet para você."
                />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://acessanet.com.br/contratos" />

                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Contato | Acessanet Telecom" />
                <meta
                    name="twitter:description"
                    content="Entre em contato com a Acessanet Telecom agora mesmo."
                />
            </Helmet>
            <section className="contato">

                <div className="contato-hero">
                    <h1>Fale Conosco</h1>
                    <p>Estamos prontos para atender você.</p>
                </div>

                <div className="container contato-grid">

                    {/* INFORMAÇÕES */}
                    <div className="contato-info">
                        <h2>Atendimento</h2>

                        <p><FaPhone />  0800 444 5799</p>
                        <p><FaWhatsapp /> WhatsApp: (55) 0800 444 5799</p>
                        <p><FaEnvelope /> contato@acessanet.com.br</p>
                        <p><FaMapMarkerAlt /> Franco da Rocha - SP</p>
                    </div>

                    {/* FORM */}
                    <form className="contato-form" action ="malito:">
                        <input type="text" placeholder="Seu nome" required />
                        <input type="email" placeholder="Seu e-mail" required />
                        <input type="text" placeholder="Assunto" />

                        <textarea placeholder="Digite sua mensagem"></textarea>

                        <button type="submit">Enviar Mensagem</button>
                    </form>

                </div>

            </section>
        </>
    );
}