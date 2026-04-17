import "../styles/components-styles/whatsAppButton.css";
import { FaWhatsapp } from "react-icons/fa";

export default function WhatsAppButton() {

  const phone = "5508004445799"; // <-- coloque seu número
  const message = "Olá! Gostaria de saber mais sobre os planos da Acessa Net.";

  const link = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-float"
    >
      <FaWhatsapp />
      <span>Fale Conosco</span>
    </a>
  );
}