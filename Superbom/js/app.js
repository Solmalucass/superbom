const STORAGE_KEY = 'superSorteioRegistrosV3';
const STORAGE_FORM_KEY = 'superSorteioUltimoParticipanteV3';
const CEP_HISTORY_KEY = 'superSorteioHistoricoCepV1';

let ultimoEndereco = null;
let ultimoRegistroGerado = null;

const elementos = {
  numeroNota: document.getElementById('numeroNota'),
  dataCompra: document.getElementById('dataCompra'),
  valorCompra: document.getElementById('valorCompra'),
  loja: document.getElementById('loja'),

  nome: document.getElementById('nome'),
  cpf: document.getElementById('cpf'),
  telefone: document.getElementById('telefone'),
  email: document.getElementById('email'),
  cep: document.getElementById('cep'),
  logradouro: document.getElementById('logradouro'),
  numeroCasa: document.getElementById('numeroCasa'),
  bairro: document.getElementById('bairro'),
  cidade: document.getElementById('cidade'),
  uf: document.getElementById('uf'),

  buscarCep: document.getElementById('buscarCep'),
  salvarCadastro: document.getElementById('salvarCadastro'),
  mensagem: document.getElementById('mensagem'),
  cupomGerado: document.getElementById('cupomGerado'),
  aceiteRegulamento: document.getElementById('aceiteRegulamento')
};

document.addEventListener('DOMContentLoaded', () => {
  carregarUltimoParticipante();
  registrarEventos();
  atualizarCupomNaTela('Aguardando cadastro');
  mostrarMensagem('Preencha o cadastro para gerar seu cupom promocional.', 'info');
});

function registrarEventos() {
  elementos.buscarCep.addEventListener('click', buscarCep);
  elementos.salvarCadastro.addEventListener('click', salvarCadastroEPrepararEmail);

  elementos.cep.addEventListener('input', (event) => {
    event.target.value = formatarCep(event.target.value);
    invalidarCupomAtual();
    salvarUltimoParticipante();
  });

  elementos.telefone.addEventListener('input', (event) => {
    event.target.value = formatarTelefone(event.target.value);
    invalidarCupomAtual();
    salvarUltimoParticipante();
  });

  elementos.cpf.addEventListener('input', (event) => {
    event.target.value = formatarCpf(event.target.value);
    invalidarCupomAtual();
    salvarUltimoParticipante();
  });

  [
    elementos.numeroNota,
    elementos.dataCompra,
    elementos.valorCompra,
    elementos.loja,
    elementos.nome,
    elementos.email,
    elementos.numeroCasa,
    elementos.aceiteRegulamento
  ].forEach((campo) => {
    campo.addEventListener('input', () => {
      invalidarCupomAtual();
      salvarUltimoParticipante();
    });

    campo.addEventListener('change', () => {
      invalidarCupomAtual();
      salvarUltimoParticipante();
    });
  });
}

function invalidarCupomAtual() {
  if (ultimoRegistroGerado) {
    ultimoRegistroGerado = null;
    atualizarCupomNaTela('Aguardando novo cadastro');
  }
}

async function buscarCep() {
  const cepNumeros = elementos.cep.value.replace(/\D/g, '');

  if (cepNumeros.length !== 8) {
    mostrarMensagem('Digite um CEP válido com 8 números.', 'error');
    return;
  }

  const historico = obterHistoricoCep();
  const cepSalvo = historico.find((item) => item.cepNumeros === cepNumeros);

  if (cepSalvo) {
    ultimoEndereco = {
      cep: cepSalvo.cep,
      logradouro: cepSalvo.logradouro,
      bairro: cepSalvo.bairro,
      cidade: cepSalvo.cidade,
      uf: cepSalvo.uf
    };

    elementos.cep.value = cepSalvo.cep;
    preencherEndereco(ultimoEndereco);
    salvarCepNoHistorico(ultimoEndereco);
    salvarUltimoParticipante();
    invalidarCupomAtual();
    mostrarMensagem('CEP carregado do armazenamento local, sem nova consulta à API.', 'success');
    return;
  }

  try {
    mostrarMensagem('Consultando CEP...', 'info');

    const resposta = await fetch(`https://viacep.com.br/ws/${cepNumeros}/json/`);
    const dados = await resposta.json();

    if (dados.erro) {
      limparEndereco();
      ultimoEndereco = null;
      mostrarMensagem('CEP não encontrado. Confira os dados digitados.', 'error');
      return;
    }

    ultimoEndereco = {
      cep: dados.cep,
      logradouro: dados.logradouro,
      bairro: dados.bairro,
      cidade: dados.localidade,
      uf: dados.uf
    };

    elementos.cep.value = dados.cep;
    preencherEndereco(ultimoEndereco);
    salvarCepNoHistorico(ultimoEndereco);
    salvarUltimoParticipante();
    invalidarCupomAtual();
    mostrarMensagem('Endereço carregado com sucesso pela API ViaCEP.', 'success');
  } catch (erro) {
    limparEndereco();
    ultimoEndereco = null;
    mostrarMensagem('Não foi possível consultar o CEP no momento.', 'error');
  }
}

