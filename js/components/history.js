import { getAllFromStore, saveToStore, deleteFromStore, clearAllDatabase } from '../db.js';
import { getCurrentSessionSolves } from './timer.js'; 

let REAL_SOLVES_STORE = 'times';
let currentFilter = 'all'; 
let evolutionChart = null;

let localPeer = null;

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
    if (recentes.some(s => s.isDNF)) return 'DNF';
    
    const tempos = recentes.map(s => s.time).sort((a, b) => a - b);
    const temposFiltrados = tempos.slice(1, -1); 
    const soma = temposFiltrados.reduce((acc, t) => acc + t, 0);
    return (soma / temposFiltrados.length).toFixed(2) + 's';
}

function encontrarMelhorAoN(solves, n) {
    if (solves.length < n) return '-';
    let melhorMeda = Infinity;

    for (let i = 0; i <= solves.length - n; i++) {
        const subGrupo = solves.slice(i, i + n);
        if (subGrupo.some(s => s.isDNF)) continue;
        
        const tempos = subGrupo.map(s => s.time).sort((a, b) => a - b);
        const temposFiltrados = tempos.slice(1, -1);
        const soma = temposFiltrados.reduce((acc, t) => acc + t, 0);
        const media = soma / temposFiltrados.length;
        if (media < melhorMeda) melhorMeda = media;
    }

    return melhorMeda === Infinity ? 'DNF' : melhorMeda.toFixed(2) + 's';
}
// ==========================================
// 2. SISTEMA DE SINCRONIZAÇÃO P2P E UTILS
// ==========================================
async function garantirPeerJS() {
    if (typeof Peer === 'undefined') {
        console.log("Injetando PeerJS dinamicamente via CDN estável...");
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
            script.onload = () => {
                console.log("PeerJS carregado e pronto para uso.");
                resolve();
            };
            script.onerror = () => reject(new Error("Falha ao carregar os scripts do PeerJS. Verifique a ligação à internet."));
            document.head.appendChild(script);
        });
    }
}

async function conectarComoReceptorP2P(codigoAlvo) {
    const statusLabel = document.getElementById('p2p-status');
    const inputCodigo = document.getElementById('p2p-code-input');

    if (statusLabel) statusLabel.innerText = "Verificando dependências de rede...";

    try {
        await garantirPeerJS();
    } catch (loaderError) {
        console.error(loaderError);
        if (statusLabel) statusLabel.innerHTML = `<span style='color: var(--danger);'>❌ Erro: ${loaderError.message}</span>`;
        return;
    }

    if (statusLabel) statusLabel.innerText = "Localizando par na rede...";

    if (localPeer) {
        try { localPeer.destroy(); } catch (e) {}
        localPeer = null;
    }

    // O receptor não precisa de ID fixo, ele apenas inicia e conecta no código numérico do alvo
    localPeer = new Peer();

    localPeer.on('open', () => {
        const conn = localPeer.connect(codigoAlvo);

        conn.on('open', () => {
            if (statusLabel) statusLabel.innerText = "Conectado! A aguardar dados...";
        });

        conn.on('data', async (data) => {
            if (statusLabel) statusLabel.innerText = "A mesclar histórico e progresso de flashcards...";
            
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

                if (statusLabel) statusLabel.innerHTML = "<span style='color: var(--success);'>✅ Dispositivo 100% Sincronizado!</span>";
                if (inputCodigo) inputCodigo.value = "";
                
            } catch (error) {
                console.error(error);
                if (statusLabel) statusLabel.innerText = "Falha ao gravar dados recebidos.";
            } finally {
                setTimeout(() => {
                    if (localPeer) {
                        try { localPeer.destroy(); } catch (e) {}
                        localPeer = null;
                    }
                    if (statusLabel) statusLabel.innerText = "Sincronização concluída.";

                    import('./dashboard.js').then(dash => {
                        if (dash && typeof dash.renderDashboard === 'function') {
                            dash.renderDashboard();
                        }
                    });
                    
                    initHistoryScreen();
                }, 3500);
            }
        });

        conn.on('error', (err) => {
            console.error(err);
            if (statusLabel) statusLabel.innerText = "Erro na conexão com o par.";
        });
    });

    localPeer.on('error', (err) => {
        console.error(err);
        if (statusLabel) statusLabel.innerText = "Não foi possível conectar. Verifique o código.";
    });
}

