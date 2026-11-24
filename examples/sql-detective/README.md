# Detetive SQL

## Como executar

Requisitos: Node.js instalado.

1. Em um terminal, na pasta `sql-detective-api`, execute:

```bash
npm install
npm run dev
```

2. Em outro terminal, na pasta `sql-detective` (frontend), execute:

```bash
npm install
npm run dev
```

Abra o endereco exibido pelo Vite, normalmente `http://localhost:5173`. No modo
local o frontend usa a API em `http://localhost:3000`. A API nao requer conta,
credenciais ou configuracao do Firebase. Em producao, o frontend usa a API
publicada no Vercel.

## Testes automatizados

Na pasta do frontend, execute `npm test`. Os cenarios e as funcionalidades
cobertas estao descritos em [TESTING.md](./TESTING.md).

O manifesto configura a dificuldade inicial e o tipo de seleção: `student`
(Escolha do aluno), `individual` (Sorteio Individual) ou `class` (Único caso
para todos). O sorteio individual evita casos que o aluno já jogou naquele
script. No modo de caso único, todos recebem o caso base do card, com uma
alternativa individual quando o aluno já o jogou em outro card e a repetição
está desativada.

O jogo carrega os casos em `GET /cases`, inicia a partida em `POST /game-sessions`
e envia cada consulta, uso de dica e conclusao para os endpoints da game-session.
O jogo envia `player_id`, `player_name`, `script_id`, `card_id` e `session_id`.
Com `sessionContinuity`
habilitado, busca a ultima partida do jogador naquele card e restaura
automaticamente o caso, o nivel, a pontuacao acumulada e as dicas usadas sem
solicitar o nome novamente.
Sem essa opcao, inicia uma nova partida do zero. O score comeca em 100 e as
perdas continuam entre niveis.
Depois da criacao, o jogo usa o `id` interno retornado pela API em todas as
chamadas da game-session. Em desenvolvimento, as chamadas HTTP aparecem no
Console do DevTools, com metodo, URL, parametros, corpo enviado e resposta.

## Nivel 1

Um crime foi cometido, e como detetive, sua missão é resolver o caso. A perícia forneceu um relatório detalhado da cena do crime, mas você, de alguma forma, o perdeu.
Tudo o que você lembra é que o incidente foi um assassinato ocorrido em 6 de outubro de 2023, em São Paulo.
Sua primeira tarefa é recuperar o relatório da cena do crime no banco de dados do departamento de polícia.

```SQL
SELECT * FROM relatorios_criminais
WHERE categoria = "Assassinato"
  AND data = 20231006
  AND cidade = "São Paulo"
```

Resultado:
| data | categoria | descricao | cidade |
| :----: | :---------: | :----------: | :------: |
| 20231006 | Assassinato | Imagens de segurança mostram que havia 2 testemunhas. A primeira testemunha mora na última casa na Avenida Carlos Gomes em Porto Alegre. A segunda testemunha, chamada Estefane, mora em algum lugar na Rua Augusta em São Paulo. | São Paulo |

## Nivel 2

Imagens de segurança revelam que havia duas testemunhas no local.
A primeira testemunha reside na última casa da Avenida Carlos Gomes em Porto Alegre.

```SQL
SELECT * FROM pessoas
WHERE logradouro = "Avenida Carlos Gomes"
  AND cidade = "Porto Alegre"
ORDER BY numero DESC
LIMIT 1
```

Resultado:
| id | carteira_id | nome | logradouro | numero | cidade | estado | cpf |
| :--: | :----: | :-----------: | :------: | :----------: | :------: | :------: | :---: |
| 6843 | 7343 | João Victor | Avenida Carlos Gomes | 1024 | Porto Alegre | RS | 336.348.325-61 |

## Nivel 3

Imagens de segurança mostram que havia duas testemunhas.
A segunda testemunha, chamada Estefane, vive em algum lugar na Rua Augusta em São Paulo.

```SQL
SELECT * FROM pessoas
WHERE nome LIKE "%Estefane%"
  AND logradouro = "Rua Augusta"
  AND cidade = "São Paulo"
```

Resultado:
| id | carteira_id | nome | logradouro | numero | cidade | estado | cpf |
| :--: | :----: | :-----------: | :------: | :----------: | :------: | :------: | :---: |
| 5098 | 5598 | Estefane Ribeiro | Rua Augusta | 30 | São Paulo | SP | 443.087.362-12 |

## Nivel 4

Uma das testemunhas é João Victor, identificado pelo número '6843', residente no endereço Avenida Carlos Gomes, 1024, Porto Alegre.
Ele foi entrevistado pela equipe de polícia, e as transcrições dessa entrevista estão armazenadas no banco de dados.

```SQL
SELECT e.*
FROM entrevistas e
JOIN pessoas p
  ON e.pessoa_id = p.id
WHERE p.id = 6843
```

Resultado:
| pessoa_id | transcricao |
| :---------: | :-----------: |
| 6843 | Ouvi um tiro e então vi um homem correndo para fora. Ele tinha uma sacola escrito 'Fitness 360'. O número de membro na sacola começava com '6J5'. Somente membros Ouro têm essas sacolas. O homem entrou em um carro com uma placa que incluía '3J45'. |

## Nivel 5

A outra testemunha é Estefane Ribeiro, identificada pelo número '5098', residente no endereço Rua Augusta, 30, São Paulo.
Ela foi entrevistada pela equipe de polícia, e as transcrições dessa entrevista estão armazenadas no banco de dados.

