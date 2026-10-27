// Coisas compartilhadas entre as três páginas
// O balcão e o telão usam uma sessão separada ("equipe"), pra o login da equipe
// não trocar a conta do app da galera aberto em outra aba do mesmo navegador.
const appTrela = window.SESSAO_EQUIPE
  ? firebase.initializeApp(window.FIREBASE_CONFIG, "equipe")
  : firebase.initializeApp(window.FIREBASE_CONFIG);
const db = appTrela.firestore();
const agoraServidor = () => firebase.firestore.FieldValue.serverTimestamp();

const CORES = { neon: "var(--neon)", lilas: "var(--lilas)", laranja: "var(--laranja)" };
const REACOES = { fogo: "🔥", riso: "😂", amor: "❤️" };
const REACOES_ZERO = { fogo: 0, riso: 0, amor: 0 };

// ---------- Filtro de recados e comentários ----------
// Limpo vai direto pro telão. Se cair em alguma regra abaixo, vai pra fila do balcão.
// Pra acrescentar palavras, é só colocar nas listas (sem acento, minúsculo).

// Palavras inteiras
const FILTRO_PALAVRAS = [
  "porra","caralho","krl","crl","merda","bosta","puta","puto","putaria","fdp","vsf","pqp","tnc",
  "cu","cuzao","buceta","bct","piroca","foda","fodase","foder","fuder","fudeu","corno","chifrudo",
  "viado","bicha","traveco","macaco","retardado","mongol","otario","babaca","idiota","imbecil",
  "vadia","vagabunda","vagabundo","piranha","rapariga","escrota","escroto","nojenta","nojento",
  "baleia","nazista","hitler","maconha","cocaina"
];
// Começos de palavra (pega variações: arrombado, arrombada, arrombados...)
const FILTRO_COMECOS = ["arromb","desgrac","vagabund","retardad","fodid","fudid","merd","caralh","putiss","filhadaput","filhodaput"];

function normalizar(texto) {
  return texto.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[0]/g, "o").replace(/[1!]/g, "i").replace(/3/g, "e").replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s").replace(/7/g, "t");
}
// Separa em palavras e junta letras soltas seguidas (p.u.t.a / p u t a -> puta).
// Feito sem "lookbehind" de regex, que iPhones antigos (antes do iOS 16.4) não entendem.
function palavrasDe(texto) {
  const toks = normalizar(texto).split(/[^a-z]+/).filter(Boolean), out = [];
  let soltas = "";
  for (const w of toks) {
    if (w.length === 1) { soltas += w; continue; }
    if (soltas) { out.push(soltas); soltas = ""; }
    out.push(w);
  }
  if (soltas) out.push(soltas);
  return out.map(w => w.replace(/([a-z])\1+/g, "$1"));   // poooorra -> pora
}
const comprimir = p => p.replace(/([a-z])\1+/g, "$1");
const PALAVRAS_C = new Set(FILTRO_PALAVRAS.map(comprimir));
const COMECOS_C = FILTRO_COMECOS.map(comprimir);

// Devolve o motivo se o texto for suspeito, ou "" se estiver limpo
function motivoSuspeito(texto) {
  if (!texto) return "";
  if (/(https?:\/\/|www\.|\b[\w-]+\.(com|net|org|br|ly|io|me|gg|link|site|xyz)\b)/i.test(texto)) return "Tem link";
  if (/(\d[\s.()-]*){8,}/.test(texto)) return "Parece telefone";
  const palavras = palavrasDe(texto);
  if (palavras.some(p => PALAVRAS_C.has(p) || COMECOS_C.some(c => p.startsWith(c)))) return "Palavrão ou ofensa";
  const letras = texto.replace(/[^A-Za-zÀ-ú]/g, "");
  if (letras.length >= 25 && letras === letras.toUpperCase()) return "Tudo em maiúsculas";
  return "";
}

// ---------- Fotos ----------
// Diminui a foto no próprio celular antes de enviar (fica leve e rápida)
function comprimirFoto(arquivo, max = 1000) {
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let d = c.toDataURL("image/jpeg", 0.72);
      if (d.length > 650000) d = c.toDataURL("image/jpeg", 0.5);
      d.length > 650000 ? erro(new Error("grande")) : ok(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error("formato")); };
    img.src = url;
  });
}

const cacheFotos = new Map();
function carregarFoto(fotoId) {
  if (!cacheFotos.has(fotoId)) {
    cacheFotos.set(fotoId, db.doc("fotos/" + fotoId).get().then(s => s.exists ? s.data().data : null).catch(() => null));
  }
  return cacheFotos.get(fotoId);
}

// ---------- Virada da noite ----------
// O feed e o telão mostram só o que foi postado desde as 6h da manhã.
// (Entre meia-noite e 6h ainda vale a noite que começou na véspera.)
const HORA_VIRADA = 6;
function inicioDaNoite() {
  const agora = new Date(), i = new Date(agora);
  i.setHours(HORA_VIRADA, 0, 0, 0);
  if (agora < i) i.setDate(i.getDate() - 1);
  return i;
}
function msAteVirada() {
  const p = new Date(inicioDaNoite()); p.setDate(p.getDate() + 1);
  return Math.max(1000, p - Date.now() + 2000);
}
// Liga um "ouvinte" pra noite atual e troca sozinho de noite às 6h
function ouvirNoite(montar) {
  let parar = null, t = null;
  const ligar = () => {
    if (parar) parar();
    parar = montar(firebase.firestore.Timestamp.fromDate(inicioDaNoite()));
    t = setTimeout(ligar, msAteVirada());
  };
  ligar();
  return () => { if (parar) parar(); clearTimeout(t); };
}

