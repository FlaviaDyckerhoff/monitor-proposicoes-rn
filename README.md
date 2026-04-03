# 🏛️ Monitor Proposições RN — ALERN

Monitora automaticamente a API da Assembleia Legislativa do Rio Grande do Norte e envia email quando há proposições novas. Roda **4x por dia** via GitHub Actions (8h, 12h, 17h e 21h, horário de Brasília).

---

## Como funciona

1. GitHub Actions roda o script nos horários configurados
2. O script chama a API da ALERN (`api-transparencialegislativa.al.rn.leg.br`)
3. Compara as proposições recebidas com as já registradas no `estado.json`
4. Se há proposições novas → envia email com a lista organizada por tipo
5. Salva o estado atualizado no repositório

---

## Estrutura

```
monitor-proposicoes-rn/
├── monitor.js
├── package.json
├── estado.json          # Gerado automaticamente
├── README.md
└── .github/workflows/monitor.yml
```

---

## Setup

### 1. Gmail — App Password

1. Acesse myaccount.google.com/security
2. Confirme que Verificação em duas etapas está ativa
3. Busque "Senhas de app" → Criar → nome livre (ex: `monitor-alern`)
4. Copie a senha de 16 letras — aparece só uma vez
5. Se já tem App Password de outro monitor, pode reutilizar

### 2. Repositório GitHub

1. github.com → + → New repository
2. Nome: `monitor-proposicoes-rn` | Visibilidade: Private
3. Upload: `monitor.js`, `package.json`, `README.md`
4. Criar manualmente: Add file → Create new file → `.github/workflows/monitor.yml` → colar conteúdo → Commit

### 3. Secrets

Settings → Secrets and variables → Actions → New repository secret

| Name | Valor |
|------|-------|
| `EMAIL_REMETENTE` | seu Gmail |
| `EMAIL_SENHA` | App Password de 16 chars (sem espaços) |
| `EMAIL_DESTINO` | email destino dos alertas |

### 4. Primeiro teste

Actions → Monitor Proposições RN → Run workflow → Run workflow

O primeiro run envia email com as 500 proposições mais recentes do ano e salva o estado. A partir do segundo run, só notifica novidades.

---

## API utilizada

```
URL base: https://api-transparencialegislativa.al.rn.leg.br/elegis-api-transp-legislativa
Endpoint: GET /processo?pagina=0&tamanhoPagina=100&ano=2026
Portal:   https://transparencialegislativa.al.rn.leg.br/pesquisa-avancada
```

API pública, sem autenticação.

---

## Resetar o estado

1. No repositório, clique em `estado.json` → lápis
2. Substitua por: `{"proposicoes_vistas":[],"ultima_execucao":""}`
3. Commit → rode o workflow manualmente

---

## Horários

| Horário BRT | Cron UTC |
|-------------|----------|
| 08:00 | `0 11 * * *` |
| 12:00 | `0 15 * * *` |
| 17:00 | `0 20 * * *` |
| 21:00 | `0 0 * * *` |
