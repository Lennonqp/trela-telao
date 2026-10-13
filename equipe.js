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

  // Usuário da equipe sem e-mail: "balcao" vira uma conta interna balcao@equipe.trela
  const DOMINIO_EQUIPE = "@equipe.trela";
  const limparUsuario = t => t.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "").replace(/[^a-z0-9._-]/g, "");
  const ERROS = {
    "auth/invalid-credential": "Usuário ou senha não conferem.",
    "auth/wrong-password": "Usuário ou senha não conferem.",
    "auth/user-not-found": "Usuário ou senha não conferem.",
    "auth/email-already-in-use": "Esse usuário já existe. Escolhe outro ou entra com ele.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Espera um pouquinho e tenta de novo.",
    "auth/network-request-failed": "Sem internet. Confere a conexão."
  };

  function telaLogin(erro, criar) {
    const f = el("form", "porta"); f.noValidate = true;
    const titulo = el("p", "msg", criar ? "Cria um usuário e uma senha pra equipe. Não precisa de e-mail." : "Entra com o usuário da equipe.");
    const us = el("input"); us.placeholder = "Usuário (ex.: balcao)"; us.autocomplete = "username"; us.autocapitalize = "none"; us.spellcheck = false; us.maxLength = 20; us.setAttribute("aria-label", "Usuário");
    const se = el("input"); se.type = "password"; se.placeholder = "Senha (mínimo 6)"; se.autocomplete = criar ? "new-password" : "current-password"; se.setAttribute("aria-label", "Senha");
    const se2 = el("input"); se2.type = "password"; se2.placeholder = "Repete a senha"; se2.autocomplete = "new-password"; se2.setAttribute("aria-label", "Repetir senha");
    const ok = el("button", "btn", criar ? "Criar acesso" : "Entrar"); ok.type = "submit";
    const troca = el("button", "ghost", criar ? "Já tenho usuário, entrar" : "Primeira vez? Criar acesso da equipe"); troca.type = "button";
    troca.onclick = () => telaLogin("", !criar);
    const msg = el("p", "msg" + (erro ? " erro" : ""), erro || "");
    const g = el("button", "google"); g.type = "button"; g.append(el("span", "", "G"), "Entrar com Google");
    g.onclick = async () => {
      const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
      g.disabled = true;
      try { await auth.signInWithPopup(p); }
      catch (e) {
        msg.className = "msg erro";
        if (e.code === "auth/popup-blocked") msg.textContent = "O navegador bloqueou a janela do Google. Clica de novo ou libera pop-ups pra este site.";
        else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") msg.textContent = "Não deu pra entrar com o Google. Tenta de novo.";
        else msg.className = "msg";
      } finally { g.disabled = false; }
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const erroMsg = t => { msg.textContent = t; msg.className = "msg erro"; };
      const bruto = us.value.trim();
      // Quem já tem conta com e-mail de verdade também pode entrar digitando o e-mail
      const email = bruto.includes("@") ? bruto : limparUsuario(bruto) + DOMINIO_EQUIPE;
      if (!bruto.includes("@") && limparUsuario(bruto).length < 3) return erroMsg("O usuário precisa ter pelo menos 3 letras ou números.");
      if (se.value.length < 6) return erroMsg("A senha precisa ter pelo menos 6 caracteres.");
      if (criar && se.value !== se2.value) return erroMsg("As senhas não são iguais.");
      ok.disabled = true;
      try {
        if (criar) {
          const c = await auth.createUserWithEmailAndPassword(email, se.value);
          await c.user.updateProfile({ displayName: "Equipe " + limparUsuario(bruto) });
        } else await auth.signInWithEmailAndPassword(email, se.value);
      } catch (err) { erroMsg(ERROS[err.code] || "Não deu pra entrar. Tenta de novo."); }
      finally { ok.disabled = false; }
    };
    f.append(titulo, us, se);
    if (criar) f.append(se2);
    f.append(msg, ok, troca);
    if (!criar) f.append(el("div", "ou", "ou"), g);
    caixa.replaceChildren(f);
    setTimeout(() => us.focus(), 50);
  }
  const nomeConta = u => (u.email || "").endsWith(DOMINIO_EQUIPE) ? "usuário “" + u.email.slice(0, -DOMINIO_EQUIPE.length) + "”" : "conta " + (u.email || u.displayName || "");

  function telaConferindo() { caixa.replaceChildren(Object.assign(el("div", "porta"), { innerHTML: '<p class="msg">Conferindo acesso…</p>' })); }

  function telaNaoEquipe(u) {
    const d = el("div", "porta");
    d.append(el("p", "msg erro", "O " + nomeConta(u) + " ainda não está liberado como equipe. Falta só liberar no Firebase (é uma vez só por usuário)."));
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
