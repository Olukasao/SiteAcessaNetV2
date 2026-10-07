import logoTemSaude from "../assets/temSaude.png";
import logoVamoLe from "../assets/graviola/logo.png";
import logoWatch from "../assets/watchTV.jpg";

const planosData = [
  {
    nome: "700 Mbps",
    preco: "114,99",
    destaque: false,
    cardClass: "card-700",
    beneficios: ["Internet Fibra Óptica", "App Livros", "Globoplay"],
    servicos: [{ src: logoVamoLe, fundo: true, nome: "Graviola Digital" }],
  },
  {
    nome: "800 Mbps",
    preco: "169,99",
    destaque: true,
    cardClass: "card-800",
    beneficios: [
      "Streaming da Watch TV com Premiere",
      "ESPN + SporTV",
      "Telemedicina",
      "App Livros",
      "Globoplay",
    ],
    servicos: [
      { src: logoTemSaude, fundo: false, nome: "Tem Saúde" },
      { src: logoWatch, fundo: false, nome: "Watch TV" },
      { src: logoVamoLe, fundo: true, nome: "Graviola Digital" },
    ],
  },
];

export default planosData;
