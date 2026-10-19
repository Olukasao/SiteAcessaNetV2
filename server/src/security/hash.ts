import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

interface ScryptOptions {
  N: number;
  r: number;
  p: number;
  maxmem: number;
}

/** Wrapper manual em vez de promisify(scrypt): promisify nao resolve bem o overload com opcoes. */
function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * HMAC-SHA256 com segredo do servidor. Usar sempre que o valor de entrada
 * tiver espaco de busca pequeno (ex.: CPF), onde um SHA-256 simples
 * permitiria a um atacante pre-calcular o hash de todos os valores
 * possiveis (11 digitos, ~10^11 combinacoes e menos ainda validas).
 */
export function hmacSha256(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function randomId(prefix: string) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

/** Token opaco de alta entropia para sessoes/segredos (crypto seguro, nunca Math.random). */
export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Codigo numerico de 6 digitos criptograficamente seguro (crypto.randomInt, nunca Math.random). */
export function randomOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
// scrypt exige maxmem >= ~128*N*r*p bytes; usamos uma folga generosa (4x)
// em vez do minimo exato, que na pratica estourava "memory limit exceeded".
const SCRYPT_MAX_MEM = Math.max(64 * 1024 * 1024, 512 * SCRYPT_PARAMS.N * SCRYPT_PARAMS.r * SCRYPT_PARAMS.p);

/**
 * Hash de senha com scrypt (custo de memoria/CPU, sal aleatorio por senha).
 * NUNCA usar sha256/hmacSha256 para senha -- sao hashes rapidos, feitos para
 * integridade/identificacao, nao para resistir a forca bruta offline. Os
 * parametros do scrypt vao codificados no proprio hash armazenado, entao
 * podem ser reforcados no futuro sem invalidar hashes antigos.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_MAX_MEM
  });

  return `scrypt:${SCRYPT_PARAMS.N}:${SCRYPT_PARAMS.r}:${SCRYPT_PARAMS.p}:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

/** Verifica senha em tempo constante contra um hash gerado por hashPassword. Nunca loga a senha ou o hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  if (!nRaw || !rRaw || !pRaw || !saltHex || !hashHex) {
    return false;
  }

  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");

  if (salt.length === 0 || expected.length === 0) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, expected.length, {
    N,
    r,
    p,
    maxmem: Math.max(SCRYPT_MAX_MEM, 512 * N * r * p)
  });

  if (derivedKey.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expected);
}
