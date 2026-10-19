// Teste ponta a ponta do RADIUS sem AP: um "AP falso" manda Access-Request de
// verdade (PAP, com segredo) por UDP, e o site e simulado por um servidor HTTP local.
import { test } from "node:test";
import assert from "node:assert/strict";
import dgram from "node:dgram";
import http from "node:http";
import radius from "radius";
import { handleAccessRequest, start } from "./index.mjs";

const SECRET = "segredo-do-ap-bem-longo";
const TOKEN = "t".repeat(40);

function fakeSite() {
  const calls = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      calls.push({ auth: req.headers.authorization, body: JSON.parse(body) });
      const { username, password } = JSON.parse(body);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(username === "wifi_ok" && password === "senha-certa" ? { accept: true, sessionTimeout: 7200 } : { accept: false }));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, calls, url: `http://127.0.0.1:${server.address().port}` })));
}

function sendRequest(port, username, password, secret = SECRET) {
  return new Promise((resolve) => {
    const client = dgram.createSocket("udp4");
    const packet = radius.encode({
      code: "Access-Request",
      secret,
      identifier: 7,
      attributes: [
        ["User-Name", username],
        ["User-Password", password],
        ["Calling-Station-Id", "11-22-33-44-55-66"],
        ["NAS-IP-Address", "192.168.10.1"]
      ]
    });
    const timer = setTimeout(() => {
      client.close();
      resolve(null);
    }, 1500);
    client.on("message", (message) => {
      clearTimeout(timer);
      client.close();
      resolve(radius.decode({ packet: message, secret }));
    });
    client.send(packet, port, "127.0.0.1");
  });
}

test("AP falso -> RADIUS -> site: aceita credencial certa com Session-Timeout, recusa errada, ignora segredo errado", async () => {
  const site = await fakeSite();
  const sockets = start({ secret: SECRET, token: TOKEN, apiUrl: site.url, clients: [], authPort: 0, acctPort: 0, timeoutMs: 2000 });
  await new Promise((resolve) => sockets.auth.once("listening", resolve));
  const port = sockets.auth.address().port;
  try {
    const ok = await sendRequest(port, "wifi_ok", "senha-certa");
    assert.equal(ok.code, "Access-Accept");
    assert.equal(ok.attributes["Session-Timeout"], 7200);
    assert.equal(site.calls[0].auth, `Bearer ${TOKEN}`);
    assert.equal(site.calls[0].body.clientMac, "11-22-33-44-55-66");
    assert.equal(site.calls[0].body.password, "senha-certa"); // PAP decodificado com o segredo

    const bad = await sendRequest(port, "wifi_ok", "errada");
    assert.equal(bad.code, "Access-Reject");

    // Segredo diferente: a senha decodifica errado -> site recusa (nunca aceita).
    const wrongSecret = await sendRequest(port, "wifi_ok", "senha-certa", "outro-segredo-qualquer");
    assert.ok(wrongSecret === null || wrongSecret.code !== "Access-Accept");
  } finally {
    sockets.auth.close();
    sockets.acct.close();
    site.server.close();
  }
});

test("site fora do ar = recusa (nunca libera no escuro)", async () => {
  const config = { secret: SECRET, token: TOKEN, apiUrl: "http://127.0.0.1:1", timeoutMs: 500 };
  const result = await handleAccessRequest(config, { attributes: { "User-Name": "wifi_ok", "User-Password": "senha-certa" } });
  assert.equal(result.code, "Access-Reject");
});

test("sem usuário ou senha = recusa sem chamar o site", async () => {
  let called = false;
  const result = await handleAccessRequest({}, { attributes: { "User-Name": "x" } }, async () => {
    called = true;
    return { accept: true };
  });
  assert.equal(result.code, "Access-Reject");
  assert.equal(called, false);
});
