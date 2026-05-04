import "../styles/components-styles/header.css";
import logo from "../assets/logo.png";
import { Link, NavLink } from "react-router-dom";
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
          <a href="https://acessanet.sgp.net.br/accounts/central/login">
            Área do Cliente
          </a>

          <NavLink to="/planos" className={({ isActive }) => isActive ? "active" : ""}>
            Planos
          </NavLink>

          <NavLink to="/contratos" className={({ isActive }) => isActive ? "active" : ""}>
            Contratos
          </NavLink>

          <NavLink to="/historia" className={({ isActive }) => isActive ? "active" : ""}>
            Nossa História
          </NavLink>

          <NavLink to="/trabalhe-conosco" className={({ isActive }) => isActive ? "active" : ""}>
            Trabalhe Conosco
          </NavLink>

          <NavLink to="/contatos" className={({ isActive }) => isActive ? "active" : ""}>
            Contatos
          </NavLink>

          <NavLink to="/lgpd" className={({ isActive }) => isActive ? "active" : ""}>
            LGPD
          </NavLink>

          <NavLink to="/disponibilidade" className={({ isActive }) => isActive ? "active" : ""}>
            Disponibilidade
          </NavLink>
        </nav>

        {/* SOCIAL */}
        <div className="social">
          <a href="https://www.facebook.com/people/Acessanet/61564243311224/" target="_black" style={{ textDecoration: "None", color: "white" }}>
            <FaFacebookF />

          </a>
          <a href="https://www.instagram.com/acessanet_/" target="_black" style={{ textDecoration: "None", color: "white" }}>
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