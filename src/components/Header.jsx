import "../styles/components-styles/header.css";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaBars, FaTimes } from "react-icons/fa";
import { useState } from "react";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header">
      <div className="header-container">

        {/* LOGO */}
        <Link to="/">
          <img src={logo} alt="Acessa Net" className="logo" />
        </Link>

        {/* MENU */}
        <nav className={`menu ${menuOpen ? "active" : ""}`}>
          <Link to="https://acessanet.sgp.net.br/accounts/central/login">Área do Cliente</Link>
          <Link to="/planos">Planos</Link>
          <Link to="/contratos">Contratos</Link>
          <Link to="/historia">Nossa História</Link>
          <Link to="/trabalhe-conosco">Trabalhe Conosco</Link>
          <Link to="/contatos">Contatos</Link>
          <Link to="/lgpd">LGPD</Link>
          <Link to="/disponibilidade">Disponibilidade</Link>
        </nav>

        {/* SOCIAL */}
        <div className="social">
          <a href="https://www.facebook.com/people/Acessanet/61564243311224/" style={{textDecoration:"None",color:"white"}}>
            <FaFacebookF />

          </a>
          <a href="https://www.instagram.com/acessanet_/" style={{textDecoration:"None",color:"white"}}>
            <FaInstagram />
          </a>
        </div>

        {/* HAMBURGER */}
        <div
          className="hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <FaTimes /> : <FaBars />}
        </div>

      </div>
    </header>
  );
}