import "../styles/components-styles/header.css";
import logo from "../assets/logo acessa (2).png";
import { Link, NavLink } from "react-router-dom";
import { FaBars, FaTimes } from "react-icons/fa";
import { useState } from "react";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="header-logo-link" onClick={closeMenu}>
          <img
            src={logo}
            alt="Acessanet"
            className="logo"
            width="4240"
            height="1545"
            decoding="async"
          />
        </Link>

        <div className={`mobile-nav-panel ${menuOpen ? "active" : ""}`}>
          <nav className="menu">
            <a href="/#inicio" onClick={closeMenu}>
              Início
            </a>

            <NavLink to="/planos" onClick={closeMenu}>
              Planos
            </NavLink>

            <NavLink to="/contatos" onClick={closeMenu}>
              Atendimento
            </NavLink>

            <NavLink to="/cliente/guia-wifi" onClick={closeMenu}>
              Boas Práticas Wi‑Fi
            </NavLink>
          </nav>

          <div className="header-actions">
            <Link className="client-link" to="/cliente" onClick={closeMenu}>
              Central do Assinante
            </Link>

            <Link className="header-cta" to="/planos">
              Conheça os planos
            </Link>
          </div>
        </div>

        <button
          className="hamburger"
          type="button"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>
    </header>
  );
}
