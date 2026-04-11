# OpenHive AI

Plataforma open-source de criacao e gestao de conteudo para redes sociais com IA.

Crie posts com imagens e legendas geradas por IA, agende publicacoes, extraia clips de videos do YouTube, gerencie tarefas, projetos e funis de vendas. Integra com Instagram, Telegram, Claude e Gemini (via MCP).

## Tutorial em video

[![Tutorial OpenHive AI](https://img.youtube.com/vi/wjQiGIeOEzo/maxresdefault.jpg)](https://youtu.be/wjQiGIeOEzo)

> Clique na imagem acima para assistir o tutorial completo no YouTube.

---

## O que o OpenHive faz

- **Posts com IA** - Gera imagens (Google Gemini) e legendas, publica no Instagram
- **Editor Visual** - Editor tipo Figma para slides: edite titulo, subtitulo, fonte, posicao, overlay, fundo, cantos, logo, indicadores, glass effect, word highlights e mais. Preview ao vivo em 1080px
- **IA no Editor** - Gere conteudo de slides com Gemini, refine textos com instrucoes em linguagem natural ("deixe mais curto", "mude o tom"), gere imagens de fundo por prompt
- **Carrossel** - Crie carrosseis com 2-10 slides (HTML/Tailwind renderizado ou IA)
- **Carrossel Misto** - Capa gerada por IA + slides em HTML/Template (melhor dos dois mundos)
- **Carrossel Composto** - Cada slide com fundo IA + overlay HTML/Tailwind com CSS variables do brand
- **Brands** - Cadastre marcas com logo, 6 cores, 3 fontes, tom de voz, produtos, **site** e **Instagram**. Agentes de IA podem pesquisar essas URLs para manter consistencia
- **Design Systems** - Biblioteca com 58 inspiracoes visuais (Stripe, Linear, Apple, Notion, Tesla, etc) para criar brands
- **Calendario** - Visualize e agende posts em calendario
- **Tarefas** - Gerencie gravacoes e publicacoes com prioridades e prazos
- **Projetos** - Organize conteudo em projetos com modulos
- **Funis de Vendas** - Construtor visual com drag and drop (React Flow)
- **YouTube Clips** - Extraia melhores momentos, crie clips verticais com face cam e legendas
- **Telegram Bot** - Crie e gerencie posts direto pelo Telegram
- **MCP Server** - 40 tools pra usar com Claude, Gemini Antigravity, Cursor e outros
- **Equipe** - Convide membros com permissoes por pagina
- **Multi-Instagram** - Conecte varias contas do Instagram
- **Tema escuro** - Interface dark mode com tons neutros (estilo Figma/Framer)

---

## Arquitetura

```
┌─────────────────────────────────────────────────┐
│                    Clientes                      │
│  Web (3000)  │  Telegram Bot  │  MCP (3002)     │
└──────┬───────┴───────┬────────┴──────┬──────────┘
       │               │               │
       ▼               ▼               ▼
┌─────────────────────────────────────────────────┐
│              API Express (3001)                  │
│  Auth │ Posts │ Tasks │ Projects │ Funnels       │
│  Generate │ Upload │ Instagram │ Video Clips     │
└──┬──────┬──────┬──────┬──────┬──────────────────┘
   │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼
 Postgres Redis  MinIO  Gemini  Renderer (3003)
  (5432)  (6379) (9000)  API    Puppeteer+Chromium
```

### Packages

| Package | Descricao | Porta |
|---------|-----------|-------|
| `packages/api` | API REST (Express + Prisma + BullMQ) | 3001 |
| `packages/web` | Frontend (Next.js 14 + Tailwind) | 3000 |
| `packages/bot` | Telegram Bot (grammy.js) | - |
| `packages/mcp` | MCP Server HTTP (40 tools) | 3002 |
| `packages/mcp-cli` | MCP CLI para IDEs externas (npm) | - |
| `packages/shared` | Tipos TypeScript compartilhados | - |
| `scripts/renderer` | HTML para PNG (Puppeteer) | 3003 |
| `scripts/video` | Video Worker (Python + ffmpeg) | - |

### Portas

| Porta | Servico | Uso |
|-------|---------|-----|
| 3000 | Web (Next.js) | Dashboard |
| 3001 | API (Express) | REST API |
| 3002 | MCP Server | Model Context Protocol |
| 3003 | Renderer | HTML para PNG |
| 5432 | PostgreSQL | Banco de dados (interno Docker) |
| 5433 | PostgreSQL | Banco de dados (dev local, evita conflito) |
| 6379 | Redis | Filas BullMQ |
| 9000 | MinIO API | Storage S3 |
| 9001 | MinIO Console | UI do MinIO |

---

## Como instalar

O OpenHive usa **Docker Compose** em todos os cenarios. Escolha a opcao que se encaixa no seu caso:

| Cenario | O que acontece | Arquivo |
|---------|---------------|---------|
| **Desenvolvimento local** | Docker Compose sobe o banco, cache e storage. A aplicacao roda com `npm run dev`. | `docker-compose.yml` |
| **VPS com SSH** | Docker Compose sobe **tudo** (infra + app) com um unico comando. | `docker-compose.production.yml` |
| **Coolify** | Voce aponta o repo e o Coolify usa o Docker Compose pra buildar e rodar tudo. | `docker-compose.prod.yml` |
| **Easypanel** | Voce aponta o repo e o Easypanel usa o Docker Compose pra buildar e rodar tudo. | `docker-compose.prod.yml` |

> **Resumo:** em todos os casos voce precisa de Docker. A unica diferenca e se voce roda `docker compose` direto no terminal ou se uma plataforma (Coolify/Easypanel) faz isso por voce.

---

## Instalacao Local (Desenvolvimento)

### Pre-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (ja inclui Docker Compose)
- [Node.js 22 LTS](https://nodejs.org/) (recomendado via [fnm](https://github.com/Schniz/fnm) ou [nvm](https://github.com/nvm-sh/nvm))
- Git

> **Por que Docker?** O Docker Compose sobe automaticamente o banco de dados (PostgreSQL), cache (Redis) e storage de imagens (MinIO). Voce nao precisa instalar nenhum desses manualmente.

### Passo a passo

#### 1. Clone o repositorio

```bash
git clone https://github.com/NetoNetoArreche/instapost.git
cd instapost
```

#### 2. Configure o ambiente

```bash
cp .env.example .env
```

Abra o `.env` e substitua os valores `CHANGE_ME` por senhas seguras (ou use o setup automatico no passo abaixo).

#### 3. Suba a infraestrutura com Docker Compose

```bash
docker compose up -d
```

Isso inicia 3 containers:

| Container | Servico | Porta |
|-----------|---------|-------|
| `instapost-postgres` | PostgreSQL 16 | 5433 (mapeada de 5432 interna) |
| `instapost-redis` | Redis 7 | 6379 |
| `instapost-minio` | MinIO (S3) | 9000 (API) / 9001 (Console) |

Verifique se estao rodando:

```bash
docker compose ps
```

Os 3 devem aparecer como **running (healthy)**.

#### 4. Instale dependencias e rode migrations

```bash
npm install
npx prisma migrate deploy --schema=packages/api/prisma/schema.prisma
```

#### 5. Inicie a aplicacao

```bash
npm run dev
```

Acesse:
- **Web**: http://localhost:3000
- **API**: http://localhost:3001
- **MCP**: http://localhost:3002/mcp
- **MinIO Console**: http://localhost:9001

#### 6. Crie sua conta

Abra http://localhost:3000, clique em **Registrar** e crie sua conta. O primeiro usuario criado sera o Owner.

### Setup automatico (alternativa)

Se preferir, o script `setup.sh` faz tudo de uma vez (gera .env com secrets aleatorios, sobe Docker, instala deps, roda migrations e cria usuario admin):

```bash
bash setup.sh
```

Login padrao: `admin@instapost.local` / `admin123` (troque depois!)

### Comandos uteis do Docker Compose

```bash
# Ver status dos containers
docker compose ps

# Ver logs de um servico especifico
docker compose logs postgres
docker compose logs redis
docker compose logs minio

# Parar tudo (dados persistem nos volumes)
docker compose down

# Parar e apagar todos os dados (recomecar do zero)
docker compose down -v

# Reiniciar um servico
docker compose restart postgres
```

### Renderer Service (para carrosseis HTML)

O renderer e necessario para a funcionalidade de carrossel com HTML/CSS/Tailwind. Em dev local, rode separado:

```bash
docker compose -f docker-compose.production.yml up renderer -d
```

---

## Instalacao via Docker Compose (VPS com SSH)

Para VPS com acesso SSH direto (sem Coolify/Easypanel). O Docker Compose sobe **tudo** — infra e aplicacao — em containers.

### Pre-requisitos

- VPS Ubuntu 22+ (minimo 2GB RAM)
- Docker e Docker Compose instalados ([como instalar Docker no Ubuntu](https://docs.docker.com/engine/install/ubuntu/))
- Git

### O que o Docker Compose cria

O arquivo `docker-compose.production.yml` sobe **8 containers**:

| Container | Servico | Porta exposta |
|-----------|---------|---------------|
| `instapost-postgres` | PostgreSQL 16 (banco de dados) | interna (5432) |
| `instapost-redis` | Redis 7 (filas e cache) | interna (6379) |
| `instapost-minio` | MinIO (storage S3 para imagens) | 9000 / 9001 |
| `instapost-api` | API Express (backend) | 3001 |
| `instapost-web` | Next.js (frontend) | 3000 |
| `instapost-bot` | Telegram Bot | - |
| `instapost-mcp` | MCP Server (40 tools) | 3002 |
| `renderer` | Puppeteer (HTML para PNG) | 3003 |

### Passo a passo

#### 1. Clone e rode o setup

```bash
git clone https://github.com/NetoNetoArreche/instapost.git
cd instapost
bash setup.sh --production
```

O `setup.sh --production`:
- Gera o `.env` com secrets aleatorios
- Roda `docker compose -f docker-compose.production.yml up -d` (builda e sobe tudo)
- Executa migrations do banco dentro do container da API
- Cria o usuario admin

#### 2. Verifique se esta tudo rodando

```bash
docker compose -f docker-compose.production.yml ps
```

Todos os containers devem aparecer como **running**.

#### 3. Acesse

- **Web**: `http://SEU_IP:3000`
- **API**: `http://SEU_IP:3001`
- **MCP**: `http://SEU_IP:3002/mcp`
- **MinIO Console**: `http://SEU_IP:9001`

Login padrao: `admin@instapost.local` / `admin123` (troque depois!)

### Comandos uteis (producao)

```bash
# Ver status
docker compose -f docker-compose.production.yml ps

# Ver logs de um servico
docker compose -f docker-compose.production.yml logs api
docker compose -f docker-compose.production.yml logs web

# Reiniciar tudo
docker compose -f docker-compose.production.yml restart

# Atualizar para nova versao
git pull
docker compose -f docker-compose.production.yml up -d --build

# Parar tudo (dados persistem)
docker compose -f docker-compose.production.yml down
```

### Configurar dominio com proxy reverso

Use Nginx ou Caddy na frente dos containers:

```nginx
# /etc/nginx/sites-available/openhive
server {
    server_name app.seudominio.com;
    location / { proxy_pass http://127.0.0.1:3000; }
}
server {
    server_name api.seudominio.com;
    location / { proxy_pass http://127.0.0.1:3001; }
}
server {
    server_name mcp.seudominio.com;
    location / { proxy_pass http://127.0.0.1:3002; }
}
server {
    server_name s3.seudominio.com;
    location / { proxy_pass http://127.0.0.1:9000; }
}
```

Apos configurar o dominio, atualize no `.env` e reinicie:
```bash
# Edite o .env
FRONTEND_URL=https://app.seudominio.com
MINIO_PUBLIC_URL=https://s3.seudominio.com

# Reinicie para aplicar
docker compose -f docker-compose.production.yml up -d
```

---

## Instalacao no Coolify

O Coolify e uma plataforma self-hosted que gerencia Docker Compose por voce. Ele le o arquivo `docker-compose.prod.yml` do repositorio, builda as imagens e sobe todos os containers automaticamente.

### Pre-requisitos

- VPS Ubuntu 22+ (minimo 2GB RAM)
- Coolify instalado ([como instalar](https://coolify.io/docs/installation))

### O que o Coolify faz por voce

Ao apontar o Coolify para este repositorio, ele usa o `docker-compose.prod.yml` que sobe:

| Servico no Compose | O que e | Porta |
|---------------------|---------|-------|
| `postgres` | PostgreSQL 16 | interna |
| `redis` | Redis 7 (com senha) | interna |
| `minio` | MinIO (storage S3) | 9000 / 9001 |
| `api` | API Express (backend) | 3001 |
| `web` | Next.js (frontend) | 3000 |
| `telegram-bot` | Telegram Bot | - |
| `mcp-server` | MCP Server (40 tools) | 3002 |
| `renderer` | Puppeteer (HTML para PNG) | 3003 |

O Coolify cuida de: build das imagens, SSL automatico, dominios, restart e logs.

### Passo 1: Criar o projeto

1. Acesse o painel do Coolify (ex: `http://sua-vps:8000`)
2. **Projects** > **Add New Project** > nomeie "OpenHive"

### Passo 2: Adicionar como Docker Compose

1. Dentro do projeto, clique **+ New** > **Resource**
2. Selecione **Docker Compose**
3. Em **Git Repository** > **Public Repository**
4. URL: `https://github.com/NetoNetoArreche/instapost.git`
5. Branch: `main`
6. Docker Compose Location: `/docker-compose.prod.yml`
7. Base Directory: `/`
8. Clique **Save**

> **Importante:** o Coolify vai ler o `docker-compose.prod.yml` e criar todos os servicos automaticamente. Voce nao precisa criar containers manualmente.

### Passo 3: Configurar variaveis de ambiente

Va em **Environment Variables**. Apague tudo e cole apenas isto (trocando cada `CHANGE_ME` por uma senha inventada por voce):

```bash
DB_PASSWORD=CHANGE_ME
REDIS_PASSWORD=CHANGE_ME
MINIO_SECRET_KEY=CHANGE_ME
JWT_SECRET=CHANGE_ME
INTERNAL_SERVICE_TOKEN=CHANGE_ME
```

**So essas 5 senhas.** Nao precisa colocar Gemini, Instagram, Telegram, dominios nem nada mais aqui. Tudo isso voce configura depois pela interface web do OpenHive.

### Passo 4: Primeiro deploy

1. Clique **Deploy**
2. Aguarde ~10 minutos (build das imagens)
3. Quando aparecer **Running (healthy)**, esta pronto

### Passo 5: Configurar dominios

Agora que esta rodando, voce precisa dizer ao Coolify quais servicos devem ser acessiveis. **Voce NAO precisa ter um dominio proprio** — o Coolify gera URLs automaticas.

Va em **Configuration** > **General**. Para cada servico abaixo, clique **Generate Domain** (ou coloque seu dominio se tiver um):

| Servico | Porta | O que e |
|---------|-------|---------|
| **web** | 3000 | Dashboard — o que voce acessa no navegador |
| **api** | 3001 | Backend — a web precisa dele pra funcionar |
| **minio** | 9000 | Storage — onde as imagens ficam salvas |
| **mcp-server** | 3002 | MCP — conexao com IDEs (opcional) |

O Coolify gera URLs automaticas tipo `openhive-web-abc123.coolify.io`. Se voce tiver dominio proprio pode usar, mas **nao e obrigatorio**.

O Coolify gera SSL (HTTPS) automaticamente.

Anote as URLs geradas — voce vai precisar de 2 delas no proximo passo.

### Passo 6: Atualizar as URLs no ambiente

Volte em **Environment Variables** e adicione estas 2 linhas, usando as URLs que o Coolify gerou:

```bash
FRONTEND_URL=https://url-do-web-que-o-coolify-gerou
MINIO_PUBLIC_URL=https://url-do-minio-que-o-coolify-gerou
```

Clique **Save** e depois **Deploy** novamente para aplicar.

### Passo 7: Acessar e configurar

1. Abra a URL do **web** no navegador (a mesma que voce colocou no FRONTEND_URL)
2. Clique **Registrar** e crie sua conta (primeiro usuario = Owner)
3. Va em **Configuracoes** no menu lateral e configure tudo pela interface:
   - **Geracao de Imagens** — cole sua chave do Google Gemini ([pegue aqui](https://aistudio.google.com/))
   - **Instagram** — conecte sua conta (opcional)
   - **Telegram Bot** — cole o token do BotFather (opcional)

> **Resumo:** voce NAO precisa comprar um dominio. O Coolify gera URLs automaticas. Todas as integracoes (Gemini, Instagram, Telegram) sao configuradas pela interface web, nao por variaveis de ambiente.

---

## Instalacao no Easypanel

O Easypanel e um painel de controle self-hosted para Docker. Ele suporta deploy via **Docker Compose** — o jeito mais facil de subir o OpenHive inteiro com poucos cliques.

### Pre-requisitos

- VPS Ubuntu 22+ (minimo 2GB RAM)
- Easypanel instalado ([como instalar](https://easypanel.io/docs/get-started))

### O que vai ser criado

O Docker Compose (`docker-compose.prod.yml`) sobe **8 containers** automaticamente:

| Container | Servico | Porta |
|-----------|---------|-------|
| `postgres` | PostgreSQL 16 (banco de dados) | interna |
| `redis` | Redis 7 (filas e cache) | interna |
| `minio` | MinIO (storage S3 para imagens) | 9000 / 9001 |
| `api` | API Express (backend) | 3001 |
| `web` | Next.js (frontend) | 3000 |
| `telegram-bot` | Telegram Bot | - |
| `mcp-server` | MCP Server (40 tools) | 3002 |
| `renderer` | Puppeteer (HTML para PNG) | 3003 |

Voce nao precisa criar cada servico manualmente — o Docker Compose faz tudo.

### Passo 1: Criar o projeto

1. Acesse o painel do Easypanel (ex: `http://sua-vps:3000`)
2. Clique **Create Project** > nome: `openhive`

### Passo 2: Adicionar como Docker Compose

1. Dentro do projeto, clique **+ Service**
2. Selecione **Docker Compose**
3. Em **Source**, selecione **Github** (ou **Git URL** para repo publico)
4. URL: `https://github.com/NetoNetoArreche/instapost.git`
5. Branch: `main`
6. Docker Compose Path: `docker-compose.prod.yml`
7. Clique **Save**

> O Easypanel vai ler o `docker-compose.prod.yml` e criar todos os 8 servicos automaticamente. Voce nao precisa configurar containers manualmente.

### Passo 3: Configurar variaveis de ambiente

Clique em **Ambiente** no menu lateral. **Apague tudo** que o Easypanel colocou la (ele preenche automaticamente com valores de exemplo, ignore tudo). Cole **apenas** isto:

```bash
DB_PASSWORD=MinhaSenh4Forte1
REDIS_PASSWORD=MinhaSenh4Forte2
MINIO_SECRET_KEY=MinhaSenh4Forte3
JWT_SECRET=MinhaSenh4Forte4
INTERNAL_SERVICE_TOKEN=MinhaSenh4Forte5
```

Troque as senhas de exemplo acima por senhas suas. Pode inventar qualquer coisa, so nao use `@`, `#` ou espacos.

**So essas 5 senhas e mais nada.**

**NAO COLOQUE nenhuma destas variaveis agora (elas vem DEPOIS):**
- ~~FRONTEND_URL~~ — voce adiciona no **Passo 6**, depois que o Easypanel gerar a URL
- ~~MINIO_PUBLIC_URL~~ — voce adiciona no **Passo 6**, depois que o Easypanel gerar a URL
- ~~NANO_BANANA_API_KEY~~ — voce configura pela **interface web** do OpenHive (menu Configuracoes), nao aqui
- ~~NANO_BANANA_PROVIDER~~ — mesmo, pela interface web
- ~~TELEGRAM_BOT_TOKEN~~ — mesmo, pela interface web
- ~~INSTAGRAM_ACCESS_TOKEN~~ — mesmo, pela interface web
- ~~DATABASE_URL~~ — o Docker Compose monta sozinho usando DB_PASSWORD
- ~~REDIS_URL~~ — o Docker Compose monta sozinho usando REDIS_PASSWORD
- ~~MINIO_ENDPOINT~~ — o Docker Compose configura sozinho

> **Como as senhas funcionam?** Voce inventa uma senha para `DB_PASSWORD` e o Docker Compose automaticamente usa essa mesma senha para criar o banco Postgres E para a API conectar nele. Voce nao precisa saber a connection string nem configurar nada separado — o Compose monta tudo sozinho internamente. O mesmo vale para `REDIS_PASSWORD` e `MINIO_SECRET_KEY`.

Clique **Salvar**.

### Passo 4: Primeiro deploy

1. Clique em **Implantar** (botao verde no topo)
2. Aguarde ~10 minutos (ele vai buildar as imagens Docker — e normal demorar)
3. Quando os servicos aparecerem como **Running**, esta pronto

> **O app ja funciona neste ponto**, so as imagens nao vao carregar ate voce configurar os dominios nos proximos passos.

### Passo 5: Descobrir o IP da sua VPS

Voce precisa do IP da sua VPS para criar os dominios. No Easypanel, o IP aparece no **canto inferior esquerdo** do painel (na barra lateral, embaixo de tudo). E algo como `123.45.67.89`.

Anote esse IP — voce vai usar no proximo passo.

### Passo 6: Configurar dominios

Voce precisa criar 4 dominios para os servicos ficarem acessiveis pelo navegador. **Voce NAO precisa comprar um dominio** — vamos usar o `sslip.io` que e gratuito e resolve automaticamente pro IP da sua VPS.

1. Clique em **Dominios** no menu lateral esquerdo
2. Clique em **Adicionar Dominio**. Vai abrir um formulario com os campos: Host, Porta, Servico Compose, etc.
3. Crie os 4 dominios abaixo, um de cada vez:

**Dominio 1 — Web (Dashboard):**
- **Host**: `web.SEU_IP.sslip.io` (ex: `web.123.45.67.89.sslip.io`)
- **Porta**: `3000`
- **Servico Compose**: `web`
- **Caminho**: `/`
- Clique **Criar**

**Dominio 2 — API (Backend):**
- **Host**: `api.SEU_IP.sslip.io` (ex: `api.123.45.67.89.sslip.io`)
- **Porta**: `3001`
- **Servico Compose**: `api`
- **Caminho**: `/`
- Clique **Criar**

**Dominio 3 — MinIO (Storage de imagens):**
- **Host**: `minio.SEU_IP.sslip.io` (ex: `minio.123.45.67.89.sslip.io`)
- **Porta**: `9000`
- **Servico Compose**: `minio`
- **Caminho**: `/`
- Clique **Criar**

**Dominio 4 — MCP Server (para IDEs, opcional):**
- **Host**: `mcp.SEU_IP.sslip.io` (ex: `mcp.123.45.67.89.sslip.io`)
- **Porta**: `3002`
- **Servico Compose**: `mcp-server`
- **Caminho**: `/`
- Clique **Criar**

> **O que e sslip.io?** E um servico DNS gratuito. Quando voce acessa `web.123.45.67.89.sslip.io`, ele automaticamente resolve para o IP `123.45.67.89`. Nao precisa configurar nada nem comprar dominio. Se voce tiver um dominio proprio, pode usar ele no lugar (ex: `app.seusite.com`).

### Passo 7: Atualizar as URLs no ambiente

1. Clique em **Ambiente** no menu lateral
2. Adicione estas 2 linhas **no final** das variaveis que ja estao la, trocando `SEU_IP` pelo IP real da sua VPS:

```bash
FRONTEND_URL=https://web.SEU_IP.sslip.io
MINIO_PUBLIC_URL=https://minio.SEU_IP.sslip.io
```

**Exemplo real** (se seu IP e `123.45.67.89`):
```bash
FRONTEND_URL=https://web.123.45.67.89.sslip.io
MINIO_PUBLIC_URL=https://minio.123.45.67.89.sslip.io
```

3. Clique **Salvar**
4. Clique **Implantar** (botao verde no topo) para aplicar as mudancas

### Passo 8: Acessar e configurar

1. Abra `https://web.SEU_IP.sslip.io` no navegador (troque `SEU_IP` pelo IP real)
2. Clique **Registrar** e crie sua conta (primeiro usuario vira Owner automaticamente)
3. Va em **Configuracoes** no menu lateral e configure tudo pela interface web:
   - **Geracao de Imagens** — cole sua chave do Google Gemini ([pegue aqui](https://aistudio.google.com/))
   - **Instagram** — conecte sua conta (opcional)
   - **Telegram Bot** — cole o token do BotFather (opcional)

> **Resumo:** voce NAO precisa comprar um dominio. O sslip.io gera URLs automaticas a partir do IP da sua VPS. Todas as integracoes (Gemini, Instagram, Telegram) sao configuradas pela interface web do OpenHive, nao por variaveis de ambiente.

### Alternativa: criar servicos manualmente

Se preferir nao usar Docker Compose no Easypanel, voce pode criar cada servico individualmente:

<details>
<summary>Clique para ver o passo a passo manual</summary>

#### Infraestrutura

1. **Postgres**: + Service > Databases > Postgres 16. Anote a connection string.
2. **Redis**: + Service > Databases > Redis. Anote a connection string.
3. **MinIO**: + Service > App > Docker Image
   - Image: `minio/minio:latest`
   - Command: `server /data --console-address :9001`
   - Portas: `9000` e `9001`
   - Env: `MINIO_ROOT_USER=minioadmin`, `MINIO_ROOT_PASSWORD=CHANGE_ME`
   - Dominio para porta 9000 (ex: `s3.seudominio.com`)

#### API (backend)

- + Service > App > Github
- Repo: `NetoNetoArreche/instapost`, Branch: `main`
- Dockerfile: `packages/api/Dockerfile`, Porta: `3001`
- Dominio: `api.seudominio.com`
- Env vars:
```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgres://<user>:<pass>@postgres.openhive.internal:5432/<db>
REDIS_URL=redis://default:<pass>@redis.openhive.internal:6379
JWT_SECRET=CHANGE_ME
JWT_EXPIRES_IN=7d
INTERNAL_SERVICE_TOKEN=CHANGE_ME
MINIO_ENDPOINT=minio.openhive.internal
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=CHANGE_ME
MINIO_PUBLIC_URL=https://s3.seudominio.com
MINIO_BUCKET=openhive-images
FRONTEND_URL=https://app.seudominio.com
```

#### Web (frontend)

- + Service > App > Github
- Dockerfile: `packages/web/Dockerfile`, Porta: `3000`
- Dominio: `app.seudominio.com`
- Env: `API_INTERNAL_URL=http://api.openhive.internal:3001`

#### MCP Server

- + Service > App > Github
- Dockerfile: `packages/mcp/Dockerfile`, Porta: `3002`
- Dominio: `mcp.seudominio.com`
- Env: `API_URL=http://api.openhive.internal:3001`, `API_TOKEN=mesmo_INTERNAL_SERVICE_TOKEN`

#### Renderer

- + Service > App > Github
- Dockerfile: `Dockerfile.renderer`, Porta: `3003`

#### Telegram Bot (opcional)

- + Service > App > Github
- Dockerfile: `packages/bot/Dockerfile`
- Env: `API_URL=http://api.openhive.internal:3001`, `API_TOKEN=mesmo_INTERNAL_SERVICE_TOKEN`, `TELEGRAM_BOT_TOKEN=...`, `TELEGRAM_ALLOWED_CHAT_IDS=...`

</details>

---

## Variaveis de Ambiente (.env)

> **Se voce esta usando Easypanel ou Coolify, IGNORE esta secao.** Ela e para desenvolvimento local e VPS com SSH. No Easypanel/Coolify voce so precisa das 5 senhas descritas na secao de instalacao acima.

<details>
<summary>Referencia completa de variaveis (dev local / VPS)</summary>

```bash
# === Banco de Dados ===
DB_PASSWORD=senha_forte                    # Senha do Postgres
DATABASE_URL=postgresql://instapost:SENHA@localhost:5433/instapost  # Dev local
# DATABASE_URL=postgresql://instapost:SENHA@postgres:5432/instapost # Docker prod

# === Redis ===
REDIS_URL=redis://localhost:6379           # Dev local
# REDIS_URL=redis://:senha@redis:6379     # Docker prod com senha

# === JWT ===
JWT_SECRET=openssl_rand_hex_32             # Gere com: openssl rand -hex 32
JWT_EXPIRES_IN=7d

# === Token interno (Bot + MCP autenticam na API) ===
INTERNAL_SERVICE_TOKEN=openssl_rand_hex_24 # Gere com: openssl rand -hex 24

# === MinIO (Storage S3) ===
MINIO_ENDPOINT=localhost                   # Dev: localhost | Docker: minio
MINIO_PORT=9000
MINIO_USE_SSL=false                        # true se usar HTTPS
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=senha_minio
MINIO_PUBLIC_URL=http://localhost:9000     # URL publica para acessar imagens
MINIO_BUCKET=instapost-images

# === Frontend ===
FRONTEND_URL=http://localhost:3000         # URL do web app
WEB_PORT=3000

# === MCP Server ===
MCP_PORT=3002

# === Geracao de Imagens (Google Gemini) ===
NANO_BANANA_API_KEY=                       # Chave do Google AI Studio
NANO_BANANA_PROVIDER=google               # google | nanobananaapi | fal

# === Instagram (opcional) ===
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_USER_ID=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

# === Telegram Bot (opcional) ===
TELEGRAM_BOT_TOKEN=                        # Token do BotFather
TELEGRAM_ALLOWED_CHAT_IDS=                 # IDs dos chats permitidos
```

</details>

---

## Conectar MCP (IDEs e Agentes)

O OpenHive expoe 40 tools via Model Context Protocol. Ha duas formas de conectar:

### Opcao 1: MCP Server HTTP (ja incluso no projeto)

Quando voce roda o OpenHive (local ou VPS), o MCP Server HTTP ja sobe automaticamente na porta 3002. Nao precisa instalar nada extra.

**URL do MCP:**
- Local: `http://localhost:3002/mcp`
- VPS: `https://mcp.seudominio.com/mcp`

**Claude Cowork**: Personalizar > Conectores > + Adicionar > cole a URL do MCP

**Claude Desktop**: Settings > MCP Servers > Add Server > cole a URL do MCP

### Opcao 2: MCP CLI via npx (para IDEs com Stdio)

Usado pelo **Gemini Antigravity**, **Cursor**, **VS Code**, **Claude Code** e qualquer IDE que suporte MCP via comando stdio.

**Nao precisa instalar nada manualmente.** O `npx -y` baixa e executa o pacote automaticamente. Basta adicionar a configuracao JSON na sua IDE.

O `OPENHIVE_API_URL` deve apontar pra sua API:
- Se roda **local**: `http://localhost:3001`
- Se roda em **VPS**: `https://api.seudominio.com`

O `OPENHIVE_API_TOKEN` e o mesmo valor do `INTERNAL_SERVICE_TOKEN` que esta no seu `.env`.

**Gemini Antigravity** (`~/.gemini/antigravity/mcp_config.json`):
```json
{
  "mcpServers": {
    "openhive": {
      "command": "npx",
      "args": ["-y", "openhive-mcp-server@latest"],
      "env": {
        "OPENHIVE_API_URL": "http://localhost:3001",
        "OPENHIVE_API_TOKEN": "seu_INTERNAL_SERVICE_TOKEN"
      }
    }
  }
}
```

**Claude Code** (`~/.claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "openhive": {
      "command": "npx",
      "args": ["-y", "openhive-mcp-server@latest"],
      "env": {
        "OPENHIVE_API_URL": "http://localhost:3001",
        "OPENHIVE_API_TOKEN": "seu_INTERNAL_SERVICE_TOKEN"
      }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json` na raiz do projeto):
```json
{
  "mcpServers": {
    "openhive": {
      "command": "npx",
      "args": ["-y", "openhive-mcp-server@latest"],
      "env": {
        "OPENHIVE_API_URL": "http://localhost:3001",
        "OPENHIVE_API_TOKEN": "seu_INTERNAL_SERVICE_TOKEN"
      }
    }
  }
}
```

**VS Code** (`.vscode/mcp.json`):
```json
{
  "servers": {
    "openhive": {
      "command": "npx",
      "args": ["-y", "openhive-mcp-server@latest"],
      "env": {
        "OPENHIVE_API_URL": "http://localhost:3001",
        "OPENHIVE_API_TOKEN": "seu_INTERNAL_SERVICE_TOKEN"
      }
    }
  }
}
```

### Opcao 3: Plugin Claude Cowork + Skills Antigravity

O plugin inclui skills do OpenHive (carrossel, LinkedIn, Twitter, YouTube, etc) com fluxos guiados. Tambem inclui skills para o Gemini Antigravity.

1. [Baixe o plugin e as skills](https://drive.google.com/drive/folders/19mjr6dnzNrAyz92cij3RRLVB2F9710AT?usp=sharing)
2. Extraia numa pasta local

**Claude Cowork:**
```bash
/plugin marketplace add ./caminho/para/openhives-plugin
/plugin install openhives
/reload-plugins
```

**Gemini Antigravity:**
Copie os arquivos de skills para `~/.gemini/antigravity/skills/` e reinicie o Antigravity.

---

## Configurar Integracoes

Todas configuradas pela interface web em **Configuracoes** (menu lateral).

### Google Gemini (geracao de imagens e legendas)

1. Acesse [aistudio.google.com](https://aistudio.google.com/)
2. **Get API Key** > **Create API Key**
3. No OpenHive > Configuracoes > Geracao de Imagens (Gemini) > cole e salve

### Instagram (publicacao automatica)

1. Acesse [developers.facebook.com](https://developers.facebook.com/)
2. **Meus Apps** > **Criar App** > tipo **Empresa**
3. No app, **Adicionar Produto** > **Instagram** > **Configurar**
4. **Funcoes do app** > adicione sua conta como **Testador do Instagram**
5. No Instagram, aceite o convite (Config > Apps e sites > Convites)
6. Volte ao Facebook > Instagram > Config da API > **Gerar token**
7. No OpenHive:
   - Configuracoes > Chaves de API > cole **App ID** e **App Secret**
   - Contas do Instagram > Adicionar Conta > cole **Access Token** e **User ID**

O token e renovado automaticamente a cada 50 dias.

### Telegram Bot

1. No Telegram, fale com [@BotFather](https://t.me/BotFather) > `/newbot`
2. Copie o token
3. Descubra seu chat ID: fale com [@userinfobot](https://t.me/userinfobot)
4. No OpenHive > Configuracoes > Telegram Bot > cole token e chat ID

### YouTube Clips (cookies)

1. No Chrome, instale **"Get cookies.txt LOCALLY"**
2. Va ao youtube.com logado > exporte cookies
3. No OpenHive > Configuracoes > YouTube Clips > upload do `cookies.txt`

---

## MCP Tools (40)

### Design Systems (biblioteca de inspiracoes)
| Tool | Descricao |
|------|-----------|
| `list_design_systems` | Lista 58 inspiracoes visuais (Stripe, Linear, Apple, Notion, Tesla, etc) com paleta, vibe e mood |
| `get_design_system` | Detalhes completos de uma inspiracao (cores, tipografia, principios) |
| `list_design_system_categories` | Categorias disponiveis (fintech, dev-tools, ai, luxury, etc) |
| `suggest_brand_from_inspirations` | Combina 1-5 inspiracoes em uma sugestao de brand pronta para salvar |

### Brands
| Tool | Descricao |
|------|-----------|
| `list_brands` | Lista brands cadastrados (use antes de criar visuais) |
| `get_brand` | Detalhes de um brand especifico |
| `get_default_brand` | Brand padrao do usuario |
| `create_brand` | Cria brand (logo, cores, produtos, tom de voz) |
| `update_brand` | Atualiza brand |
| `set_default_brand` | Define brand padrao |
| `delete_brand` | Remove brand |

### Posts
| Tool | Descricao |
|------|-----------|
| `create_post` | Cria post ou carrossel (image_prompt, image_prompts, image_urls) |
| `update_post` | Edita post (legenda, hashtags, reagendamento automatico) |
| `create_mixed_carousel` | Carrossel misto: capa IA + slides HTML/Template (aceita brand_id) |
| `list_posts` | Lista posts com filtros |
| `add_image_to_post` | Adiciona imagem a post existente (vira carrossel auto) |
| `schedule_post` | Agenda publicacao |
| `publish_now` | Publica imediatamente no Instagram |

### Geracao
| Tool | Descricao |
|------|-----------|
| `generate_image` | Gera imagem via Google Gemini |
| `generate_caption` | Gera legenda e conteudo de slide com Gemini (fallback estatico se sem API key) |
| `generate_template_image` | Gera imagem com template HTML pre-definido |
| `render_html_to_image` | Renderiza HTML/CSS/Tailwind em PNG |
| `compose_image_with_html_overlay` | Combina imagem IA de fundo + HTML/Tailwind overlay com CSS variables do brand (7 variaveis + logo automatico) |
| `upload_image` | Upload de imagem base64 |
| `get_analytics` | Metricas dos posts |

### Editor Visual (via web)
| Funcionalidade | Descricao |
|------|-----------|
| Gerar conteudo com IA | Gera titulo + subtitulo via Gemini baseado no tema |
| Refinar slide com IA | Refina textos com instrucoes em linguagem natural (ex: "mais curto", "tom profissional") |
| Gerar imagem de fundo | Gera imagem por prompt via Gemini direto no editor |
| Templates | 6 templates (hero, content, stat, quote, cta, list) com preview ao vivo |
| Word highlights | Destaque individual por palavra (cor, bold, italic, underline) |
| Cantos configuráveis | Texto nos 4 cantos + icones + glass effect |
| Aspect ratios | 1:1 (Feed), 4:5 (Retrato), 9:16 (Stories) |

### Tarefas
| Tool | Descricao |
|------|-----------|
| `create_task` | Cria tarefa (gravacao, post, patrocinio) |
| `list_tasks` | Lista com filtros |
| `update_task` | Atualiza tarefa |
| `delete_task` | Remove tarefa |

### Projetos
| Tool | Descricao |
|------|-----------|
| `create_project` | Cria projeto com modulos |
| `list_projects` | Lista projetos |
| `get_project` | Detalhes com modulos e tarefas |
| `update_project` | Atualiza projeto |
| `delete_project` | Remove projeto |
| `add_module` | Adiciona modulo |
| `update_module` | Atualiza modulo |
| `delete_module` | Remove modulo |

### Video
| Tool | Descricao |
|------|-----------|
| `analyze_youtube_video` | Analisa video YouTube (transcreve + detecta momentos) |
| `cut_youtube_clips` | Corta clips verticais com face cam e legendas |
| `list_video_clips` | Lista clips |

---

## Telegram Bot - Comandos

| Comando | O que faz |
|---------|-----------|
| `/start` | Lista todos os comandos |
| `/gerar [tema]` | Gera post com imagem e legenda |
| `/gerar 3 [tema]` | Gera carrossel com 3 imagens |
| `/novopost` | Criacao interativa de post |
| `/listar` | Posts agendados |
| `/publicar [id]` | Publica post |
| `/agendar [id] [data] [hora]` | Agenda post |
| `/cancelar [id]` | Cancela agendamento |
| `/tarefas` | Tarefas dos proximos 7 dias |
| `/projetos` | Lista projetos |
| `/funis` | Lista funis |
| `/clip [url]` | Analisa video do YouTube |
| `/clipcortar [id] todos` | Corta clips |
| `/template [titulo]` | Gera imagem com template |
| `/status` | Status das integracoes |

---

## Como usar

### Criar post pela web
Novo Post > digite o tema > IA gera imagem e legenda > revise > publique ou agende

### Criar carrossel pelo MCP (HTML)
1. O agente gera HTML de cada slide
2. Chama `render_html_to_image` para cada slide > coleta as URLs
3. Chama `create_post({ image_urls: [url1, url2, ...], caption: "..." })`

### Criar carrossel pelo MCP (IA)
1. Chama `create_post({ image_prompts: ["slide 1", "slide 2", ...], caption: "..." })`
2. As imagens sao geradas automaticamente via Gemini

### Criar carrossel misto (capa IA + slides template)
**Pela web:** Novo Post > aba **Misto** > gere a capa com IA e adicione slides template um a um.

**Pelo MCP:**
```
create_mixed_carousel({
  cover_prompt: "imagem vibrante sobre produtividade",
  slides: [
    { title: "Dica 1", subtitle: "...", template: "bold-gradient" },
    { title: "Dica 2", subtitle: "...", template: "minimal-dark" }
  ],
  brand_id: "uuid-do-brand"  // opcional - aplica logo + cores automaticamente
})
```

### Brands (identidade visual)
Cadastre suas marcas para aplicar logo, cores e tom de voz automaticamente nos posts.

**Pela web:**
1. Menu lateral > **Brands** > **Novo Brand**
2. Configure:
   - **Nome** e **logo** (PNG/JPG/WebP)
   - **Cor primaria** e **secundaria** (color picker)
   - **Descricao** e **tom de voz** (educativo, descontraido, etc)
   - **Site (URL)** - agentes de IA podem visitar para pesquisar informacoes do brand
   - **Instagram (URL do perfil)** - agentes podem analisar o estilo visual e de conteudo
   - **Produtos/servicos** (separados por virgula)
   - **Hashtags padrao**
3. Marque **brand padrao** para aplicar automaticamente

**Pelo MCP** (em qualquer IDE):
1. O agente chama `list_brands` para descobrir brands disponiveis
2. Pega `website_url` e `instagram_url` para pesquisar contexto e estilo
3. Pergunta qual brand voce quer aplicar no post
4. Passa `brand_id` para `create_mixed_carousel` ou `create_post`
5. O OpenHive aplica automaticamente:
   - **Logo** no canto inferior direito de cada slide template
   - **Cores** do brand nos templates HTML
   - **Tom de voz** na geracao da legenda
   - **Hashtags padrao** mescladas as hashtags do post

Exemplo de prompt no chat: *"Cria um carrossel sobre 5 dicas de produtividade usando o brand Buildix - antes de criar, pesquise no site e Instagram dele pra manter o estilo"*

### YouTube Clips
1. Clips > Novo Clip > cole URL > Analisar
2. Espere transcricao e deteccao de momentos
3. Selecione momentos > Gerar Clips
4. Download dos clips verticais (1080x1920)

### Funis de Vendas
Funis > Novo Funil > crie etapas e passos > modo Flow pra arrastar e conectar

### Equipe
Equipe > convide por email > defina funcao e paginas permitidas

---

## Licenca

**Source Available License** — [ver LICENSE](LICENSE)

Voce pode usar o OpenHive gratuitamente para uso pessoal e interno. **NAO** e permitido:
- Vender, revender ou distribuir comercialmente
- Modificar e redistribuir como produto proprio
- Oferecer como SaaS para terceiros
- Remover a marca ou renomear

Para licenciamento comercial: helioarreche@gmail.com
