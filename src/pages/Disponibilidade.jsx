import { useState, useEffect } from "react"
import "../styles/disponibilidade.css"
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap
} from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { Helmet } from "react-helmet-async";


// 🔥 move o mapa suavemente
function MoverMapa({ posicao }) {
    const map = useMap()

    useEffect(() => {
        map.flyTo(posicao, 16, { duration: 1.5 })
    }, [posicao])

    return null
}

export default function Disponibilidade() {

    const [cep, setCep] = useState("")
    const [posicao, setPosicao] = useState([-23.3217, -46.7269])
    const [resultado, setResultado] = useState(null)
    const [status, setStatus] = useState(null)
    const [endereco, setEndereco] = useState("")
    const [cidade, setCidade] = useState("")
    const [loading, setLoading] = useState(false)

    const cidadesAtendidas = [
        "Franco da Rocha",
        "Francisco Morato",
        "Caieiras",
        "Laranjeiras"
    ]

    // 🔤 normalizar texto (evita erro com acento)
    const normalizar = (texto) =>
        texto?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

    // 🎯 formatar CEP
    function formatarCep(valor) {
        valor = valor.replace(/\D/g, "")
        if (valor.length > 5) {
            return valor.replace(/^(\d{5})(\d{1,3})$/, "$1-$2")
        }
        return valor
    }

    // 🔎 buscar CEP + coordenadas
    async function buscarCep(valor) {

        const cepLimpo = valor.replace(/\D/g, "")
        setCep(formatarCep(valor))

        if (cepLimpo.length !== 8) return

        setLoading(true)

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
            const data = await res.json()

            if (data.erro) {
                setResultado("❌ CEP não encontrado")
                setStatus(null)
                setLoading(false)
                return
            }

            const enderecoCompleto = `${data.logradouro}, ${data.bairro}, ${data.localidade}`
            setEndereco(enderecoCompleto)
            setCidade(data.localidade)

            // 🌍 coordenadas
            const geo = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${enderecoCompleto}`
            )
            const geoData = await geo.json()

            if (geoData.length > 0) {
                setPosicao([
                    parseFloat(geoData[0].lat),
                    parseFloat(geoData[0].lon)
                ])
            }

        } catch {
            setResultado("Erro ao buscar endereço")
        }

        setLoading(false)
    }

    // ✅ verificar por cidade
    function verificar() {

        if (!cidade) {
            setResultado("Digite um CEP válido")
            return
        }

        const temCobertura = cidadesAtendidas.some(c =>
            normalizar(c) === normalizar(cidade)
        )

        if (temCobertura) {
            setResultado(`🎉 Temos cobertura em ${cidade}!`)
            setStatus("ok")
        } else {
            setResultado(`❌ Ainda não atendemos ${cidade}`)
            setStatus("no")
        }
    }


    const mensagem = `Olá, consultei meu CEP (${cep}) em ${cidade} e quero saber sobre os planos`

    return (
        <>
            <Helmet>
                <title>Consultar Disponibilidade de Internet | Acessanet Telecom</title>

                <meta
                    name="description"
                    content="Verifique se a internet fibra da Acessanet Telecom está disponível no seu endereço em Franco da Rocha e região. Consulte agora!"
                />

                {/* SEO básico */}
                <meta
                    name="keywords"
                    content="disponibilidade internet, cobertura fibra Franco da Rocha, consultar internet por endereço, Acessanet Telecom"
                />
                <meta name="author" content="Acessanet Telecom" />

                {/* Open Graph */}
                <meta property="og:title" content="Consultar Disponibilidade | Acessanet Telecom" />
                <meta
                    property="og:description"
                    content="Descubra se temos cobertura de internet fibra no seu endereço."
                />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://acessanet.com.br/disponibilidade" />
                
                <meta property="og:locale" content="pt_BR" />

                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Disponibilidade de Internet | Acessanet Telecom" />
                <meta
                    name="twitter:description"
                    content="Consulte a cobertura de internet fibra na sua região."
                />

                {/* Indexação */}
                <meta name="robots" content="index, follow" />
            </Helmet>
            <div className="disponibilidade">

                <div className="card">

                    <h2>Consulte disponibilidade</h2>
                    <p>Descubra se já atendemos sua região em segundos</p>

                    <div className="busca">

                        <input
                            placeholder="Digite seu CEP"
                            value={cep}
                            onChange={(e) => buscarCep(e.target.value)}
                            maxLength={9}
                        />

                        <button onClick={verificar}>
                            {loading ? "Buscando..." : "Verificar"}
                        </button>

                    </div>

                    {endereco && (
                        <div className="endereco">
                            📍 {endereco}
                        </div>
                    )}

                    {status === "ok" && (
                        <div className="resultado ok">
                            ✅ Cobertura disponível em {cidade}
                        </div>
                    )}

                    {status === "no" && (
                        <div className="resultado no">
                            🚧 Ainda não atendemos {cidade}
                        </div>
                    )}

                    {status && (
                        <a
                            href={`https://wa.me/5508004445799?text=${encodeURIComponent(mensagem)}`}
                            target="_blank"
                            className="whatsapp"
                        >
                            💬 Falar no WhatsApp
                        </a>
                    )}

                    <MapContainer center={posicao} zoom={15} className="mapa">

                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                        <MoverMapa posicao={posicao} />

                        <Marker position={posicao}>
                            <Popup>
                                📍 {endereco || "Localização do cliente"}
                            </Popup>
                        </Marker>

                    </MapContainer>

                </div>

            </div>
        </>
    )
}