```SQL
SELECT e.*
FROM entrevistas e
JOIN pessoas p
  ON e.pessoa_id = p.id
WHERE p.id = 5098
```

Resultado:
| pessoa_id | transcricao |
| :---------: | :-----------: |
| 5098 | Eu vi o assassinato acontecer e reconheci o assassino da minha academia quando estava malhando na semana passada, dia 17 de setembro. |

## Nivel 6

Uma das testemunhas ouviu um tiro e viu um homem saindo correndo. Ele carregava uma sacola escrito 'Fitness 360'.
O número de membro na sacola começava com '6J5', e apenas membros Ouro têm acesso a essas sacolas. O homem entrou em um carro cuja placa incluía '3J45'.
A outra testemunha relatou que presenciou o assassinato e reconheceu o assassino como alguém que viu na academia enquanto malhava na semana passada, no dia 17 de setembro.

```SQL
SELECT p.*
FROM pessoas p
JOIN carteiras_motorista cm
  ON p.carteira_id = cm.id
JOIN registros_academias ra
  ON p.id = ra.pessoa_id
WHERE cm.placa_carro LIKE '%3J45%'
  AND ra.codigo_membro LIKE '6J5%'
  AND ra.status_membro = 'Ouro'
```

Resultado:
| id | carteira_id | nome | logradouro | numero | cidade | estado | cpf |
| :--: | :----: | :-----------: | :------: | :----------: | :------: | :------: | :---: |
| 7507 | 8007 | Gabriel Braga | Rua 12 de Agosto | 105 | Tianguá | CE | 279.915.084-90 |

## Nivel 7

Parabéns, você encontrou o assassino! Mas espere, há mais... o verdadeiro vilão por trás deste crime ainda está à solta.
O assassino se chama Gabriel Braga, identificado pelo número '7507', e é membro Ouro da academia Fitness 360.
Ele foi entrevistado pela polícia e forneceu mais detalhes sobre o crime.

```SQL
SELECT e.*
FROM entrevistas e
JOIN pessoas p
  ON e.pessoa_id = p.id
WHERE p.id = 7507
```

Resultado:
| pessoa_id | transcricao |
| :---------: | :-----------: |
| 7507 | Fui contratado por uma mulher com muito dinheiro. Não sei o nome dela, mas sei que ela tem cerca de 170 ou 180 centímetros. Ela tem cabelo loiro e dirige um Hyundai Creta. Sei que ela foi a Conferência de Inteligência Artificial 3 vezes em agosto de 2015. |

## Nivel 8

O assassino relatou na entrevista que foi contratado por uma mulher rica.
Ele disse que não sabe o nome dela, mas mencionou que ela tem aproximadamente 170 ou 180 centímetros de altura.
Ela possui cabelo loiro e dirige um Hyundai Creta.
Além disso, ele informou que ela compareceu a Conferência de Inteligência Artificial três vezes em agosto de 2015.

```SQL
SELECT p.*
FROM pessoas p
JOIN carteiras_motorista cm
  ON p.carteira_id = cm.id
JOIN registros_eventos re
  ON p.id = re.pessoa_id
WHERE cm.sexo = 'Feminino'
  AND cm.cor_cabelo = 'Loiro'
  AND cm.altura BETWEEN 170 AND 180
  AND cm.marca_carro = 'Hyundai'
  AND cm.modelo_carro = 'Creta'
  AND re.evento = 'Conferência de Inteligência Artificial'
  AND re.data LIKE '201508%'
```

Resultado:
| id | carteira_id | nome | logradouro | numero | cidade | estado | cpf |
| :--: | :----: | :-----------: | :------: | :----------: | :------: | :------: | :---: |
| 6009 | 6509 | Nazaré Tedesco | Avenida Brasil | 255 | Rio de Janeiro | RJ | 756.834.012-56 |
| 6009 | 6509 | Nazaré Tedesco | Avenida Brasil | 255 | Rio de Janeiro | RJ | 756.834.012-56 |
| 6009 | 6509 | Nazaré Tedesco | Avenida Brasil | 255 | Rio de Janeiro | RJ | 756.834.012-56 |

## Fluxo de seleção e progressão dos casos

O Manifest usa configurações simples para dificuldade inicial, escolha do caso,
distribuição e progressão. Com a progressão `single`, a atividade termina após
um caso. Com `sequence`, a tela de conclusão permite ao aluno jogar outro caso
da dificuldade atual ou encerrar a atividade. Depois que todos os casos dessa
dificuldade forem concluídos, ele poderá avançar para a próxima dificuldade.

No modo `student`, a tela lista os casos da dificuldade atual. Nos modos
`individual` e `class`, o jogo usa `POST /cards/{cardId}/cases/select`. A seleção
`individual` sorteia um caso ainda não jogado pelo aluno no script. A seleção
`class` atribui casos diferentes aos cards do mesmo script e compartilha o caso
base do card com a turma. Se o aluno já tiver jogado o caso base em outro card e
a repetição estiver desativada, o sistema sorteia uma alternativa ainda não
jogada por ele e emite um evento para a FCTool.

Cada caso é registrado como uma game-session independente na API e gera um
evento `case_completed` no FCTool. Em progressão `sequence`, o aluno encerra a
atividade explicitamente na tela de conclusão; caso contrário, pode continuar
para outro caso ou dificuldade. `allowReplaySameCase` controla a repetição de
casos já concluídos.
