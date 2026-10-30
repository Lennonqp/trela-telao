// Recebe as notificações no celular mesmo com o Trela fechado (Firebase Cloud Messaging).
// Fica na mesma pasta do app: /sw.js no oficial, /teste/sw.js no teste.
self.window = self;   // o config.js escreve em window.*
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js",
  "config.js"
);
firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

// Com o app fechado ou em segundo plano: mostra a notificação
messaging.onBackgroundMessage(p => {
  const d = (p && p.data) || {};
  return self.registration.showNotification(d.titulo || "Trela", {
    body: d.texto || "",
    icon: "icone-192.png",
    badge: "icone-192.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || "./" }
  });
});

// Tocar na notificação abre (ou traz pra frente) o Trela
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || "./", self.location.origin).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(janelas => {
    for (const j of janelas) {
      if (j.url.indexOf(self.registration.scope) === 0 && "focus" in j) {
        if (j.url !== alvo && "navigate" in j) j.navigate(alvo).catch(() => {});
        return j.focus();
      }
    }
    return clients.openWindow(alvo);
  }));
});
