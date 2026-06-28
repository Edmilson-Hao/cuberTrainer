import { getAllFromStore, saveToStore, deleteFromStore, clearAllDatabase } from '../db.js';
import { getCurrentSessionSolves } from './timer.js'; 

// ==========================================
// TRANCA GLOBAL CONTRA REFRESH (ANTI-BUG)
// ==========================================
window.addEventListener('submit', function(e) {
    // Impede absolutamente qualquer formulário de recarregar a página nesta aba
    if (e.target && (e.target.id === 'btn-p2p-gerar' || e.target.querySelector('#btn-p2p-gerar'))) {
        e.preventDefault();
        e.stopPropagation();
    }
}, true);

let REAL_SOLVES_STORE = 'times';
let currentFilter = 'all'; 
let evolutionChart = null;

let localPeer = null;
let p2pCodigoAtivoGlobal = null;
let p2pStatusMensagemGlobal = ""; 

// ==========================================
// 1. FUNÇÕES AUXILIARES DE BUSCA E CÁLCULO
// ==========================================
async function discoverAndFetchSolves() {
    try {
        const data = await getAllFromStore(REAL_SOLVES_STORE);
        return data || [];
    } catch (err) {
        return [];
    }
}

function calcularAoN(solves, n) {
    if (solves.length < n) return '-';
    const recentes = solves.slice(-n);
    const dnfCount = recentes.filter(s => s.isDNF).length;

    // Regra WCA: 1 DNF é permitido (conta como pior tempo, descartado no corte).
    // 2 ou mais DNFs no grupo → resultado DNF.
    if (dnfCount >= 2) return 'DNF';

    // Ordena: DNFs vão para o fim (valor Infinity)
    const tempos = recentes
        .map(s => s.isDNF ? Infinity : s.time)
        .sort((a, b) => a - b);

    // Corta o melhor e o pior (o DNF, se houver, já está no fim como Infinity)
    const temposFiltrados = tempos.slice(1, -1);
    const soma = temposFiltrados.reduce((acc, t) => acc + t, 0);
    return (soma / temposFiltrados.length).toFixed(2) + 's';
}

function encontrarMelhorAoN(solves, n) {
    if (solves.length < n) return '-';
    let melhorMedia = Infinity;

    for (let i = 0; i <= solves.length - n; i++) {
        const subGrupo = solves.slice(i, i + n);
        const dnfCount = subGrupo.filter(s => s.isDNF).length;

        // Regra WCA: 2 ou mais DNFs no grupo → esse grupo é DNF, pula
        if (dnfCount >= 2) continue;

        // 1 DNF é tratado como Infinity (pior tempo, descartado no corte)
        const tempos = subGrupo
            .map(s => s.isDNF ? Infinity : s.time)
            .sort((a, b) => a - b);

        const temposFiltrados = tempos.slice(1, -1);
        const soma = temposFiltrados.reduce((acc, t) => acc + t, 0);
        const media = soma / temposFiltrados.length;
        if (media < melhorMedia) melhorMedia = media;
    }

    return melhorMedia === Infinity ? 'DNF' : melhorMedia.toFixed(2) + 's';
}

// ==========================================
// 2. SISTEMA DE SINCRONIZAÇÃO P2P
// ==========================================
async function garantirPeerJS() {
    if (typeof Peer === 'undefined') {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error("Falha ao carregar o PeerJS."));
            document.head.appendChild(script);
        });
    }
}

