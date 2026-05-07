import "./FloatingButton.css";
import { useNavigate } from "react-router-dom";

export default function FloatingButton({ text = "Ver promoções" }) {
  const navigate = useNavigate();

  const goToPromocoes = () => {
    navigate("/planos#ofertas-tema");
  };

  return (
    <button type="button" className="floating-button" onClick={goToPromocoes}>
      {text}
    </button>
  );
}
