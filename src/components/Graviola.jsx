import "../styles/components-styles/graviola.css"
import logo from "../assets/graviola/logo.png"
import { useEffect, useState } from "react"
import contaOutraVezLogo from "../assets/graviola/contaOutraVez.png"
import clubeCinemaLogo from "../assets/graviola/clubeCinema.png"
import maquinaContosLogo from "../assets/graviola/maquinaContos.png"

const booksModules = import.meta.glob(
    "../assets/graviola/books/*.{png,jpg,jpeg,webp}"
)
const apps = [
    {
        id: 1,
        name: "Conta Outra Vez",
        logo: contaOutraVezLogo,
        link: "#"
    },
    {
        id: 2,
        name: "Clube de Cinema",
        logo: clubeCinemaLogo,
        link: "#"
    },
    {
        id: 3,
        name: "Máquina de Contos",
        logo: maquinaContosLogo,
        link: "#"
    }
]

export default function Graviola() {
    const [books, setBooks] = useState([])

    useEffect(() => {
        async function loadBooks() {
            const loaders = Object.values(booksModules)

            const imgs = await Promise.all(
                loaders.map(async (loader) => {
                    const mod = await loader()
                    return mod.default
                })
            )

            setBooks(imgs)
        }

        loadBooks()
    }, [])

    return (
        <section className="graviola-hero">

            <div className="graviola-hero-wrap">

                <div className="graviola-hero-left">
                    <h2>Graviola</h2>

                    <p>
                        Descubra uma nova forma de ler livros digitais e explorar
                        conteúdos exclusivos.
                    </p>

                    <a href="#" className="btn-graviola">
                        Acessar plataforma
                    </a>
                </div>

                <div className="graviola-hero-right">
                    <div className="graviola-hero-box">
                        <img src={logo} alt="Graviola" />
                    </div>
                </div>

            </div>

            <div className="graviola-apps-logos">

                <h2>Conheça nossos apps</h2>

                <div className="logos-grid">
                    {apps.map((app) => (
                        <a
                            href={app.link}
                            key={app.id}
                            className="logo-card"
                        >
                            <img src={app.logo} alt={app.name} />
                        </a>
                    ))}
                </div>

            </div>
            {/* LIVROS */}
            <div className="graviola-library-wrap">
                <div>
                    <h2>Explore os livros</h2>
                </div>

                <div className="graviola-library">
                    {books.length === 0 ? (
                        <p>Carregando livros...</p>
                    ) : (
                        books.map((img, index) => (
                            <div className="book" key={img}>
                                <img src={img} loading="lazy" alt="Livro" />
                            </div>
                        ))
                    )}
                </div>

            </div>
            <div className="library-more">
                <p>Explore uma biblioteca completa com muito mais conteúdos.</p>

                <a href="#" className="btn-graviola">
                    Ver todos os livros
                </a>
            </div>

        </section>
    )
}