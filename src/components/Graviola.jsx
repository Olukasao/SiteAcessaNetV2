import "../styles/components-styles/graviola.css"
import logo from "../assets/graviola/logo.png"
import { useEffect, useRef, useState } from "react"
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
        link: "https://contaoutravez.com.br/",
        width: 216,
        height: 169,
    },
    {
        id: 2,
        name: "Clube de Cinema",
        logo: clubeCinemaLogo,
        link: "#",
        width: 182,
        height: 139,
    },
    {
        id: 3,
        name: "Máquina de Contos",
        logo: maquinaContosLogo,
        link: "https://www.maquinadecontos.com.br/",
        width: 184,
        height: 190,
    }
]

function useNearViewport(rootMargin = "700px") {
    const ref = useRef(null)
    const [isNearViewport, setIsNearViewport] = useState(false)

    useEffect(() => {
        if (isNearViewport) return undefined

        const element = ref.current
        if (!element) return undefined

        if (!("IntersectionObserver" in window)) {
            const timeoutId = window.setTimeout(() => setIsNearViewport(true), 0)
            return () => window.clearTimeout(timeoutId)
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsNearViewport(true)
                    observer.disconnect()
                }
            },
            { rootMargin }
        )

        observer.observe(element)

        return () => observer.disconnect()
    }, [isNearViewport, rootMargin])

    return [ref, isNearViewport]
}

export default function Graviola() {
    const [sectionRef, shouldLoadBooks] = useNearViewport()
    const [books, setBooks] = useState([])

    useEffect(() => {
        if (!shouldLoadBooks) return undefined

        let isMounted = true

        async function loadBooks() {
            const entries = Object.entries(booksModules)

            const imgs = await Promise.all(
                entries.map(async ([path, loader]) => {
                    const mod = await loader()
                    return { path, src: mod.default }
                })
            )

            if (isMounted) {
                setBooks(
                    imgs
                        .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
                        .map((item) => item.src)
                )
            }
        }

        loadBooks()

        return () => {
            isMounted = false
        }
    }, [shouldLoadBooks])

    return (
        <section className="graviola-hero" ref={sectionRef}>

            <div className="graviola-hero-wrap">

                <div className="graviola-hero-left">
                    <h2>Graviola</h2>

                    <p>
                        Descubra uma nova forma de ler livros digitais e explorar
                        conteúdos exclusivos.
                    </p>

                    <a href="https://www.gravioladigital.com.br/" target="_blank" rel="noopener noreferrer" className="btn-graviola">
                        Acessar plataforma
                    </a>
                </div>

                <div className="graviola-hero-right">
                    <div className="graviola-hero-box">
                        <img
                            src={logo}
                            alt="Graviola"
                            width="222"
                            height="256"
                            loading="lazy"
                            decoding="async"
                        />
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
                            target="_blank"
                            rel="noopener noreferrer"
                            className="logo-card"
                        >
                            <img
                                src={app.logo}
                                alt={app.name}
                                width={app.width}
                                height={app.height}
                                loading="lazy"
                                decoding="async"
                            />
                        </a>
                    ))}
                </div>

            </div>
            {/* LIVROS */}
            <div className="graviola-library-wrap">
                <div>
                    <h2>Confira nosso livros</h2>
                </div>

                <div className="graviola-library">
                    {!shouldLoadBooks ? (
                        Array.from({ length: 6 }).map((_, index) => (
                            <div className="book book--placeholder" key={index} aria-hidden="true" />
                        ))
                    ) : books.length === 0 ? (
                        <p>Carregando livros...</p>
                    ) : (
                        books.map((img) => (
                            <div className="book" key={img}>
                                <img
                                    src={img}
                                    width="160"
                                    height="220"
                                    loading="lazy"
                                    decoding="async"
                                    alt="Livro"
                                />
                            </div>
                        ))
                    )}
                </div>

            </div>
           

        </section>
    )
}
