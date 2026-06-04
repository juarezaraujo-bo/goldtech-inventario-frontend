# Guia de Coleta Automática Goldtech

O sistema de inventário Goldtech utiliza agentes baseados em PowerShell para coleta de dados sem a necessidade de login/senha manual.

## 📋 Tipos de Coleta

### 1. Inventário Geral (Hardware/Software)
- **Script:** `windows-inventory.ps1`
- **Frequência recomendada:** 1x por semana ou ao iniciar a máquina.
- **Dados coletados:** Hostname, SO, CPU, RAM, Disco Total, IP/MAC, Bios, Placa-mãe, Antivírus, etc.

### 2. Monitoramento de Desempenho (Performance)
- **Script:** `windows-performance.ps1`
- **Frequência recomendada:** A cada 15 minutos (via Tarefa Agendada).
- **Dados coletados:** Uso de CPU (%), Uso de RAM (%), Espaço Livre em Disco (C:), Tráfego de Rede.
- **Endpoint:** `/api/agent/performance`

## 🚀 Instalação do Monitoramento (Performance)

Para garantir que os dados de performance apareçam no painel de **Monitoramento**, siga os passos abaixo em cada estação:

1. Baixe o script `windows-performance.ps1`.
2. Execute o instalador de tarefa agendada:
   ```powershell
   .\install-performance-task.ps1
   ```
3. O script criará uma tarefa chamada **"Goldtech Performance Agent"** que rodará em background a cada 15 minutos.

## 🛠️ Regras de Alerta

O painel de monitoramento centraliza equipamentos com:
- **CPU:** Uso sustentado >= 90%.
- **Memória RAM:** Uso >= 90%.
- **Disco:** Espaço livre <= 10%.
- **Status "Sem Coleta":** Equipamentos que não enviaram dados nas últimas 24 horas.

## 🔒 Segurança

Todas as coletas utilizam o `AGENT_TOKEN` configurado no arquivo `.env` do servidor. O token deve ser enviado no header `x-agent-token` de cada requisição.