function atualizarApenasHTMLP2P() {
    const containerP2P = document.getElementById('p2p-interactive-container');
    if (!containerP2P) return;

    const btnTexto = p2pCodigoAtivoGlobal ? `🔑 CÓDIGO ATIVO: ${p2pCodigoAtivoGlobal}` : '🔗 Gerar Código de Transmissão Neste Dispositivo';
    const btnEstilo = p2pCodigoAtivoGlobal 
        ? 'background: rgba(40, 167, 69, 0.2) !important; border: 1px solid #28a745 !important; color: #fff !important;' 
        : 'background: rgba(38, 139, 210, 0.12); border: 1px solid var(--accent); color: var(--text-bright);';

    containerP2P.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px; width:100%;">
            <button id="btn-p2p-gerar" type="button" onclick="event.preventDefault(); event.stopPropagation(); return false;" style="${btnEstilo} font-size:12px; padding: 10px; cursor: pointer; border-radius:4px; font-weight:bold;">
                ${btnTexto}
            </button>
            
            <div style="display: flex; gap: 6px; margin-top: 4px; width: 100%; box-sizing: border-box;">
                <input type="text" 
                       id="p2p-code-input" 
                       inputmode="numeric" 
                       pattern="[0-9]*" 
                       maxlength="5" 
                       value="${p2pCodigoAtivoGlobal || ''}"
                       placeholder="Digite os 5 números..." 
                       style="flex: 1; padding: 10px; font-size:12px; background: #002b36; border: 1px solid var(--border-color); color: var(--text-bright); border-radius: var(--radius-sm); outline:none; min-width: 0;">
                
                <button id="btn-p2p-conectar" type="button" onclick="event.preventDefault(); event.stopPropagation(); return false;" style="font-size:12px; padding: 0 14px; background: var(--success); color: #fff; border:none; white-space: nowrap; cursor: pointer; border-radius:4px; font-weight:bold;">
                    Sincronizar 📥
                </button>
            </div>
        </div>
        <div id="p2p-status" style="font-size: 11px; color: var(--text-muted); font-family: monospace; text-align: center; margin-top: 10px; min-height: 14px;">
            ${p2pStatusMensagemGlobal}
        </div>
    `;

    const btnGerar = document.getElementById('btn-p2p-gerar');
    if (btnGerar) {
        btnGerar.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await gerarCodigoParaTransmissaoP2P();
        });
    }

    const btnConectar = document.getElementById('btn-p2p-conectar');
    if (btnConectar) {
        btnConectar.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const inputCodigo = document.getElementById('p2p-code-input');
            if (inputCodigo && inputCodigo.value.trim() !== "") {
                await conectarComoReceptorP2P(inputCodigo.value.trim());
            }
        });
    }
}

async function conectarComoReceptorP2P(codigoAlvo) {
    p2pStatusMensagemGlobal = "Verificando dependências de rede...";
    atualizarApenasHTMLP2P();

    try {
        await garantirPeerJS();
    } catch (loaderError) {
        p2pStatusMensagemGlobal = `<span style='color: var(--danger);'>❌ Erro: ${loaderError.message}</span>`;
        atualizarApenasHTMLP2P();
        return;
    }

    p2pStatusMensagemGlobal = "Localizando par na rede...";
    atualizarApenasHTMLP2P();

    if (localPeer) {
        try {
            localPeer.off('open'); localPeer.off('error'); localPeer.off('connection'); localPeer.off('close');
            localPeer.disconnect(); localPeer.destroy();
        } catch(e){}
        localPeer = null;
    }

    localPeer = new Peer();

    localPeer.on('open', () => {
        const conn = localPeer.connect(codigoAlvo);

        conn.on('open', () => {
            p2pStatusMensagemGlobal = "<span style='color: var(--accent); font-weight:bold;'>● Conectado! Baixando dados...</span>";
            atualizarApenasHTMLP2P();
        });

        conn.on('data', async (data) => {
            p2pStatusMensagemGlobal = "A mesclar histórico e progresso...";
            atualizarApenasHTMLP2P();
            
            try {
                const db = await import('../db.js');
                if (data.solves && Array.isArray(data.solves)) {
                    for (const solve of data.solves) {
                        await db.saveToStore(REAL_SOLVES_STORE, solve);
                    }
                }
                if (data.cases && Array.isArray(data.cases)) {
                    for (const caseState of data.cases) {
                        await db.saveToStore('casesState', caseState);
                    }
                }

                p2pStatusMensagemGlobal = "<span style='color: var(--success); font-weight:bold;'>✅ Dispositivo Sincronizado!</span>";
                p2pCodigoAtivoGlobal = null;
                atualizarApenasHTMLP2P();
                
                setTimeout(() => {
                    p2pStatusMensagemGlobal = "";
                    if (localPeer) { try { localPeer.destroy(); } catch(e){} localPeer = null; }
                    initHistoryScreen();
                }, 1500);
                
            } catch (error) {
                p2pStatusMensagemGlobal = "Falha ao gravar dados recebidos.";
                atualizarApenasHTMLP2P();
            }
        });

        conn.on('error', () => {
            p2pStatusMensagemGlobal = "<span style='color:var(--danger);'>Erro na conexão com o par.</span>";
            atualizarApenasHTMLP2P();
        });
    });

    localPeer.on('error', () => {
        p2pStatusMensagemGlobal = "<span style='color:var(--danger);'>Não foi possível conectar. Verifique o código.</span>";
        atualizarApenasHTMLP2P();
    });
}

async function gerarCodigoParaTransmissaoP2P() {
    p2pStatusMensagemGlobal = "Preparando servidor local...";
    atualizarApenasHTMLP2P();
    
    try {
        await garantirPeerJS();
    } catch (loaderError) {
        p2pStatusMensagemGlobal = `<span style='color: var(--danger);'>❌ Erro: ${loaderError.message}</span>`;
        atualizarApenasHTMLP2P();
        return;
    }

    if (localPeer) {
        try {
            localPeer.off('open'); localPeer.off('error'); localPeer.off('connection'); localPeer.off('close');
            localPeer.disconnect(); localPeer.destroy();
        } catch(e){}
        localPeer = null;
    }

    const codigoNumericoCurto = Math.floor(10000 + Math.random() * 90000).toString();
    p2pCodigoAtivoGlobal = codigoNumericoCurto;

    p2pStatusMensagemGlobal = `
        <div style="background: rgba(40,167,69,0.1); border: 1px solid #28a745; padding: 12px; border-radius: 6px; margin-top: 10px; text-align: center;">
            <span style="display:block; font-size:12px; color: #a6e3a1; font-weight:bold; text-transform:uppercase;">● Canal Ativo para Pareamento</span>
            <strong style="font-size: 28px; color: #a6e3a1; font-family: monospace; letter-spacing: 3px; display:block; margin: 5px 0;">${codigoNumericoCurto}</strong>
            <p style="margin: 0; font-size:11px; color: var(--text-muted);">Digite estes 5 números no outro dispositivo e clique em Sincronizar.</p>
        </div>
    `;

    atualizarApenasHTMLP2P();

    try {
        localPeer = new Peer(codigoNumericoCurto);

        localPeer.on('connection', (conn) => {
            conn.on('open', async () => {
                p2pStatusMensagemGlobal = "<span style='color: var(--accent);'>Par conectado! Transmitindo...</span>";
                atualizarApenasHTMLP2P();

                try {
                    const todosOsSolves = await getAllFromStore(REAL_SOLVES_STORE) || [];
                    const todosOsFlashcards = await getAllFromStore('casesState') || [];

                    conn.send({ solves: todosOsSolves, cases: todosOsFlashcards });

                    p2pStatusMensagemGlobal = "<span style='color: var(--success); font-weight:bold;'>🚀 Dados transmitidos com sucesso!</span>";
                    p2pCodigoAtivoGlobal = null;
                    atualizarApenasHTMLP2P();
                    
                    setTimeout(() => { encerrarConexaoP2P(); }, 2000);
                } catch (err) {
                    p2pStatusMensagemGlobal = "Erro ao verificar dados locais.";
                    atualizarApenasHTMLP2P();
                }
            });
        });

        localPeer.on('error', (err) => {
            if (err.type === 'unavailable-id') {
                p2pStatusMensagemGlobal = "Código em uso. Clique novamente para gerar outro.";
                p2pCodigoAtivoGlobal = null;
                atualizarApenasHTMLP2P();
            }
        });

    } catch (e) {
        p2pStatusMensagemGlobal = "Erro ao abrir canal de transmissão.";
        atualizarApenasHTMLP2P();
    }
}

function encerrarConexaoP2P() {
    if (localPeer) {
        try {
            localPeer.off('open'); localPeer.off('error'); localPeer.off('connection'); localPeer.off('close');
            localPeer.disconnect(); localPeer.destroy();
        } catch (e) {}
        localPeer = null;
    }
    p2pCodigoAtivoGlobal = null;
    p2pStatusMensagemGlobal = "";
    initHistoryScreen();
}

async function forceClearSystemCacheAndReload() {
    try {
        if ('caches' in window && 'serviceWorker' in navigator) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) { await registration.unregister(); }
        }
        setTimeout(() => { window.location.reload(true); }, 400);
    } catch (err) {
        window.location.reload();
    }
}

// ==========================================
// 3. RENDERIZADORES COMPLEMENTARES
// ==========================================
function renderEvolutionChart(solves) {
    const ctx = document.getElementById('historyEvolutionChart');
    if (!ctx || typeof Chart === 'undefined') return;

    if (evolutionChart) { try { evolutionChart.destroy(); } catch (e) {} }

    const validSolves = [...solves]
        .filter(s => s && !s.isDNF)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (validSolves.length < 2) {
        const context = ctx.getContext('2d');
        if (context) {
            context.clearRect(0, 0, ctx.width || 300, ctx.height || 160);
            context.fillStyle = '#8e8e93';
            context.font = '11px monospace';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('Gere mais dados para plotar o gráfico.', (ctx.width || 300) / 2, (ctx.height || 160) / 2);
        }
        return;
    }

    const dataDisplay = validSolves.slice(-30);
    const labels = dataDisplay.map((_, idx) => `#${idx + 1}`);
    const values = dataDisplay.map(s => s.time);

    try {
        evolutionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    borderColor: '#268bd2',
                    borderWidth: 2,
                    backgroundColor: 'rgba(38, 139, 210, 0.06)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 2,
                    pointBackgroundColor: '#268bd2'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#657b83', font: { size: 9 } } },
                    y: { grid: { color: 'rgba(88, 110, 117, 0.1)' }, ticks: { color: '#657b83', font: { size: 9 } } }
                }
            }
        });
    } catch (chartError) {}
}