async function gerarCodigoParaTransmissaoP2P() {
    const statusLabel = document.getElementById('p2p-status');
    if (statusLabel) statusLabel.innerText = "Preparando servidor local de sincronização...";

    try {
        await garantirPeerJS();
    } catch (loaderError) {
        console.error(loaderError);
        if (statusLabel) statusLabel.innerHTML = `<span style='color: var(--danger);'>❌ Erro: ${loaderError.message}</span>`;
        return;
    }

    if (localPeer) {
        try { localPeer.destroy(); } catch (e) {}
        localPeer = null;
    }

    // 🚀 GERA UM CÓDIGO ALEATÓRIO DE 5 DÍGITOS (Ex: 84391)
    const codigoNumericoCurto = Math.floor(10000 + Math.random() * 90000).toString();

    // Passamos o número gerado diretamente para o construtor do Peer
    localPeer = new Peer(codigoNumericoCurto);

    localPeer.on('open', (id) => {
        if (statusLabel) {
            statusLabel.innerHTML = `
                <div style="background: rgba(38,139,210,0.1); border: 1px solid var(--accent); padding: 12px; border-radius: 6px; margin-top: 10px;">
                    <span style="display:block; font-size:11px; color: var(--accent); font-weight:bold; text-transform:uppercase;">Código Deste Dispositivo:</span>
                    <strong style="font-size: 26px; color: var(--success); font-family: monospace; letter-spacing: 2px;">${id}</strong>
                    <p style="margin: 6px 0 0 0; font-size:11px; color: var(--text-muted);">Insira estes 5 números no outro dispositivo para enviar o seu histórico.</p>
                </div>
            `;
        }
    });

    localPeer.on('connection', (conn) => {
        conn.on('open', async () => {
            if (statusLabel) statusLabel.innerText = "Par conectado! Empacotando banco de dados...";

            try {
                const todosOsSolves = await getAllFromStore(REAL_SOLVES_STORE) || [];
                const todosOsFlashcards = await getAllFromStore('casesState') || [];

                conn.send({
                    solves: todosOsSolves,
                    cases: todosOsFlashcards
                });

                if (statusLabel) statusLabel.innerHTML = "<span style='color: var(--success);'>🚀 Dados transmitidos com sucesso! Sincronizando...</span>";
            } catch (err) {
                console.error(err);
                if (statusLabel) statusLabel.innerText = "Erro ao ler dados locais para envio.";
            }
        });
    });

    localPeer.on('error', (err) => {
        console.error(err);
        // Se o código por extrema coincidência já estiver em uso no servidor central, avisa para gerar outro
        if (err.type === 'unavailable-id') {
            if (statusLabel) statusLabel.innerText = "Código em uso. Clique novamente para gerar outro.";
        } else {
            if (statusLabel) statusLabel.innerText = "Erro ao abrir canal de transmissão.";
        }
    });
}

