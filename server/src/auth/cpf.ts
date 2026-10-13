export type BrazilianDocumentType = "cpf" | "cnpj";

export function normalizeDocument(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeCpf(value: string) {
  return normalizeDocument(value);
}

export function getDocumentType(value: string): BrazilianDocumentType | null {
  const digits = normalizeDocument(value);

  if (digits.length === 11) return "cpf";
  if (digits.length === 14) return "cnpj";

  return null;
}

export function normalizeIdentifier(value: string) {
  const digits = normalizeDocument(value);
  const documentType = getDocumentType(digits);

  if (documentType && isValidDocument(digits)) {
    return { type: documentType, value: digits };
  }

  return { type: "contrato" as const, value: digits };
}

export function isValidDocument(value: string) {
  const type = getDocumentType(value);

  if (type === "cpf") return isValidCpf(value);
  if (type === "cnpj") return isValidCnpj(value);

  return false;
}

export function isValidCpf(value: string) {
  const cpf = normalizeDocument(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digits = cpf.split("").map(Number);
  const first = calculateCpfDigit(digits.slice(0, 9));
  const second = calculateCpfDigit([...digits.slice(0, 9), first]);

  return first === digits[9] && second === digits[10];
}

export function isValidCnpj(value: string) {
  const cnpj = normalizeDocument(value);

  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const digits = cnpj.split("").map(Number);
  const first = calculateCnpjDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateCnpjDigit([...digits.slice(0, 12), first], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return first === digits[12] && second === digits[13];
}

function calculateCpfDigit(numbers: number[]) {
  const sum = numbers.reduce((acc, digit, index) => acc + digit * (numbers.length + 1 - index), 0);
  const result = (sum * 10) % 11;
  return result === 10 ? 0 : result;
}

function calculateCnpjDigit(numbers: number[], weights: number[]) {
  const sum = numbers.reduce((acc, digit, index) => acc + digit * (weights[index] ?? 0), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function maskCpf(value: string) {
  const cpf = normalizeDocument(value);
  return `***.***.***-${cpf.slice(-2)}`;
}

export function maskCnpj(value: string) {
  const cnpj = normalizeDocument(value);
  return `**.***.***/****-${cnpj.slice(-2)}`;
}

export function maskDocument(value: string) {
  const digits = normalizeDocument(value);
  return getDocumentType(digits) === "cnpj" ? maskCnpj(digits) : maskCpf(digits);
}

/** "joao.silva@empresa.com" -> "jo***@empresa.com". Nunca expor o e-mail completo em resposta de API. */
export function maskEmail(value: string) {
  const [localPart, domain] = value.split("@");
  if (!localPart || !domain) {
    return "";
  }

  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}***@${domain}`;
}

export function maskPhone(value: string) {
  const phone = value.replace(/\D/g, "");
  const ddd = phone.slice(0, 2) || "00";
  const suffix = phone.slice(-4) || "0000";
  return `(${ddd}) *****-${suffix}`;
}

export function normalizeBrazilianPhone(value: string) {
  let phone = value.replace(/\D/g, "");
  if (phone.startsWith("55") && (phone.length === 12 || phone.length === 13)) {
    phone = phone.slice(2);
  }

  return phone.length === 10 || phone.length === 11 ? phone : "";
}

export function formatBrazilianPhone(value: string) {
  const phone = normalizeBrazilianPhone(value);
  if (!phone) {
    return "";
  }

  const ddd = phone.slice(0, 2);
  const localNumber = phone.slice(2);
  const splitAt = localNumber.length === 9 ? 5 : 4;
  return `(${ddd}) ${localNumber.slice(0, splitAt)}-${localNumber.slice(splitAt)}`;
}
