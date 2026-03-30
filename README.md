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

## Instalacao Rapida (Coolify)

A forma mais facil de instalar. Se voce tem uma VPS com Coolify:

### 1. Crie o projeto no Coolify

- Va em **Projects** > **New Project**
- Escolha **Docker Compose** como Build Pack
- Cole a URL do repositorio: `https://github.com/NetoNetoArreche/instapost.git`
- Em **Docker Compose Location**, coloque: `/docker-compose.prod.yml`
- Clique **Save** e depois **Deploy**

### 2. Aguarde o deploy

O primeiro deploy demora ~10 minutos (baixa imagens, instala dependencias, compila). Os proximos sao mais rapidos (~3 minutos).

### 3. Acesse o OpenHive

Depois do deploy, o Coolify gera URLs automaticas pra cada servico. Clique em **Links** pra ver:

- **Web** - Interface principal (a que voce vai usar no dia a dia)
- **API** - Backend (nao precisa acessar diretamente)
- **MCP** - Servidor MCP (copie essa URL pra conectar ao Claude)

### 4. Crie sua conta

1. Abra a URL do **Web**
2. Clique em **Registrar**
3. Crie sua conta (o primeiro usuario vira Owner com acesso total)

### 5. Configure as integracoes

Va em **Configuracoes** (ultimo item no menu lateral) e configure:

#### Instagram (publicacao automatica)

