// ---------- Marca "feito por lennon" (rodapé de todas as telas) ----------
// O "o" de lennon é um botão de ligar. Escrito em JS antigo de propósito: roda até em TV.
// Não depende do Firebase: o jogo Encara ou Bebe também usa.
var LENNON_LIGA = '<svg class="liga" viewBox="0 0 74 80" aria-hidden="true"><path d="M20 22 A28 28 0 1 0 54 22" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><path d="M37 8 V40" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/></svg>';
function marcaLennon(tipo) {
  var lista = window.CONTATO_LENNON || [];
  if (!lista.length && lista.texto) lista = [lista];          // aceita o formato antigo { texto, link }
  var esc = function (t) { return String(t || "").replace(/[&<>"]/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]; }); };
  var tv = tipo === "tv";
  var contatos = "";
  for (var i = 0; i < lista.length && (!tv || i < 1); i++) {
    var c = lista[i] || {}, link = /^(https?:\/\/|mailto:)/.test(c.link || "") ? c.link : "";
    if (!c.texto) continue;
    contatos += (link && !tv)
      ? '<a class="ln-contato" href="' + esc(link) + '"' + (link.indexOf("http") === 0 ? ' target="_blank" rel="noopener"' : "") + ">" + esc(c.texto) + "</a>"
      : '<span class="ln-contato">' + esc(c.texto) + "</span>";
  }
  if (!contatos && !tv) contatos = '<span class="ln-contato vazio">contato em breve</span>';
  var el = document.createElement("div");
  el.className = "lennon" + (tv ? " ln-tv" : "");
  el.innerHTML = '<span class="ln-por">feito por</span><span class="ln-nome" aria-label="lennon">lenn' + LENNON_LIGA + 'n</span>' +
    (tv ? '<span class="ln-sep">·</span><span class="ln-txt">telão interativo pro teu negócio</span>' : '<span class="ln-txt">quer um app ou telão pro teu negócio?</span>') +
    (contatos ? (tv ? '<span class="ln-sep">·</span>' : "") + '<span class="ln-contatos">' + contatos + "</span>" : "");
  return el;
}
(function () {
  var alvos = document.querySelectorAll("[data-marca-lennon]");
  for (var i = 0; i < alvos.length; i++) alvos[i].appendChild(marcaLennon(alvos[i].getAttribute("data-marca-lennon")));
})();
