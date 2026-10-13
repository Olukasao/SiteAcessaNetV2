import { useEffect } from "react";
import Hero from "../sections/Hero";
import PlansSection from "../sections/PlansSection";
import Residencial from "../sections/Residencial";
import Entretenimento from "../sections/Entretenimento";
import Empresas from "../sections/Empresas";
import CoverageBand from "../sections/CoverageBand";
import Central from "../sections/Central";

export default function Home() {
  useEffect(() => {
    document.title = "AcessaNet — Internet fibra óptica | Cada mundo. Uma conexão.";
  }, []);
  return (
    <>
      <Hero />
      <PlansSection />
      <Residencial />
      <Entretenimento />
      <CoverageBand />
      <Empresas />
      <Central />
    </>
  );
}
