import "../styles/components-styles/chatBot.css"
import { FaWhatsapp } from "react-icons/fa";

export default function ChatBot() {
    return (
        <a
            href="https://wa.me/5508004445799?text=Olá, preciso de atendimento"
            target="_blank"
            rel="noreferrer"
            className="chat-botao"
        >
            <FaWhatsapp size={28} />
        </a>
    )
}