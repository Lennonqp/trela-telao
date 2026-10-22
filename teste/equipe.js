// Porta de entrada da equipe (menu, balcão e telão).
// Mostra o login, confere se a conta está em /equipe e, se não estiver,
// explica como liberar (mostrando o UID pra copiar) em vez de deslogar.
//
// Modo TV (opcoes.tv): a TV entra sozinha numa conta anônima e mostra um código
// de 6 números. Alguém da equipe digita o código em /bar e a TV fica liberada,
// sem precisar digitar usuário e senha com o controle remoto.
//
// Escrito sem recursos novos de JavaScript/CSS pra rodar em navegador de Smart TV.
function portaEquipe(caixa, aoLiberar, aoSair, opcoes) {
  opcoes = opcoes || {};
  const auth = appTrela.auth();
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const trocar = (...filhos) => { while (caixa.firstChild) caixa.removeChild(caixa.firstChild); filhos.forEach(f => caixa.appendChild(f)); };
  const estilo = document.createElement("style");
  estilo.textContent = `
    .porta{display:flex;flex-direction:column;width:100%;max-width:380px;text-align:left}
    .porta > * + *{margin-top:12px}
    .porta .google{background:var(--ink);color:#1a1320;border:0;border-radius:999px;padding:13px;font:700 15px/1 var(--f-body);cursor:pointer;display:flex;justify-content:center;align-items:center}
    .porta .google span{width:22px;height:22px;border-radius:50%;background:#1a1320;color:var(--ink);display:flex;align-items:center;justify-content:center;font-size:12px;margin-right:10px}
    .porta .ou{display:flex;align-items:center;color:var(--muted);font:400 11px var(--f-mono);letter-spacing:.12em;text-transform:uppercase}
    .porta .ou::before,.porta .ou::after{content:"";flex:1;height:1px;background:var(--line)}
    .porta .ou::before{margin-right:10px}.porta .ou::after{margin-left:10px}
    .porta .msg{font-size:14px;color:var(--muted);margin:0}
    .porta .msg.erro{color:var(--laranja)}
    .porta .uid{display:flex;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:400 13px var(--f-mono);word-break:break-all}
    .porta .uid code{flex:1;margin-right:8px}
    .porta ol{margin:0;padding-left:20px;color:var(--muted);font-size:14px}
    .porta ol li + li{margin-top:6px}
    .porta ol b{color:var(--ink)}
    .porta .codigo-tv{font:400 72px/1 var(--f-display);letter-spacing:.12em;color:var(--ink);text-align:center;margin:8px 0 4px}
    .porta .passos-tv{color:var(--muted);font-size:16px;text-align:center;margin:0}
    .porta .passos-tv b{color:var(--neon)}`;
  document.head.appendChild(estilo);
  let liberado = false, pararPareamento = null, pararTela = null;

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
    pararTudoTV();
    const f = el("form", "porta"); f.noValidate = true;
    const titulo = el("p", "msg", criar ? "Cria um usuário e uma senha pra equipe. Não precisa de e-mail." : "Entra com o usuário da equipe.");
    const us = el("input"); us.placeholder = "Usuário (ex.: balcao)"; us.autocomplete = "username"; us.autocapitalize = "none"; us.spellcheck = false; us.maxLength = 20; us.setAttribute("aria-label", "Usuário");
    const se = el("input"); se.type = "password"; se.placeholder = "Senha (mínimo 6)"; se.autocomplete = criar ? "new-password" : "current-password"; se.setAttribute("aria-label", "Senha");
    const se2 = el("input"); se2.type = "password"; se2.placeholder = "Repete a senha"; se2.autocomplete = "new-password"; se2.setAttribute("aria-label", "Repetir senha");
    const ok = el("button", "btn", criar ? "Criar acesso" : "Entrar"); ok.type = "submit";
    const troca = el("button", "ghost", criar ? "Já tenho usuário, entrar" : "Primeira vez? Criar acesso da equipe"); troca.type = "button";
    troca.onclick = () => telaLogin("", !criar);
    const msg = el("p", "msg" + (erro ? " erro" : ""), erro || "");
    const g = el("button", "google"); g.type = "button"; g.appendChild(el("span", "", "G")); g.appendChild(document.createTextNode("Entrar com Google"));
    g.onclick = async () => {
      const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
      g.disabled = true;
      try { await auth.signInWithPopup(p); }
      catch (e) {
        msg.className = "msg erro";
        if (e.code === "auth/popup-blocked") msg.textContent = "O navegador bloqueou a janela do Google. Clica de novo ou libera pop-ups pra este site.";
        else if (e.code === "auth/unauthorized-domain") msg.textContent = "Este endereço ainda não está liberado no Firebase: Authentication → Configurações → Domínios autorizados → adicionar " + location.hostname + ".";
        else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") msg.textContent = "Não deu pra entrar com o Google (" + (e.code || "erro") + "). Tenta de novo.";
        else msg.className = "msg";
      }
      g.disabled = false;
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const erroMsg = t => { msg.textContent = t; msg.className = "msg erro"; };
      const bruto = us.value.trim();
      // Quem já tem conta com e-mail de verdade também pode entrar digitando o e-mail
      const email = bruto.indexOf("@") >= 0 ? bruto : limparUsuario(bruto) + DOMINIO_EQUIPE;
      if (bruto.indexOf("@") < 0 && limparUsuario(bruto).length < 3) return erroMsg("O usuário precisa ter pelo menos 3 letras ou números.");
      if (se.value.length < 6) return erroMsg("A senha precisa ter pelo menos 6 caracteres.");
      if (criar && se.value !== se2.value) return erroMsg("As senhas não são iguais.");
      ok.disabled = true;
      try {
        if (criar) {
          const c = await auth.createUserWithEmailAndPassword(email, se.value);
          await c.user.updateProfile({ displayName: "Equipe " + limparUsuario(bruto) });
        } else await auth.signInWithEmailAndPassword(email, se.value);
      } catch (err) { erroMsg(ERROS[err.code] || "Não deu pra entrar. Tenta de novo."); }
      ok.disabled = false;
    };
    [titulo, us, se].forEach(x => f.appendChild(x));
    if (criar) f.appendChild(se2);
    [msg, ok, troca].forEach(x => f.appendChild(x));
    if (!criar) { f.appendChild(el("div", "ou", "ou")); f.appendChild(g); }
    if (opcoes.tv) {
      const volta = el("button", "ghost", "‹ Voltar pro código da TV"); volta.type = "button";
      volta.onclick = () => auth.signInAnonymously().catch(() => telaLogin("Não deu pra gerar o código. Confere a internet."));
      f.appendChild(volta);
    }
    trocar(f);
    setTimeout(() => us.focus(), 50);
  }
  const nomeConta = u => (u.email || "").slice(-DOMINIO_EQUIPE.length) === DOMINIO_EQUIPE ? "usuário “" + u.email.slice(0, -DOMINIO_EQUIPE.length) + "”" : "conta " + (u.email || u.displayName || "");

  function telaConferindo() { const d = el("div", "porta"); d.appendChild(el("p", "msg", "Conferindo acesso…")); trocar(d); }

  function telaNaoEquipe(u) {
    const d = el("div", "porta");
    d.appendChild(el("p", "msg erro", "O " + nomeConta(u) + " ainda não está liberado como equipe. Falta só liberar no Firebase (é uma vez só por usuário)."));
    const uid = el("div", "uid"); uid.appendChild(el("code", "", u.uid));
    const cp = el("button", "ghost", "Copiar"); cp.type = "button";
    cp.onclick = () => {
      const selecionar = () => { const r = document.createRange(); r.selectNodeContents(uid.firstChild); getSelection().removeAllRanges(); getSelection().addRange(r); };
      if (navigator.clipboard) navigator.clipboard.writeText(u.uid).then(() => cp.textContent = "Copiado!").catch(selecionar); else selecionar();
    };
    uid.appendChild(cp);
    const ol = el("ol");
    ol.innerHTML = "<li>No Firebase, abre o <b>Firestore</b> e clica em <b>Iniciar coleção</b> (ou abre a coleção <b>equipe</b> se já existir).</li><li>ID da coleção: <b>equipe</b>.</li><li>ID do documento: <b>cola o código acima</b>.</li><li>Adiciona um campo <b>nome</b> com qualquer valor e salva.</li>";
    const de = el("button", "btn", "Já liberei, conferir de novo"); de.type = "button"; de.onclick = () => conferir(u);
    const sa = el("button", "ghost", "Entrar com outra conta"); sa.type = "button"; sa.onclick = () => auth.signOut();
    [el("p", "msg", "Pra liberar, copia este código:"), uid, ol, de, sa].forEach(x => d.appendChild(x));
    trocar(d);
  }

  // ---------- Modo TV: código de pareamento ----------
  function pararTudoTV() {
    if (pararPareamento) { pararPareamento(); pararPareamento = null; }
    if (pararTela) { pararTela(); pararTela = null; }
  }
  function telaCodigoTV(u) {
    pararTudoTV();
    const d = el("div", "porta");
    const titulo = el("p", "passos-tv"); titulo.innerHTML = "No celular da equipe, abre <b>" + location.host + "/bar</b><br>e toca em <b>Conectar uma TV</b>. Digita o código:";
    const cod = el("div", "codigo-tv", "······");
    const status = el("p", "msg", "Gerando o código…"); status.style.textAlign = "center";
    const outra = el("button", "ghost", "Entrar com usuário e senha"); outra.type = "button";
    outra.onclick = () => { pararTudoTV(); telaLogin(); };
    [titulo, cod, status, outra].forEach(x => d.appendChild(x));
    trocar(d);

    let ref = null, timer = null;
    const gerar = async () => {
      if (ref) ref.delete().catch(() => {});
      const codigo = String(Math.floor(100000 + Math.random() * 900000));
      ref = db.doc("pareamentos/" + codigo);
      try {
        await ref.set({ uid: u.uid, criado: agoraServidor() });
        cod.textContent = codigo.slice(0, 3) + " " + codigo.slice(3);
        status.textContent = "O código troca a cada 10 minutos.";
      } catch (e) {
        status.className = "msg erro";
        status.textContent = e.code === "permission-denied"
          ? "As regras do Firestore estão desatualizadas. Publica o firestore.rules de novo."
          : "Não deu pra gerar o código (" + (e.code || "erro") + "). Confere a internet.";
      }
    };
    gerar();
    timer = setInterval(gerar, 10 * 60 * 1000);
    // Quando a equipe confirmar o código, aparece /telas/{uid} e a TV entra sozinha
    pararTela = db.doc("telas/" + u.uid).onSnapshot(s => { if (s.exists) { pararTudoTV(); liberar(u); } }, () => {});
    pararPareamento = () => { clearInterval(timer); if (ref) ref.delete().catch(() => {}); ref = null; };
  }

  function liberar(u) { while (caixa.firstChild) caixa.removeChild(caixa.firstChild); liberado = true; aoLiberar(u); }

  async function conferir(u) {
    telaConferindo();
    // TV pareada (conta anônima liberada em /telas)
    if (u.isAnonymous) {
      if (!opcoes.tv) return auth.signOut();
      let pareada = false;
      try { pareada = (await db.doc("telas/" + u.uid).get()).exists; } catch (e) {}
      return pareada ? liberar(u) : telaCodigoTV(u);
    }
    let ok = false;
    try {
      ok = (await db.doc("equipe/" + u.uid).get({ source: "server" })).exists;
      if (!ok && opcoes.tv) ok = (await db.doc("telas/" + u.uid).get()).exists;
    } catch (e) {
      telaNaoEquipe(u);
      const aviso = el("p", "msg erro");
      aviso.textContent = e.code === "permission-denied"
        ? "Diagnóstico: o banco recusou a leitura. As regras do Firestore provavelmente não foram publicadas (ou estão na versão antiga). Cola o firestore.rules de novo em Firestore → Regras e clica em Publicar."
        : "Diagnóstico: não deu pra falar com o banco (" + (e.code || e.message) + "). Confere a internet e tenta de novo.";
      caixa.firstChild.insertBefore(aviso, caixa.firstChild.firstChild);
      return;
    }
    if (!ok) {
      telaNaoEquipe(u);
      const aviso = el("p", "msg");
      aviso.textContent = "Diagnóstico: o banco respondeu, mas não existe o documento equipe/" + u.uid + ". Confere se a coleção se chama exatamente equipe (minúsculo) e se o ID do documento é igual ao código acima, sem espaço no começo ou no fim. Não use o botão “ID automático”.";
      caixa.firstChild.appendChild(aviso);
      return;
    }
    liberar(u);
  }

  auth.onAuthStateChanged(u => {
    if (!u) {
      if (liberado && aoSair) aoSair();
      liberado = false;
      if (opcoes.tv) {
        // TV: entra anônima pra gerar o código (sem digitar nada no controle remoto)
        telaConferindo();
        return auth.signInAnonymously().catch(e => telaLogin(e.code === "auth/operation-not-allowed"
          ? "O login por código ainda não está ativado no Firebase (Authentication → Método de login → Anônimo). Entra com usuário e senha por enquanto."
          : "Não deu pra gerar o código da TV. Entra com usuário e senha."));
      }
      return telaLogin();
    }
    conferir(u);
  });
}