1. Acesse [developers.facebook.com](https://developers.facebook.com/)
2. Crie um app (ou use um existente) do tipo **Empresa**
3. Adicione o produto **Instagram** ao app
4. Em **Funcoes do app**, adicione sua conta do Instagram como **Testador do Instagram**
5. Aceite o convite no Instagram (Configuracoes > Apps e sites)
6. Volte ao Facebook Developer > **Instagram** > **Gerar token**
7. No OpenHive, va em **Configuracoes**:
   - Em **Chaves de API** > **Facebook App**, cole o **App ID** (topo da pagina do Facebook Developer) e o **App Secret** (Chave secreta do app do Instagram). Salve os dois
   - Em **Contas do Instagram**, clique **Adicionar Conta**, cole o **Access Token** gerado e o **User ID** do Instagram
   - O token e trocado automaticamente por um long-lived (60 dias) e renovado a cada 50 dias

#### Google Gemini (geracao de imagens e legendas)

1. Acesse [aistudio.google.com](https://aistudio.google.com/)
2. Clique em **Get API Key** > **Create API Key**
3. No OpenHive, va em **Configuracoes** > **Geracao de Imagens (Gemini)** > cole a API Key e salve

#### Telegram Bot

1. No Telegram, fale com [@BotFather](https://t.me/BotFather)
2. Envie `/newbot` e siga as instrucoes
3. Copie o token do bot
4. No OpenHive, va em **Configuracoes** > **Telegram Bot** > cole o **Bot Token**
5. No campo **Chat IDs**, coloque o ID do seu chat (envie `/start` pro bot e veja nos logs, ou use [@userinfobot](https://t.me/userinfobot))

#### YouTube Clips (cookies para download)

O YouTube bloqueia downloads de servidores. Para funcionar:

1. No seu navegador (Chrome), instale a extensao **"Get cookies.txt LOCALLY"**
2. Va ao YouTube e faca login na sua conta
3. Clique na extensao e exporte os cookies (salva como `cookies.txt`)
4. No OpenHive, va em **Configuracoes** > **YouTube Clips** > clique **Enviar cookies.txt**

### 6. Conecte ao Claude (MCP)

O OpenHive tem 24 tools de IA que o Claude pode usar pra criar posts, tarefas, projetos, gerar imagens e mais.

1. No OpenHive, va em **Configuracoes** > **Conexao MCP**
2. Cole a URL do MCP que o Coolify gerou (clique em **Links** no Coolify, e a URL que termina com a porta 3002)
3. Salve a URL
4. Copie a URL e adicione no Claude:
   - **Claude Cowork**: Personalizar > Conectores > + (Adicionar) > Cole a URL
   - **Claude Desktop**: Settings > MCP Servers > Add Server > Cole a URL
   - **Claude Code**: Adicione no arquivo de configuracao

Pronto! O Claude agora pode criar posts, gerar imagens, agendar publicacoes e mais pelo OpenHive.

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

## Como usar

### Criar um post com IA

**Pela web:**
1. Clique em **Novo Post** no menu
2. Digite o tema do post
3. A IA gera imagem e legenda automaticamente
4. Revise, edite se quiser, e publique ou agende

**Pelo Telegram:**
1. Envie qualquer texto pro bot (ex: "5 dicas de produtividade")
2. O bot gera imagem + legenda e mostra botoes: Aprovar, Publicar, Agendar
3. Ou use `/gerar 3 dicas de marketing` pra carrossel com 3 imagens

**Pelo Claude (MCP):**
1. Peca ao Claude: "Cria um post sobre inteligencia artificial"
2. O Claude usa as tools `generate_image`, `generate_caption` e `create_post`

### YouTube Clips

1. Va em **Clips** > **Novo Clip**
2. Cole a URL do video do YouTube
3. Clique **Analisar Video**
4. O sistema baixa, transcreve e encontra os melhores momentos
5. Selecione quais momentos quer e clique **Gerar Clips**
6. Cada clip e gerado em formato vertical (1080x1920) com:
   - Deteccao de rosto automatica (face cam + conteudo)
   - Legendas automaticas (.srt e .ass)
   - Download direto (MP4, SRT, ASS)

### Funis de Vendas

1. Va em **Funis** > **Novo Funil**
2. Crie etapas (ex: Lead Capture, Email, Vendas)
3. Adicione passos em cada etapa
4. Use o modo **Flow** pra arrastar, conectar e visualizar o fluxo
5. Acompanhe o progresso de cada etapa

### Gerenciar Equipe

1. Va em **Equipe**
2. Convide membros por email
3. Defina a funcao (Admin, Editor, Viewer)
4. Escolha quais paginas cada membro pode acessar

---

## Telegram Bot - Comandos

| Comando | O que faz |
|---------|-----------|
| `/start` | Lista todos os comandos |
| `/gerar [tema]` | Gera post com imagem e legenda |
| `/gerar 3 [tema]` | Gera carrossel com 3 imagens |
| `/gerar 4:5 [tema]` | Gera em formato retrato |
| `/novopost` | Inicia criacao interativa |
| `/listar` | Lista posts agendados |
| `/publicar [id]` | Publica post no Instagram |
| `/agendar [id] [data] [hora]` | Agenda post |
| `/cancelar [id]` | Cancela agendamento |
| `/tarefas` | Tarefas dos proximos 7 dias |
| `/projetos` | Lista projetos |
| `/funis` | Lista funis de vendas |
| `/clip [url]` | Analisa video do YouTube |
| `/clipcortar [id] todos` | Corta clips do video |
| `/status` | Status das integracoes |

Ou envie qualquer texto e o bot gera um post automaticamente.

---

## MCP Tools (24 tools)

Conecte ao Claude Cowork, Claude Desktop ou Claude Code.

| Categoria | Tools | Descricao |
|-----------|-------|-----------|
| **Posts** | `create_post` | Cria um novo post |
| | `list_posts` | Lista posts com filtros |
| | `add_image_to_post` | Adiciona imagem a um post |
| | `schedule_post` | Agenda publicacao |
| | `publish_now` | Publica imediatamente |
| | `generate_image` | Gera imagem com IA |
| | `generate_caption` | Gera legenda com IA |
| | `upload_image` | Faz upload de imagem |
| | `get_analytics` | Metricas do Instagram |
| **Tarefas** | `create_task` | Cria tarefa |
| | `list_tasks` | Lista tarefas |
| | `update_task` | Atualiza tarefa |
| | `delete_task` | Remove tarefa |
| **Projetos** | `create_project` | Cria projeto |
| | `list_projects` | Lista projetos |
| | `get_project` | Detalhes do projeto |
| | `update_project` | Atualiza projeto |
| | `delete_project` | Remove projeto |
| **Modulos** | `add_module` | Adiciona modulo |
| | `update_module` | Atualiza modulo |
| | `delete_module` | Remove modulo |
| **Video** | `analyze_youtube_video` | Analisa video do YouTube |
| | `cut_youtube_clips` | Corta clips selecionados |
| | `list_video_clips` | Lista clips processados |

---

## Estrutura do Projeto

```
openhive/
  packages/
    api/          API Express + Prisma + BullMQ
    web/          Frontend Next.js 14 + Tailwind
    bot/          Bot Telegram (Grammy.js)
    mcp/          Servidor MCP (24 tools)
    shared/       Tipos TypeScript compartilhados
  scripts/
    video/        Scripts Python (analise + corte de video)
  docker-compose.yml              Desenvolvimento (so infra)
  docker-compose.prod.yml         Producao (tudo via Docker)
  docker-compose.production.yml   Producao alternativo
  setup.sh                        Script de setup automatico
  Dockerfile.*                    Imagens Docker de cada servico
```

---

## Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| API | Express + Prisma + BullMQ |
| Web | Next.js 14 + Tailwind CSS |
| Bot | Grammy.js (Telegram) |
| MCP | @modelcontextprotocol/sdk |
| Banco | PostgreSQL 16 |
| Cache/Fila | Redis 7 |
| Storage | MinIO (S3-compatible) |
| Video | Python 3.12 + FFmpeg + Whisper + OpenCV |
| Infra | Docker Compose / Coolify / Easypanel |

---

## Licenca

[AGPL-3.0](LICENSE)

Voce pode usar, modificar e distribuir livremente. Se hospedar como servico publico, deve disponibilizar o codigo fonte das suas modificacoes.
