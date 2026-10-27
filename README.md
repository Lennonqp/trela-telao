# Trela · app da noite e telão

Três páginas:

| Página | Quem abre | Onde |
|---|---|---|
| `index.html` | A galera, pelo QR code do telão | Celular |
| `bar` | A equipe: menu com Telão e Balcão (entra uma vez só) | Celular, tablet ou PC |
| `telao` | A TV do bar (login da equipe) | Navegador da TV ou notebook ligado nela |
| `balcao` | A equipe (login da equipe) | Celular ou tablet do balcão |

## O que o app da galera faz

- **Login** com Google ou com conta do Trela (e-mail e senha, com "esqueci a senha"). Amigos, conversas e posts ficam salvos na conta.
- **Manda pro telão**: recado ou foto com legenda. Mostra a posição na fila e avisa quando está na TV.
- **Rolou hoje**: o feed da noite, com reações (🔥 😂 ❤️) e comentários. Os comentários abrem numa tela própria e dá pra **marcar** amigos e quem está no bar com @. Quem é marcado recebe aviso.
- **Galera** (💬 ao lado do logo):
  - **Amigos**: pedidos de amizade, marcações, lista de amigos com quem está online e "visto há X". Tocando num amigo, abre a conversa.
  - **No Trela agora**: quem abriu o app nas últimas 3 horas, com botão de adicionar.
- **Foto de perfil**: toca na tua bolinha lá em cima → "Colocar foto de perfil". A foto é cortada em quadrado e diminuída no celular.
- **Instalar na tela inicial**: o app tem ícone próprio e abre em tela cheia. Um aviso no feed ensina a adicionar (some quando a pessoa fecha).
- **Perfil** de cada pessoa, com os **últimos posts** dela (separados por Hoje, Ontem e data), **Conversar** e **Desfazer amizade**.
- **Lista de conversas**: em Amigos, as conversas abertas ficam em cima e os outros amigos embaixo. O **⋯** de cada pessoa tem Apagar conversa (some da lista) e Desfazer amizade.
- **Excluir minha conta**: no teu perfil (bolinha lá em cima). Pede a senha ou o Google pra confirmar e apaga perfil, foto, amizades e posts.
- **Virada da noite às 6h**: o "Rolou hoje", o telão e o balcão mostram só o que foi postado desde as 6h da manhã. Às 6h zeram sozinhos e começa a noite nova (os posts antigos ficam guardados no banco). Pra mudar o horário: `HORA_VIRADA` no `comum.js`.
- **Conversas privadas só entre amigos**. As conversas não zeram às 6h; no menu ⋯ do chat tem **Apagar conversa** (só pra mim, ou pra nós dois). Dá pra desfazer amizade, bloquear e denunciar. Mensagem com palavrão chega borrada.

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

## 3. Criar o acesso da equipe (sem e-mail)

A equipe entra com **usuário e senha**, sem precisar de e-mail:

1. Abre `balcao.html` e clica em **Primeira vez? Criar acesso da equipe**.
2. Escolhe um usuário (ex.: `balcao`) e uma senha, e clica em **Criar acesso**.
3. A página mostra um código (UID). Clica em **Copiar**.
4. No Firebase: **Firestore → Iniciar coleção** → ID da coleção: `equipe` → ID do documento: **cola o código** → campo `nome` (string) = `Balcão` → Salvar.
5. Volta no balcão e clica em **Já liberei, conferir de novo**.

Esse mesmo usuário e senha abrem o **telão**. Pra mais alguém da equipe, cria outro usuário e repete o passo 4 dentro da coleção `equipe`.

> Esqueceu a senha? Sem e-mail não dá pra recuperar: no Firebase, **Authentication → Usuários**, apaga o usuário (ex.: `balcao@equipe.trela`), cria de novo pelo balcão e libera o novo código.

## Endereços

- Menu da equipe: `https://trela-telao.vercel.app/bar` → entra uma vez e escolhe Telão ou Balcão
- Galera: `https://trela-telao.vercel.app/`
- TV: `https://trela-telao.vercel.app/telao` → entra com a conta da equipe → **Ligar o telão**
- Balcão: `https://trela-telao.vercel.app/balcao`

## Telão em qualquer TV

