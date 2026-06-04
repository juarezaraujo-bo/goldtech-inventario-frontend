# Goldtech Inventário — Guia de Deploy e Configuração

## Índice

1. [Variáveis de Ambiente](#1-variáveis-de-ambiente)
2. [Preparar o Servidor](#2-preparar-o-servidor)
3. [Instalar o Agente nas Máquinas](#3-instalar-o-agente-nas-máquinas)
4. [Configurar Integração com Helpdesk](#4-configurar-integração-com-helpdesk)
5. [Testar Abertura Automática de Chamado](#5-testar-abertura-automática-de-chamado)
6. [Checklist de Produção](#6-checklist-de-produção)

---

## 1. Variáveis de Ambiente

Arquivo: `backend/.env`

```env
# Porta do servidor
PORT=3002

# Segredo para assinar tokens JWT de usuários do painel
# Gerar um valor seguro com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=TROQUE_AQUI_POR_VALOR_SEGURO

# Token que os scripts PowerShell enviam no header x-agent-token
# Gerar com: node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
AGENT_TOKEN=TROQUE_AQUI_POR_VALOR_SEGURO

# URL do endpoint de criação de chamados no sistema Helpdesk
# Exemplo local: http://localhost:3001/api/tickets
# Exemplo remoto: https://helpdesk.suaempresa.com/api/tickets
HELPDESK_API_URL=https://helpdesk.goldtech.com/api/tickets

# Token de autenticação da API do Helpdesk
HELPDESK_API_TOKEN=TROQUE_AQUI_PELO_TOKEN_DO_HELPDESK

# Caminho do banco de dados SQLite
DB_PATH=../database/inventory.sqlite
```

> **Nunca commite o `.env` no Git.** O arquivo `.gitignore` já deve excluí-lo.

---

## 2. Preparar o Servidor

### Requisitos
- Node.js 18+ (obrigatório para `fetch` nativo)
- NPM 9+
- Porta 3002 liberada no firewall (ou a porta que configurar)

### Passos

```bash
# 1. Clonar / transferir o projeto para o servidor
cd /opt/goldtech-inventario   # ou caminho de sua escolha

# 2. Instalar dependências do backend
cd backend
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env          # copiar o modelo
nano .env                     # editar com os valores reais

# 4. Iniciar em produção (recomendado: PM2)
npm install -g pm2
pm2 start src/server.js --name goldtech-inventario
pm2 save
pm2 startup                   # habilitar início automático no boot
```

### Verificar que o servidor está online

```bash
curl http://localhost:3002/api/agent/test \
  -H "x-agent-token: SEU_AGENT_TOKEN"
# Esperado: {"status":"active","message":"Goldtech Agent API is online"}
```

---

## 3. Instalar o Agente nas Máquinas

Os scripts ficam em `agent/`. Copie a pasta `agent/` para a máquina cliente.

### Configuração única por máquina

Execute **como Administrador** no PowerShell:

```powershell
# Instalar coleta de INVENTÁRIO (semanal, domingos 02:00)
.\install-inventory-task.ps1 `
  -ApiUrl     "http://SEU-SERVIDOR:3002/api/agent/inventory" `
  -AgentToken "SEU_AGENT_TOKEN" `
  -Cliente    "Nome do Cliente"

# Instalar coleta de PERFORMANCE (a cada 15 minutos)
.\install-performance-task.ps1 `
  -ApiUrl     "http://SEU-SERVIDOR:3002/api/agent/performance" `
  -AgentToken "SEU_AGENT_TOKEN"
```

Os scripts de instalação atualizam automaticamente o `$ApiUrl` e o `$AgentToken` nos arquivos `.ps1` de coleta.

### Verificar as tarefas instaladas

```powershell
Get-ScheduledTask | Where-Object { $_.TaskName -like "Goldtech*" }
```

### Executar manualmente (teste imediato)

```powershell
Start-ScheduledTask -TaskName "GoldtechInventario"
Start-ScheduledTask -TaskName "GoldtechPerformance"
```

### Desinstalar o agente

```powershell
.\uninstall-agent-tasks.ps1
```

---

## 4. Configurar Integração com Helpdesk

A integração cria chamados automaticamente quando:

| Condição | Tipo de Alerta | Comportamento |
|---|---|---|
| Disco livre ≤ 10% | `disco_critico` | Chamado imediato na próxima coleta |
| CPU ≥ 90% por 3 coletas seguidas | `cpu_persistente` | Chamado após confirmação de persistência |
| RAM ≥ 90% por 3 coletas seguidas | `ram_persistente` | Chamado após confirmação de persistência |

**Chamados duplicados são bloqueados:** o sistema consulta a tabela `monitoring_helpdesk_tickets` e só abre um novo chamado se não houver outro com `status = 'aberto'` para o mesmo `equipment_id + alert_type`.

### Configurar a URL do Helpdesk no `.env`

```env
# Se o Helpdesk for outro projeto Node local na mesma máquina:
HELPDESK_API_URL=http://localhost:3001/api/tickets

# Se for um serviço externo:
HELPDESK_API_URL=https://helpdesk.suaempresa.com/api/tickets

HELPDESK_API_TOKEN=TOKEN_DO_HELPDESK
```

O payload enviado ao Helpdesk segue o formato:

```json
{
  "title": "[Monitoramento] disco critico — HOSTNAME",
  "description": "Alerta crítico de performance...",
  "priority": "high",
  "category": "Performance",
  "client_id": 1,
  "source": "Goldtech Inventory Monitor"
}
```

---

## 5. Testar Abertura Automática de Chamado

### Simulação via cURL (sem máquina Windows)

```bash
# Substituir SEU_TOKEN e SEU_HOSTNAME pelos valores reais

# Simular disco crítico (abre chamado imediatamente)
curl -X POST http://localhost:3002/api/agent/performance \
  -H "Content-Type: application/json" \
  -H "x-agent-token: SEU_TOKEN" \
  -d '{
    "hostname": "SEU_HOSTNAME",
    "cpu_usage_percent": 45,
    "memory_usage_percent": 60,
    "disk_free_percent": 5,
    "disk_free_gb": 5,
    "network_usage": "10 KB/s"
  }'

# Simular CPU persistente (enviar 3x com cpu_usage_percent >= 90)
for i in 1 2 3; do
  curl -X POST http://localhost:3002/api/agent/performance \
    -H "Content-Type: application/json" \
    -H "x-agent-token: SEU_TOKEN" \
    -d '{
      "hostname": "SEU_HOSTNAME",
      "cpu_usage_percent": 95,
      "memory_usage_percent": 50,
      "disk_free_percent": 40,
      "disk_free_gb": 100,
      "network_usage": "10 KB/s"
    }'
  sleep 1
done
```

### O que observar no terminal do backend

```
[PERFORMANCE] Dados salvos para SEU_HOSTNAME (ID: 1)
[HELPDESK-PERF] Abrindo chamado 'disco_critico' para SEU_HOSTNAME...
[HELPDESK-PERF] Chamado criado com ID: 123
```

Na segunda execução com o mesmo alerta:
```
[HELPDESK-PERF] Chamado 'disco_critico' já aberto para SEU_HOSTNAME. Ignorando.
```

### Verificar no banco de dados

```bash
cd database
sqlite3 inventory.sqlite "SELECT * FROM monitoring_helpdesk_tickets;"
```

---

## 6. Checklist de Produção

- [ ] `JWT_SECRET` trocado por valor aleatório de 32+ bytes
- [ ] `AGENT_TOKEN` trocado por valor aleatório de 24+ bytes
- [ ] `HELPDESK_API_URL` apontando para o servidor correto
- [ ] `HELPDESK_API_TOKEN` configurado com token real do helpdesk
- [ ] Arquivo `.env` **não** versionado no Git
- [ ] Servidor rodando com PM2 (ou systemd) com restart automático
- [ ] Porta 3002 protegida por firewall — aceitar apenas IPs dos clientes + IP do admin
- [ ] HTTPS configurado (nginx/caddy como proxy reverso) para o painel web
- [ ] Agente instalado em pelo menos uma máquina de teste e confirmado via painel
- [ ] Tarefa de inventário executada manualmente e equipamento apareceu no painel
- [ ] Tarefa de performance executada e aba Monitoramento mostrando dados
- [ ] Chamado de teste disparado e confirmado no Helpdesk (ou log do backend)

---

## 7. Render + SQLite sem reset de dados

No Render, o filesystem padrao do servico e efemero. Se o SQLite ficar em um caminho como `../database/inventory.sqlite` dentro do codigo da aplicacao, o banco pode sumir em restart/deploy e o sistema volta a criar os dados padrao.

Para usar SQLite em producao no Render:

1. Crie/anexe um **Persistent Disk** no servico backend.
2. Use o mount path:

```text
/var/data
```

3. Configure a variavel de ambiente:

```env
DB_PATH=/var/data/inventory.sqlite
```

4. Redeploy o backend.
5. Confira os logs de inicializacao. O esperado e:

```text
Connected to SQLite database: /var/data/inventory.sqlite
```

Se aparecer um aviso como `[DATABASE WARNING] Render detectado usando SQLite fora de /var/data`, o servico ainda esta em risco de resetar o banco.

Tambem foi adicionado `backend/render.yaml` como referencia de Blueprint para o backend com disco persistente em `/var/data`.