function preencherEndereco(endereco) {
  elementos.logradouro.value = endereco.logradouro || '';
  elementos.bairro.value = endereco.bairro || '';
  elementos.cidade.value = endereco.cidade || '';
  elementos.uf.value = endereco.uf || '';
}

function limparEndereco() {
  preencherEndereco({
    logradouro: '',
    bairro: '',
    cidade: '',
    uf: ''
  });
}

function capturarDadosFormulario() {
  return {
    numeroNota: elementos.numeroNota.value.trim(),
    dataCompra: elementos.dataCompra.value,
    valorCompra: Number(Number(elementos.valorCompra.value || 0).toFixed(2)),
    loja: elementos.loja.value,

    nome: elementos.nome.value.trim(),
    cpf: elementos.cpf.value.trim(),
    telefone: elementos.telefone.value.trim(),
    email: elementos.email.value.trim(),
    cep: elementos.cep.value.trim(),
    logradouro: elementos.logradouro.value.trim(),
    numeroCasa: elementos.numeroCasa.value.trim(),
    bairro: elementos.bairro.value.trim(),
    cidade: elementos.cidade.value.trim(),
    uf: elementos.uf.value.trim(),

    aceiteRegulamento: elementos.aceiteRegulamento.checked
  };
}

function validarRegistro() {
  const dados = capturarDadosFormulario();
  const telefoneNumeros = dados.telefone.replace(/\D/g, '');
  const cepNumeros = dados.cep.replace(/\D/g, '');

  if (!dados.numeroNota) {
    mostrarMensagem('Informe o número da nota fiscal.', 'error');
    return false;
  }

  if (!dados.dataCompra) {
    mostrarMensagem('Informe a data da compra.', 'error');
    return false;
  }

  if (!dados.valorCompra || dados.valorCompra <= 0) {
    mostrarMensagem('Informe um valor de compra válido.', 'error');
    return false;
  }

  if (!dados.loja) {
    mostrarMensagem('Selecione a loja participante.', 'error');
    return false;
  }

  if (!dados.nome) {
    mostrarMensagem('Informe o nome do participante.', 'error');
    return false;
  }

  if (!validarCpf(dados.cpf)) {
    mostrarMensagem('Informe um CPF válido.', 'error');
    return false;
  }

  if (telefoneNumeros.length < 10) {
    mostrarMensagem('Informe um telefone válido.', 'error');
    return false;
  }

  if (!validarEmail(dados.email)) {
    mostrarMensagem('Informe um e-mail válido.', 'error');
    return false;
  }

  if (cepNumeros.length !== 8) {
    mostrarMensagem('Informe um CEP válido.', 'error');
    return false;
  }

  if (!ultimoEndereco) {
    mostrarMensagem('Consulte um CEP válido antes de salvar o cadastro.', 'error');
    return false;
  }

  if (!dados.numeroCasa) {
    mostrarMensagem('Informe o número da casa.', 'error');
    return false;
  }

  if (!dados.aceiteRegulamento) {
    mostrarMensagem('É necessário aceitar o regulamento da promoção.', 'error');
    return false;
  }

  if (notaJaCadastrada(dados.numeroNota)) {
    mostrarMensagem('Esta nota fiscal já foi cadastrada.', 'error');
    return false;
  }

  return true;
}

function notaJaCadastrada(numeroNota) {
  const registros = obterRegistros();
  return registros.some((registro) => registro.numeroNota.toLowerCase() === numeroNota.toLowerCase());
}

