import { getAllFromStore, saveToStore, deleteFromStore, clearAllDatabase } from '../db.js';
import { getCurrentSessionSolves } from './timer.js'; 

let REAL_SOLVES_STORE = 'times';
let currentFilter = 'all'; 
let evolutionChart = null;

let localPeer = null;

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

export async function initHistoryScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;

    const rawSolves = await discoverAndFetchSolves();
    
    // Filtro rígido para não misturar etapas com o Cubo Inteiro (Todos)
    const filteredSolves = rawSolves.filter(s => {
        if (currentFilter === 'all') {
            return !s.step || s.step === 'all';
        }
        return s.step === currentFilter;
    });

    // Cálculos de Estatísticas Avançadas
    const totalSolves = filteredSolves.length;
    const validSolves = filteredSolves.filter(s => !s.isDNF);
    const pbSingle = validSolves.length > 0 ? Math.min(...validSolves.map(s => s.time)).toFixed(2) + 's' : '-';
    
    const totalSoma = validSolves.reduce((acc, s) => acc + s.time, 0);
    const mediaSessaoGeral = validSolves.length > 0 ? (totalSoma / validSolves.length).toFixed(2) + 's' : '-';

    const curAo5 = calcularAoN(filteredSolves, 5);
    const curAo12 = calcularAoN(filteredSolves, 12);
    const bestAo5 = encontrarMelhorAoN(filteredSolves, 5);
    const bestAo12 = encontrarMelhorAoN(filteredSolves, 12);

    // 📊 Cálculo da Sessão Atual
    const sessionSolves = getCurrentSessionSolves() || [];
    const solvesSessaoAtualFiltradas = currentFilter === 'all'
        ? sessionSolves
        : sessionSolves.filter(s => s.step === currentFilter);

    const totalSessaoAtual = solvesSessaoAtualFiltradas.length;
    const validSessaoAtual = solvesSessaoAtualFiltradas.filter(s => !s.isDNF);
    const somaSessaoAtual = validSessaoAtual.reduce((acc, s) => acc + s.time, 0);
    const mediaSessaoAtual = validSessaoAtual.length > 0 ? (somaSessaoAtual / validSessaoAtual.length).toFixed(2) + 's' : '-';

    container.innerHTML = `
        <div class="history-screen" style="background: var(--bg-card); border: 1px solid #1e293b; border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow); box-sizing: border-box; width: 100%; max-width: 100%;">
            
            <div class="tab-selector" style="display: flex; gap: 6px; background: rgba(2, 6, 23, 0.5); padding: 5px; border-radius: var(--radius-sm, 6px); margin-bottom: 20px; border: 1px solid rgba(88, 110, 117, 0.2);">
                <button class="${currentFilter === 'all' ? 'active':''}" id="btn-filter-all" style="
                    flex: 1; padding: 8px 12px; font-size: 13px; font-weight: 600; border: none; border-radius: var(--radius-sm, 4px); cursor: pointer; 
                    background: ${currentFilter === 'all' ? 'var(--accent)' : 'transparent'}; 
                    color: ${currentFilter === 'all' ? 'var(--text-bright)' : 'var(--text-main)'};
                    transition: all 0.2s ease;
                ">Todos</button>
                <button class="${currentFilter === 'f2l' ? 'active':''}" id="btn-filter-f2l" style="
                    flex: 1; padding: 8px 12px; font-size: 13px; font-weight: 600; border: none; border-radius: var(--radius-sm, 4px); cursor: pointer; 
                    background: ${currentFilter === 'f2l' ? 'var(--accent)' : 'transparent'}; 
                    color: ${currentFilter === 'f2l' ? 'var(--text-bright)' : 'var(--text-main)'};
                    transition: all 0.2s ease;
                ">F2L</button>
                <button class="${currentFilter === 'oll' ? 'active':''}" id="btn-filter-oll" style="
                    flex: 1; padding: 8px 12px; font-size: 13px; font-weight: 600; border: none; border-radius: var(--radius-sm, 4px); cursor: pointer; 
                    background: ${currentFilter === 'oll' ? 'var(--accent)' : 'transparent'}; 
                    color: ${currentFilter === 'oll' ? 'var(--text-bright)' : 'var(--text-main)'};
                    transition: all 0.2s ease;
                ">OLL</button>
                <button class="${currentFilter === 'pll' ? 'active':''}" id="btn-filter-pll" style="
                    flex: 1; padding: 8px 12px; font-size: 13px; font-weight: 600; border: none; border-radius: var(--radius-sm, 4px); cursor: pointer; 
                    background: ${currentFilter === 'pll' ? 'var(--accent)' : 'transparent'}; 
                    color: ${currentFilter === 'pll' ? 'var(--text-bright)' : 'var(--text-main)'};
                    transition: all 0.2s ease;
                ">PLL</button>
            </div>

            <div class="stats-dashboard-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:20px;">
                <div class="stat-card" style="background: #020617; border: 1px solid #1e293b; padding: 8px 10px; border-radius: var(--radius-sm);">
                    <span style="font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Solves (Total)</span>
                    <strong style="display: block; font-size: 15px; color: var(--text-main); font-family: monospace; margin-top: 2px;">${totalSolves}</strong>
                </div>
                <div class="stat-card" style="background: #020617; border: 1px solid #1e293b; padding: 8px 10px; border-radius: var(--radius-sm);">
                    <span style="font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Melhor Single (PB)</span>
                    <strong style="display: block; font-size: 15px; color: var(--success); font-family: monospace; margin-top: 2px;">${pbSingle}</strong>
                </div>
                <div class="stat-card" style="background: #020617; border: 1px solid #1e293b; padding: 8px 10px; border-radius: var(--radius-sm);">
                    <span style="font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Média Geral</span>
                    <strong style="display: block; font-size: 15px; color: var(--text-main); font-family: monospace; margin-top: 2px;">${mediaSessaoGeral}</strong>
                </div>
                <div class="stat-card" style="background: #020617; border: 1px solid var(--accent); padding: 8px 10px; border-radius: var(--radius-sm);">
                    <span style="font-size: 9px; color: var(--accent); font-weight: 700; text-transform: uppercase;">Sessão Atual</span>
                    <strong style="display: block; font-size: 14px; color: var(--text-bright); font-family: monospace; margin-top: 2px;">${totalSessaoAtual} s / ${mediaSessaoAtual}</strong>
                </div>
                <div class="stat-card" style="background: #020617; border: 1px solid #1e293b; padding: 8px 10px; border-radius: var(--radius-sm);">
                    <span style="font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Atual ao5</span>
                    <strong style="display: block; font-size: 15px; color: var(--text-main); font-family: monospace; margin-top: 2px;">${curAo5}</strong>
                </div>
                <div class="stat-card" style="background: #020617; border: 1px solid #1e293b; padding: 8px 10px; border-radius: var(--radius-sm);">
                    <span style="font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Melhor ao5</span>
                    <strong style="display: block; font-size: 15px; color: var(--text-main); font-family: monospace; margin-top: 2px;">${bestAo5}</strong>
                </div>
                <div class="stat-card" style="background: #020617; border: 1px solid #1e293b; padding: 8px 10px; border-radius: var(--radius-sm);">
                    <span style="font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Atual ao12</span>
                    <strong style="display: block; font-size: 15px; color: var(--text-main); font-family: monospace; margin-top: 2px;">${curAo12}</strong>
                </div>
                <div class="stat-card" style="background: #020617; border: 1px solid #1e293b; padding: 8px 10px; border-radius: var(--radius-sm);">
                    <span style="font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Melhor ao12</span>
                    <strong style="display: block; font-size: 15px; color: var(--text-main); font-family: monospace; margin-top: 2px;">${bestAo12}</strong>
                </div>
            </div>

            <div id="weakness-panel-container" style="margin-bottom: 25px; display: none;"></div>

            <div style="background: #020617; border: 1px solid #1e293b; border-radius: var(--radius-sm); padding: 12px; margin-bottom: 25px; box-sizing: border-box;">
                <h4 style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">📈 Linha de Evolução Temporal</h4>
                <div style="position: relative; height: 160px; width: 100%;">
                    <canvas id="chart-evolution"></canvas>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 24px; width: 100%; max-width: 100%; box-sizing: border-box;">
                
                <div style="width: 100%; max-width: 100%; box-sizing: border-box;">
                    <h3 style="font-size: 13px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        🏆 Seus 12 Melhores Tempos
                    </h3>
                    <div id="top-12-singles-target" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; width: 100%; box-sizing: border-box;"></div>
                </div>

                <div style="width: 100%; max-width: 100%; box-sizing: border-box;">
                    <h3 style="font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                        Histórico Detalhado
                    </h3>
                    <div id="history-list-target" style="height: 400px; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box;"></div>
                </div>
            </div>

            <div style="margin-top: 30px; border-top: 1px solid #1e293b; padding-top: 20px; box-sizing: border-box; width: 100%;">
                <button id="btn-forcar-update" style="
                    background: rgba(38, 139, 210, 0.1); 
                    border: 1px solid rgba(38, 139, 210, 0.3); 
                    color: var(--accent); 
                    font-size: 11px; 
                    font-weight: 700; 
                    padding: 8px 12px; 
                    border-radius: var(--radius-sm, 4px); 
                    cursor: pointer; 
                    transition: all 0.2s ease; 
                    width: 100%; 
                    margin-bottom: 10px;
                    text-align: center;
                ">
                    🔄 Forçar Atualização do Código (Preservar Histórico)
                </button>
                <button id="btn-toggle-backup-zone" style="background: transparent; border: 1px solid #1e293b; color: var(--text-muted); font-size: 12px; font-weight:600; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition); width: 100%; text-align: center;">⚙️ Gerenciar Dados (Backup / Reset)</button>
                
                <div id="import-export-zone" class="hidden" style="margin-top: 15px; background: rgba(2, 6, 23, 0.4); border: 1px solid #1e293b; padding: 15px; border-radius: var(--radius-sm); box-sizing: border-box; width: 100%;">
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <button id="btn-export-json" class="btn-primary" style="font-size: 11px; padding: 6px 12px; flex: 1; background: var(--accent); border:none; color:#fff; border-radius:4px; cursor:pointer;">📥 Exportar JSON</button>
                        <label style="background: #1e293b; color: var(--text-main); font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; flex: 1;">
                            📤 Enviar Arquivo
                            <input type="file" id="file-import-selector" accept=".json" style="display: none;">
                        </label>
                    </div>
                    <textarea id="txt-import-data" placeholder="Conteúdo JSON do backup..." style="width: 100%; height: 70px; background: #020617; border: 1px solid #1e293b; color: var(--accent); font-family: monospace; font-size: 11px; padding: 8px; border-radius: 5px; resize: none; margin-bottom: 10px; box-sizing: border-box;"></textarea>
                    <button id="btn-confirm-import" style="background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #10b981; font-size: 11px; font-weight: 700; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; width: 100%;">Confirmar e Mesclar Dados</button>
                </div>

                <div class="danger-zone-container" style="margin-top: 20px; padding: 15px; border-radius: var(--radius-sm); background: rgba(220, 50, 47, 0.03); border: 1px dashed rgba(220, 50, 47, 0.2); text-align: center;">
                    <p class="danger-text" style="font-size:11px; color:var(--text-muted); margin-bottom:10px;"><strong>Zona de Perigo:</strong> Esta ação apagará permanentemente todo o seu histórico e progresso salvos localmente.</p>
                    <button id="btn-danger-clear-db" class="btn-reset-danger" style="background: transparent; color: var(--danger); border: 1px solid var(--danger); padding: 8px 16px; font-size: 12px; font-weight: 600; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.2s ease;">
                        ⚠️ Limpar Banco de Dados
                    </button>
                </div>
            </div>
        </div>

        <div style="margin-top: 15px; background: rgba(2, 6, 23, 0.6); border: 1px solid #1e293b; padding: 15px; border-radius: var(--radius-sm); box-sizing: border-box; width: 100%;">
            <h4 style="font-size: 12px; color: var(--accent); margin-top: 0; margin-bottom: 5px; text-transform: uppercase;">⚡ Sincronização Direta P2P</h4>
            <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px;">Transfira dados instantaneamente entre PC e Celular sem cabos ou arquivos.</p>
            
            <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
                <button id="btn-p2p-gerar" style="background: #268bd2; border:none; color:#fff; font-size:11px; padding:8px 12px; border-radius:4px; font-weight:600; cursor:pointer; flex: 1;">
                    🖥️ Enviar deste PC
                </button>
                
                <div style="display: flex; flex: 1; gap: 4px; min-width: 160px;">
                    <input type="number" id="input-p2p-code" placeholder="Código de 4 dígitos" style="background:#020617; border: 1px solid #1e293b; color:#fff; font-size:11px; padding:6px; border-radius:4px; width:70%; text-align:center; font-family:monospace;">
                    <button id="btn-p2p-conectar" style="background: rgba(16, 185, 129, 0.2); border:1px solid rgba(16, 185, 129, 0.4); color:#10b981; font-size:11px; padding:6px; border-radius:4px; font-weight:600; cursor:pointer; width:30%;">
                        📱 OK
                    </button>
                </div>
            </div>

            <div id="p2p-container-display" style="text-align: center; margin-top: 10px;">
                <span id="p2p-status" style="font-size: 11px; color: var(--text-muted); font-family: monospace;">Sistema pronto para pareamento.</span>
                <div id="p2p-code-display"></div>
            </div>
        </div>
    `;

    // Vincular cliques dos botões de etapas
    ['all', 'f2l', 'oll', 'pll'].forEach(f => {
        const btn = document.getElementById(`btn-filter-${f}`);
        if (btn) {
            btn.onclick = () => {
                currentFilter = f;
                initHistoryScreen();
            };
        }
    });

    const btnToggle = document.getElementById('btn-toggle-backup-zone');
    if (btnToggle) {
        btnToggle.onclick = () => {
            document.getElementById('import-export-zone').classList.toggle('hidden');
        };
    }

    // Vinculação de eventos do backup corrigidos
    document.getElementById('btn-export-json').onclick = exportData;
    document.getElementById('file-import-selector').onchange = handleFileSelect;
    document.getElementById('btn-confirm-import').onclick = importData;

    document.getElementById('btn-danger-clear-db').onclick = async () => {
        if (confirm("⚠️ ATENÇÃO MÁXIMA!! Isso apagará TODOS os seus tempos e algoritmos do navegador!\n\nTem certeza absoluta que deseja prosseguir?")) {
            // ✅ CORREÇÃO: Mata qualquer conexão WebRTC aberta antes de resetar e recarregar a página
            if (typeof encerrarConexaoP2P === 'function') {
                encerrarConexaoP2P();
            }
            
            await clearAllDatabase();
            alert("O aplicativo foi redefinido com sucesso.");
            window.location.reload();
        }
    };

    renderTop12Singles(filteredSolves, rawSolves); 
    renderHistoryList(filteredSolves, rawSolves);
    renderEvolutionChart(filteredSolves);
    calculateAndRenderWeaknesses(rawSolves);
    document.getElementById('btn-p2p-gerar').onclick = iniciarEmissorP2P;
    document.getElementById('btn-p2p-conectar').onclick = conectarComoReceptorP2P;
    const btnUpdate = document.getElementById('btn-forcar-update');
        if (btnUpdate) {
            btnUpdate.onclick = forcarAtualizacaoSistema;
        }
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