async function forceClearSystemCacheAndReload() {
    const statusLabel = document.getElementById('p2p-status');
    
    if (statusLabel) {
        statusLabel.innerText = "A procurar novas atualizações de código...";
    }

    try {
        if ('caches' in window && 'serviceWorker' in navigator) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );

            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }

        if (statusLabel) {
            statusLabel.innerHTML = "<span style='color: var(--success);'>✅ Sistema atualizado! A recarregar...</span>";
        }

        setTimeout(() => {
            window.location.reload(true);
        }, 1000);

    } catch (err) {
        console.error("Erro ao atualizar arquivos:", err);
        alert("Não foi possível atualizar automaticamente.");
    }
}
// ==========================================
// 3. RENDERIZADORES COMPLEMENTARES
//    (Devem estar declarados ANTES de initHistoryScreen)
// ==========================================
function renderEvolutionChart(solves) {
    const ctx = document.getElementById('historyEvolutionChart');
    
    // ✅ GUARDA DE SEGURANÇA 1: Se o elemento canvas não existir no DOM, aborta imediatamente
    if (!ctx) return;

    if (evolutionChart) {
        try {
            evolutionChart.destroy();
        } catch (e) {
            console.warn("Erro ao destruir gráfico antigo:", e);
        }
    }

    // Filtra os solves válidos e ordena por data
    const validSolves = [...solves]
        .filter(s => s && !s.isDNF)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    // ✅ GUARDA DE SEGURANÇA 2: Se não houver dados suficientes, limpa o canvas de forma segura e para
    if (validSolves.length < 2) {
        const context = ctx.getContext('2d');
        if (context) {
            // Garante que o canvas está limpo antes de desenhar o texto
            context.clearRect(0, 0, ctx.width || 300, ctx.height || 160);
            context.fillStyle = '#8e8e93';
            context.font = '11px monospace';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            // Usa valores estáticos seguros caso o bounding box ainda não esteja calculado
            context.fillText('Gere mais dados para plotar o gráfico.', (ctx.width || 300) / 2, (ctx.height || 160) / 2);
        }
        return;
    }

    const dataDisplay = validSolves.slice(-30);
    const labels = dataDisplay.map((_, idx) => `#${idx + 1}`);
    const values = dataDisplay.map(s => s.time);

    // Cria a instância do gráfico apenas se passou pelas validações
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
                    pointRadius: dataDisplay.length > 50 ? 0 : 2,
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
    } catch (chartError) {
        console.error("Falha ao inicializar Chart.js:", chartError);
    }
}

