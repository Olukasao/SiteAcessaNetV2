import "../styles/components-styles/appProvedor.css";
import apple from "../assets/apple.png"
import google from "../assets/google-play.png"

import { motion } from "framer-motion";
import logoAppProvedor from "../assets/AppProvedor.jpg"
import {
  FaMobileAlt,
  FaFileInvoice,
  FaWifi,
  FaHeadset,
  FaQrcode,
} from "react-icons/fa";
import { Link } from "react-router-dom";

export default function AppProvedor() {
  return (
    <section className="app-provedor">

      <div className="app-container">

        {/* IMAGEM */}
        <motion.div
          className="app-image"
          initial={{ opacity: 0, x: -80 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <img src={logoAppProvedor} />
        </motion.div>

        {/* TEXTO */}
        <motion.div
          className="app-info"
          initial={{ opacity: 0, x: 80 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >

          <span className="badge">
            <FaMobileAlt /> APP DO CLIENTE
          </span>

          <h2>Seu provedor na palma da mão</h2>

          <p>
            Resolva tudo pelo aplicativo: faturas, suporte,
            pagamentos e controle total da sua internet.
          </p>

          <ul className="app-beneficios">
            <li><FaFileInvoice /> Segunda via de fatura</li>
            <li><FaQrcode /> Pagamento via Pix</li>
            <li><FaWifi /> Teste de velocidade</li>
            <li><FaHeadset /> Suporte imediato</li>
          </ul>

          <div className="store-buttons">
            <a
              href="https://play.google.com/store/apps/details?id=br.net.tsmx.meuappprovedor"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src={google} alt="Google Play Store" />
            </a>

            <a
              href="https://apps.apple.com/br/app/meuappprovedor/id1637448837"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src={apple} height ="200"alt="Apple App Store" />
            </a>
          </div>

        </motion.div>

      </div>
    </section>
  );
}