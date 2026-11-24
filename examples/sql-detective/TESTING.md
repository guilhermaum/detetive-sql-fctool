# Testes automatizados do Detetive SQL

Na pasta `examples/sql-detective`, execute:

```bash
npm test
```

O comando roda Vitest em ambiente `jsdom`, com React Testing Library. Os serviços de API e do host FCTool são simulados nos testes de interface, portanto a suíte não precisa de backend ou conta FCTool.

## Funcionalidades cobertas

- Formulário de resposta: campos obrigatórios; resposta incorreta exibe erro, toca o som de erro, aplica a penalidade e emite `answer_submitted`; resposta correta toca o som de acerto, chama a ação de acerto, aplica sucesso e emite `answer_submitted` e `level_completed`.
- Estado da partida: para três combinações de aluno, roteiro e card, confirma que os IDs corretos chegam à sessão criada; também inicia com nome limpo e pontuação inicial, desconta pontos por dica e resposta errada, mantém a pontuação entre níveis, limpa dicas usadas ao trocar de nível, conclui a sequência e registra o resultado final.
- Consulta SQL: envia sessão, nível e texto; exibe resultados em tabela e limpa o campo após sucesso; mostra erros da API e emite o evento `sql_query_submitted` com o resultado da execução.
- Esquema do banco: mostra e fecha o diagrama quando há imagem configurada.
- Serviço de casos: normaliza formatos de resposta da API, filtra por dificuldade sem diferenciar caixa, ordena níveis e converte a imagem em URL absoluta.
- Seleção de caso: envia identidade do aluno, roteiro, card e sessão, modo de distribuição, índice e opção para repetir casos.
- Serviço de níveis: converte dicas e textos de pista/problema, fornece as três ajudas e envia respostas e pontuação para validação.
- Mock Host FCTool: simula o handshake `HELLO` → `INITIALIZE` → `READY` para três combinações de aluno, roteiro e card; confirma que a identidade recebida é usada ao iniciar o jogo e que a configuração do professor é normalizada.
- Dificuldade: testa as três dificuldades fixadas pela configuração e a escolha livre quando não há dificuldade inicial definida.
- Seleção e replay: testa a lista escolhida pelo aluno, o filtro de casos concluídos, a liberação de replay, o sorteio individual (`aleatorio`) e a seleção compartilhada da turma (`mesmo`), incluindo os IDs do roteiro/card/aluno.
- Progressão: testa a opção `single` sem avanço, `sequence` para outro caso, avanço para a próxima dificuldade, replay em sequência e encerramento explícito da atividade.
- Ranking: verifica que o botão é apresentado quando habilitado, carrega os resultados para o card/caso atual e não abre quando está desabilitado.
- Continuidade de sessão: verifica a retomada automática por aluno/card, a restauração do nível atual, pontuação e dicas usadas, e que uma sessão retomada não cria outra partida.

## Limites

Os testes não verificam persistência real no backend nem executam a página `tools/mock-host.html` em um navegador real. O handshake e as mensagens do host são simulados em `jsdom`; validações visuais e de viewport continuam manuais.
