// Porta de entrada da equipe (balcão e telão).
// Mostra o login, confere se a conta está em /equipe e, se não estiver,
// explica como liberar (mostrando o UID pra copiar) em vez de deslogar.
function portaEquipe(caixa, aoLiberar, aoSair) {
  const auth = firebase.auth();
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const estilo = document.createElement("style");
  estilo.textContent = `
    .porta{display:flex;flex-direction:column;gap:12px;width:100%;max-width:380px;text-align:left}
    .porta .google{background:var(--ink);color:#1a1320;border:0;border-radius:999px;padding:13px;font:700 15px/1 var(--f-body);cursor:pointer;display:flex;gap:10px;justify-content:center;align-items:center}
    .porta .google span{width:22px;height:22px;border-radius:50%;background:#1a1320;color:var(--ink);display:grid;place-items:center;font-size:12px}
    .porta .ou{display:flex;align-items:center;gap:10px;color:var(--muted);font:400 11px var(--f-mono);letter-spacing:.12em;text-transform:uppercase}
    .porta .ou::before,.porta .ou::after{content:"";flex:1;height:1px;background:var(--line)}
    .porta .msg{font-size:14px;color:var(--muted);margin:0}
    .porta .msg.erro{color:var(--laranja)}
    .porta .uid{display:flex;gap:8px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:400 13px var(--f-mono);word-break:break-all}
    .porta .uid code{flex:1}
    .porta ol{margin:0;padding-left:20px;color:var(--muted);font-size:14px;display:flex;flex-direction:column;gap:6px}
    .porta ol b{color:var(--ink)}`;
  document.head.append(estilo);
  let liberado = false;

  function telaLogin(erro) {
    const f = el("form", "porta"); f.noValidate = true;
    const g = el("button", "google"); g.type = "button"; g.append(el("span", "", "G"), "Continuar com Google");
    const em = el("input"); em.type = "email"; em.placeholder = "E-mail da equipe"; em.autocomplete = "username"; em.setAttribute("aria-label", "E-mail");
    const se = el("input"); se.type = "password"; se.placeholder = "Senha"; se.autocomplete = "current-password"; se.setAttribute("aria-label", "Senha");
    const ok = el("button", "btn", "Entrar"); ok.type = "submit";
    const msg = el("p", "msg" + (erro ? " erro" : ""), erro || "Entra com a mesma conta que a equipe usa no app.");
    g.onclick = async () => {
      const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
      try { await auth.signInWithPopup(p); }
      catch (e) {
        if (e.code === "auth/popup-blocked") return auth.signInWithRedirect(p);
        if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") { msg.textContent = "Não deu pra entrar com o Google. Tenta de novo."; msg.className = "msg erro"; }
      }
    };
    f.onsubmit = async e => {
      e.preventDefault();
      try { await auth.signInWithEmailAndPassword(em.value.trim(), se.value); }
      catch (err) { msg.textContent = "E-mail ou senha não conferem."; msg.className = "msg erro"; }
    };
    f.append(g, el("div", "ou", "ou"), em, se, msg, ok);
    caixa.replaceChildren(f);
  }

  function telaConferindo() { caixa.replaceChildren(Object.assign(el("div", "porta"), { innerHTML: '<p class="msg">Conferindo acesso…</p>' })); }

  function telaNaoEquipe(u) {
    const d = el("div", "porta");
    d.append(el("p", "msg erro", "A conta " + (u.email || u.displayName || "") + " ainda não está liberada como equipe."));
    const uid = el("div", "uid"); uid.append(el("code", "", u.uid));
    const cp = el("button", "ghost", "Copiar"); cp.type = "button";
    cp.onclick = () => navigator.clipboard.writeText(u.uid).then(() => cp.textContent = "Copiado!").catch(() => { const r = document.createRange(); r.selectNodeContents(uid.firstChild); getSelection().removeAllRanges(); getSelection().addRange(r); });
    uid.append(cp);
    const ol = el("ol");
    ol.innerHTML = "<li>No Firebase, abre o <b>Firestore</b> e clica em <b>Iniciar coleção</b> (ou abre a coleção <b>equipe</b> se já existir).</li><li>ID da coleção: <b>equipe</b>.</li><li>ID do documento: <b>cola o código acima</b>.</li><li>Adiciona um campo <b>nome</b> com qualquer valor e salva.</li>";
    const de = el("button", "btn", "Já liberei, conferir de novo"); de.type = "button"; de.onclick = () => conferir(u);
    const sa = el("button", "ghost", "Entrar com outra conta"); sa.type = "button"; sa.onclick = () => auth.signOut();
    d.append(el("p", "msg", "Pra liberar, copia este código:"), uid, ol, de, sa);
    caixa.replaceChildren(d);
  }

  async function conferir(u) {
    telaConferindo();
    let ok = false;
    try { ok = (await db.doc("equipe/" + u.uid).get()).exists; }
    catch (e) { return telaNaoEquipe(u); }
    if (!ok) return telaNaoEquipe(u);
    caixa.replaceChildren(); liberado = true; aoLiberar(u);
  }

  auth.onAuthStateChanged(u => {
    if (!u) { if (liberado && aoSair) aoSair(); liberado = false; return telaLogin(); }
    conferir(u);
  });
}