// ==========================================
// 4. O INICIALIZADOR PRINCIPAL (Exportado)
//    (Totalmente isolado por categorias fidedignas)
// ==========================================
export async function initHistoryScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;

    // 1. Busca TODAS as resoluções brutas do IndexedDB
    const allSolves = await discoverAndFetchSolves();

    // 2. FILTRAGEM ESTREITA: Separa os dados antes de qualquer cálculo para não misturar recordes
    // Se currentFilter for 'all', consideramos como a montagem completa do 3x3
    const filteredSolves = allSolves.filter(s => {
        if (currentFilter === 'all') {
            return !s.step || s.step === 'all'; // Apenas montagens completas 3x3
        }
        return s.step === currentFilter; // Apenas a etapa específica (f2l, oll, pll)
    });

    const totalSolves = filteredSolves.length;
    const validSolves = filteredSolves.filter(s => !s.isDNF);
    const pbSingle = validSolves.length > 0 ? Math.min(...validSolves.map(s => s.time)).toFixed(2) + 's' : '-';

    // 3. Cálculos de Médias baseados ESTRITAMENTE na categoria filtrada
    const ao5 = calcularAoN(filteredSolves, 5);
    const ao12 = calcularAoN(filteredSolves, 12);
    const ao50 = calcularAoN(filteredSolves, 50);
    const ao100 = calcularAoN(filteredSolves, 100);

    const bAo5 = encontrarMelhorAoN(filteredSolves, 5);
    const bAo12 = encontrarMelhorAoN(filteredSolves, 12);

    // Nome legível da categoria atual para exibição na UI
    const categoriaNome = currentFilter === 'all' ? '3x3 Completo' : currentFilter.toUpperCase();

    // Renderização completa da estrutura de interface (HTML)
    container.innerHTML = `
        <div class="history-screen" style="padding: 10px; max-width: 600px; margin: 0 auto; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px;">
            
            <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <span style="font-size: 13px; font-weight: bold; color: var(--text-bright);">📂 Categoria Ativa:</span>
                <select id="filter-history-step" style="padding: 6px 12px; font-size: 13px; font-weight: bold; background: #002b36; color: var(--accent); border: 1px solid var(--accent); border-radius: var(--radius-sm); outline: none; cursor:pointer;">
                    <option value="all" ${currentFilter === 'all' ? 'selected':''}>Cube 3x3 Completo</option>
                    <option value="f2l" ${currentFilter === 'f2l' ? 'selected':''}>Etapa - F2L</option>
                    <option value="oll" ${currentFilter === 'oll' ? 'selected':''}>Etapa - OLL</option>
                    <option value="pll" ${currentFilter === 'pll' ? 'selected':''}>Etapa - PLL</option>
                </select>
            </div>

            <div class="stats-summary-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                <div class="stat-box-mini" style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.03); text-align: center;">
                    <span style="font-size: 10px; color: var(--text-muted); display:block; text-transform:uppercase; letter-spacing: 0.5px;">Solves (${categoriaNome})</span>
                    <strong style="font-size: 22px; color: var(--text-bright); font-family: monospace;">${totalSolves}</strong>
                </div>
                <div class="stat-box-mini" style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.03); text-align: center;">
                    <span style="font-size: 10px; color: var(--text-muted); display:block; text-transform:uppercase; letter-spacing: 0.5px;">Melhor Single (PB ${categoriaNome})</span>
                    <strong style="font-size: 22px; color: var(--success); font-family: monospace;">${pbSingle}</strong>
                </div>
            </div>

            <div class="averages-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.02);">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-bright); border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px; display: flex; justify-content: space-between;">
                    <span>📊 Estatísticas de: <strong>${categoriaNome}</strong></span>
                </h3>
                
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
                        <h4 style="margin: 0 0 8px 0; font-size: 11px; color: var(--success); text-transform: uppercase;">Melhor Histórico (PB)</h4>
                        <div style="display: flex; flex-direction: column; gap: 6px; font-family: monospace; font-size: 13px;">
                            <div>Melhor ao5: <strong style="color: var(--success); float: right;">${bAo5}</strong></div>
                            <div>Melhor ao12: <strong style="color: var(--success); float: right;">${bAo12}</strong></div>
                            <div style="color: var(--text-muted); font-size: 10px; margin-top: 6px; text-align: center; grid-column: span 2;">Focado em ${categoriaNome}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="averages-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.02);">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-bright);">🥇 Top 12 Singles — ${categoriaNome}</h3>
                <div id="top-12-singles-target" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;"></div>
            </div>

            <div id="weakness-panel-container" style="display: none;"></div>

            <div class="chart-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.02);">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-bright);">📈 Gráfico de Evolução (${categoriaNome})</h3>
                <div style="position: relative; width: 100%; height: 180px;">
                    <canvas id="historyEvolutionChart"></canvas>
                </div>
            </div>

            <div class="history-list-section">
                <h3 style="font-size: 14px; color: var(--text-bright); margin: 0 0 10px 0;">📜 Histórico Recente — ${categoriaNome}</h3>
                <div id="history-list-target" style="display: flex; flex-direction: column; gap: 6px;"></div>
            </div>

            <div class="averages-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius-md); border: 1px solid rgba(38,139,210,0.15);">
                <h3 style="margin: 0 0 6px 0; font-size: 14px; color: var(--accent);">🌐 Sincronização Cross-Device (P2P Direto)</h3>
                <p style="font-size:11px; color: var(--text-muted); margin: 0 0 12px 0; line-height: 1.4;">Transfira ou mescle os seus treinos e estados de flashcards entre telemóveis e computadores sem servidores intermédios.</p>
                
                <div style="display: flex; flex-direction: column; gap: 10px; width:100%;">
                    <button id="btn-p2p-gerar" class="btn-primary" style="background: rgba(38,139,210,0.12); border: 1px solid var(--accent); color: var(--text-bright); font-size:12px; padding: 10px;">
                        🔗 Gerar Código de Transmissão Neste Dispositivo
                    </button>
                    
                    <div style="display: flex; gap: 6px; margin-top: 4px; width: 100%; box-sizing: border-box;">
                        <input type="text" 
                               id="p2p-code-input" 
                               inputmode="numeric" 
                               pattern="[0-9]*" 
                               maxlength="5" 
                               placeholder="Digite os 5 números do Dispositivo 1..." 
                               style="flex: 1; padding: 10px; font-size:12px; background: #002b36; border: 1px solid var(--border-color); color: var(--text-bright); border-radius: var(--radius-sm); outline:none; min-width: 0;">
                        
                        <button id="btn-p2p-conectar" class="btn-primary" style="font-size:12px; padding: 0 14px; background: var(--success); white-space: nowrap;">
                            Sincronizar 📥
                        </button>
                    </div>
                </div>
                <div id="p2p-status" style="font-size: 11px; color: var(--text-muted); font-family: monospace; text-align: center; margin-top: 10px; min-height: 14px;"></div>
            </div>

            <div class="danger-zone-container" style="margin-top: 10px;">
                <p class="danger-text" style="font-size: 11px; color: var(--danger); margin-bottom: 8px;">⚠️ Cuidado: Esta ação irá apagar definitivamente todas as suas resoluções, recordes e progresso de flashcards salvos localmente.</p>
                <button id="btn-wipe-database" class="btn-primary" style="background: var(--danger); padding: 8px 16px; font-size: 12px; font-weight: bold; border-radius: var(--radius-sm); border: none; color: #fff; cursor: pointer;">
                    Apagar Todos os Dados do Sistema
                </button>
            </div>
            
            <div style="text-align: center; margin-top: 10px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.03);">
                <button id="btn-force-update-app" style="background: transparent; border: 1px dashed var(--border-color); color: var(--text-muted); padding: 6px 12px; font-size: 11px; border-radius: 4px; cursor: pointer;">
                    🔄 Procurar Atualizações de Código (Limpar Cache)
                </button>
            </div>

        </div>
    `;

    // =========================================================================
    // 🚀 ASSOCIAÇÃO DE EVENTOS
    // =========================================================================
    document.getElementById('btn-p2p-gerar').addEventListener('click', async () => {
        await gerarCodigoParaTransmissaoP2P();
    });

    document.getElementById('btn-p2p-conectar').addEventListener('click', async () => {
        const inputCodigo = document.getElementById('p2p-code-input');
        if (inputCodigo && inputCodigo.value.trim() !== "") {
            await conectarComoReceptorP2P(inputCodigo.value.trim());
        } else {
            const statusLabel = document.getElementById('p2p-status');
            if (statusLabel) {
                statusLabel.innerHTML = "<span style='color:var(--warning);'>Por favor, digite um código válido.</span>";
            }
        }
    });

    document.getElementById('btn-force-update-app').addEventListener('click', forceClearSystemCacheAndReload);

    document.getElementById('btn-wipe-database').addEventListener('click', async () => {
        const confirmar = confirm("Tem a certeza absoluta de que deseja limpar a sua base de dados? Esta ação não pode ser desfeita!");
        if (confirmar) {
            await clearAllDatabase();
            alert("Base de dados limpa com sucesso.");
            window.location.reload();
        }
    });

    // Event listener do filtro corrigido para disparar a atualização completa com isolamento
    document.getElementById('filter-history-step').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        initHistoryScreen(); 
    });

    // 4. ENVIO DOS DADOS FILTRADOS PARA OS COMPONENTES VISUAIS
    renderTop12Singles(filteredSolves, allSolves);
    renderHistoryList(filteredSolves, allSolves);
    calculateAndRenderWeaknesses(allSolves);
    renderEvolutionChart(filteredSolves);
}

