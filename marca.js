// ---------- Marca "feito por Na Tela" (rodapé de todas as telas) ----------
// O logo: "na tela" com o ponto vermelho entre os cantos amarelos. Escrito em JS antigo de propósito: roda até em TV.
// Não depende do Firebase: o jogo Encara ou Bebe também usa.
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
  var el = document.createElement("div");
  el.className = "lennon" + (tv ? " ln-tv" : "");
  el.innerHTML = '<span class="ln-por">feito por</span><span class="ln-nome nt" aria-label="Na Tela"><span class="nt-dot"></span>na tela</span>' +
    (tv ? '<span class="ln-sep">·</span><span class="ln-txt">telão interativo pro teu bar</span>' : (contatos ? '<span class="ln-txt">quer o Na Tela no teu bar?</span>' : "")) +
    (contatos ? (tv ? '<span class="ln-sep">·</span>' : "") + '<span class="ln-contatos">' + contatos + "</span>" : "");
  return el;
}
(function () {
  var alvos = document.querySelectorAll("[data-marca-lennon]");
  for (var i = 0; i < alvos.length; i++) alvos[i].appendChild(marcaLennon(alvos[i].getAttribute("data-marca-lennon")));
})();
