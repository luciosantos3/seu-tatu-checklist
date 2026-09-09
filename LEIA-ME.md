# Checklist de Gravação — Seu Tatu

Painel Kanban (A Gravar → Gravando → Em Revisão → Concluído) pra equipe
registrar e conferir o checklist de gravação de criativos, no mesmo visual
do TaskBoard interno. Acessível de qualquer dispositivo, com os registros
expirando sozinhos depois de **15 dias** — sem precisar de banco de dados
pago.

Cada card é uma sessão de gravação. Clique num card pra abrir o checklist
completo (pré-produção, durante, pós-produção), marcar itens, trocar o
status (o que move o card de coluna) ou excluir o registro.

## Como funciona (sem custo)

- **Netlify** hospeda o site (grátis).
- **Netlify Functions** roda o backend (grátis, incluso no plano free).
- **Netlify Blobs** guarda os registros — é um armazenamento chave-valor
  incluso de graça no Netlify, sem precisar contratar Supabase, Firebase
  ou qualquer outro serviço.
- Toda vez que alguém abre o histórico ou salva algo novo, o sistema
  automaticamente descarta registros com mais de 15 dias. Por isso o
  armazenamento nunca cresce e continua dentro do limite gratuito pra sempre.

## Como publicar no Netlify

Como o site usa uma função serverless com uma dependência (`@netlify/blobs`),
o deploy precisa passar pelo processo de build do Netlify — não dá pra
simplesmente arrastar a pasta no site (isso pularia o `npm install`).

**Passo a passo (via GitHub — recomendado):**

1. Crie um repositório novo no GitHub e suba esta pasta inteira nele.
2. No painel do Netlify: **Add new site → Import an existing project**.
3. Conecte o repositório.
4. Configurações de build (o `netlify.toml` já deixa isso configurado
   automaticamente, mas confira):
   - **Build command:** `npm install`
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
5. Clique em **Deploy site**.

Pronto — o Netlify Blobs já funciona automaticamente em produção, não
precisa criar conta em nenhum outro serviço nem configurar chave de API.

**Alternativa via Netlify CLI**, se preferir publicar direto do computador:

```bash
npm install -g netlify-cli
cd seu-tatu-checklist
npm install
netlify deploy --prod
```

## Estrutura do projeto

```
public/                → o site (HTML, CSS, JS, logo)
  checklist-data.js     → itens padrão do checklist (edite aqui pra mudar as perguntas)
netlify/functions/
  checklist.js          → API que salva/lê/apaga os registros no Netlify Blobs
netlify.toml            → configuração de build e das functions
```

## Editar os itens do checklist

Abra `public/checklist-data.js` e edite as listas de `pre`, `durante` e
`pos`. Não precisa mexer em mais nada — o formulário e o histórico se
atualizam sozinhos.

## Mudar o tempo de retenção (15 dias)

No arquivo `netlify/functions/checklist.js`, altere a constante
`RETENTION_DAYS` no topo do arquivo. No `public/app.js`, altere também a
constante `RETENTION_DAYS` (mesma lógica no front, só pra calcular a
contagem regressiva mostrada na tela).

## Instalar no iPhone (PWA)

Depois de publicado no Netlify, qualquer pessoa do time instala assim:

1. Abrir o link do site no **Safari** do iPhone (precisa ser Safari, não funciona pelo Chrome no iOS).
2. Tocar no ícone de compartilhar (o quadrado com a seta pra cima).
3. Escolher **"Adicionar à Tela de Início"**.
4. Confirmar o nome ("Checklist") e tocar em **Adicionar**.

O ícone aparece na tela como um app normal, abre em tela cheia (sem barra de endereço do Safari) e carrega instantaneamente porque o app shell fica em cache no aparelho. Os dados (gravações, checklist) continuam vindo direto do Netlify Blobs — isso nunca fica em cache, então sempre está atualizado.

Isso é um PWA (Progressive Web App), não um app da App Store — não precisa de conta de desenvolvedor Apple, não passa por revisão, e é grátis. A limitação é que não aparece buscando na App Store; só instala por esse link.

Funciona igual no Android (Chrome > menu > "Instalar app" / "Adicionar à tela inicial").