// ==========================================================================
// 🛠️ FUNÇÕES DE BACKUP E ESCALA DOS EVENTOS (FORA DE INITHISTORYSCREEN)
// ==========================================================================

async function exportData() {
    try {
        const db = await import('../db.js');
        const rawSolves = await db.getAllFromStore('times') || [];
        const rawCases = await db.getAllFromStore('casesState') || []; // Ajustado para casesState

        const compressedSolves = rawSolves.map(s => ({
            t: s.time,
            s: s.scramble,
            d: s.date,
            e: s.step || 'all', 
            f: s.isDNF ? 1 : 0,         
            p: s.hasPlusTwo ? 1 : 0,    
            c: s.caseId || null,
            n: s.caseName || null
        }));

        const compressedCases = rawCases.map(c => ({
            i: c.uid,          
            l: c.learned ? 1 : 0 
        }));

        const finalBackupObject = {
            solves: compressedSolves,
            cases: compressedCases,
            version: "2.0"
        };

        const minifiedJsonText = JSON.stringify(finalBackupObject);
        const blob = new Blob([minifiedJsonText], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cuber_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Erro ao exportar dados", err);
        alert("Falha ao gerar o arquivo de backup de dados.");
    }
}

async function importData() {
    const txtArea = document.getElementById('txt-import-data');
    if (!txtArea || !txtArea.value.trim()) {
        alert("Cole o conteúdo do JSON ou envie um arquivo antes de confirmar.");
        return;
    }

    try {
        const parsed = JSON.parse(txtArea.value.trim());
        const db = await import('../db.js');

        if (parsed.solves && Array.isArray(parsed.solves)) {
            // 1. Descomprime e restaura o Histórico de Solves
            for (const item of parsed.solves) {
                const isCompressed = item.t !== undefined;
                const restoredSolve = {
                    time: isCompressed ? item.t : item.time,
                    scramble: isCompressed ? item.s : item.scramble,
                    date: isCompressed ? item.d : item.date,
                    step: isCompressed ? (item.e || 'all') : (item.step || 'all'),
                    isDNF: isCompressed ? (item.f === 1) : !!item.isDNF,
                    hasPlusTwo: isCompressed ? (item.p === 1) : !!item.hasPlusTwo,
                    caseId: isCompressed ? item.c : (item.caseId || null),
                    caseName: isCompressed ? item.n : (item.caseName || null)
                };
                await db.saveToStore('times', restoredSolve);
            }

            // 2. Descomprime e restaura o Estado de Aprendizado (Corrigido para casesState)
            if (parsed.cases && Array.isArray(parsed.cases)) {
                for (const item of parsed.cases) {
                    const isCompressed = item.i !== undefined;
                    const caseRecord = {
                        uid: isCompressed ? item.i : item.uid,
                        learned: isCompressed ? (item.l === 1) : !!item.learned
                    };
                    await db.saveToStore('casesState', caseRecord);
                }
            }

            alert("Dados mesclados e importados com sucesso!");
            txtArea.value = "";
            initHistoryScreen();
            
            // Atualiza o dashboard do topo
            import('./dashboard.js').then(dash => { if (dash?.renderDashboard) dash.renderDashboard(); });
        } else {
            alert("Formato de backup inválido.");
        }
    } catch (e) {
        console.error(e);
        alert("Erro ao ler dados inseridos. Certifique-se de que é um JSON válido.");
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0]; 
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { 
        document.getElementById('txt-import-data').value = evt.target.result; 
    };
    reader.readAsText(file);
}

// LÓGICA DE DETECÇÃO DE CASOS COM MAIOR TEMPO DE EXECUÇÃO
function calculateAndRenderWeaknesses(allSolves) {
    const container = document.getElementById('weakness-panel-container');
    if (!container || currentFilter === 'all') {
        container.style.display = 'none';
        return;
    }

    const solvesEtapa = allSolves.filter(s => s.step === currentFilter && s.caseName && !s.isDNF);
    
    if (solvesEtapa.length === 0) {
        container.innerHTML = `
            <div style="background: rgba(2,6,23,0.3); border: 1px dashed #1e293b; padding:12px; border-radius:6px; font-size:11px; color: var(--text-muted); text-align:center;">
                Gere resoluções específicas de <strong>${currentFilter.toUpperCase()}</strong> no cronômetro para ranquear seus piores casos.
            </div>
        `;
        container.style.display = 'block';
        return;
    }

    const mapaCasos = {};
    solvesEtapa.forEach(s => {
        if (!mapaCasos[s.caseName]) {
            mapaCasos[s.caseName] = { nome: s.caseName, soma: 0, qtd: 0 };
        }
        mapaCasos[s.caseName].soma += s.time;
        mapaCasos[s.caseName].qtd++;
    });

    const listaAnalise = Object.values(mapaCasos).map(c => {
        return { nome: c.nome, media: c.soma / c.qtd, totalSolves: c.qtd };
    });

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
            <h4 style="font-size: 11px; font-weight: 800; color: var(--danger); text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">🚨 Seus 3 Piores Casos em ${currentFilter.toUpperCase()} (Treine Mais!)</h4>
            <div style="display:flex; flex-direction:column; gap:6px;">
                ${itemsHtml}
            </div>
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
            <div style="background: rgba(2, 6, 23, 0.5); border: 1px solid #1e293b; border-radius: var(--radius-sm); padding: 5px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 0;" title="${s.caseName || s.scramble || ''}">
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

    let html = '';
    listaExibicao.forEach((s) => {
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
                            <strong style="font-size: 13px; color: ${s.isDNF ? 'var(--danger)' : 'var(--text-main)'}; font-family: monospace; flex-shrink: 0;">
                                ${displayTime}
                            </strong>
                            ${badgeEtapa}
                        </div>
                        <span style="font-size: 10px; color: var(--text-muted); font-family: monospace; white-space: normal; word-break: break-word; width: 100%; display: block;">
                            ${s.scramble || 'Sem scramble'}
                        </span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-top: 2px;">
                    <span style="font-size: 10px; color: var(--text-muted); font-weight: 500; white-space: nowrap;">
                        ${dataFormatada}
                    </span>
                    <button class="btn-delete-solve" data-id="${s.id}" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; font-size: 12px; flex-shrink: 0;">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = html;

    listContainer.querySelectorAll('.btn-delete-solve').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = Number(btn.getAttribute('data-id'));
            if (confirm("Apagar esta resolução?")) {
                await deleteFromStore(REAL_SOLVES_STORE, id);
                initHistoryScreen();
                import('./dashboard.js').then(dash => { if (dash?.renderDashboard) dash.renderDashboard(); });
            }
        });
    });
}

