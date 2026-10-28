// Configuração do projeto Firebase do Trela
// (Console do Firebase → Configurações do projeto → Seus apps → Web)
// Pode ficar público: quem protege os dados são as regras do firestore.rules.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAvj6HhY-J-KHCh_pqleea2TXdOAV6mWwU",
  authDomain: "trela-telao.firebaseapp.com",
  projectId: "trela-telao",
  storageBucket: "trela-telao.firebasestorage.app",
  messagingSenderId: "636208420289",
  appId: "1:636208420289:web:096741a3af7af8ad108b40",
  measurementId: "G-NHLFG7GTED"
};

// Marca "feito por lennon" no rodapé das telas.
// Preencha o contato quando quiser: aparece no app, no balcão, no menu da equipe e no telão.
//   texto: o que aparece (ex.: "WhatsApp (51) 99999-9999" ou "@lennon.dev")
//   link:  pra onde vai ao tocar (ex.: "https://wa.me/5551999999999" ou "https://instagram.com/lennon.dev")
window.CONTATO_LENNON = { texto: "", link: "" };

// Quanto tempo cada recado fica no telão (em segundos)
window.TEMPO_POR_RECADO = 8;
