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
// ---------- Dicas do app (telão; o servidor das notificações tem a mesma lista em api/avisar.js) ----------
// precisaCardapio: só aparece quando a equipe já cadastrou algum produto no cardápio.
var DICAS_APP = [
  { k: "crush", titulo: "Tá de olho em alguém?", texto: "Marca \"Tenho interesse\" em Quem tá no Trela, no app. A pessoa fica sabendo e, se marcar de volta, dá match.", ic: '<path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5h2c.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z"/>', cor: "#ff3fa4" },
  { k: "drink", precisaCardapio: true, titulo: "Quer oferecer um drink pra alguém?", texto: "Manda o convite pelo app. Se a pessoa aceitar, tu pega no balcão.", ic: '<path d="M6 4h12l-1.5 15a2 2 0 0 1-2 1.8h-5a2 2 0 0 1-2-1.8z"/><path d="M6.5 9h11"/>', cor: "#ff7a2e" },
  { k: "anel", titulo: "Aberto pra conhecer gente?", texto: "Liga no menu do app e aparece pra galera com o selo.", ic: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>', cor: "#ffc94d" },
  { k: "encara", titulo: "Encara ou Bebe", texto: "Chama teus amigos do app pra jogar, cada um no seu celular.", ic: '<rect x="3" y="6" width="11" height="15" rx="2" transform="rotate(-10 8.5 13.5)"/><rect x="10" y="3" width="11" height="15" rx="2"/>', cor: "#ff8fc2" },
  { k: "cardapio", precisaCardapio: true, titulo: "O cardápio do Trela tá no app", texto: "Com os preços de 500 e 700 ml.", ic: '<path d="M5 3h11a3 3 0 0 1 3 3v15H8a3 3 0 0 1-3-3z"/><path d="M5 18a3 3 0 0 1 3-3h11M9 7h6M9 10.5h4"/>', cor: "#a95cf2" },
  { k: "notificacoes", titulo: "Fica sabendo na hora", texto: "Recebe aviso no celular de mensagem, drink e da tua vez no karaokê. O app pergunta quando tu entra.", ic: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', cor: "#3ddc97" }
];
function dicasDoApp(temCardapio) { return DICAS_APP.filter(function (d) { return !d.precisaCardapio || temCardapio; }); }

// Ações especiais: o que foi ligado antes da virada (6h) conta como desligado.
// Assim nada fica ligado de uma noite pra outra, mesmo sem ninguém desligar.
var ACOES_DA_NOITE = ["concurso", "desafio", "enquete", "roleta", "karaoke", "contagem", "jogo", "bingo", "ranking"];
function acoesDaNoite(d) {
  var dados = d.exists ? d.data({ serverTimestamps: "estimate" }) : {};
  var pendente = !!(d.metadata && d.metadata.hasPendingWrites), noite = inicioDaNoite().getTime(), velhas = [];
  ACOES_DA_NOITE.forEach(function (k) {
    var a = dados[k];
    if (!a || !a.ativo) return;
    if (!a.desde && pendente) return;                 // acabou de ligar e o horário ainda não voltou do servidor
    if (ms(a.desde) >= noite) return;                 // ligado nesta noite
    dados[k] = Object.assign({}, a, { ativo: false }); velhas.push(k);
  });
  return { dados: dados, velhas: velhas };
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

// ---------- Roleta de regras ----------
// A regra da vez é calculada pelo relógio: todo mundo (app, balcão, telão) chega na mesma regra
// sem ninguém precisar gravar nada a cada troca. "Girar agora" no balcão muda a base e a semente.
var REGRAS_PADRAO = [
  "Brinde coletivo: toda vez que tocar música dos anos 2000, a mesa levanta o copo",
  "Proibido falar \u201ctipo\u201d. Quem falar conta uma piada pra mesa",
  "Hora da selfie: manda uma foto da tua mesa pro telão",
  "Pedido no balcão só vale com sotaque diferente",
  "Quem for no banheiro volta com um elogio pra alguém da mesa ao lado",
  "Dança obrigatória no refrão",
  "Troca de lugar com alguém da tua mesa",
  "Só vale falar cantando até a próxima regra",
  "Manda um recado pro telão elogiando quem tá no balcão",
  "Apresenta alguém da tua mesa pra mesa do lado"
];
function aleatorioFixo(n) {   // mesmo número em qualquer aparelho
  var t = (n + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function regrasDaRoleta(c) {
  var lista = (c && c.regras && c.regras.length ? c.regras : REGRAS_PADRAO);
  return lista.map(function (r) { return String(r || "").trim(); }).filter(Boolean);
}
function regraDaRoleta(c, agoraMs) {
  var regras = regrasDaRoleta(c), n = regras.length;
  if (!n) return null;
  var iv = Math.max(1, (c && c.intervalo) || 20) * 60000;
  var base = (c && (ms(c.base) || ms(c.desde))) || 0;
  var agora = agoraMs || Date.now();
  var slot = Math.max(0, Math.floor((agora - base) / iv));
  var semente = ((c && c.semente) || 7) * 1009;
  // Embaralha a lista a cada volta: passa por todas antes de repetir e nunca repete em seguida
  var ordem = function (volta) {
    var o = regras.map(function (_, i) { return i; });
    for (var i = n - 1; i > 0; i--) { var j = Math.floor(aleatorioFixo(semente + volta * 131 + i) * (i + 1)); var t = o[i]; o[i] = o[j]; o[j] = t; }
    return o;
  };
  var volta = Math.floor(slot / n), pos = slot % n, o = ordem(volta);
  if (n > 1 && volta > 0) { var ant = ordem(volta - 1); if (o[0] === ant[n - 1]) { var t2 = o[0]; o[0] = o[1]; o[1] = t2; } }
  var idx = n === 2 ? (slot + (semente % 2)) % 2 : o[pos];   // com 2 regras, só alterna
  return { idx: idx, texto: regras[idx], slot: slot, inicio: base + slot * iv, fim: base + (slot + 1) * iv, total: n, regras: regras };
}
function faltaTexto(fimMs) {
  var s = Math.max(0, Math.round((fimMs - Date.now()) / 1000)), m = Math.floor(s / 60), ss = s % 60;
  return m + ":" + (ss < 10 ? "0" : "") + ss;
}

// ---------- Bingo de fotos ----------
// Cartela de 9 tarefas, cada uma cumprida com uma foto. A equipe pode trocar as tarefas no balcão.
var BINGO_PADRAO = [
  "Selfie com alguém de outra mesa",
  "Foto do brinde da tua mesa",
  "Foto com alguém da equipe do Trela",
  "Foto de um grupo de 5 ou mais",
  "Foto com alguém com a mesma cor de roupa",
  "Careta junto com um desconhecido",
  "Foto com alguém que faz aniversário no teu mês",
  "Foto com o telão aparecendo atrás",
  "Foto dançando com alguém"
];
function tarefasDoBingo(c) {
  var lista = (c && c.tarefas && c.tarefas.length ? c.tarefas : BINGO_PADRAO).map(function (t) { return String(t || "").trim(); }).filter(Boolean).slice(0, 9);
  for (var i = lista.length; i < 9; i++) lista.push(BINGO_PADRAO[i]);
  return lista;
}
// Quem fechou primeiro vem na frente; depois, quem tem mais fotos
function rankingBingo(cartelas) {
  return cartelas.slice().sort(function (a, b) {
    var fa = ms(a.fechou), fb = ms(b.fechou);
    if (fa || fb) return (fa || Infinity) - (fb || Infinity);
    return (b.n || 0) - (a.n || 0) || ms(a.atualizado) - ms(b.atualizado);
  });
}

// ---------- Ranking da noite ----------
// posts: os recados e fotos da noite; cantou: as entradas do karaokê; curtidasPor: curtidas por post (quando der pra ler)
function rankingDaNoite(posts, cantou, curtidasPor) {
  var soma = function (r) { var x = r.reacoes || {}; return (x.fogo || 0) + (x.riso || 0) + (x.amor || 0); };
  var galera = posts.filter(function (r) { return r.tipo !== "bar" && r.autor && !r.demo; });
  var melhor = function (lista, valor) {
    var top = null, n = 0;
    lista.forEach(function (r) { var v = valor(r); if (v > n) { n = v; top = r; } });
    return top ? { r: top, n: n } : null;
  };
  var recado = melhor(galera.filter(function (r) { return r.tipo === "recado"; }), soma);
  var foto = melhor(galera.filter(function (r) { return r.tipo === "foto"; }), function (r) { return (curtidasPor && curtidasPor[r.id] != null) ? curtidasPor[r.id] : ((r.reacoes || {}).amor || 0); });
  var conta = function (lista, chave) {
    var m = {}; lista.forEach(function (x) { var k = x[chave]; if (!k) return; m[k] = m[k] || { uid: k, nome: x.nome, n: 0 }; m[k].n++; });
    var top = null; Object.keys(m).forEach(function (k) { if (!top || m[k].n > top.n) top = m[k]; });
    return top;
  };
  var cantor = conta((cantou || []).filter(function (k) { return k.status === "feito" || k.status === "cantando"; }), "autor");
  var ativo = conta(galera, "autor");
  var out = [];
  if (recado) out.push({ k: "recado", rotulo: "Recado mais reagido", nome: recado.r.nome, uid: recado.r.autor, detalhe: recado.r.texto, n: recado.n, un: recado.n === 1 ? "reação" : "reações" });
  if (foto) out.push({ k: "foto", rotulo: "Foto mais curtida", nome: foto.r.nome, uid: foto.r.autor, detalhe: foto.r.texto || "", fotoId: foto.r.fotoId, n: foto.n, un: foto.n === 1 ? "curtida" : "curtidas" });
  if (cantor) out.push({ k: "cantor", rotulo: "Quem mais cantou", nome: cantor.nome, uid: cantor.uid, detalhe: "", n: cantor.n, un: cantor.n === 1 ? "música" : "músicas" });
  if (ativo && ativo.n > 1) out.push({ k: "ativo", rotulo: "Quem mais mandou pro telão", nome: ativo.nome, uid: ativo.uid, detalhe: "", n: ativo.n, un: "envios" });
  return out;
}

// ---------- Reações nas mensagens do chat ----------
var REACOES_CHAT = { fogo: "🔥", riso: "😂", amor: "❤️", joia: "👍", uau: "😮" };

// Datas da agenda e das reservas ("AAAA-MM-DD")
function hojeISO(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function dataBonita(iso) {
  var p = String(iso || "").split("-"); if (p.length !== 3) return iso || "";
  var d = new Date(+p[0], +p[1] - 1, +p[2]), hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  var dif = Math.round((d - hoje) / 86400000);
  var sem = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][d.getDay()];
  var dm = p[2] + "/" + p[1];
  return dif === 0 ? "Hoje, " + dm : dif === 1 ? "Amanhã, " + dm : sem.charAt(0).toUpperCase() + sem.slice(1) + ", " + dm;
}

// A marca "feito por lennon" fica em marca.js (também usada pelo jogo, que não tem Firebase).

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