/**
 * 🌐 Inicializa o canal P2P como Emissor (Gerador do Código)
 */
async function iniciarEmissorP2P() {
    const statusLabel = document.getElementById('p2p-status');
    const codeDisplay = document.getElementById('p2p-code-display');
    
    if (!statusLabel || !codeDisplay) return;

    // Se já existia uma instância ativa, destrói para resetar portas
    if (localPeer) {
        encerrarConexaoP2P();
    }
    
    if (typeof Peer === 'undefined') {
        statusLabel.innerText = "Carregando protocolo de comunicação...";
        try {
            await carregarScriptPeerJS();
        } catch (err) {
            statusLabel.innerText = "Erro ao baixar protocolo. Verifique sua conexão.";
            return;
        }
    }
    
    statusLabel.innerText = "Gerando chave única no servidor...";
    
    // Gerar código de 4 dígitos baseado no tempo para mitigar colisões imediatas
    const codigoUnico = Math.floor(1000 + Math.random() * 9000).toString();
    
    try {
        // Inicializa o Peer com tratamento estrito de reconexão e erros
        localPeer = new Peer(`cuber-trainer-${codigoUnico}`, {
            debug: 1,
            secure: true
        });

        localPeer.on('open', (id) => {
            statusLabel.innerText = "Aguardando conexão do smartphone...";
            codeDisplay.innerHTML = `
                <div style="font-size: 24px; font-weight: 800; color: var(--accent); letter-spacing: 4px; margin: 10px 0;">${codigoUnico}</div>
                <p style="font-size: 11px; color: var(--text-muted);">Digite este código no celular para parear.</p>
            `;
        });

        // Quando o celular (ou outro dispositivo) conectar com sucesso no PC
        localPeer.on('connection', (conn) => {
            statusLabel.innerText = "Dispositivo conectado! Transferindo dados completos...";
            if (codeDisplay) codeDisplay.innerHTML = ""; 
            
            conn.on('open', async () => {
                try {
                    const db = await import('../db.js');
                    
                    // 📦 Coleta ABSOLUTAMENTE TODOS os dados do IndexedDB local
                    const rawSolves = await db.getAllFromStore('times') || [];
                    const rawCases = await db.getAllFromStore('casesState') || [];

                    // Dispara o payload completo via P2P local puro
                    conn.send({
                        solves: rawSolves,
                        cases: rawCases // ✅ Agora o progresso e streaks dos flashcards vão aqui dentro!
                    });
                    
                    statusLabel.innerHTML = "<span style='color: var(--success);'>✅ Todo o histórico foi sincronizado!</span>";
                } catch (dbErr) {
                    console.error(dbErr);
                    statusLabel.innerText = "Erro ao ler banco local.";
                } finally {
                    setTimeout(() => encerrarConexaoP2P(), 3500);
                }
            });
        });

        localPeer.on('error', (err) => {
            console.error("Erro no PeerJS:", err.type, err);
            if (err.type === 'unavailable-id') {
                statusLabel.innerText = "Código em conflito no servidor. Tentando gerar outro...";
                setTimeout(() => iniciarEmissorP2P(), 1000);
            } else {
                statusLabel.innerText = `Erro de pareamento (${err.type}). Tente novamente.`;
                encerrarConexaoP2P();
            }
        });

    } catch (e) {
        console.error(e);
        statusLabel.innerText = "Falha crítica ao iniciar canal P2P.";
    }
}