// ==========================================
// 4. O INICIALIZADOR PRINCIPAL (Exportado)
// ==========================================
export async function initHistoryScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;

    const allSolves = await discoverAndFetchSolves();

    const filteredSolves = allSolves.filter(s => {
        if (currentFilter === 'all') return !s.step || s.step === 'all' || s.step === ''; 
        return s.step === currentFilter;
    });

    const totalSolves = filteredSolves.length;
    const validSolves = filteredSolves.filter(s => !s.isDNF);
    const pbSingle = validSolves.length > 0 ? Math.min(...validSolves.map(s => s.time)).toFixed(2) + 's' : '-';

    const ao5 = calcularAoN(filteredSolves, 5);
    const ao12 = calcularAoN(filteredSolves, 12);
    const ao50 = calcularAoN(filteredSolves, 50);
    const ao100 = calcularAoN(filteredSolves, 100);

    const bAo5 = encontrarMelhorAoN(filteredSolves, 5);
    const bAo12 = encontrarMelhorAoN(filteredSolves, 12);

    const categoriaNome = currentFilter === 'all' ? '3x3 Completo' : currentFilter.toUpperCase();

    container.innerHTML = `
        <div class="history-screen" style="padding: 10px; max-width: 600px; margin: 0 auto; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px;">
            
            <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <span style="font-size: 13px; font-weight: bold; color: var(--text-bright);">📂 Categoria Ativa:</span>
                <select id="filter-history-step" style="padding: 6px 12px; font-size: 13px; font-weight: bold; background: #002b36; color: var(--accent); border: 1px solid var(--accent); border-radius: var(--radius-sm); outline: none; cursor:pointer;">
                    <option value="all" ${currentFilter === 'all' ? 'selected':''}>Cube 3x3 Completo (Tudo)</option>
                    <option value="cross" ${currentFilter === 'cross' ? 'selected':''}>Etapa - Cruz</option>
                    <option value="f2l" ${currentFilter === 'f2l' ? 'selected':''}>Etapa - F2L</option>
                    <option value="oll" ${currentFilter === 'oll' ? 'selected':''}>Etapa - OLL</option>
                    <option value="pll" ${currentFilter === 'pll' ? 'selected':''}>Etapa - PLL</option>
                </select>
            </div>

            <div class="averages-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius-md); border: 1px solid rgba(38,139,210,0.15);">
                <h3 style="margin: 0 0 6px 0; font-size: 14px; color: var(--accent);">🌐 Sincronização Cross-Device (P2P Direto)</h3>
                <div id="p2p-interactive-container"></div>
            </div>

            <div id="weakness-panel-container" style="display: none; margin-bottom: 5px;"></div>

            <div class="stats-summary-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                <div class="stat-box-mini" style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.03); text-align: center;">
                    <span style="font-size: 10px; color: var(--text-muted); display:block; text-transform:uppercase; letter-spacing: 0.5px;">Solves (${categoriaNome})</span>
                    <strong style="font-size: 22px; color: var(--text-bright); font-family: monospace;">${totalSolves}</strong>
                </div>
                <div class="stat-box-mini" style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.03); text-align: center;">
                    <span style="font-size: 10px; color: var(--text-muted); display:block; text-transform:uppercase; letter-spacing: 0.5px;">Melhor Single</span>
                    <strong style="font-size: 22px; color: var(--success); font-family: monospace;">${pbSingle}</strong>
                </div>
            </div>

            <div class="averages-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.02);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                    <div style="background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Média Atual</h4>
                        <div style="display: flex; flex-direction: column; gap: 6px; font-family: monospace; font-size: 13px;">
                            <div>ao5: <strong style="color: var(--text-bright); float: right;">${ao5}</strong></div>
                            <div>ao12: <strong style="color: var(--text-bright); float: right;">${ao12}</strong></div>
                            <div>ao50: <strong style="color: var(--text-bright); float: right;">${ao50}</strong></div>
                            <div>ao100: <strong style="color: var(--text-bright); float: right;">${ao100}</strong></div>
                        </div>
                    </div>
                    
                    <div style="background: rgba(40,167,69,0.03); padding: 10px; border-radius: 6px; border: 1px solid rgba(40,167,69,0.1);">
                        <h4 style="margin: 0 0 8px 0; font-size: 11px; color: var(--success); text-transform: uppercase;">Melhor Histórico</h4>
                        <div style="display: flex; flex-direction: column; gap: 6px; font-family: monospace; font-size: 13px;">
                            <div>Melhor ao5: <strong style="color: var(--success); float: right;">${bAo5}</strong></div>
                            <div>Melhor ao12: <strong style="color: var(--success); float: right;">${bAo12}</strong></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="averages-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.02);">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-bright);">🥇 Top 12 Singles</h3>
                <div id="top-12-singles-target" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;"></div>
            </div>

            <div class="chart-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.02);">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-bright);">📈 Gráfico de Evolução</h3>
                <div style="position: relative; width: 100%; height: 180px;">
                    <canvas id="historyEvolutionChart"></canvas>
                </div>
            </div>

            <div class="history-list-section">
                <h3 style="font-size: 14px; color: var(--text-bright); margin: 0 0 10px 0;">📜 Últimas Solves Recentes</h3>
                <div id="history-list-target" style="display: flex; flex-direction: column; gap: 6px;"></div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.03); gap: 10px;">
                <button id="btn-force-update-app" style="background: transparent; border: 1px dashed var(--border-color); color: var(--text-muted); padding: 8px 12px; font-size: 11px; border-radius: 4px; cursor: pointer;">
                    🔄 Limpar Cache
                </button>
                <button id="btn-wipe-database" style="background: rgba(220,53,69,0.15); border: 1px solid var(--danger); padding: 8px 12px; font-size: 11px; font-weight: bold; border-radius: var(--radius-sm); color: var(--danger); cursor: pointer;">
                    🗑️ Apagar Banco
                </button>
            </div>
        </div>
    `;

    atualizarApenasHTMLP2P();

    document.getElementById('btn-force-update-app').addEventListener('click', forceClearSystemCacheAndReload);

    document.getElementById('btn-wipe-database').addEventListener('click', async () => {
        if (confirm("Tem a certeza absoluta de que deseja limpar a sua base de dados?")) {
            await clearAllDatabase();
            window.location.reload();
        }
    });

    document.getElementById('filter-history-step').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        initHistoryScreen(); 
    });

    renderTop12Singles(filteredSolves, allSolves);
    renderHistoryList(filteredSolves, allSolves);
    calculateAndRenderWeaknesses(allSolves);
    renderEvolutionChart(filteredSolves);
}

