// Manda notificação pro celular (Firebase Cloud Messaging).
// O app chama POST /api/avisar depois de gravar algo (mensagem, drink, match...).
// Aqui a gente NÃO confia no que o app mandou: confere no banco quem fez o quê,
// decide pra quem vai e escreve o texto. Cada aviso só sai uma vez (coleção "enviados").
//
// Precisa da variável FIREBASE_SERVICE_ACCOUNT no Vercel (o JSON da conta de serviço do Firebase).
const admin = require("firebase-admin");

function iniciarAdmin() {
  if (!admin.apps.length) {
    const conta = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(conta) });
  }
  return admin;
}

const corta = (t, n) => { t = String(t || ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const BASES = ["/", "/teste/"];

// Monta a lista de avisos { para, titulo, texto, caminho, tag, chave } a partir do pedido
async function montarAvisos(db, uid, pedido) {
  const tipo = String(pedido.tipo || "");
  const ler = async caminho => { const s = await db.doc(caminho).get(); return s.exists ? s.data() : null; };
  const nomeDe = async u => ((await ler("usuarios/" + u)) || {}).nome || "Alguém";
  const id = String(pedido.id || "").replace(/\//g, "");

  if (tipo === "mensagem") {
    const par = String(pedido.par || "").replace(/\//g, ""), membros = par.split("_");
    if (membros.length !== 2 || !membros.includes(uid) || !id) return [];
    const m = await ler("conversas/" + par + "/mensagens/" + id);
    if (!m || m.de !== uid) return [];
    const outro = membros.find(x => x !== uid);
    return [{ para: outro, titulo: await nomeDe(uid), texto: m.fotoId ? "Mandou uma foto. Abre o Trela pra ver." : corta(m.texto, 110), caminho: "", tag: "chat-" + par, chave: "msg_" + id }];
  }
  if (tipo === "drink") {
    const d = id && await ler("drinks/" + id); if (!d) return [];
    if (d.status === "enviado" && d.de === uid)
      return [{ para: d.para, titulo: corta(d.deNome, 30) + " quer te pagar um drink", texto: corta(d.itemNome, 80) + ". Abre o Trela pra aceitar ou não.", caminho: "", tag: "drink-" + id, chave: "drink_" + id + "_enviado" }];
    if (d.status === "aceito" && d.para === uid)
      return [{ para: d.de, titulo: corta(d.paraNome, 30) + " aceitou teu drink!", texto: "Pega o " + corta(d.itemNome, 60) + " no balcão e leva até " + corta(d.paraNome, 30) + ".", caminho: "", tag: "drink-" + id, chave: "drink_" + id + "_aceito" }];
    if (d.status === "recusado" && d.para === uid)
      return [{ para: d.de, titulo: "Teu convite de drink não rolou", texto: "Fica pra próxima!", caminho: "", tag: "drink-" + id, chave: "drink_" + id + "_recusado" }];
    return [];
  }
  if (tipo === "match") {
    const m = id && await ler("matches/" + id);
    if (!m || !(m.membros || []).includes(uid)) return [];
    const outro = m.membros.find(x => x !== uid);
    const quando = m.criado && m.criado.toMillis ? m.criado.toMillis() : 0;
    return [{ para: outro, titulo: "Deu match!", texto: "Tu e " + (await nomeDe(uid)) + " marcaram interesse um no outro. Bora conversar?", caminho: "", tag: "match-" + id, chave: "match_" + id + "_" + quando }];
  }
  if (tipo === "interesse") {   // "Tenho interesse": avisa a pessoa marcada dizendo quem foi
    const i = id && await ler("interesses/" + id);
    if (!i || i.de !== uid || !i.para || i.para === uid) return [];
    // os dois já marcaram: quem avisa é o "Deu match!"
    const volta = await ler("interesses/" + i.para + "_" + uid);
    if (volta) return [];
    const quando = i.criado && i.criado.toMillis ? i.criado.toMillis() : 0;
    const nome = await nomeDe(uid);
    return [{ para: i.para, titulo: corta(nome, 30) + " tem interesse em ti", texto: "Abre o perfil e marca \"Tenho interesse\" de volta pra dar match.", caminho: "", tag: "interesse-" + id, chave: "interesse_" + id + "_" + quando }];
  }
  if (tipo === "reserva") {   // a equipe confirmou ou recusou uma reserva de mesa
    const r = id && await ler("reservas/" + id);
    if (!r || !(await ler("equipe/" + uid))) return [];
    const dia = String(r.data || "").split("-").reverse().slice(0, 2).join("/");
    const quando = dia + " às " + (r.hora || "") + ", " + r.pessoas + (r.pessoas === 1 ? " pessoa" : " pessoas");
    const recado = r.resposta ? " Recado do Trela: " + corta(r.resposta, 80) : "";
    if (r.status === "confirmada")
      return [{ para: r.de, titulo: "Tua reserva foi confirmada!", texto: "Mesa pra " + quando + "." + recado, caminho: "", tag: "reserva-" + id, chave: "reserva_" + id + "_confirmada" }];
    if (r.status === "recusada")
      return [{ para: r.de, titulo: "Não deu pra reservar dessa vez", texto: "Pedido de " + quando + "." + recado, caminho: "", tag: "reserva-" + id, chave: "reserva_" + id + "_recusada" }];
    return [];
  }
  if (tipo === "aviso") {   // curtida ou menção (o app grava em avisos/{dono}/itens)
    const dono = String(pedido.dono || "").replace(/\//g, "");
    const a = dono && id && await ler("avisos/" + dono + "/itens/" + id);
    if (!a || a.de !== uid || dono === uid) return [];
    const titulo = a.tipo === "curtida" ? corta(a.deNome, 30) + " curtiu tua foto" : corta(a.deNome, 30) + " te marcou num comentário";
    return [{ para: dono, titulo, texto: corta(a.texto, 100), caminho: "", tag: "aviso", chave: "aviso_" + dono + "_" + id }];
  }
  if (tipo === "amizade") {
    const a = id && await ler("amizades/" + id); if (!a || !(a.membros || []).includes(uid)) return [];
    if (a.status === "pendente" && a.de === uid)
      return [{ para: a.para, titulo: (await nomeDe(uid)) + " quer ser teu amigo", texto: "Abre o Trela pra aceitar.", caminho: "", tag: "amizade-" + id, chave: "amizade_" + id + "_pendente" }];
    if (a.status === "aceita" && a.para === uid)
      return [{ para: a.de, titulo: (await nomeDe(uid)) + " aceitou tua amizade", texto: "Agora vocês podem conversar.", caminho: "", tag: "amizade-" + id, chave: "amizade_" + id + "_aceita" }];
    return [];
  }
  if (tipo === "karaoke") {   // quem está cantando e quem é o próximo (das últimas 12 h)
    const desde = Date.now() - 12 * 3600 * 1000, ms = t => (t && t.toMillis ? t.toMillis() : 0);
    const [cant, fila] = await Promise.all([
      db.collection("karaoke").where("status", "==", "cantando").get(),
      db.collection("karaoke").where("status", "==", "fila").get()
    ]);
    const agora = cant.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => ms(x.criado) > desde).sort((a, b) => ms(a.criado) - ms(b.criado))[0];
    const prox = fila.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => ms(x.criado) > desde).sort((a, b) => ms(a.criado) - ms(b.criado))[0];
    const out = [];
    if (agora) out.push({ para: agora.autor, titulo: "Tua vez no karaokê!", texto: "Sobe pro palco e solta a voz: " + corta(agora.musica, 60), caminho: "", tag: "karaoke", chave: "karaoke_" + agora.id + "_cantando" });
    if (prox && agora) out.push({ para: prox.autor, titulo: "Tu é o próximo no karaokê", texto: "Vai se preparando: " + corta(prox.musica, 60), caminho: "", tag: "karaoke", chave: "karaoke_" + prox.id + "_proximo" });
    return out;
  }
  if (tipo === "mesa") {   // convite pro Encara ou Bebe
    const para = String(pedido.para || "").replace(/\//g, "");
    const m = id && await ler("mesas/" + id);
    if (!m || !(m.jogadores || []).includes(uid) || !(m.convidados || []).includes(para)) return [];
    if ((m.jogadores || []).includes(para) || (m.recusados || []).includes(para)) return [];
    return [{ para, titulo: corta(m.donoNome || (await nomeDe(uid)), 30) + " te chamou pro Encara ou Bebe", texto: "Toca pra entrar na mesa. Cada um joga no próprio celular.", caminho: "encara?mesa=" + encodeURIComponent(id), tag: "mesa-" + id, chave: "mesa_" + id + "_" + para }];
  }
  return [];
}

// Tipos que também ficam guardados no sino do app (até a pessoa apagar).
// Curtida e menção o próprio app já grava; mensagem fica no ícone do chat.
const NO_SINO = ["drink", "match", "amizade", "karaoke", "mesa", "interesse", "reserva"];

async function guardarNoSino(adm, db, de, aviso, pedido) {
  const sub = String(pedido.tipo || "");
  if (!NO_SINO.includes(sub)) return;
  const u = await db.doc("usuarios/" + de).get();
  await db.doc("avisos/" + aviso.para + "/itens/sino_" + aviso.chave.replace(/\//g, "")).create({
    tipo: "sistema", sub, de: sub === "karaoke" ? "" : de, deNome: (u.exists && u.data().nome) || "",
    titulo: aviso.titulo, texto: aviso.texto || "", caminho: aviso.caminho || "", alvo: String(pedido.id || "").replace(/\//g, ""),
    criado: adm.firestore.FieldValue.serverTimestamp(), lida: false
  }).catch(() => {});   // já estava no sino: não duplica
}

async function enviar(adm, db, de, aviso, base, pedido) {
  if (!aviso.para || aviso.para === de) return 0;
  // quem bloqueou não recebe nada de quem foi bloqueado
  const [b1, b2] = await Promise.all([db.doc("bloqueios/" + aviso.para + "_" + de).get(), db.doc("bloqueios/" + de + "_" + aviso.para).get()]);
  if (b1.exists || b2.exists) return 0;
  await guardarNoSino(adm, db, de, aviso, pedido || {});
  const aparelhos = await db.collection("tokens").doc(aviso.para).collection("aparelhos").get();
  if (aparelhos.empty) return 0;
  // cada aviso uma vez só (se já foi, para aqui)
  try { await db.doc("enviados/" + aviso.chave.replace(/\//g, "")).create({ em: adm.firestore.FieldValue.serverTimestamp(), para: aviso.para }); }
  catch (e) { return 0; }
  const tokens = aparelhos.docs.map(d => d.id);
  const r = await adm.messaging().sendEachForMulticast({
    tokens,
    data: { titulo: aviso.titulo, texto: aviso.texto || "", url: base + (aviso.caminho || ""), tag: aviso.tag || "" },
    webpush: { headers: { Urgency: "high", TTL: "3600" } }
  });
  // apaga os aparelhos que não existem mais
  const mortos = [];
  r.responses.forEach((x, i) => {
    const c = x.error && x.error.code;
    if (c === "messaging/registration-token-not-registered" || c === "messaging/invalid-registration-token" || c === "messaging/invalid-argument") mortos.push(tokens[i]);
  });
  await Promise.all(mortos.map(t => db.collection("tokens").doc(aviso.para).collection("aparelhos").doc(t).delete().catch(() => {})));
  return r.successCount;
}

// Hora de Brasília: a noite vira às 6h (igual ao app)
function inicioDaNoiteMs(agora) {
  const b = new Date((agora || Date.now()) - 3 * 3600 * 1000);
  if (b.getUTCHours() < 6) b.setUTCDate(b.getUTCDate() - 1);
  return Date.parse(b.toISOString().slice(0, 10) + "T06:00:00-03:00");
}
// Aviso da equipe pra todo mundo que abriu o app nesta noite: fica no sino e vai pro celular de quem ativou
async function avisoGeral(adm, db, uid, pedido, base) {
  const eq = await db.doc("equipe/" + uid).get();
  if (!eq.exists) return { status: 403, corpo: { erro: "só a equipe manda aviso geral" } };
  const texto = String(pedido.texto || "").replace(/\s+/g, " ").trim();
  if (texto.length < 3 || texto.length > 140) return { status: 400, corpo: { erro: "o aviso precisa ter de 3 a 140 letras" } };
  const agora = Date.now(), chave = "geral_" + agora;
  const pessoas = await db.collection("usuarios").where("ultimoAcesso", ">=", adm.firestore.Timestamp.fromMillis(inicioDaNoiteMs(agora))).get();
  const tokens = [], quem = pessoas.docs.filter(p => p.id !== uid);
  // em lotes de 25 pessoas ao mesmo tempo, pra não estourar o tempo do servidor em noite cheia
  for (let i = 0; i < quem.length; i += 25) {
    await Promise.all(quem.slice(i, i + 25).map(async p => {
      await db.doc("avisos/" + p.id + "/itens/sino_" + chave).create({
        tipo: "sistema", sub: "geral", de: "", deNome: "Trela", titulo: "Aviso do Trela", texto, caminho: "", alvo: "",
        criado: adm.firestore.FieldValue.serverTimestamp(), lida: false
      }).catch(() => {});
      const ap = await db.collection("tokens").doc(p.id).collection("aparelhos").get();
      ap.docs.forEach(a => tokens.push({ dono: p.id, t: a.id }));
    }));
  }
  let enviados = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const lote = tokens.slice(i, i + 500);
    const r = await adm.messaging().sendEachForMulticast({
      tokens: lote.map(x => x.t),
      data: { titulo: "Aviso do Trela", texto, url: base, tag: "geral" },
      webpush: { headers: { Urgency: "high", TTL: "1800" } }
    });
    enviados += r.successCount;
    await Promise.all(r.responses.map((x, j) => {
      const c = x.error && x.error.code;
      if (c === "messaging/registration-token-not-registered" || c === "messaging/invalid-registration-token") return db.collection("tokens").doc(lote[j].dono).collection("aparelhos").doc(lote[j].t).delete().catch(() => {});
      return null;
    }));
  }
  return { status: 200, corpo: { ok: true, pessoas: quem.length, enviados } };
}

module.exports = async (req, res) => {
  // Abrir no navegador mostra se está tudo pronto (não mostra nada secreto)
  if (req.method === "GET") return res.status(200).json({ servidor: "ok", chavePrivadaNoVercel: !!process.env.FIREBASE_SERVICE_ACCOUNT });
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(503).json({ erro: "falta a chave FIREBASE_SERVICE_ACCOUNT no Vercel" });
  let adm, uid;
  try { adm = iniciarAdmin(); } catch (e) { return res.status(500).json({ erro: "chave FIREBASE_SERVICE_ACCOUNT inválida" }); }
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    uid = (await adm.auth().verifyIdToken(token)).uid;
  } catch (e) { return res.status(401).json({ erro: "não autenticado" }); }
  let pedido = req.body || {};
  if (typeof pedido === "string") { try { pedido = JSON.parse(pedido); } catch (e) { pedido = {}; } }
  const base = BASES.includes(pedido.base) ? pedido.base : "/";
  try {
    const db = adm.firestore();
    const susp = await db.doc("suspensos/" + uid).get();
    if (susp.exists) return res.status(403).json({ erro: "conta suspensa" });
    if (pedido.tipo === "geral") { const g = await avisoGeral(adm, db, uid, pedido, base); return res.status(g.status).json(g.corpo); }
    const avisos = await montarAvisos(db, uid, pedido);
    let enviados = 0;
    for (const a of avisos) enviados += await enviar(adm, db, uid, a, base, pedido);
    return res.status(200).json({ ok: true, avisos: avisos.length, enviados });
  } catch (e) {
    console.error("[avisar]", e);
    return res.status(500).json({ erro: "falhou" });
  }
};
module.exports.montarAvisos = montarAvisos;
module.exports.enviar = enviar;
module.exports.NO_SINO = NO_SINO;