/**
 * 📱 Conecta ao PC como Receptor (Consumidor do Código)
 */

/**
 * 🧹 Desconecta portas e limpa listeners com atualização segura da interface
 */
function encerrarConexaoP2P() {
    if (localPeer) {
        try {
            localPeer.disconnect();
            localPeer.destroy();
        } catch (e) {
            console.error("Erro ao destruir peer:", e);
        }
        localPeer = null;
    }
    
    // Atualiza a interface gráfica de status de forma sutil
    const statusLabel = document.getElementById('p2p-status');
    const codeDisplay = document.getElementById('p2p-code-display');
    
    if (statusLabel && !statusLabel.innerHTML.includes("✅")) {
        statusLabel.innerText = "Sincronização finalizada.";
    }
    if (codeDisplay) codeDisplay.innerHTML = "";
    
    // ✅ CORREÇÃO: Força a reinicialização limpa e completa da tela de Histórico.
    // Isso garante que o Chart.js encontre o canvas reconstruído no DOM e evita o erro de 'width'
    // Força atualização suave de todos os módulos na tela do receptor
    setTimeout(() => {
        // Se a tela atual for o dashboard, força ele a ler o novo banco mesclado
        import('./dashboard.js').then(dash => {
            if (dash && typeof dash.renderDashboard === 'function') {
                dash.renderDashboard();
            }
        });
        
        // Se a tela atual for o histórico, força a reconstrução dos gráficos
        if (typeof initHistoryScreen === 'function') {
            initHistoryScreen();
        }
    }, 500);
}

