import { Routes, Route } from "react-router-dom";

import Home from "../pages/HomePage";
import Contratos from "../pages/Contratos";
import Historia from "../pages/Historia";
import TrabalheConosco from "../pages/TrabalheConosco";
import Contatos from "../pages/Contatos";
import Planos from "../pages/Planos";

export default function AppRoutes() {

    
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/planos" element={<Planos />} />
            <Route path="/historia" element={<Historia />} />
            <Route path="/trabalhe-conosco" element={<TrabalheConosco />} />
            <Route path="/contatos" element={<Contatos />} />

            <Route path="/contratos" element={<Contratos />} />
        </Routes>
    );
}