// ==========================================================================
// 5. FUNÇÕES DE SUPORTE E ANÁLISE DE DADOS
// ==========================================================================
function calculateAndRenderWeaknesses(allSolves) {
    const container = document.getElementById('weakness-panel-container');
    if (!container) return;

    if (currentFilter === 'all') {
        container.innerHTML = `
            <div class="chart-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.02); margin-bottom: 5px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-bright);">📊 Distribuição Teórica das Etapas (CFOP)</h3>
                <div style="position: relative; width: 100%; height: 160px;">
                    <canvas id="historyDistributionChartCanvas"></canvas>
                </div>
            </div>
        `;
        container.style.display = 'block';
        setTimeout(() => { renderDistributionChart('historyDistributionChartCanvas', allSolves); }, 500);
        return; 
    }

    const solvesEtapa = allSolves.filter(s => s.step === currentFilter && s.caseName && !s.isDNF);
    if (solvesEtapa.length === 0) { container.style.display = 'none'; return; }

    const mapaCasos = {};
    solvesEtapa.forEach(s => {
        if (!mapaCasos[s.caseName]) mapaCasos[s.caseName] = { nome: s.caseName, soma: 0, qtd: 0 };
        mapaCasos[s.caseName].soma += s.time;
        mapaCasos[s.caseName].qtd++;
    });

    const listaAnalise = Object.values(mapaCasos).map(c => ({ nome: c.nome, media: c.soma / c.qtd, totalSolves: c.qtd }));
    listaAnalise.sort((a, b) => b.media - a.media);
    const pioresTres = listaAnalise.slice(0, 3);

    let itemsHtml = '';
    pioresTres.forEach((c, i) => {
        const corAlerta = i === 0 ? '#ff1744' : i === 1 ? '#ff5252' : '#ff7979';
        itemsHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#020617; border: 1px solid #1e293b; padding:8px 12px; border-radius: var(--radius-sm);">
                <span style="font-size:12px; font-weight:700; color:#fff;">⚠️ ${c.nome}</span>
                <div style="text-align:right;">
                    <strong style="color: ${corAlerta}; font-family:monospace; font-size:13px;">${c.media.toFixed(2)}s médio</strong>
                    <span style="display:block; font-size:9px; color: var(--text-muted);">${c.totalSolves} resoluções</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div style="background: rgba(255, 23, 68, 0.03); border: 1px solid rgba(255, 23, 68, 0.2); border-radius: var(--radius-sm); padding:12px; box-sizing:border-box;">
            <h4 style="font-size: 11px; font-weight: 800; color: var(--danger); text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">🚨 Seus 3 Piores Casos em ${currentFilter.toUpperCase()}</h4>
            <div style="display:flex; flex-direction:column; gap:6px;">${itemsHtml}</div>
        </div>
    `;
    container.style.display = 'block';
}

function renderTop12Singles(filteredSolves, rawSolves) {
    const topContainer = document.getElementById('top-12-singles-target');
    if (!topContainer) return;

    const validSolves = filteredSolves.filter(s => !s.isDNF);
    const top12 = [...validSolves].sort((a, b) => a.time - b.time).slice(0, 12);
    const rawCronologico = [...rawSolves].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (top12.length === 0) {
        topContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 11px; padding: 10px;">Sem recordes disponíveis.</div>`;
        return;
    }

    let html = '';
    top12.forEach((s, idx) => {
        const numeroAbsoluto = rawCronologico.findIndex(x => x.id === s.id) + 1;
        const medalha = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
        html += `
            <div style="background: rgba(2, 6, 23, 0.5); border: 1px solid #1e293b; border-radius: var(--radius-sm); padding: 5px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 0;">
                <span style="font-size: 9px; font-weight: 700; color: var(--text-muted);">${medalha}</span>
                <strong style="font-size: 11px; color: var(--text-main); font-family: monospace; white-space: nowrap;">${s.time.toFixed(2)}s</strong>
                <span style="font-size: 8px; color: var(--accent); font-family: monospace;">${s.caseName ? s.caseName.split(' ')[0] : `#${numeroAbsoluto}`}</span>
            </div>
        `;
    });
    topContainer.innerHTML = html;
}

function renderHistoryList(filteredSolves, rawSolves) {
    const listContainer = document.getElementById('history-list-target');
    if (!listContainer) return;

    if (filteredSolves.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 12px;">Nenhuma resolução nesta aba.</div>`;
        return;
    }

    const listaExibicao = [...filteredSolves].sort((a, b) => new Date(b.date) - new Date(a.date));
    const rawCronologico = [...rawSolves].sort((a, b) => new Date(a.date) - new Date(b.date));
    const listaOtimizadaCelular = listaExibicao.slice(0, 50);

    let html = '';
    listaOtimizadaCelular.forEach((s) => {
        const numeroAbsolutoSolve = rawCronologico.findIndex(x => x.id === s.id) + 1;
        const dataFormatada = new Date(s.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

        let displayTime = s.time.toFixed(2) + 's';
        if (s.isDNF) displayTime = 'DNF';
        else if (s.hasPlusTwo) displayTime += ' (+2)';

        const badgeEtapa = s.caseName 
            ? `<span style="background: rgba(38, 139, 210, 0.1); color: var(--accent); border: 1px solid rgba(38, 139, 210, 0.2); font-size: 9px; padding: 1px 5px; border-radius: 4px; font-weight: 700;">${s.caseName}</span>`
            : s.step && s.step !== 'all' ? `<span style="background: #1e293b; color: var(--accent); font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: 600; text-transform: uppercase;">${s.step}</span>` : '';

        html += `
            <div class="history-item" style="background: rgba(2, 6, 23, 0.3); border: 1px solid #1e293b; border-radius: var(--radius-sm); padding: 10px; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; box-sizing: border-box; width: 100%;">
                <div style="display: flex; align-items: flex-start; gap: 8px; min-width: 0; flex: 1;">
                    <span style="font-family: monospace; font-size: 11px; font-weight: 700; color: var(--text-muted); min-width: 28px; flex-shrink: 0; margin-top: 2px;">
                        #${numeroAbsolutoSolve}
                    </span>
                    <div style="display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 3px;">
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <strong style="font-size: 13px; color: ${s.isDNF ? 'var(--danger)' : 'var(--text-main)'}; font-family: monospace;">
                                ${displayTime}
                            </strong>
                            ${badgeEtapa}
                        </div>
                        <span style="font-size: 10px; color: var(--text-muted); font-family: monospace; word-break: break-word; width: 100%; display: block;">
                            ${s.scramble || 'Sem scramble'}
                        </span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-top: 2px;">
                    <span style="font-size: 10px; color: var(--text-muted); font-weight: 500;">${dataFormatada}</span>
                    <button class="btn-delete-solve" data-id="${s.id}" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; font-size: 12px;">🗑️</button>
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = html;

    listContainer.querySelectorAll('.btn-delete-solve').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const rawId = btn.getAttribute('data-id');
            const idValido = rawId.startsWith('workout_') ? rawId : Number(rawId);
            if (confirm("Apagar esta resolução das metas?")) {
                await deleteFromStore(REAL_SOLVES_STORE, idValido);
                initHistoryScreen();
                import('./dashboard.js').then(dash => { if (dash?.renderDashboard) dash.renderDashboard(); });
            }
        });
    });
}

export async function renderDistributionChart(canvasId, allSolves) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;

    const pegarMediaMovel = (etapaNome) => {
        const filtrados = allSolves.filter(s => s.step === etapaNome && !s.isDNF);
        if (filtrados.length === 0) return 0;
        const ultimosTreinos = filtrados.slice(-20);
        return ultimosTreinos.reduce((acc, s) => acc + s.time, 0) / ultimosTreinos.length;
    };

    const mediaCruz = pegarMediaMovel('cross');
    const mediaF2L  = pegarMediaMovel('f2l');
    const mediaOLL  = pegarMediaMovel('oll');
    const mediaPLL  = pegarMediaMovel('pll');

    let dadosGrafico = [mediaCruz, mediaF2L, mediaOLL, mediaPLL];

    if (window.myDistributionChartInstance) { window.myDistributionChartInstance.destroy(); }

    window.myDistributionChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Cruz', 'F2L (4 Passos)', 'OLL', 'PLL'],
            datasets: [{
                data: dadosGrafico.map(v => parseFloat(v.toFixed(2))),
                backgroundColor: ['#268bd2', '#28a745', '#b58900', '#2aa198'],
                borderWidth: 1,
                borderColor: '#002b36'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#93a1a1', font: { size: 11, family: 'monospace' } } }
            },
            cutout: '70%'
        }
    });
}