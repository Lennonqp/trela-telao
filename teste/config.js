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

// Marca "feito por lennon" no rodapé das telas (app, balcão, menu da equipe e telão).
// Cada contato vira um botão. No telão aparece só o primeiro (sem link).
window.CONTATO_LENNON = [
  { texto: "WhatsApp (51) 99017-7804", link: "https://wa.me/5551990177804?text=" + encodeURIComponent("Oi Lennon! Vi o telão do Trela e quero um pro meu negócio.") },
  { texto: "lennonqpscs@gmail.com", link: "mailto:lennonqpscs@gmail.com?subject=" + encodeURIComponent("Telão / app pro meu negócio") }
];

// Quanto tempo cada recado fica no telão (em segundos)
window.TEMPO_POR_RECADO = 8;

// Notificações no celular: chave pública do Firebase (Configurações do projeto → Cloud Messaging →
// Certificados push da Web). Vazia = a opção de notificação não aparece no app.
window.VAPID_KEY = "";