// A fila "Pra decidir" também vira às 6h: o que ficou sem decisão da noite anterior é apagado
// (só a equipe consegue, então quem chama é o balcão e o menu da equipe)
function limparFilaAntiga(desde) {
  db.collection("fila").where("criado", "<", desde).limit(200).get().then(s => {
    if (s.empty) return;
    const b = db.batch();
    s.docs.forEach(d => { b.delete(d.ref); if (d.data().fotoId) b.delete(db.doc("fotos/" + d.data().fotoId)); });
    return b.commit();
  }).catch(() => {});
}

// ---------- Pessoas ----------
const PALETA = ["#ff3fa4", "#a95cf2", "#ff5a1f", "#3ddc97", "#ffd166", "#7cc6fe", "#f4a3c8"];
function corDe(uid) { let h = 0; for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETA[h % PALETA.length]; }
const parDe = (a, b) => a < b ? a + "_" + b : b + "_" + a;
const ms = ts => (ts && ts.toMillis) ? ts.toMillis() : 0;
const NO_BAR_MS = 3 * 60 * 60 * 1000;   // "No Trela agora" = abriu o app nas últimas 3 h
const ONLINE_MS = 5 * 60 * 1000;        // online = app aberto (o celular avisa a cada 2 min; sumiu há 5 min, sai da lista)
function visto(ts) {
  const t = ms(ts); if (!t) return "";
  const d = Date.now() - t;
  if (d < ONLINE_MS) return "Online agora";
  if (d < 60 * 60 * 1000) return "Visto há " + Math.round(d / 60000) + " min";
  if (d < 24 * 60 * 60 * 1000) return "Visto há " + Math.round(d / 3600000) + " h";
  if (d < 48 * 60 * 60 * 1000) return "Visto ontem";
  return "Visto em " + new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
const horaDe = ts => ms(ts) ? new Date(ms(ts)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "agora";

// localStorage que não quebra se o navegador bloquear
const guardado = {
  ler(k, padrao) { try { const v = localStorage.getItem(k); return v === null ? padrao : JSON.parse(v); } catch (e) { return padrao; } },
  salvar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

// ---------- SÓ NA VERSÃO DE TESTE: 3 fotos de exemplo no concurso ----------
// Não vão pro banco. Aparecem no telão, no ranking do balcão e na tela do concurso no app.
const FOTOS_DEMO = [
  { id: "demo1", nome: "Bruxa (exemplo)", texto: "Bruxa do Trela", cores: ["#2b0a3d", "#a95cf2"], titulo: "BRUXA", curtidas: 6 },
  { id: "demo2", nome: "Vampiro (exemplo)", texto: "Conde Drácula", cores: ["#3a0410", "#ff3fa4"], titulo: "VAMPIRO", curtidas: 4 },
  { id: "demo3", nome: "Zumbi (exemplo)", texto: "Zumbi de chopp", cores: ["#0b2a1c", "#3ddc97"], titulo: "ZUMBI", curtidas: 3 }
];
const imagensDemo = {};
function imagemDemo(id) {
  if (imagensDemo[id]) return imagensDemo[id];
  const d = FOTOS_DEMO.filter(x => x.id === id)[0]; if (!d) return null;
  const c = document.createElement("canvas"); c.width = 600; c.height = 600;
  const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 600, 600);
  gr.addColorStop(0, d.cores[0]); gr.addColorStop(1, d.cores[1]); g.fillStyle = gr; g.fillRect(0, 0, 600, 600);
  // silhueta simples de uma pessoa
  g.fillStyle = "rgba(0,0,0,.35)";
  g.beginPath(); g.arc(300, 230, 90, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(150, 600); g.quadraticCurveTo(160, 360, 300, 350); g.quadraticCurveTo(440, 360, 450, 600); g.fill();
  g.fillStyle = "#fff"; g.font = "bold 64px sans-serif"; g.textAlign = "center"; g.fillText(d.titulo, 300, 540);
  g.font = "bold 26px monospace"; g.fillStyle = "rgba(255,255,255,.8)"; g.fillText("FOTO DE EXEMPLO", 300, 70);
  return (imagensDemo[id] = c.toDataURL("image/jpeg", 0.85));
}
function fotosDemoConcurso() {
  const t = inicioDaNoite().getTime() + 60000;
  return FOTOS_DEMO.map((d, i) => ({
    id: d.id, demo: true, tipo: "foto", acao: "concurso", autor: "demo-" + d.id, nome: d.nome, texto: d.texto, cor: "neon",
    fotoId: "demo:" + d.id, reacoes: { fogo: 0, riso: 0, amor: d.curtidas },
    criado: { toMillis: () => t + i * 1000, toDate: () => new Date(t + i * 1000) }
  }));
}
const curtidasDemo = () => FOTOS_DEMO.reduce((o, d) => { o[d.id] = d.curtidas; return o; }, {});
// carregarFoto entende as fotos de exemplo
const carregarFotoReal = carregarFoto;
carregarFoto = function (fotoId) {
  if (String(fotoId).indexOf("demo:") === 0) return Promise.resolve(imagemDemo(String(fotoId).slice(5)));
  return carregarFotoReal(fotoId);
};
