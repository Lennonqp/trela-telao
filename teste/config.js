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

// Marca "feito por Na Tela" no rodapé das telas (app, balcão, menu da equipe e telão).
// Cada contato vira um botão. No telão aparece só o primeiro (sem link).
// Sem contato por enquanto (rodapé mostra só "feito por Na Tela"). Pra voltar, coloque itens assim:
// { texto: "WhatsApp (00) 00000-0000", link: "https://wa.me/5500000000000" }
window.CONTATO_LENNON = [];

// Quanto tempo cada recado fica no telão (em segundos)
window.TEMPO_POR_RECADO = 8;

// Notificações no celular: chave pública do Firebase (Configurações do projeto → Cloud Messaging →
// Certificados push da Web). Vazia = a opção de notificação não aparece no app.
window.VAPID_KEY = "BIh3VPifqcbnrCarsqcnMbQNF740GnGt0n9v2nQFcFt6lNlCjnSeHptk03AYBxpunoAqWhvD8RIJPyfkgQeTq0U";
