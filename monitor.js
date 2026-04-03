const fs = require('fs');
const nodemailer = require('nodemailer');

const EMAIL_DESTINO = process.env.EMAIL_DESTINO;
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE;
const EMAIL_SENHA = process.env.EMAIL_SENHA;
const ARQUIVO_ESTADO = 'estado.json';
const API_BASE = 'https://api-transparencialegislativa.al.rn.leg.br/elegis-api-transp-legislativa';

function carregarEstado() {
  if (fs.existsSync(ARQUIVO_ESTADO)) {
    return JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8'));
  }
  return { proposicoes_vistas: [], ultima_execucao: '' };
}

function salvarEstado(estado) {
  fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado, null, 2));
}

async function enviarEmail(novas) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_REMETENTE, pass: EMAIL_SENHA },
  });

  const porTipo = {};
  novas.forEach(p => {
    const tipo = p.tipo || 'OUTROS';
    if (!porTipo[tipo]) porTipo[tipo] = [];
    porTipo[tipo].push(p);
  });

  const linhas = Object.keys(porTipo).sort().map(tipo => {
    const header = `<tr><td colspan="5" style="padding:10px 8px 4px;background:#f0f4f8;font-weight:bold;color:#1a3a5c;font-size:13px;border-top:2px solid #1a3a5c">${tipo} — ${porTipo[tipo].length} proposição(ões)</td></tr>`;
    const rows = porTipo[tipo].map(p =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#555;font-size:12px">${p.tipo || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee"><strong>${p.numero || '-'}/${p.ano || '-'}</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px">${p.autor || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;white-space:nowrap">${p.data || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px">${p.ementa || '-'}</td>
      </tr>`
    ).join('');
    return header + rows;
  }).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto">
      <h2 style="color:#1a3a5c;border-bottom:2px solid #1a3a5c;padding-bottom:8px">
        🏛️ ALERN — ${novas.length} nova(s) proposição(ões)
      </h2>
      <p style="color:#666">Monitoramento automático — ${new Date().toLocaleString('pt-BR')}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#1a3a5c;color:white">
            <th style="padding:10px;text-align:left">Tipo</th>
            <th style="padding:10px;text-align:left">Número/Ano</th>
            <th style="padding:10px;text-align:left">Autor</th>
            <th style="padding:10px;text-align:left">Data</th>
            <th style="padding:10px;text-align:left">Ementa</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <p style="margin-top:20px;font-size:12px;color:#999">
        Acesse: <a href="https://transparencialegislativa.al.rn.leg.br/pesquisa-avancada">transparencialegislativa.al.rn.leg.br</a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Monitor ALERN" <${EMAIL_REMETENTE}>`,
    to: EMAIL_DESTINO,
    subject: `🏛️ ALERN: ${novas.length} nova(s) proposição(ões) — ${new Date().toLocaleDateString('pt-BR')}`,
    html,
  });

  console.log(`✅ Email enviado com ${novas.length} proposições novas.`);
}

async function buscarProposicoes() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const tamanhoPagina = 100;
  const maxPaginas = 5; // primeiras 500 no backlog inicial; no dia a dia só há novas na pág 0
  let todasProposicoes = [];

  console.log(`🔍 Buscando proposições de ${ano}...`);

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const url = `${API_BASE}/processo?pagina=${pagina}&tamanhoPagina=${tamanhoPagina}&ano=${ano}`;

    console.log(`📄 Página ${pagina + 1}/${maxPaginas}...`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Origin': 'https://transparencialegislativa.al.rn.leg.br',
        'Referer': 'https://transparencialegislativa.al.rn.leg.br/',
      }
    });

    if (!response.ok) {
      console.error(`❌ Erro na API: ${response.status} ${response.statusText}`);
      const texto = await response.text();
      console.error('Resposta:', texto.substring(0, 300));
      break;
    }

    const json = await response.json();
    const lista = json.dados || [];
    console.log(`   ${lista.length} proposições recebidas (total da API: ${json.total})`);

    if (lista.length === 0) break;
    todasProposicoes = todasProposicoes.concat(lista);

    // Se já temos todas as proposições do ano, parar
    if (todasProposicoes.length >= json.total) break;
  }

  console.log(`📊 Total coletado: ${todasProposicoes.length}`);
  return todasProposicoes;
}

function normalizarProposicao(p) {
  // Usa o número da propositura (PL 130/2026), não o número do processo interno
  const sigla = p.propositura?.tipo?.sigla || '-';
  const descricao = p.propositura?.tipo?.descricao || '-';
  const tipo = sigla !== '-' ? `${sigla} — ${descricao}` : descricao;

  const numero = p.propositura?.numero || p.numero || '-';
  const ano = p.propositura?.ano || p.ano || '-';

  const autor = p.iniciativa?.descricao || p.iniciativa?.parlamentar?.nomeParlamentar || '-';

  let data = '-';
  if (p.dataEntrada) {
    data = new Date(p.dataEntrada).toLocaleDateString('pt-BR');
  }

  return {
    id: String(p.id),
    tipo,
    numero: String(numero),
    ano: String(ano),
    autor,
    data,
    ementa: (p.ementa || '-').substring(0, 200),
  };
}

(async () => {
  console.log('🚀 Iniciando monitor ALERN (RN)...');
  console.log(`⏰ ${new Date().toLocaleString('pt-BR')}`);

  const estado = carregarEstado();
  const idsVistos = new Set(estado.proposicoes_vistas.map(String));

  const proposicoesRaw = await buscarProposicoes();

  if (proposicoesRaw.length === 0) {
    console.log('⚠️ Nenhuma proposição encontrada.');
    process.exit(0);
  }

  const proposicoes = proposicoesRaw.map(normalizarProposicao).filter(p => p.id);
  console.log(`📊 Total normalizado: ${proposicoes.length}`);

  const novas = proposicoes.filter(p => !idsVistos.has(p.id));
  console.log(`🆕 Proposições novas: ${novas.length}`);

  if (novas.length > 0) {
    novas.sort((a, b) => {
      if (a.tipo < b.tipo) return -1;
      if (a.tipo > b.tipo) return 1;
      return (parseInt(b.numero) || 0) - (parseInt(a.numero) || 0);
    });
    await enviarEmail(novas);
    novas.forEach(p => idsVistos.add(p.id));
    estado.proposicoes_vistas = Array.from(idsVistos);
    estado.ultima_execucao = new Date().toISOString();
    salvarEstado(estado);
  } else {
    console.log('✅ Sem novidades. Nada a enviar.');
    estado.ultima_execucao = new Date().toISOString();
    salvarEstado(estado);
  }
})();
