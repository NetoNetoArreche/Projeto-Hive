# OpenHive AI

Plataforma open-source de criacao e gestao de conteudo para redes sociais com IA.

Crie posts com imagens e legendas geradas por IA, agende publicacoes, extraia clips de videos do YouTube, gerencie tarefas, projetos e funis de vendas - tudo em um so lugar. Integra com Instagram, Telegram e Claude (via MCP).

---

## O que o OpenHive faz

- **Posts com IA** - Gera imagens e legendas automaticamente, publica no Instagram
- **Calendario** - Visualize e agende posts em calendario
- **Tarefas** - Gerencie gravacoes e publicacoes com prioridades e prazos
- **Projetos** - Organize conteudo em projetos com modulos
- **Funis de Vendas** - Construtor visual com drag and drop (React Flow)
- **YouTube Clips** - Extraia melhores momentos de videos, crie clips verticais com face cam e legendas
- **Telegram Bot** - Crie e gerencie posts direto pelo Telegram
- **MCP Server** - 24 tools pra usar com Claude (Cowork, Desktop ou Code)
- **Equipe** - Convide membros com permissoes por pagina
- **Multi-Instagram** - Conecte varias contas do Instagram

---

## Instalacao no Coolify (Recomendado)

### Pre-requisitos

- Uma VPS (Ubuntu 22+ recomendado, minimo 2GB RAM)
- Coolify instalado na VPS ([como instalar o Coolify](https://coolify.io/docs/installation))

### Passo 1: Criar o projeto

1. Acesse o painel do Coolify (ex: `http://sua-vps:8000`)
2. Clique em **Projects** > **Add New Project**
3. De um nome (ex: "OpenHive") e clique **Continue**

### Passo 2: Adicionar o servico

1. Dentro do projeto, clique em **+ New** > **Resource**
2. Selecione **Docker Compose**
3. Em **Git Repository**, selecione **Public Repository**
4. Cole a URL: `https://github.com/NetoNetoArreche/instapost.git`
5. Em **Branch**, deixe `main`
6. Em **Docker Compose Location**, coloque: `/docker-compose.prod.yml`
7. Em **Base Directory**, deixe `/`
8. Clique **Save**

### Passo 3: Configurar dominios

Antes de deployar, va em **Configuration** > **General** e configure os dominios:

- **Domains for web**: clique **Generate Domain** (ou coloque seu dominio)
- **Domains for api**: clique **Generate Domain**
- **Domains for mcp-server**: clique **Generate Domain**

Anote as URLs geradas - voce vai precisar delas.

### Passo 4: Deploy

1. Clique no botao **Deploy** (ou **Redeploy**)
2. Aguarde ~10 minutos no primeiro deploy (baixa imagens, compila tudo)
3. Quando aparecer **Running (healthy)**, esta pronto

### Passo 5: Acessar

1. Va em **Links** (aba no topo) pra ver as URLs geradas
2. Abra a URL do **web** no navegador
3. Clique **Registrar** e crie sua conta (primeiro usuario = Owner)

### Passo 6: Configurar integracoes

Va em **Configuracoes** no menu lateral e configure tudo pela interface (veja secao "Configurar Integracoes" abaixo).

**Importante**: Em **Conexao MCP**, cole a URL do mcp-server que o Coolify gerou (a que aparece em Links) e salve. Voce vai usar essa URL pra conectar ao Claude.

---

## Instalacao no Easypanel

### Pre-requisitos

- Uma VPS (Ubuntu 22+ recomendado, minimo 2GB RAM)
- Easypanel instalado na VPS ([como instalar o Easypanel](https://easypanel.io/docs/get-started))

### Passo 1: Criar o projeto

1. Acesse o painel do Easypanel (ex: `http://sua-vps:3000`)
2. Clique em **Create Project**
3. De um nome (ex: "openhive")

### Passo 2: Criar os servicos de infraestrutura

Dentro do projeto, crie 3 servicos:

**Postgres:**
1. Clique **+ Service** > **Databases** > **Postgres**
2. Versao: `16`
3. Anote a **connection string** que o Easypanel gera (ex: `postgres://user:pass@postgres:5432/db`)

**Redis:**
1. Clique **+ Service** > **Databases** > **Redis**
2. Anote a **connection string** (ex: `redis://default:pass@redis:6379`)

**MinIO:**
1. Clique **+ Service** > **App** > **Docker Image**
2. Image: `minio/minio:latest`
3. Command: `server /data --console-address :9001`
4. Adicione as portas: `9000` e `9001`
5. Env vars: `MINIO_ROOT_USER=minioadmin` e `MINIO_ROOT_PASSWORD=suasenha`

### Passo 3: Criar o servico da API

1. Clique **+ Service** > **App** > **Github**
2. Repositorio: `NetoNetoArreche/instapost`
3. Branch: `main`
4. Dockerfile path: `packages/api/Dockerfile`
5. Porta: `3001`
6. Adicione as variaveis de ambiente:

```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgres://user:pass@postgres:5432/db    (a string do Postgres que voce anotou)
REDIS_URL=redis://default:pass@redis:6379              (a string do Redis que voce anotou)
JWT_SECRET=gere_um_secret_longo_aleatorio
INTERNAL_SERVICE_TOKEN=gere_outro_token_aleatorio
MINIO_ENDPOINT=minio                                   (nome do servico MinIO no Easypanel)
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=suasenha
MINIO_PUBLIC_URL=http://sua-vps:9000
MINIO_BUCKET=instapost-images
```

7. Clique **Deploy**

### Passo 4: Criar o servico Web

1. Clique **+ Service** > **App** > **Github**
2. Repositorio: `NetoNetoArreche/instapost`
3. Branch: `main`
4. Dockerfile path: `packages/web/Dockerfile`
5. Porta: `3000`
6. Env var: `API_INTERNAL_URL=http://api:3001` (onde `api` e o nome do servico da API)
7. Clique **Deploy**

### Passo 5: Criar o MCP Server

1. Clique **+ Service** > **App** > **Github**
2. Repositorio: `NetoNetoArreche/instapost`
3. Branch: `main`
4. Dockerfile path: `packages/mcp/Dockerfile`
5. Porta: `3002`
6. Env vars:
```
API_URL=http://api:3001
API_TOKEN=mesmo_token_do_INTERNAL_SERVICE_TOKEN
```
7. Clique **Deploy**

### Passo 6: Criar o Bot (opcional)

1. Clique **+ Service** > **App** > **Github**
2. Repositorio: `NetoNetoArreche/instapost`
3. Branch: `main`
4. Dockerfile path: `packages/bot/Dockerfile`
5. Sem porta (nao precisa expor)
6. Env vars:
```
API_URL=http://api:3001
API_TOKEN=mesmo_token_do_INTERNAL_SERVICE_TOKEN
TELEGRAM_BOT_TOKEN=seu_bot_token
TELEGRAM_ALLOWED_CHAT_IDS=seu_chat_id
```
7. Clique **Deploy**

### Passo 7: Criar o Video Worker (opcional)

1. Clique **+ Service** > **App** > **Github**
2. Repositorio: `NetoNetoArreche/instapost`
3. Branch: `main`
4. Dockerfile path: `Dockerfile.video`
5. Sem porta
6. Env vars:
```
REDIS_URL=redis://default:pass@redis:6379
DATABASE_URL=postgres://user:pass@postgres:5432/db
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=suasenha
MINIO_USE_SSL=false
MINIO_BUCKET=instapost-images
MINIO_PUBLIC_URL=http://sua-vps:9000
SCRIPTS_DIR=/app
```
7. Clique **Deploy**

### Passo 8: Rodar migrations

No Easypanel, abra o **terminal** do servico API e execute:

```bash
npx prisma migrate deploy
```

### Passo 9: Acessar e configurar

1. Abra a URL do servico Web
2. Registre sua conta
3. Va em Configuracoes e configure as integracoes (veja abaixo)

---

## Instalacao via Docker Compose (VPS com SSH)

Se voce tem acesso SSH direto a VPS (sem Coolify/Easypanel):

```bash
# 1. Clone o repositorio
git clone https://github.com/NetoNetoArreche/instapost.git
cd instapost

# 2. Rode o setup (gera secrets, sobe Docker, roda migrations, cria admin)
bash setup.sh --production
```

Isso cria tudo automaticamente. Acesse `http://SEU_IP:3000` e faca login com:
- Email: `admin@openhive.local`
- Senha: `admin123` (troque depois!)

A URL do MCP sera: `http://SEU_IP:3002/mcp`

---

## Instalacao Local (Desenvolvimento)

```bash
# 1. Clone
git clone https://github.com/NetoNetoArreche/instapost.git
cd instapost

# 2. Setup (sobe Postgres, Redis, MinIO via Docker + instala deps + cria admin)
bash setup.sh

# 3. Inicie
npm run dev
```

Acesse `http://localhost:3000`. MCP em `http://localhost:3002/mcp`.

---

## Configurar Integracoes

Todas as integracoes sao configuradas pela interface web em **Configuracoes** (menu lateral).

### Instagram (publicacao automatica)

Voce precisa de um Facebook App pra publicar no Instagram via API.

1. Acesse [developers.facebook.com](https://developers.facebook.com/)
2. Clique em **Meus Apps** > **Criar App**
3. Tipo: **Empresa**
4. De um nome (ex: "MeuApp") e clique criar
5. No painel do app, clique em **Adicionar Produto** > **Instagram** > **Configurar**
6. Em **Funcoes do app** > **Funcoes**, adicione sua conta do Instagram como **Testador do Instagram**
7. No Instagram, aceite o convite (Configuracoes > Apps e sites > Convites de testador)
8. Volte ao Facebook Developer > **Instagram** > **Configuracao da API** > clique **Gerar token** ao lado da sua conta
9. Aceite as permissoes e copie o token

Agora no OpenHive:

10. Va em **Configuracoes** > **Chaves de API** > **Facebook App**
11. Cole o **App ID** (numero no topo da pagina do Facebook Developer, ex: `953530353793172`)
12. Clique em **Mostrar** na chave secreta do Instagram e cole no campo **App Secret**
13. Salve os dois
14. Em **Contas do Instagram**, clique **Adicionar Conta**
15. Cole o **Access Token** que voce gerou
16. Cole o **User ID** do Instagram (aparece abaixo do nome da conta no Facebook Developer, ex: `17841480567944567`)
17. Clique **Adicionar**

O token e trocado automaticamente por um long-lived (validade 60 dias) e renovado a cada 50 dias automaticamente.

Para adicionar mais contas, repita o processo a partir do passo 6.

### Google Gemini (geracao de imagens e legendas)

1. Acesse [aistudio.google.com](https://aistudio.google.com/)
2. Clique em **Get API Key** > **Create API Key**
3. Copie a key
4. No OpenHive > **Configuracoes** > **Geracao de Imagens (Gemini)** > cole e salve

### Telegram Bot

1. No Telegram, fale com [@BotFather](https://t.me/BotFather)
2. Envie `/newbot` e siga as instrucoes pra criar o bot
3. Copie o **token** que o BotFather gera
4. No OpenHive > **Configuracoes** > **Telegram Bot** > cole o **Bot Token**
5. No campo **Chat IDs**, coloque o ID do seu chat do Telegram
   - Pra descobrir seu ID: fale com [@userinfobot](https://t.me/userinfobot) no Telegram
6. Salve

### YouTube Clips (cookies)

O YouTube bloqueia downloads de servidores. Voce precisa exportar cookies do seu navegador:

1. No Chrome, instale a extensao **"Get cookies.txt LOCALLY"**
2. Va ao [youtube.com](https://youtube.com) e faca login
3. Clique na extensao > **Export** > salve o arquivo `cookies.txt`
4. No OpenHive > **Configuracoes** > **YouTube Clips** > clique **Enviar cookies.txt** e faca upload

### Conectar ao Claude (MCP)

1. No OpenHive > **Configuracoes** > **Conexao MCP**
2. Cole a URL do MCP Server (do Coolify/Easypanel/VPS) e salve
3. Copie a URL

**No Claude Cowork (conector MCP):**
1. Clique em **Personalizar** (canto inferior esquerdo)
2. Va em **Conectores** > clique no **+** (Adicionar)
3. Cole a URL do MCP e salve
4. O OpenHive aparece na lista com 24 tools disponiveis

**No Claude Cowork (plugin com skills):**
1. [Baixe o ZIP do plugin OpenHive aqui](https://drive.google.com/drive/folders/1VeyeIXuZrkkrRDWjv-jv0ph6biKOXPP4?usp=sharing)
2. Extraia o ZIP numa pasta local
3. No Claude Code, execute os comandos:
```bash
/plugin marketplace add ./caminho/para/openhives-plugin
/plugin install openhives
/reload-plugins
```
4. As skills do OpenHive ficam disponiveis no Cowork automaticamente

**No Claude Desktop:**
1. Va em **Settings** > **MCP Servers** > **Add Server**
2. Cole a URL do MCP e salve

**No Claude Code:**
1. Adicione no arquivo de configuracao MCP (`claude_desktop_config.json` ou similar)

O Claude tera acesso a 24 tools pra criar posts, gerar imagens, tarefas, projetos e mais.

---

## Como usar

### Criar post com IA

**Pela web:** Novo Post > digite o tema > IA gera imagem e legenda > revise > publique ou agende

**Pelo Telegram:** envie qualquer texto pro bot > ele gera o post > use os botoes pra publicar/agendar

**Pelo Claude:** peca "Cria um post sobre X" > Claude usa as tools automaticamente

### YouTube Clips

1. **Clips** > **Novo Clip** > cole URL do YouTube > **Analisar**
2. Espere a IA transcrever e encontrar os melhores momentos
3. Selecione quais momentos quer > **Gerar Clips**
4. Download dos clips verticais (1080x1920) com face cam e legendas

### Funis de Vendas

**Funis** > **Novo Funil** > crie etapas e passos > use o modo **Flow** pra arrastar e conectar visualmente

### Equipe

**Equipe** > convide por email > defina funcao e paginas permitidas

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
| `/status` | Status das integracoes |

---

## MCP Tools (24)

| Tool | Descricao |
|------|-----------|
| `create_post` | Cria post |
| `list_posts` | Lista posts |
| `add_image_to_post` | Adiciona imagem |
| `schedule_post` | Agenda publicacao |
| `publish_now` | Publica agora |
| `generate_image` | Gera imagem com IA |
| `generate_caption` | Gera legenda com IA |
| `upload_image` | Upload de imagem |
| `get_analytics` | Metricas Instagram |
| `create_task` | Cria tarefa |
| `list_tasks` | Lista tarefas |
| `update_task` | Atualiza tarefa |
| `delete_task` | Remove tarefa |
| `create_project` | Cria projeto |
| `list_projects` | Lista projetos |
| `get_project` | Detalhes do projeto |
| `update_project` | Atualiza projeto |
| `delete_project` | Remove projeto |
| `add_module` | Adiciona modulo |
| `update_module` | Atualiza modulo |
| `delete_module` | Remove modulo |
| `analyze_youtube_video` | Analisa video YouTube |
| `cut_youtube_clips` | Corta clips |
| `list_video_clips` | Lista clips |

---

## Licenca

[AGPL-3.0](LICENSE)

Voce pode usar, modificar e distribuir livremente. Se hospedar como servico publico, deve disponibilizar o codigo fonte das suas modificacoes.
