import { useState } from "react";
import "../styles/clienteMundiale.css";

export default function ClienteMundiale() {
    const [form, setForm] = useState({
        nome: "",
        rg: "",
        cpf: "",
        cep: "",
        email: "",
        telefone: "",
        endereco: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: ""
    });

    // 🔹 Máscara CPF
    function maskCPF(value) {
        return value
            .replace(/\D/g, "")
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d{1,2})/, "$1-$2")
            .replace(/(-\d{2})\d+?$/, "$1");
    }

    function maskCEP(value) {
        return value
            .replace(/\D/g, "")
            .replace(/(\d{5})(\d)/, "$1-$2")
            .replace(/(-\d{3})\d+?$/, "$1");
    }


    function maskPhone(value) {
        return value
            .replace(/\D/g, "")
            .replace(/(\d{2})(\d)/, "($1) $2")
            .replace(/(\d{5})(\d)/, "$1-$2")
            .replace(/(-\d{4})\d+?$/, "$1");
    }
    function maskRG(value) {
        return value
            .replace(/\D/g, "")
            .replace(/(\d{2})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d{1})/, "$1-$2")
            .replace(/(-\d{1})\d+?$/, "$1");
    }

    function handleChange(e) {
        const { name, value } = e.target;

        let newValue = value;

        if (name === "cpf") newValue = maskCPF(value);
        if (name === "cep") newValue = maskCEP(value);
        if (name === "telefone") newValue = maskPhone(value);
        if (name === "rg") newValue = maskRG(value);
        setForm({ ...form, [name]: newValue });
    }

    function validarForm() {
        const cpf = form.cpf.replace(/\D/g, "");
        const cep = form.cep.replace(/\D/g, "");

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!form.nome) return "Nome obrigatório";
        if (!emailRegex.test(form.email)) return "E-mail inválido";
        if (cpf.length !== 11) return "CPF inválido";
        if (cep.length !== 8) return "CEP inválido";
        if (!form.telefone || form.telefone.replace(/\D/g, "").length < 10)
            return "Telefone inválido";

        return null;
    }

    async function trazerCEP() {
        const cepLimpo = form.cep.replace(/\D/g, "");

        if (cepLimpo.length !== 8) return;

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            const data = await res.json();

            if (!data.erro) {
                setForm(prev => ({
                    ...prev,
                    endereco: data.logradouro || "",
                    bairro: data.bairro || "",
                    cidade: data.localidade || "",
                    estado: data.uf || ""
                }));
            }
        } catch (err) {
            console.error("Erro ao buscar CEP");
        }
    }

    function enviarWhats() {
        const erro = validarForm();
        if (erro) {
            alert(erro);
            return;
        }

        const mensagem = `Olá, meu nome é ${form.nome}
E-mail: ${form.email}
Telefone: ${form.telefone}

RG: ${form.rg}
CPF: ${form.cpf}

Endereço:
${form.endereco}, ${form.numero}
${form.complemento || ""}
${form.bairro}
${form.cidade} - ${form.estado}
CEP: ${form.cep}`;

        const numero = "5508004445799";

        const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;

        window.open(url, "_blank");
    }

    return (
        <div className="container-form-mundiale">
            <div className="form-mundiale">
                <div>Dados Mundiale</div>

                <div>
                    <label>Nome</label>
                    <input name="nome" value={form.nome} onChange={handleChange} />
                </div>
                <div>
                    <label>E-mail</label>
                    <input name="email" value={form.email} onChange={handleChange} />
                </div>

                <div>
                    <label>Telefone</label>
                    <input
                        name="telefone"
                        value={form.telefone}
                        onChange={handleChange}
                        maxLength={15}
                    />
                </div>
                <div>
                    <label>RG</label>
                    <input name="rg" value={form.rg} onChange={handleChange} />
                </div>


                <div>
                    <label>CPF</label>
                    <input name="cpf" value={form.cpf} onChange={handleChange} maxLength={14} />
                </div>

                <div>
                    <label>CEP</label>
                    <input
                        name="cep"
                        value={form.cep}
                        onChange={handleChange}
                        onBlur={trazerCEP}
                        maxLength={9}
                    />
                </div>

                <div>
                    <label>Endereço</label>
                    <input name="endereco" value={form.endereco} onChange={handleChange} />
                </div>

                <div>
                    <label>Número</label>
                    <input name="numero" value={form.numero} onChange={handleChange} />
                </div>

                <div>
                    <label>Complemento</label>
                    <input name="complemento" value={form.complemento} onChange={handleChange} />
                </div>

                <div>
                    <label>Bairro</label>
                    <input name="bairro" value={form.bairro} onChange={handleChange} />
                </div>

                <div>
                    <label>Cidade</label>
                    <input name="cidade" value={form.cidade} onChange={handleChange} />
                </div>

                <div>
                    <label>Estado</label>
                    <input name="estado" value={form.estado} onChange={handleChange} />

                </div>

                <button onClick={enviarWhats}>Enviar</button>
            </div>
        </div>
    );
}