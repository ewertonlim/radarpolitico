// Fixtures para o Placar de Votações (RP-010), baseados na votação real 257161-483 (PL 2159/2021)

export const placarDeputados = [
  { id: 1, nome: 'Ana Brasil', siglaPartido: 'PT', siglaUf: 'SP', urlFoto: 'https://x/1.jpg' },
  { id: 2, nome: 'Beto Costa', siglaPartido: 'PT', siglaUf: 'RJ', urlFoto: 'https://x/2.jpg' },
  { id: 3, nome: 'Cida Nunes', siglaPartido: 'PL', siglaUf: 'SP', urlFoto: 'https://x/3.jpg' },
  { id: 4, nome: 'Duda Reis', siglaPartido: 'PSOL', siglaUf: 'BA', urlFoto: 'https://x/4.jpg' },
  { id: 5, nome: 'Eder Melo', siglaPartido: 'NOVO', siglaUf: 'MG', urlFoto: 'https://x/5.jpg' },
  // id 6 não aparece em `votos`: deve virar "Não votou"
  { id: 6, nome: 'Fafa Lima', siglaPartido: 'NOVO', siglaUf: 'MG', urlFoto: 'https://x/6.jpg' },
];

export const placarVotos = [
  { tipoVoto: 'Sim', deputado_: { id: 1, nome: 'Ana Brasil', siglaPartido: 'PT', siglaUf: 'SP', urlFoto: 'https://x/1.jpg' } },
  { tipoVoto: 'Não', deputado_: { id: 2, nome: 'Beto Costa', siglaPartido: 'PT', siglaUf: 'RJ', urlFoto: 'https://x/2.jpg' } },
  { tipoVoto: 'Sim', deputado_: { id: 3, nome: 'Cida Nunes', siglaPartido: 'PL', siglaUf: 'SP', urlFoto: 'https://x/3.jpg' } },
  { tipoVoto: 'Obstrução', deputado_: { id: 4, nome: 'Duda Reis', siglaPartido: 'PSOL', siglaUf: 'BA', urlFoto: 'https://x/4.jpg' } },
  { tipoVoto: 'Sim', deputado_: { id: 5, nome: 'Eder Melo', siglaPartido: 'NOVO', siglaUf: 'MG', urlFoto: 'https://x/5.jpg' } },
];

export const placarOrientacoes = [
  { siglaPartidoBloco: 'Maioria', orientacaoVoto: 'Liberado' },
  { siglaPartidoBloco: 'Governo', orientacaoVoto: 'Não' },
  { siglaPartidoBloco: 'Oposição', orientacaoVoto: 'Sim' },
  { siglaPartidoBloco: 'Minoria', orientacaoVoto: 'Sim' },
  { siglaPartidoBloco: 'PT', orientacaoVoto: 'Sim' },
  { siglaPartidoBloco: 'PL', orientacaoVoto: 'Liberado' },
  { siglaPartidoBloco: 'Fdr PSOL-REDE', orientacaoVoto: 'Obstrução' },
  { siglaPartidoBloco: 'NOVO', orientacaoVoto: 'Sim' },
  // bloco truncado sem orientação: não deve gerar alerta
  { siglaPartidoBloco: 'Bl PlFdrPtUniPp...', orientacaoVoto: '' },
];

export const placarVotacaoDetalhe = {
  id: '257161-483',
  data: '2025-05-21',
  dataHoraRegistro: '2025-05-21T22:39:02',
  descricao: 'Aprovada a Redação Final do PL 2159/2021. Sim: 231; Não: 87; Total: 318.',
  aprovacao: 1,
  proposicoesAfetadas: [{ siglaTipo: 'PL', numero: 2159, ano: 2021, ementa: 'Licenciamento ambiental' }],
};

export const placarListaBruta = [
  {
    id: '257161-483',
    data: '2025-05-21',
    dataHoraRegistro: '2025-05-21T22:39:02',
    descricao: 'Aprovada a Redação Final do PL 2159/2021. Sim: 231; Não: 87; Total: 318.',
    aprovacao: 1,
    proposicaoObjeto: { siglaTipo: 'PL', numero: 2159, ano: 2021 },
  },
  {
    id: '257161-490',
    data: '2025-05-21',
    dataHoraRegistro: '2025-05-21T20:00:00',
    descricao: 'Aprovada a Sessão Solene em homenagem ao Dia Nacional.',
    aprovacao: 1,
    proposicaoObjeto: null,
  },
  {
    id: '257161-500',
    data: '2025-05-22',
    dataHoraRegistro: '2025-05-22T15:00:00',
    descricao: 'Rejeitado o destaque. Sim: 10; Não: 300; Total: 310.',
    aprovacao: 0,
    proposicaoObjeto: 'REQ 1/2025',
  },
];
