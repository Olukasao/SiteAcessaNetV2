export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeIdentifier(value: string) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");

  if (isValidCpf(digits)) {
    return { type: "cpf" as const, value: digits };
  }

  return { type: "contrato" as const, value: digits };
}

export function isValidCpf(value: string) {
  const cpf = normalizeCpf(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digits = cpf.split("").map(Number);
  const first = calculateDigit(digits.slice(0, 9));
  const second = calculateDigit([...digits.slice(0, 9), first]);

  return first === digits[9] && second === digits[10];
}

function calculateDigit(numbers: number[]) {
  const sum = numbers.reduce((acc, digit, index) => acc + digit * (numbers.length + 1 - index), 0);
  const result = (sum * 10) % 11;
  return result === 10 ? 0 : result;
}

export function maskCpf(value: string) {
  const cpf = normalizeCpf(value);
  return `***.***.***-${cpf.slice(-2)}`;
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