function renderEvolutionChart(solves) {
    const ctx = document.getElementById('chart-evolution');
    
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

        // Quando o celular conectar com sucesso no PC
        localPeer.on('connection', (conn) => {
            statusLabel.innerText = "Dispositivo conectado! Transferindo histórico...";
            codeDisplay.innerHTML = ""; // Limpa o número da tela
            
            conn.on('open', async () => {
                try {
                    const db = await import('../db.js');
                    const rawSolves = await db.getAllFromStore('times') || [];
                    const rawCases = await db.getAllFromStore('casesState') || [];

                    // Dispara o payload via P2P local puro
                    conn.send({
                        solves: rawSolves,
                        cases: rawCases
                    });
                    
                    statusLabel.innerHTML = "<span style='color: var(--success);'>✅ Dados enviados com sucesso!</span>";
                } catch (dbErr) {
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
async function conectarComoReceptorP2P() {
    const inputCodigo = document.getElementById('input-p2p-code');
    const statusLabel = document.getElementById('p2p-status');
    const codeDisplay = document.getElementById('p2p-code-display');
    
    if (!inputCodigo || inputCodigo.value.length !== 4) {
        alert("Insira um código válido de 4 dígitos.");
        return;
    }

    if (localPeer) {
        encerrarConexaoP2P();
    }

    if (typeof Peer === 'undefined') {
        statusLabel.innerText = "Carregando protocolo de comunicação...";
        await carregarScriptPeerJS();
    }

    statusLabel.innerText = "Buscando computador na rede local...";
    if (codeDisplay) codeDisplay.innerHTML = "";
    
    localPeer = new Peer({ secure: true });
    
    localPeer.on('open', () => {
        const targetId = `cuber-trainer-${inputCodigo.value}`;
        const conn = localPeer.connect(targetId, {
            reliable: true
        });
        
        conn.on('open', () => {
            statusLabel.innerText = "Conectado! Aguardando payload...";
        });

        conn.on('data', async (data) => {
            statusLabel.innerText = "Processando e mesclando dados recebidos...";
            
            try {
                const db = await import('../db.js');
                
                if (data.solves && Array.isArray(data.solves)) {
                    for (const solve of data.solves) {
                        await db.saveToStore('times', solve);
                    }
                }
                
                if (data.cases && Array.isArray(data.cases)) {
                    for (const c of data.cases) {
                        await db.saveToStore('casesState', c);
                    }
                }

                statusLabel.innerHTML = "<span style='color: var(--success);'>✅ Histórico sincronizado com sucesso!</span>";
                inputCodigo.value = "";
                
            } catch (error) {
                statusLabel.innerText = "Falha ao gravar dados recebidos.";
            } finally {
                setTimeout(() => encerrarConexaoP2P(), 3500);
            }
        });

        // Timeout de segurança se o ID não responder na rede
        setTimeout(() => {
            if (localPeer && statusLabel.innerText.includes("Buscando")) {
                statusLabel.innerText = "Computador não encontrado. Verifique o código.";
                encerrarConexaoP2P();
            }
        }, 8000);
    });

    localPeer.on('error', (err) => {
        console.error(err);
        statusLabel.innerText = "Não foi possível conectar ao PC emissor.";
        encerrarConexaoP2P();
    });
}

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
    setTimeout(() => {
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