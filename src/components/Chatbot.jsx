import { useState, useRef, useEffect } from "react"
import "../styles/components-styles/chatBot.css"
import { FaWhatsapp } from "react-icons/fa";

export default function ChatBot() {

    const [aberto, setAberto] = useState(false)
    const chatRef = useRef(null)

    const [mensagens, setMensagens] = useState([
        { texto: "Olá 👋 Bem-vindo! Como podemos ajudar?", autor: "bot" }
    ])

    const respostas = [
        "Ver planos",
        "Suporte técnico",
        "2ª via de boleto"
    ]

    function enviarResposta(resposta) {

        const novaMensagem = {
            texto: resposta,
            autor: "user"
        }

        const respostaBot = {
            texto: "Nossa equipe irá te ajudar com isso!",
            autor: "bot"
        }

        setMensagens([...mensagens, novaMensagem, respostaBot])
    }

    useEffect(() => {
        function handleClickOutside(event) {
            if (chatRef.current && !chatRef.current.contains(event.target)) {
                setAberto(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [])

    return (
        <>
            {/* BOTÃO CHAT */}
            <button
                className="chat-botao"
                onClick={() => setAberto(!aberto)}
            >
                <FaWhatsapp size={28} />
            </button>

            {/* JANELA */}
            {aberto && (
                <div className="container-chat" ref={chatRef}>

                    <div className="chat-header">
                        <img src="/bot.png" alt="bot" />
                        Atendimento
                    </div>

                    <div className="chat-mensagens">

                        {mensagens.map((msg, index) => (
                            <div key={index} className={`msg ${msg.autor}`}>
                                {msg.texto}
                            </div>
                        ))}

                        <div className="respostas">
                            {respostas.map((r, i) => (
                                <button key={i} onClick={() => enviarResposta(r)}>
                                    {r}
                                </button>
                            ))}
                        </div>

                    </div>

                    <div className="chat-footer">
                        <a
                            href="https://wa.me/5511999999999"
                            target="_blank"
                        >
                            Falar no WhatsApp
                        </a>
                    </div>

                </div>
            )}
        </>
    )
}