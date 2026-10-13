# Trela · app da noite e telão

Três páginas:

| Página | Quem abre | Onde |
|---|---|---|
| `index.html` | A galera, pelo QR code do telão | Celular |
| `telao.html` | A TV do bar (login da equipe) | Navegador da TV ou notebook ligado nela |
| `balcao.html` | A equipe (login da equipe) | Celular ou tablet do balcão |

## O que o app da galera faz

- **Login** com Google ou com conta do Trela (e-mail e senha, com "esqueci a senha"). Amigos, conversas e posts ficam salvos na conta.
- **Manda pro telão**: recado ou foto com legenda. Mostra a posição na fila e avisa quando está na TV.
- **Rolou hoje**: o feed da noite, com reações (🔥 😂 ❤️) e comentários. Os comentários abrem numa tela própria e dá pra **marcar** amigos e quem está no bar com @. Quem é marcado recebe aviso.
- **Galera** (💬 ao lado do logo):
  - **Amigos**: pedidos de amizade, marcações, lista de amigos com quem está online e "visto há X". Tocando num amigo, abre a conversa.
  - **No Trela agora**: quem abriu o app nas últimas 3 horas, com botão de adicionar.
- **Foto de perfil**: toca na tua bolinha lá em cima → "Colocar foto de perfil". A foto é cortada em quadrado e diminuída no celular. A equipe vê as fotos novas no balcão e pode remover.
- **Perfil** de cada pessoa, com os posts dela e o botão de amizade.
- **Conversas privadas só entre amigos**. Dá pra desfazer amizade, bloquear e denunciar. Mensagem com palavrão chega borrada.

## 1. Criar o Firebase (gratuito)

1. Entra em https://console.firebase.google.com → **Criar projeto** (pode desligar o Google Analytics).
2. **Firestore Database → Criar banco de dados** → região `southamerica-east1 (São Paulo)` → **modo de produção**.
3. Na aba **Regras** do Firestore, apaga tudo, cola o conteúdo de `firestore.rules` e clica em **Publicar**.
4. **Authentication → Começar → Método de login**, ativa:
   - **E-mail/senha**
   - **Google** (escolhe um e-mail de suporte e salva)
5. **Configurações do projeto → Seus apps → `</>` (Web)** → registra → copia o `firebaseConfig` pro `config.js`, no lugar dos `COLE_AQUI`.

> Login com Apple ficou de fora: exige o Apple Developer Program, que custa US$ 99 por ano.

## 2. Colocar no ar (Netlify, gratuito)

1. Conta em https://app.netlify.com → **Sites → Add new site → Deploy manually** → arrasta a pasta `trela-telao`.
2. No Firebase: **Authentication → Configurações → Domínios autorizados → Adicionar domínio** → coloca o endereço do Netlify (ex.: `trela-telao.netlify.app`). Sem isso, o login com Google não abre.

## 3. Criar a conta da equipe

A equipe usa uma conta normal, marcada como equipe no banco:

1. Abre o site (a página da galera) e **cria uma conta** com o e-mail da equipe (ex.: `balcao@trela.com`).
2. No Firebase, **Authentication → Usuários** → copia o **UID** dessa conta.
3. **Firestore → Iniciar coleção** → ID da coleção: `equipe` → ID do documento: **cola o UID** → adiciona um campo qualquer (ex.: `nome` = `Balcão`) → Salvar.

Pronto: com esse login, o `balcao.html` e o `telao.html` abrem. Dica: se entrar no balcão com uma conta que ainda não é da equipe, a própria página mostra o UID pra copiar. A equipe pode entrar com e-mail/senha ou com Google.

## Endereços

- Galera: `https://SEU-SITE.netlify.app/`
- TV: `https://SEU-SITE.netlify.app/telao.html` → entra com a conta da equipe → **Ligar o telão**
- Balcão: `https://SEU-SITE.netlify.app/balcao.html`

## Balcão

- **Recado do Trela**: entra na frente da fila. "Repetir durante a noite" faz ele voltar a cada 4 recados da galera.
- **Pra decidir**: todas as fotos e o que o filtro achou suspeito (recados e comentários), com o motivo. **Mostrar** ou **Descartar**.
- **Denúncias**: quando alguém denuncia uma conversa, aparece **só a última mensagem** da pessoa denunciada. O resto da conversa continua privado. **Suspender** bloqueia a conta de postar, comentar, conversar e adicionar amigos.
- **Contas suspensas**: dá pra **Reativar**.
- **No telão**: tudo na rotação, com **Tirar do telão**.

## Filtro

- Limpo vai direto. Cai na fila: palavrão ou ofensa (pega também `p.u.t.a`, `p0rr4`, `poooorra`), link, telefone, @ de perfil de fora do app e texto todo em maiúsculas. Marcar alguém do app com @ é liberado.
- Toda foto passa pelo balcão.
- As palavras ficam no começo do `comum.js`. As principais também estão nas regras do banco (`firestore.rules`, função `suspeito`), que barram quem tentar pular o filtro da página.

## Ajustes

- Tempo de cada recado na TV: `TEMPO_POR_RECADO` em `config.js`.
- Quantas horas alguém fica em "No Trela agora": `NO_BAR_MS` em `comum.js` (padrão 3 h).
- De quantos em quantos recados repete o recado do Trela: `BAR_A_CADA` em `telao.html`.

## Limites e custos

- O plano gratuito do Firebase dá 50 mil leituras e 20 mil gravações por dia. Com muita gente no app numa noite cheia, pode apertar. Se acontecer, o plano **Blaze** cobra só o excedente (normalmente centavos por noite). Configura um alerta de orçamento.
- "No Trela agora" mostra quem **abriu o app** nas últimas horas, não necessariamente quem está fisicamente no bar.
- Nenhum filtro é perfeito; **Tirar do telão** e **Suspender** ficam sempre à mão.