function registroEhAtual(registro, dadosAtuais) {
  if (!registro) return false;

  return (
    registro.numeroNota === dadosAtuais.numeroNota &&
    registro.dataCompra === dadosAtuais.dataCompra &&
    Number(registro.valorCompra) === Number(dadosAtuais.valorCompra) &&
    registro.loja === dadosAtuais.loja &&
    registro.nome === dadosAtuais.nome &&
    registro.cpf === dadosAtuais.cpf &&
    registro.telefone === dadosAtuais.telefone &&
    registro.email === dadosAtuais.email &&
    registro.cep === dadosAtuais.cep &&
    registro.logradouro === dadosAtuais.logradouro &&
    registro.numeroCasa === dadosAtuais.numeroCasa &&
    registro.bairro === dadosAtuais.bairro &&
    registro.cidade === dadosAtuais.cidade &&
    registro.uf === dadosAtuais.uf
  );
}

function montarRegistro(cupom) {
  const dados = capturarDadosFormulario();

  return {
    id: gerarId(),
    cupom,
    numeroNota: dados.numeroNota,
    dataCompra: dados.dataCompra,
    valorCompra: dados.valorCompra,
    loja: dados.loja,

    nome: dados.nome,
    cpf: dados.cpf,
    telefone: dados.telefone,
    email: dados.email,
    cep: dados.cep,
    logradouro: dados.logradouro,
    numeroCasa: dados.numeroCasa,
    bairro: dados.bairro,
    cidade: dados.cidade,
    uf: dados.uf,

    aceiteRegulamento: dados.aceiteRegulamento,
    criadoEm: new Date().toLocaleString('pt-BR')
  };
}

function salvarRegistro(silencioso = false) {
  if (!validarRegistro()) {
    return null;
  }

  const dadosAtuais = capturarDadosFormulario();

  if (registroEhAtual(ultimoRegistroGerado, dadosAtuais)) {
    if (!silencioso) {
      mostrarMensagem(`Cadastro já salvo. Cupom atual: ${ultimoRegistroGerado.cupom}.`, 'info');
    }
    atualizarCupomNaTela(ultimoRegistroGerado.cupom);
    return ultimoRegistroGerado;
  }

  const cupom = gerarCupom();
  const registro = montarRegistro(cupom);
  const registros = obterRegistros();

  registros.unshift(registro);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));

  ultimoRegistroGerado = registro;
  salvarUltimoParticipante();
  atualizarCupomNaTela(registro.cupom);

  if (!silencioso) {
    mostrarMensagem(`Cadastro salvo com sucesso. Cupom gerado: ${registro.cupom}.`, 'success');
  }

  return registro;
}

function salvarCadastroEPrepararEmail() {
  const registro = salvarRegistro(true);

  if (!registro) {
    return;
  }

  prepararEmailCupom(registro);
  mostrarMensagem(`Cadastro salvo com sucesso. Cupom gerado: ${registro.cupom}.`, 'success');

  setTimeout(() => {
    prepararNovoCadastro();
  }, 300);
}