/**
 * 🔌 Injeta a biblioteca PeerJS dinamicamente no DOM apenas quando necessária
 */
function carregarScriptPeerJS() {
    return new Promise((resolve, reject) => {
        if (typeof Peer !== 'undefined') return resolve();
        
        const script = document.createElement('script');
        script.src = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
        script.async = true;
        
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Não foi possível carregar o PeerJS"));
        
        document.head.appendChild(script);
    });
}

/**
 * 🔄 Força a atualização dos arquivos do sistema (Limpa o Cache do SW)
 * Preserva 100% dos dados salvos no IndexedDB
 */
async function forcarAtualizacaoSistema() {
    const statusLabel = document.getElementById('p2p-status'); // Reaproveita o label de status para feedback
    
    if (statusLabel) {
        statusLabel.innerText = "Buscando novas atualizações de código...";
    }

    try {
        // 1. Verifica se o navegador suporta Service Workers e Cache Storage
        if ('caches' in window && 'serviceWorker' in navigator) {
            // 2. Pega todas as chaves de cache do sistema
            const cacheNames = await caches.keys();
            
            // 3. Deleta todos os caches de arquivos (HTML, CSS, JS)
            await Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );

            // 4. Força os Service Workers ativos a se desregistrarem
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }

        if (statusLabel) {
            statusLabel.innerHTML = "<span style='color: var(--success);'>✅ Sistema atualizado! Recarregando...</span>";
        }

        // 5. Dá um reload limpando o cache nativo do navegador (Hard Reload via código)
        setTimeout(() => {
            window.location.reload(true);
        }, 1000);

    } catch (err) {
        console.error("Erro ao atualizar arquivos:", err);
        alert("Não foi possível atualizar automaticamente. Tente dar um Ctrl+F5.");
    }
}