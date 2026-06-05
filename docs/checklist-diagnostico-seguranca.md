# Checklist do Diagnostico de Seguranca

Use este checklist antes de publicar, migrar para VPS ou iniciar novas funcionalidades.

## Pacotes do scanner

- [ ] Abrir um cliente no Inventario.
- [ ] Acessar a aba `Diagnostico de Seguranca`.
- [ ] Revisar a configuracao do scanner.
- [ ] Salvar a configuracao.
- [ ] Gerar ZIP.
- [ ] Confirmar que o pacote aparece em `Pacotes Gerados`.
- [ ] Baixar ZIP.
- [ ] Confirmar que o arquivo `.zip` foi baixado corretamente.

## Execucao e upload

- [ ] Executar scanner manualmente no ambiente do cliente.
- [ ] Gerar `resultado-diagnostico.json`.
- [ ] Gerar `resultado-coleta.json`, quando disponivel.
- [ ] Enviar `resultado-diagnostico.json`.
- [ ] Confirmar que o resultado aparece na tabela.
- [ ] Enviar `resultado-coleta.json`.
- [ ] Confirmar que o resultado aparece na tabela.

## Acoes do resultado

- [ ] Visualizar resultado.
- [ ] Confirmar metadados basicos: host, versao, modo, risco, score, data, SHA256.
- [ ] Analisar resultado.
- [ ] Confirmar que a analise usa linguagem conservadora.
- [ ] Confirmar que portas altas/efemeras nao sao marcadas automaticamente como atencao.
- [ ] Baixar JSON.
- [ ] Gerar HTML.
- [ ] Abrir o HTML baixado no navegador.
- [ ] Gerar PDF.
- [ ] Abrir o PDF baixado.
- [ ] Confirmar que o PDF usa linguagem executiva e nao afirma infeccao, invasao ou malware.

## Exclusao

- [ ] Excluir resultado.
- [ ] Confirmar que ele saiu da tabela.
- [ ] Excluir pacote.
- [ ] Confirmar que ele saiu da tabela.

## Git e arquivos operacionais

- [ ] Validar que nao ha arquivos de teste no Git.
- [ ] Validar que arquivos `.zip` nao aparecem em `git status`.
- [ ] Validar que arquivos `.pdf` nao aparecem em `git status`.
- [ ] Validar que HTMLs gerados de relatorio nao aparecem em `git status`.
- [ ] Validar que `backend/storage/scanner-results/*` nao aparece em `git status`, exceto `.gitkeep`.
- [ ] Validar que `backend/storage/scanner-packages/*` nao aparece em `git status`, exceto `.gitkeep`.
- [ ] Validar que logs temporarios nao aparecem em `git status`.
- [ ] Validar git status limpo apos remocao/ignore dos arquivos operacionais.

## Producao/VPS

- [ ] Confirmar `VITE_API_URL` apontando para a API correta.
- [ ] Confirmar que a API publicada possui `/report` e `/report/pdf`.
- [ ] Confirmar que o Puppeteer gera PDF no ambiente final.
- [ ] Confirmar storage persistente para resultados e pacotes.
- [ ] Confirmar que o backend nao expoe caminhos internos nas mensagens de erro.
