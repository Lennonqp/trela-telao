// Coisas compartilhadas entre as três páginas
firebase.initializeApp(window.FIREBASE_CONFIG);
const db = firebase.firestore();
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
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[0]/g, "o").replace(/[1!]/g, "i").replace(/3/g, "e").replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s").replace(/7/g, "t")
    .replace(/(?<=\b[a-z])[\s.\-_*]+(?=[a-z]\b)/g, "")   // p.u.t.a  /  p u t a  ->  puta
    .replace(/([a-z])\1+/g, "$1");                       // poooorra -> pora
}
const comprimir = p => p.replace(/([a-z])\1+/g, "$1");
const PALAVRAS_C = new Set(FILTRO_PALAVRAS.map(comprimir));
const COMECOS_C = FILTRO_COMECOS.map(comprimir);

// Devolve o motivo se o texto for suspeito, ou "" se estiver limpo
function motivoSuspeito(texto) {
  if (!texto) return "";
  if (/(https?:\/\/|www\.|\b[\w-]+\.(com|net|org|br|ly|io|me|gg|link|site|xyz)\b)/i.test(texto)) return "Tem link";
  if (/(\d[\s.()-]*){8,}/.test(texto)) return "Parece telefone";
  if (/@[\w.]{3,}/.test(texto)) return "Marca um perfil (@)";
  const palavras = normalizar(texto).split(/[^a-z]+/).filter(Boolean);
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

// ---------- Pessoas ----------
const PALETA = ["#ff3fa4", "#a95cf2", "#ff5a1f", "#3ddc97", "#ffd166", "#7cc6fe", "#f4a3c8"];
function corDe(uid) { let h = 0; for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETA[h % PALETA.length]; }
const parDe = (a, b) => a < b ? a + "_" + b : b + "_" + a;
const ms = ts => (ts && ts.toMillis) ? ts.toMillis() : 0;
const NO_BAR_MS = 3 * 60 * 60 * 1000;   // "No Trela agora" = abriu o app nas últimas 3 h
const ONLINE_MS = 10 * 60 * 1000;       // bolinha verde = mexeu no app nos últimos 10 min
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
