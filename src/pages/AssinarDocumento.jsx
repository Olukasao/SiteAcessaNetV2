import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { FaCheckCircle, FaEraser, FaFilePdf, FaSignature } from "react-icons/fa";
import "../styles/assinarDocumento.css";
import documentoModelo from "../assets/docs/CDE.pdf";

const initialFormData = {
  nome: "",
  documento: "",
  email: "",
  telefone: "",
};

function onlyNumbers(value) {
  return value.replace(/\D/g, "");
}

function formatCpfCnpj(value) {
  const numbers = onlyNumbers(value).slice(0, 14);

  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  return numbers
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatPhone(value) {
  const numbers = onlyNumbers(value).slice(0, 11);

  if (numbers.length <= 10) {
    return numbers
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }

  return numbers
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export default function AssinarDocumento() {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);

  const [formData, setFormData] = useState(initialFormData);
  const [accepted, setAccepted] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d");

    const prepareCanvas = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 2.8;
      context.strokeStyle = "#081833";
      context.fillStyle = "#081833";

      setHasSignature(false);
    };

    prepareCanvas();

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(prepareCanvas);
      observer.observe(canvas);

      return () => observer.disconnect();
    }

    window.addEventListener("resize", prepareCanvas);
    return () => window.removeEventListener("resize", prepareCanvas);
  }, []);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    let nextValue = value;

    if (name === "documento") {
      nextValue = formatCpfCnpj(value);
    }

    if (name === "telefone") {
      nextValue = formatPhone(value);
    }

    setFormData((currentData) => ({
      ...currentData,
      [name]: nextValue,
    }));
  };

  const getCanvasPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startSignature = (event) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const point = getCanvasPoint(event);

    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);

    isDrawingRef.current = true;
    lastPointRef.current = point;

    context.beginPath();
    context.arc(point.x, point.y, 1.6, 0, Math.PI * 2);
    context.fill();

    setFeedback("");
    setHasSignature(true);
  };

  const drawSignature = (event) => {
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const currentPoint = getCanvasPoint(event);
    const lastPoint = lastPointRef.current || currentPoint;

    event.preventDefault();

    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(currentPoint.x, currentPoint.y);
    context.stroke();

    lastPointRef.current = currentPoint;
    setHasSignature(true);
  };

  const stopSignature = (event) => {
    if (!isDrawingRef.current) return;

    event.preventDefault();
    canvasRef.current?.releasePointerCapture?.(event.pointerId);

    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const { width, height } = canvas.getBoundingClientRect();

    context.clearRect(0, 0, width, height);
    setFeedback("");
    setHasSignature(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!hasSignature) {
      setFeedback("Inclua sua assinatura no campo indicado antes de continuar.");
      return;
    }

    setFeedback("Documento assinado com sucesso no front-end. A integração com banco de dados ainda não foi ativada.");
  };

  return (
    <section className="assinar-documento">
      <Helmet>
        <title>Assinatura de Documento | Acessanet Telecom</title>
        <meta
          name="description"
          content="Página visual para assinatura eletrônica de documentos da Acessanet Telecom."
        />
        <meta property="og:title" content="Assinatura de Documento | Acessanet Telecom" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://acessanet.com.br/assinar-documento" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="assinar-card">
        <header className="assinar-card-header">
          <span className="assinar-eyebrow">Documento digital</span>
          <h1>
            <FaSignature />
            Assinatura de Documento
          </h1>
        </header>

        <form className="assinar-form" onSubmit={handleSubmit}>
          <div className="assinar-form-grid">
            <label>
              <span>Nome completo</span>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleFieldChange}
                placeholder="Digite seu nome completo"
                autoComplete="name"
                required
              />
            </label>

            <label>
              <span>CPF/CNPJ</span>
              <input
                type="text"
                name="documento"
                value={formData.documento}
                onChange={handleFieldChange}
                placeholder="000.000.000-00"
                inputMode="numeric"
                required
              />
            </label>

            <label>
              <span>E-mail</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleFieldChange}
                placeholder="seuemail@exemplo.com"
                autoComplete="email"
                required
              />
            </label>

            <label>
              <span>Telefone</span>
              <input
                type="tel"
                name="telefone"
                value={formData.telefone}
                onChange={handleFieldChange}
                placeholder="(00) 00000-0000"
                autoComplete="tel"
                inputMode="tel"
                required
              />
            </label>
          </div>

          <div className="assinar-workspace">
            <section className="assinar-document-section" aria-labelledby="documento-titulo">
              <div className="assinar-section-title">
                <FaFilePdf />
                <h2 id="documento-titulo">Visualização do PDF</h2>
              </div>

              <object
                className="assinar-pdf-viewer"
                data={documentoModelo}
                type="application/pdf"
                aria-label="Visualização do PDF para assinatura"
              >
                <div className="assinar-pdf-fallback">
                  <FaFilePdf />
                  <p>Seu navegador não exibiu o PDF nesta área.</p>
                  <a href={documentoModelo} target="_blank" rel="noreferrer">
                    Abrir PDF
                  </a>
                </div>
              </object>
            </section>

            <section className="assinar-signature-section" aria-labelledby="assinatura-titulo">
              <div className="assinar-section-title">
                <FaSignature />
                <h2 id="assinatura-titulo">Área de assinatura</h2>
              </div>

              <div className="assinar-canvas-wrap">
                <canvas
                  ref={canvasRef}
                  className="assinar-canvas"
                  aria-label="Campo para desenhar assinatura"
                  onPointerDown={startSignature}
                  onPointerMove={drawSignature}
                  onPointerUp={stopSignature}
                  onPointerCancel={stopSignature}
                  onPointerLeave={stopSignature}
                />
              </div>

              <button type="button" className="assinar-clear-button" onClick={clearSignature}>
                <FaEraser />
                Limpar assinatura
              </button>
            </section>
          </div>

          <label className="assinar-acceptance">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              required
            />
            <span>Li, conferi o documento e aceito assinar eletronicamente.</span>
          </label>

          <div className="assinar-submit-row">
            <button type="submit" className="assinar-submit-button">
              <FaCheckCircle />
              Assinar documento
            </button>
          </div>

          {feedback && (
            <p className={`assinar-feedback ${hasSignature && accepted ? "success" : "warning"}`}>
              {feedback}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