- **Smart TV com navegador** (Samsung, LG, TV Box, Fire TV, Android TV): abre `trela-telao.vercel.app/telao` no navegador da TV. Ela mostra um **código de 6 números**. No celular da equipe, abre `/bar` → **Conectar uma TV** → digita o código. A TV entra sozinha, sem digitar senha no controle remoto, e liga o telão em 10 segundos (ou na hora, apertando OK).
- A TV fica conectada mesmo desligando. Pra tirar o acesso, `/bar` → **Desconectar**.
- **TV sem navegador**: liga um Fire TV Stick, Chromecast com Google TV, TV Box, notebook ou celular deitado no HDMI e abre o mesmo endereço.
- O telão foi escrito com recursos que navegadores antigos de TV entendem e se ajusta a qualquer resolução (720p, 1080p, 4K).
- **Precisa ativar uma vez no Firebase**: Authentication → Método de login → **Anônimo** → ativar. É ele que a TV usa pra mostrar o código. Contas anônimas não conseguem postar, comentar nem conversar (as regras bloqueiam).

## Balcão

- **Recado do Trela**: entra na frente da fila. "Repetir durante a noite" faz ele voltar a cada 4 recados da galera.
- **Pra decidir**: o que o filtro achou suspeito (recados, legendas e comentários), com o motivo. **Mostrar** ou **Descartar**.
- **Denúncias**: quando alguém denuncia uma conversa, aparece **só a última mensagem** da pessoa denunciada. O resto da conversa continua privado. **Suspender** bloqueia a conta de postar, comentar, conversar e adicionar amigos.
- **Contas suspensas**: dá pra **Reativar**.
- **No telão**: tudo na rotação, com **Tirar do telão**.
- **Limite do telão**: só os **10 recados/fotos mais recentes da galera** giram na TV. Quando chega o 11º, o mais antigo sai da rotação (continua no feed do app). Os recados do Trela não contam nesse limite. Pra mudar o número: `MAX_GALERA` no `telao.html`.

## Ações especiais (eventos da noite)

No balcão, a área **Ações especiais** liga e desliga cada evento (ou todos de uma vez, pela chave "Todas as ações"):

- **Concurso de fotos**: a galera manda uma foto pra concorrer (1 por pessoa por noite) e curte as fotos. O balcão vê o ranking ao vivo; no telão as fotos passam de 4 em 4, depois o ranking. "Anunciar vencedor" faz a festa no telão e mostra o vencedor no app.
- **Desafio da noite**: desafio, regras e prêmio; a galera manda a foto e a equipe escolhe quem ganhou (festa no telão).
- **Enquete**: até 4 opções, resultado ao vivo no balcão, no app e no telão.
- **Sorteio**: entre quem está com o app aberto, quem postou na noite, quem fez o desafio ou quem está no concurso.
- **Karaokê**: a galera entra na fila pelo app; quem canta toca em "Terminei" e a vez passa pro próximo. Só aparece no app, não no telão.
- **Contagem regressiva**: happy hour, show… relógio no app e no telão.

No app, eventos ligados aparecem na faixa "Ao vivo", no sino de notificações e no menu ≡ → Eventos da noite.
Participações, votos, curtidas e fila zeram às 6h. **Depois de atualizar o site, publique de novo o `firestore.rules`.**

A pasta `/teste` é uma cópia pra testar mudanças antes (selo amarelo "VERSÃO DE TESTE"), usando o mesmo banco.

## Filtro

- Limpo vai direto. Cai na fila: palavrão ou ofensa (pega também `p.u.t.a`, `p0rr4`, `poooorra`), link, telefone, @ de perfil de fora do app e texto todo em maiúsculas. Marcar alguém do app com @ é liberado.
- Foto vai direto pro telão (só a legenda passa pelo filtro). A equipe tira qualquer foto com **Tirar do telão**.
- As palavras ficam no começo do `comum.js`. As principais também estão nas regras do banco (`firestore.rules`, função `suspeito`), que barram quem tentar pular o filtro da página.

## Ajustes

- Tempo de cada recado na TV: `TEMPO_POR_RECADO` em `config.js`.
- Quantas horas alguém fica em "No Trela agora": `NO_BAR_MS` em `comum.js` (padrão 3 h).
- De quantos em quantos recados repete o recado do Trela: `BAR_A_CADA` em `telao.html`.

## Limites e custos

- O plano gratuito do Firebase dá 50 mil leituras e 20 mil gravações por dia. Com muita gente no app numa noite cheia, pode apertar. Se acontecer, o plano **Blaze** cobra só o excedente (normalmente centavos por noite). Configura um alerta de orçamento.
- "No Trela agora" mostra quem **abriu o app** nas últimas horas, não necessariamente quem está fisicamente no bar.
- Nenhum filtro é perfeito; **Tirar do telão** e **Suspender** ficam sempre à mão.
