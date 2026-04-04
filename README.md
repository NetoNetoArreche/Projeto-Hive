# OpenHive AI

Plataforma open-source de criacao e gestao de conteudo para redes sociais com IA.

Crie posts com imagens e legendas geradas por IA, agende publicacoes, extraia clips de videos do YouTube, gerencie tarefas, projetos e funis de vendas. Integra com Instagram, Telegram, Claude e Gemini (via MCP).

---

## O que o OpenHive faz

- **Posts com IA** - Gera imagens (Google Gemini) e legendas, publica no Instagram
- **Carrossel** - Crie carrosseis com 2-10 slides (HTML/Tailwind renderizado ou IA)
- **Calendario** - Visualize e agende posts em calendario
- **Tarefas** - Gerencie gravacoes e publicacoes com prioridades e prazos
- **Projetos** - Organize conteudo em projetos com modulos
- **Funis de Vendas** - Construtor visual com drag and drop (React Flow)
- **YouTube Clips** - Extraia melhores momentos, crie clips verticais com face cam e legendas
- **Telegram Bot** - Crie e gerencie posts direto pelo Telegram
- **MCP Server** - 26 tools pra usar com Claude, Gemini Antigravity, Cursor e outros
- **Equipe** - Convide membros com permissoes por pagina
- **Multi-Instagram** - Conecte varias contas do Instagram

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
| `packages/mcp` | MCP Server HTTP (26 tools) | 3002 |
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

## Instalacao Local (Desenvolvimento)

### Pre-requisitos

- Node.js 22 LTS
- Docker e Docker Compose
- Git

### Passo a passo

```bash
# 1. Clone
git clone https://github.com/NetoNetoArreche/instapost.git
cd instapost

# 2. Setup automatico (gera .env, sobe Postgres/Redis/MinIO, instala deps, roda migrations, cria admin)
bash setup.sh

# 3. Inicie todos os servicos em dev
npm run dev
```

Acesse:
- **Web**: http://localhost:3000
- **API**: http://localhost:3001
- **MCP**: http://localhost:3002/mcp
- **MinIO Console**: http://localhost:9001

Login padrao: `admin@instapost.local` / `admin123` (troque depois!)

### Setup manual (se preferir)

```bash
# 1. Copie e edite o .env
cp .env.example .env
# Edite o .env e preencha os valores CHANGE_ME

# 2. Suba a infraestrutura
docker compose up -d

# 3. Instale dependencias
npm install

# 4. Rode migrations
npx prisma migrate deploy --schema=packages/api/prisma/schema.prisma

# 5. Inicie
npm run dev
```

### Renderer Service (para carrosseis HTML)

O renderer e necessario para a funcionalidade de carrossel com HTML/CSS/Tailwind. Em dev local, rode separado:

```bash
docker compose -f docker-compose.production.yml up renderer -d
```

Ou rode manualmente:

```bash
cd scripts/renderer
npm init -y && npm install puppeteer-core express
# Requer Chromium instalado no sistema
node server.js
```

---

## Instalacao via Docker Compose (VPS com SSH)

Para VPS com acesso SSH direto (sem Coolify/Easypanel):

```bash
# 1. Clone
git clone https://github.com/NetoNetoArreche/instapost.git
cd instapost

# 2. Setup producao (gera secrets, sobe TUDO em Docker, roda migrations, cria admin)
bash setup.sh --production
```

Isso cria tudo automaticamente com `docker-compose.production.yml`:
- PostgreSQL, Redis, MinIO (infraestrutura)
- API + Video Worker, Web, Bot, MCP Server, Renderer (aplicacao)

Acesse `http://SEU_IP:3000` e faca login com:
- Email: `admin@instapost.local`
- Senha: `admin123` (troque depois!)

URL do MCP: `http://SEU_IP:3002/mcp`

### Configurar dominio com proxy reverso

Use Nginx ou Caddy na frente dos servicos:

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

Apos configurar o dominio, atualize no `.env`:
```
FRONTEND_URL=https://app.seudominio.com
MINIO_PUBLIC_URL=https://s3.seudominio.com
```

---

## Instalacao no Coolify

### Pre-requisitos

