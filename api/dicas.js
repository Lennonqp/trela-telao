// Dicas do app por notificação: uma a cada 1h30, sempre uma diferente, só pra quem abriu o app na noite.
// Não tem agendador: o telão (e o app aberto) chamam POST /api/dicas a cada 10 min e aqui a gente decide
// se já está na hora. Uma transação em config/dicasPush garante que ninguém manda duas vezes.
const admin = require("firebase-admin");

// Mesmo texto das dicas do telão (comum.js). "notificacoes" fica de fora: quem recebe já ativou.
const DICAS = [
  { k: "crush", titulo: "Tá de olho em alguém?", texto: "Marca o crush secreto em Quem tá no Trela, no app. Só avisa se os dois marcarem." },
  { k: "drink", precisaCardapio: true, titulo: "Quer oferecer um drink pra alguém?", texto: "Manda o convite pelo app. Se a pessoa aceitar, tu pega no balcão." },
  { k: "anel", titulo: "Aberto pra conhecer gente?", texto: "Liga o anel dourado no menu do app." },
  { k: "encara", titulo: "Encara ou Bebe", texto: "Chama teus amigos do app pra jogar, cada um no seu celular." },
  { k: "cardapio", precisaCardapio: true, titulo: "O cardápio do Trela tá no app", texto: "Com os preços de 500 e 700 ml." }
];
const INTERVALO = 90 * 60 * 1000;
const BASES = ["/", "/teste/"];

// Hora de Brasília (sem horário de verão desde 2019): a noite vira às 6h
function agoraBrasil(ms) { return new Date((ms || Date.now()) - 3 * 3600 * 1000); }
function noiteDe(ms) {
  const b = agoraBrasil(ms);
  if (b.getUTCHours() < 6) b.setUTCDate(b.getUTCDate() - 1);
  return b.toISOString().slice(0, 10);
}
function inicioDaNoiteMs(ms) {
  const n = noiteDe(ms);                                  // "AAAA-MM-DD" da noite
  return Date.parse(n + "T06:00:00-03:00");
}
// Só manda das 18h às 4h (horário do bar)
function horaDeMandar(ms) { const h = agoraBrasil(ms).getUTCHours(); return h >= 18 || h < 4; }

function iniciarAdmin() {
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return admin;
}

// Decide (numa transação) se é hora e qual dica vai. Devolve a dica ou null.
async function reservarDica(db, agora, temCardapio) {
  const ref = db.doc("config/dicasPush");
  return db.runTransaction(async t => {
    const s = await t.get(ref), d = s.exists ? s.data() : {};
    const noite = noiteDe(agora);
    const enviadas = d.noite === noite ? (d.enviadas || []) : [];
    const ultima = d.noite === noite ? (d.ultima || 0) : 0;
    if (!horaDeMandar(agora) || agora - ultima < INTERVALO) return null;
    const dica = DICAS.find(x => !enviadas.includes(x.k) && (!x.precisaCardapio || temCardapio));
    if (!dica) return null;                                // já mandou todas as dicas desta noite
    t.set(ref, { noite, enviadas: enviadas.concat([dica.k]), ultima: agora });
    return dica;
  });
}

async function mandarDica(adm, db, dica, base, agora) {
  const desde = adm.firestore.Timestamp.fromMillis(inicioDaNoiteMs(agora));
  const pessoas = await db.collection("usuarios").where("ultimoAcesso", ">=", desde).get();
  const tokens = [];
  for (const p of pessoas.docs) {
    const ap = await db.collection("tokens").doc(p.id).collection("aparelhos").get();
    ap.docs.forEach(a => tokens.push({ dono: p.id, t: a.id }));
  }
  let enviados = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const lote = tokens.slice(i, i + 500);
    const r = await adm.messaging().sendEachForMulticast({
      tokens: lote.map(x => x.t),
      data: { titulo: dica.titulo, texto: dica.texto, url: base, tag: "dica" },
      webpush: { headers: { Urgency: "normal", TTL: "1800" } }
    });
    enviados += r.successCount;
    await Promise.all(r.responses.map((x, j) => {
      const c = x.error && x.error.code;
      if (c === "messaging/registration-token-not-registered" || c === "messaging/invalid-registration-token") return db.collection("tokens").doc(lote[j].dono).collection("aparelhos").doc(lote[j].t).delete().catch(() => {});
      return null;
    }));
  }
  return { pessoas: pessoas.size, aparelhos: tokens.length, enviados };
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(200).json({ servidor: "ok", chavePrivadaNoVercel: false });
    try {
      const d = await iniciarAdmin().firestore().doc("config/dicasPush").get();
      const x = d.exists ? d.data() : {};
      return res.status(200).json({ servidor: "ok", chavePrivadaNoVercel: true, noite: x.noite || null, enviadasNaNoite: x.noite === noiteDe() ? (x.enviadas || []) : [] });
    } catch (e) { return res.status(200).json({ servidor: "ok", chavePrivadaNoVercel: true, erro: "não deu pra ler o banco" }); }
  }
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(503).json({ erro: "falta a chave FIREBASE_SERVICE_ACCOUNT no Vercel" });
  let adm;
  try { adm = iniciarAdmin(); } catch (e) { return res.status(500).json({ erro: "chave FIREBASE_SERVICE_ACCOUNT inválida" }); }
  try { await adm.auth().verifyIdToken(String(req.headers.authorization || "").replace(/^Bearer\s+/i, "")); }
  catch (e) { return res.status(401).json({ erro: "não autenticado" }); }
  let pedido = req.body || {};
  if (typeof pedido === "string") { try { pedido = JSON.parse(pedido); } catch (e) { pedido = {}; } }
  const base = BASES.includes(pedido.base) ? pedido.base : "/";
  try {
    const db = adm.firestore(), agora = Date.now();
    const cfg = await db.doc("config/cardapio").get();
    const temCardapio = cfg.exists && cfg.data().ativo === true && !(await db.collection("cardapio").limit(1).get()).empty;
    const dica = await reservarDica(db, agora, temCardapio);
    if (!dica) return res.status(200).json({ ok: true, mandou: false });
    const r = await mandarDica(adm, db, dica, base, agora);
    return res.status(200).json({ ok: true, mandou: dica.k, ...r });
  } catch (e) {
    console.error("[dicas]", e);
    return res.status(500).json({ erro: "falhou" });
  }
};
module.exports.noiteDe = noiteDe;
module.exports.inicioDaNoiteMs = inicioDaNoiteMs;
module.exports.horaDeMandar = horaDeMandar;
module.exports.reservarDica = reservarDica;
module.exports.DICAS = DICAS;
