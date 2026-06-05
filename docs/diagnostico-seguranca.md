# Diagnostico de Seguranca

## Visao geral

O modulo Diagnostico de Seguranca integra o Goldtech Network Behavior Scanner ao Goldtech Inventario/Monitoramento. Ele permite configurar o scanner por cliente, gerar um pacote ZIP para execucao manual, receber arquivos JSON de resultado, analisar metadados tecnicos e gerar relatorios executivos em HTML e PDF.

O modulo trabalha com linguagem conservadora. Ele apresenta pontos de atencao, indicios e itens que exigem validacao tecnica. Ele nao confirma infeccao, invasao ou presenca de malware.

## Fluxo operacional

1. O tecnico acessa o cliente no Inventario.
2. Na aba Diagnostico de Seguranca, revisa ou salva a configuracao do scanner.
3. O tecnico gera e baixa o pacote ZIP.
4. O pacote e executado manualmente no ambiente do cliente por profissional autorizado.
5. O scanner gera arquivos JSON locais.
6. O tecnico faz upload manual dos JSONs no Inventario.
7. O sistema lista os resultados enviados.
8. O tecnico pode visualizar, analisar, baixar o JSON, gerar relatorio HTML, gerar relatorio PDF ou excluir o resultado.

## Arquivos de resultado

### resultado-diagnostico.json

Arquivo voltado ao resumo do diagnostico. Normalmente contem nivel de atencao, score, resumo e achados consolidados. Quando nao contem arrays brutos completos, a analise e apresentada como resumo de diagnostico.

Use este arquivo para obter uma visao executiva rapida do resultado.

### resultado-coleta.json

Arquivo voltado a dados brutos de coleta. Pode conter:

- `connections`
- `processes`
- `listening_ports`

Use este arquivo quando for necessaria uma analise tecnica mais detalhada de conexoes, processos, portas em escuta, conexoes externas, processos sensiveis e portas que exigem validacao.

## Como gerar pacote

1. Acesse `Clientes`.
2. Abra o inventario do cliente.
3. Entre na aba `Diagnostico de Seguranca`.
4. Revise:
   - versao do scanner;
   - modo de execucao;
   - allowlist;
   - processos sensiveis adicionais;
   - observacoes.
5. Clique em `Salvar configuracao`, se necessario.
6. Clique em `Gerar pacote ZIP`.
7. Na tabela `Pacotes Gerados`, clique em `Baixar`.

## Como fazer upload

1. Na aba `Diagnostico de Seguranca`, localize `Resultados Enviados`.
2. Selecione um arquivo `.json` gerado pelo scanner.
3. Clique em `Enviar resultado JSON`.
4. Aguarde a confirmacao.
5. O resultado aparecera na tabela de historico.

O backend aceita JSON em UTF-8, UTF-8 com BOM, UTF-16 LE e UTF-16 BE.

## Como visualizar resultado

1. Na tabela `Resultados Enviados`, clique em `Visualizar`.
2. O painel exibira metadados basicos, como host, versao, modo, risco, score, data da coleta, hash SHA256 e resumo JSON formatado quando disponivel.

## Como analisar diagnostico

1. Na tabela `Resultados Enviados`, clique em `Analisar`.
2. O sistema chama a analise tecnica do resultado.
3. O painel apresenta:
   - contagens principais;
   - nivel de atencao;
   - score;
   - portas que exigem validacao;
   - processos sensiveis ou administrativos;
   - conexoes externas em destaque;
   - observacoes tecnicas.

Portas de atencao seguem uma lista conservadora. Portas altas ou efemeras nao sao classificadas automaticamente como ponto de atencao.

## Como gerar relatorio HTML

1. Na tabela `Resultados Enviados`, clique em `HTML`.
2. O navegador baixara um arquivo `.html`.
3. O arquivo pode ser aberto no navegador e impresso manualmente, se necessario.

## Como gerar relatorio PDF

1. Na tabela `Resultados Enviados`, clique em `PDF`.
2. O backend gera o relatorio executivo em PDF a partir do mesmo HTML executivo.
3. O navegador baixara um arquivo `.pdf`.

O PDF e gerado sob demanda com Puppeteer no backend.

## Limitacoes

- A execucao do scanner e manual.
- O upload dos JSONs e manual.
- O modulo nao executa acoes corretivas automaticas.
- O modulo nao envia e-mail.
- O modulo nao abre chamados automaticamente.
- O modulo nao faz correlacao avancada com alertas externos.
- O modulo nao substitui revisao tecnica humana.

## Aviso tecnico

Este modulo nao e antivirus, EDR, analise forense ou auditoria completa de seguranca. O diagnostico nao confirma infeccao, invasao ou presenca de malware. Ele identifica pontos de atencao, observacoes tecnicas e indicios que devem ser validados por um profissional responsavel antes de qualquer decisao operacional.

## Observacoes para producao/VPS

- Configure `VITE_API_URL` no frontend para apontar para a API publicada.
- Garanta que a API esteja rodando a versao mais recente do backend.
- Confirme que a rota `/api/clients/:clientId/security-diagnostic/results/:resultId/report/pdf` responde na porta e dominio usados pelo frontend.
- Em VPS Linux, o Puppeteer pode exigir bibliotecas do Chromium no sistema operacional.
- Em ambientes restritos, valide permissao de execucao do Chromium usado pelo Puppeteer.
- Se o servidor usar container, confirme que as flags `--no-sandbox` e `--disable-setuid-sandbox` sao aceitaveis para o ambiente.
- Configure storage persistente para `backend/storage/scanner-results` e `backend/storage/scanner-packages`.
- Nao versionar arquivos operacionais enviados ou gerados pelo scanner.
- Monitore tempo de geracao do PDF; arquivos muito grandes podem exigir ajuste de timeout/recurso no servidor.
