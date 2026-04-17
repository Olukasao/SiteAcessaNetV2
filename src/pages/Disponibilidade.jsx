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

    // 💬 mensagem WhatsApp
    const mensagem = `Olá, consultei meu CEP (${cep}) em ${cidade} e quero saber sobre os planos`

    return (
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
                        href={`https://wa.me/5511999999999?text=${encodeURIComponent(mensagem)}`}
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
    )
}