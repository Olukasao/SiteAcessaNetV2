import { useState } from "react"
import "../styles/disponibilidade.css"
import { MapContainer, TileLayer, Marker } from "react-leaflet"
import "leaflet/dist/leaflet.css"

export default function Disponibilidade() {

    const [cep, setCep] = useState("")
    const [posicao, setPosicao] = useState([-23.3217, -46.7269])
    const [resultado, setResultado] = useState(null)

    async function buscarCep(valor) {

        setCep(valor)

        if (valor.length === 8) {

            try {

                const res = await fetch(`https://viacep.com.br/ws/${valor}/json/`)
                const data = await res.json()

                if (data.erro) {
                    setResultado("❌ CEP não encontrado")
                    return
                }

                const endereco = `${data.logradouro}, ${data.localidade}`

                const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${endereco}`)
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

        }

    }

    function verificar() {

        setResultado("🎉 Temos cobertura na sua região!")

    }

    return (

        <div className="disponibilidade">

            <div className="card-disponibilidade">

                <h2>Verifique a disponibilidade</h2>
                <p>Digite seu CEP para saber se temos cobertura.</p>

                <div className="busca-disponibilidade">

                    <input
                        placeholder="Digite seu CEP"
                        value={cep}
                        onChange={(e) => buscarCep(e.target.value)}
                    />

                    <button onClick={verificar}>
                        Verificar
                    </button>

                </div>

                {resultado && (
                    <div className="resultado">
                        {resultado}
                    </div>
                )}

                <MapContainer
                    center={posicao}
                    zoom={15}
                    className="mapa-disponibilidade"
                >

                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <Marker position={posicao} />

                </MapContainer>

            </div>

        </div>

    )
}