function prepararEmailCupom(registro) {
  const assunto = 'Seu cupom - Super Sorteio Premiado 2026';

  const corpo = [
    `Olá, ${registro.nome}!`,
    '',
    'Seu cadastro na promoção foi realizado com sucesso.',
    '',
    `Cupom promocional: ${registro.cupom}`,
    `Número da nota fiscal: ${registro.numeroNota}`,
    `Data da compra: ${formatarData(registro.dataCompra)}`,
    `Valor da compra: ${formatarMoeda(Number(registro.valorCompra))}`,
    `Loja participante: ${registro.loja}`,
    '',
    'Guarde este cupom para acompanhamento da promoção.'
  ].join('\n');

  const url = `mailto:${encodeURIComponent(registro.email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  window.location.href = url;
}

function prepararNovoCadastro() {
  elementos.numeroNota.value = '';
  elementos.dataCompra.value = '';
  elementos.valorCompra.value = '';
  elementos.loja.value = '';
  elementos.aceiteRegulamento.checked = false;

  ultimoRegistroGerado = null;
  atualizarCupomNaTela('Aguardando novo cadastro');
  salvarUltimoParticipante();
}

function obterRegistros() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function obterHistoricoCep() {
  return JSON.parse(localStorage.getItem(CEP_HISTORY_KEY) || '[]');
}

function salvarCepNoHistorico(endereco) {
  const cep = formatarCep(endereco.cep || '');
  const cepNumeros = cep.replace(/\D/g, '');

  if (!cepNumeros) return;

  const historicoAtual = obterHistoricoCep().filter((item) => item.cepNumeros !== cepNumeros);

  const novoItem = {
    cep,
    cepNumeros,
    logradouro: endereco.logradouro || '',
    bairro: endereco.bairro || '',
    cidade: endereco.cidade || '',
    uf: endereco.uf || '',
    consultadoEm: new Date().toLocaleString('pt-BR')
  };

  historicoAtual.unshift(novoItem);
  localStorage.setItem(CEP_HISTORY_KEY, JSON.stringify(historicoAtual.slice(0, 10)));
}

function salvarUltimoParticipante() {
  const dados = {
    nome: elementos.nome.value.trim(),
    cpf: elementos.cpf.value.trim(),
    telefone: elementos.telefone.value.trim(),
    email: elementos.email.value.trim(),
    cep: elementos.cep.value.trim(),
    logradouro: elementos.logradouro.value.trim(),
    numeroCasa: elementos.numeroCasa.value.trim(),
    bairro: elementos.bairro.value.trim(),
    cidade: elementos.cidade.value.trim(),
    uf: elementos.uf.value.trim(),
    numeroNota: elementos.numeroNota.value.trim(),
    dataCompra: elementos.dataCompra.value,
    valorCompra: elementos.valorCompra.value,
    loja: elementos.loja.value
  };

  localStorage.setItem(STORAGE_FORM_KEY, JSON.stringify(dados));
}

function carregarUltimoParticipante() {
  const dados = JSON.parse(localStorage.getItem(STORAGE_FORM_KEY) || 'null');

  if (!dados) {
    return;
  }

  elementos.nome.value = dados.nome || '';
  elementos.cpf.value = dados.cpf || '';
  elementos.telefone.value = dados.telefone || '';
  elementos.email.value = dados.email || '';
  elementos.cep.value = dados.cep || '';
  elementos.logradouro.value = dados.logradouro || '';
  elementos.numeroCasa.value = dados.numeroCasa || '';
  elementos.bairro.value = dados.bairro || '';
  elementos.cidade.value = dados.cidade || '';
  elementos.uf.value = dados.uf || '';

  elementos.numeroNota.value = dados.numeroNota || '';
  elementos.dataCompra.value = dados.dataCompra || '';
  elementos.valorCompra.value = dados.valorCompra || '';
  elementos.loja.value = dados.loja || '';

  if (dados.cep) {
    ultimoEndereco = {
      cep: dados.cep,
      logradouro: dados.logradouro,
      bairro: dados.bairro,
      cidade: dados.cidade,
      uf: dados.uf
    };
  }
}

function atualizarCupomNaTela(cupom) {
  elementos.cupomGerado.textContent = cupom;
}

function formatarCep(valor) {
  return valor.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9);
}

function formatarTelefone(valor) {
  const numeros = valor.replace(/\D/g, '').slice(0, 11);

  if (numeros.length <= 10) {
    return numeros.replace(/(\d{2})(\d{4})(\d{0,4})/, (match, ddd, parte1, parte2) => {
      return parte2 ? `(${ddd}) ${parte1}-${parte2}` : `(${ddd}) ${parte1}`;
    });
  }

  return numeros.replace(/(\d{2})(\d{5})(\d{0,4})/, (match, ddd, parte1, parte2) => {
    return parte2 ? `(${ddd}) ${parte1}-${parte2}` : `(${ddd}) ${parte1}`;
  });
}

function formatarCpf(valor) {
  return valor
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function validarCpf(cpf) {
  const numeros = cpf.replace(/\D/g, '');

  if (numeros.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(numeros)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i += 1) {
    soma += Number(numeros[i]) * (10 - i);
  }

  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(numeros[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i += 1) {
    soma += Number(numeros[i]) * (11 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;

  return resto === Number(numeros[10]);
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatarData(dataIso) {
  if (!dataIso) return '---';
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function gerarCupom() {
  const agora = new Date();
  const dataCurta = [
    String(agora.getFullYear()).slice(-2),
    String(agora.getMonth() + 1).padStart(2, '0'),
    String(agora.getDate()).padStart(2, '0')
  ].join('');

  const aleatorio = gerarCodigoAleatorio(6);
  return `SSP-${dataCurta}-${aleatorio}`;
}

function gerarCodigoAleatorio(tamanho) {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let resultado = '';

  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    const array = new Uint32Array(tamanho);
    window.crypto.getRandomValues(array);
    array.forEach((item) => {
      resultado += caracteres[item % caracteres.length];
    });
    return resultado;
  }

  for (let i = 0; i < tamanho; i += 1) {
    resultado += caracteres[Math.floor(Math.random() * caracteres.length)];
  }

  return resultado;
}

function gerarId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mostrarMensagem(texto, tipo) {
  elementos.mensagem.textContent = texto;
  elementos.mensagem.className = `message ${tipo}`;
}