- VPS Ubuntu 22+ (minimo 2GB RAM)
- Coolify instalado ([como instalar](https://coolify.io/docs/installation))

### Passo 1: Criar o projeto

1. Acesse o painel do Coolify (ex: `http://sua-vps:8000`)
2. **Projects** > **Add New Project** > nomeie "OpenHive"

### Passo 2: Adicionar o servico

1. Dentro do projeto, clique **+ New** > **Resource**
2. Selecione **Docker Compose**
3. Em **Git Repository** > **Public Repository**
4. URL: `https://github.com/NetoNetoArreche/instapost.git`
5. Branch: `main`
6. Docker Compose Location: `/docker-compose.prod.yml`
7. Base Directory: `/`
8. Clique **Save**

### Passo 3: Configurar variaveis de ambiente

Va em **Environment Variables** e adicione:

```
DB_PASSWORD=senha_forte_aleatoria
REDIS_PASSWORD=outra_senha_forte
JWT_SECRET=openssl_rand_hex_32
INTERNAL_SERVICE_TOKEN=openssl_rand_hex_24
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=senha_minio_forte
MINIO_PUBLIC_URL=https://s3.seudominio.com
FRONTEND_URL=https://app.seudominio.com
NANO_BANANA_API_KEY=sua_chave_gemini
NANO_BANANA_PROVIDER=google
TELEGRAM_BOT_TOKEN=token_do_botfather
TELEGRAM_ALLOWED_CHAT_IDS=seu_chat_id
```

### Passo 4: Configurar dominios

Em **Configuration** > **General**, configure dominios para cada servico:

- **web**: `app.seudominio.com` (ou Generate Domain)
- **api**: `api.seudominio.com`
- **mcp-server**: `mcp.seudominio.com`
- **minio**: `s3.seudominio.com` (porta 9000)

Anote as URLs geradas.

### Passo 5: Deploy

1. Clique **Deploy**
2. Aguarde ~10 minutos no primeiro deploy
3. Quando aparecer **Running (healthy)**, esta pronto

### Passo 6: Acessar

1. Abra a URL do **web** no navegador
2. Clique **Registrar** e crie sua conta (primeiro usuario = Owner)
3. Va em **Configuracoes** e configure as integracoes

---

## Instalacao no Easypanel

### Pre-requisitos

- VPS Ubuntu 22+ (minimo 2GB RAM)
- Easypanel instalado ([como instalar](https://easypanel.io/docs/get-started))

### Passo 1: Criar projeto e infraestrutura

1. Acesse o Easypanel > **Create Project** > nome: "openhive"

2. **Postgres**: + Service > Databases > Postgres 16. Anote a connection string.

3. **Redis**: + Service > Databases > Redis. Anote a connection string.

4. **MinIO**: + Service > App > Docker Image
   - Image: `minio/minio:latest`
   - Command: `server /data --console-address :9001`
   - Portas: `9000` e `9001`
   - Env: `MINIO_ROOT_USER=minioadmin`, `MINIO_ROOT_PASSWORD=senha_forte`
   - Configure dominio para porta 9000 (ex: `s3.seudominio.com`)

### Passo 2: Servico API

1. + Service > App > Github
2. Repo: `NetoNetoArreche/instapost`, Branch: `main`
3. Dockerfile: `packages/api/Dockerfile`
4. Porta: `3001`
5. Env vars:

```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgres://user:pass@postgres.openhive.internal:5432/db
REDIS_URL=redis://default:pass@redis.openhive.internal:6379
JWT_SECRET=gere_hex_32_aleatorio
JWT_EXPIRES_IN=7d
INTERNAL_SERVICE_TOKEN=gere_hex_24_aleatorio
MINIO_ENDPOINT=minio.openhive.internal
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=senha_forte
MINIO_PUBLIC_URL=https://s3.seudominio.com
MINIO_BUCKET=openhive-images
FRONTEND_URL=https://app.seudominio.com
NANO_BANANA_API_KEY=sua_chave_gemini
NANO_BANANA_PROVIDER=google
```

6. Deploy

### Passo 3: Servico Web

1. + Service > App > Github
2. Repo: `NetoNetoArreche/instapost`, Branch: `main`
3. Dockerfile: `packages/web/Dockerfile`
4. Porta: `3000`
5. Env: `API_INTERNAL_URL=http://api.openhive.internal:3001`
6. Configure dominio (ex: `app.seudominio.com`)
7. Deploy

### Passo 4: MCP Server

1. + Service > App > Github
2. Repo: `NetoNetoArreche/instapost`, Branch: `main`
3. Dockerfile: `packages/mcp/Dockerfile`
4. Porta: `3002`
5. Env:
```
API_URL=http://api.openhive.internal:3001
API_TOKEN=mesmo_INTERNAL_SERVICE_TOKEN_da_api
```
6. Configure dominio (ex: `mcp.seudominio.com`)
7. Deploy

### Passo 5: Renderer (necessario para carrosseis HTML)

1. + Service > App > Github
2. Repo: `NetoNetoArreche/instapost`, Branch: `main`
3. Dockerfile: `Dockerfile.renderer`
4. Porta: `3003`
5. Sem env vars necessarias
6. Deploy

### Passo 6: Telegram Bot (opcional)

1. + Service > App > Github
2. Repo: `NetoNetoArreche/instapost`, Branch: `main`
3. Dockerfile: `packages/bot/Dockerfile`
4. Sem porta (nao precisa expor)
5. Env:
```
API_URL=http://api.openhive.internal:3001
API_TOKEN=mesmo_INTERNAL_SERVICE_TOKEN_da_api
TELEGRAM_BOT_TOKEN=token_do_botfather
TELEGRAM_ALLOWED_CHAT_IDS=seu_chat_id
```
6. Deploy

### Passo 7: Acessar

1. Abra a URL do Web
2. Registre sua conta (primeiro = Owner)
3. Va em **Configuracoes** e configure integracoes

---

## Variaveis de Ambiente (.env)

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

---

## Conectar MCP (IDEs e Agentes)

O OpenHive expoe 26 tools via Model Context Protocol. Ha duas formas de conectar:

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
      "args": ["-y", "openhive-mcp-server@1.1.0"],
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
      "args": ["-y", "openhive-mcp-server@1.1.0"],
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
      "args": ["-y", "openhive-mcp-server@1.1.0"],
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
      "args": ["-y", "openhive-mcp-server@1.1.0"],
      "env": {
        "OPENHIVE_API_URL": "http://localhost:3001",
        "OPENHIVE_API_TOKEN": "seu_INTERNAL_SERVICE_TOKEN"
      }
    }
  }
}
```

### Opcao 3: Plugin Claude Cowork (com Skills)

O plugin inclui skills do OpenHive (carrossel, LinkedIn, Twitter, YouTube, etc) com fluxos guiados.

1. [Baixe o ZIP do plugin](https://drive.google.com/drive/folders/1VeyeIXuZrkkrRDWjv-jv0ph6biKOXPP4?usp=sharing)
2. Extraia numa pasta local
3. No Claude Code:
```bash
/plugin marketplace add ./caminho/para/openhives-plugin
/plugin install openhives
/reload-plugins
```

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

## MCP Tools (26)

### Posts
| Tool | Descricao |
|------|-----------|
| `create_post` | Cria post ou carrossel (image_prompt, image_prompts, image_urls) |
| `list_posts` | Lista posts com filtros |
| `add_image_to_post` | Adiciona imagem a post existente (vira carrossel auto) |
| `schedule_post` | Agenda publicacao |
| `publish_now` | Publica imediatamente no Instagram |

### Geracao
| Tool | Descricao |
|------|-----------|
| `generate_image` | Gera imagem via Google Gemini |
| `generate_caption` | Gera legenda otimizada |
| `generate_template_image` | Gera imagem com template HTML pre-definido |
| `render_html_to_image` | Renderiza HTML/CSS/Tailwind em PNG |
| `upload_image` | Upload de imagem base64 |
| `get_analytics` | Metricas dos posts |

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

[AGPL-3.0](LICENSE)

Voce pode usar, modificar e distribuir livremente. Se hospedar como servico publico, deve disponibilizar o codigo fonte das suas modificacoes.
