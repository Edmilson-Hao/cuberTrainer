import { getAllFromStore, saveToStore, deleteFromStore, clearAllDatabase } from '../db.js';
import { getCurrentSessionSolves } from './timer.js';

let REAL_SOLVES_STORE = 'times';
let currentFilter = 'all'; 
let evolutionChart = null;

export async function initHistoryScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;

    const todasSolves = await discoverAndFetchSolves();
    const solvesFiltradas = currentFilter === 'all' 
        ? todasSolves 
        : todasSolves.filter(s => s.step === currentFilter);

    // Cálculos de Estatísticas Avançadas
    const totalSolves = solvesFiltradas.length;
    const validSolves = solvesFiltradas.filter(s => !s.isDNF);
    const pbSingle = validSolves.length > 0 ? Math.min(...validSolves.map(s => s.time)).toFixed(2) + 's' : '-';
    
    const totalSoma = validSolves.reduce((acc, s) => acc + s.time, 0);
    const mediaSessaoGeral = validSolves.length > 0 ? (totalSoma / validSolves.length).toFixed(2) + 's' : '-';

    const curAo5 = calcularAoN(solvesFiltradas, 5);
    const curAo12 = calcularAoN(solvesFiltradas, 12);
    const bestAo5 = encontrarMelhorAoN(solvesFiltradas, 5);
    const bestAo12 = encontrarMelhorAoN(solvesFiltradas, 12);

    // 📊 Cálculo da Sessão Atual (Mantido)
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
            
            <!-- 🔄 RESTAURADO: Abas de Filtros de Etapas do Estilo Antigo (Imagem 2) -->
            <div class="tab-selector" style="display: flex; gap: 6px; background: rgba(2, 6, 23, 0.5); padding: 5px; border-radius: var(--radius-sm, 6px); margin-bottom: 20px; border: 1px solid rgba(88, 110, 117, 0.2);">
                <button class="${currentFilter === 'all' ? 'active':''}" id="btn-filter-all" style="
                    flex: 1; 
                    padding: 8px 12px; 
                    font-size: 13px; 
                    font-weight: 600; 
                    border: none; 
                    border-radius: var(--radius-sm, 4px); 
                    cursor: pointer; 
                    background: ${currentFilter === 'all' ? 'var(--accent)' : 'transparent'}; 
                    color: ${currentFilter === 'all' ? 'var(--text-bright)' : 'var(--text-main)'};
                    transition: all 0.2s ease;
                ">Todos</button>
                
                <button class="${currentFilter === 'f2l' ? 'active':''}" id="btn-filter-f2l" style="
                    flex: 1; 
                    padding: 8px 12px; 
                    font-size: 13px; 
                    font-weight: 600; 
                    border: none; 
                    border-radius: var(--radius-sm, 4px); 
                    cursor: pointer; 
                    background: ${currentFilter === 'f2l' ? 'var(--accent)' : 'transparent'}; 
                    color: ${currentFilter === 'f2l' ? 'var(--text-bright)' : 'var(--text-main)'};
                    transition: all 0.2s ease;
                ">F2L</button>
                
                <button class="${currentFilter === 'oll' ? 'active':''}" id="btn-filter-oll" style="
                    flex: 1; 
                    padding: 8px 12px; 
                    font-size: 13px; 
                    font-weight: 600; 
                    border: none; 
                    border-radius: var(--radius-sm, 4px); 
                    cursor: pointer; 
                    background: ${currentFilter === 'oll' ? 'var(--accent)' : 'transparent'}; 
                    color: ${currentFilter === 'oll' ? 'var(--text-bright)' : 'var(--text-main)'};
                    transition: all 0.2s ease;
                ">OLL</button>
                
                <button class="${currentFilter === 'pll' ? 'active':''}" id="btn-filter-pll" style="
                    flex: 1; 
                    padding: 8px 12px; 
                    font-size: 13px; 
                    font-weight: 600; 
                    border: none; 
                    border-radius: var(--radius-sm, 4px); 
                    cursor: pointer; 
                    background: ${currentFilter === 'pll' ? 'var(--accent)' : 'transparent'}; 
                    color: ${currentFilter === 'pll' ? 'var(--text-bright)' : 'var(--text-main)'};
                    transition: all 0.2s ease;
                ">PLL</button>
            </div>

            <!-- Grid de Estatísticas Premium com a Sessão Atual Integrada -->
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

            <!-- ANÁLISE INTEGRADA: Casos Mais Demorados -->
            <div id="weakness-panel-container" style="margin-bottom: 25px; display: none;"></div>

            <!-- Canvas do Gráfico de Evolução -->
            <div style="background: #020617; border: 1px solid #1e293b; border-radius: var(--radius-sm); padding: 12px; margin-bottom: 25px; box-sizing: border-box;">
                <h4 style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">📈 Linha de Evolução Temporal</h4>
                <div style="position: relative; height: 160px; width: 100%;">
                    <canvas id="history-evolution-chart"></canvas>
                </div>
            </div>

            <!-- Layout Híbrido -->
            <div style="display: flex; flex-direction: column; gap: 24px; width: 100%; max-width: 100%; box-sizing: border-box;">
                <!-- Quadro de Recordes (Top 12) -->
                <div style="width: 100%; max-width: 100%; box-sizing: border-box;">
                    <h3 style="font-size: 13px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        🏆 Seus 12 Melhores Tempos
                    </h3>
                    <div id="top-12-singles-target" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; width: 100%; box-sizing: border-box;"></div>
                </div>

                <!-- Histórico Detalhado -->
                <div style="width: 100%; max-width: 100%; box-sizing: border-box;">
                    <h3 style="font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                        Histórico Detalhado
                    </h3>
                    <div id="history-list-target" style="height: 400px; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box;"></div>
                </div>
            </div>

            <!-- Setup de Backups -->
            <div style="margin-top: 30px; border-top: 1px solid #1e293b; padding-top: 20px; box-sizing: border-box; width: 100%;">
                <button id="btn-toggle-backup-zone" style="background: transparent; border: 1px solid #1e293b; color: var(--text-muted); font-size: 12px; font-weight:600; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition); width: 100%; text-align: center;">⚙️ Gerenciar Dados (Backup / Reset)</button>
                
                <div id="import-export-zone" class="hidden" style="margin-top: 15px; background: rgba(2, 6, 23, 0.4); border: 1px solid #1e293b; padding: 15px; border-radius: var(--radius-sm); box-sizing: border-box; width: 100%;">
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <button id="btn-export-backup" class="btn-primary" style="font-size: 11px; padding: 6px 12px; flex: 1;">📥 Exportar JSON</button>
                        <label style="background: #1e293b; color: var(--text-main); font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; flex: 1;">
                            📤 Enviar Arquivo
                            <input type="file" id="file-import-selector" accept=".json" style="display: none;">
                        </label>
                    </div>
                    <textarea id="txt-import-data" placeholder="Conteúdo JSON do backup..." style="width: 100%; height: 70px; background: #020617; border: 1px solid #1e293b; color: var(--accent); font-family: monospace; font-size: 11px; padding: 8px; border-radius: 5px; resize: none; margin-bottom: 10px; box-sizing: border-box;"></textarea>
                    <button id="btn-confirm-import" style="background: var(--success-bg); border: 1px solid rgba(16, 185, 129, 0.3); color: var(--success); font-size: 11px; font-weight: 700; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; width: 100%;">Confirmar e Mesclar Dados</button>
                </div>

                <!-- Zona de Perigo (Reset) -->
                <div class="danger-zone-container">
                    <p class="danger-text"><strong>Zona de Perigo:</strong> Esta ação apagará permanentemente todo o seu histórico e progresso salvos localmente.</p>
                    <button id="btn-danger-clear-db" class="btn-reset-danger">
                        ⚠️ Limpar Banco de Dados
                    </button>
                </div>
            </div>
        </div>
    `;

    // Re-vinculação dos eventos de cliques com as IDs antigas corrigidas
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

    document.getElementById('btn-export-backup').onclick = exportData;
    document.getElementById('file-import-selector').onchange = handleFileSelect;
    document.getElementById('btn-confirm-import').onclick = importData;

    document.getElementById('btn-danger-clear-db').onclick = async () => {
        if (confirm("⚠️ ATENÇÃO MÁXIMA!! Isso apagará TODOS os seus tempos e algoritmos do navegador!\n\nTem certeza absoluta que deseja prosseguir?")) {
            await clearAllDatabase();
            alert("O aplicativo foi redefinido com sucesso.");
            window.location.reload();
        }
    };

    // Sub-renderizações nativas do seu arquivo completo original
    if (typeof renderAveragesPanel === 'function') renderAveragesPanel(solvesFiltradas);
    if (typeof renderTop12Singles === 'function') renderTop12Singles(solvesFiltradas, todasSolves); 
    if (typeof renderHistoryList === 'function') renderHistoryList(solvesFiltradas, todasSolves);
    renderHistoryChart(solvesFiltradas);
    if (typeof calculateAndRenderWeaknesses === 'function') calculateAndRenderWeaknesses(todasSolves);
}

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

// LÓGICA DE DETECÇÃO DE CASOS COM MAIOR TEMPO DE EXECUÇÃO
function calculateAndRenderWeaknesses(allSolves) {
    const container = document.getElementById('weakness-panel-container');
    if (!container || currentFilter === 'all') {
        container.style.display = 'none';
        return;
    }

    // Filtra resoluções válidas que pertencem à etapa selecionada e que possuem amarração de caso
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

    // Agrupa dados por nome/id do caso
    const mapaCasos = {};
    solvesEtapa.forEach(s => {
        if (!mapaCasos[s.caseName]) {
            mapaCasos[s.caseName] = { nome: s.caseName, soma: 0, qtd: 0 };
        }
        mapaCasos[s.caseName].soma += s.time;
        mapaCasos[s.caseName].qtd++;
    });

    // Converte em array e tira a média de tempo de cada um
    const listaAnalise = Object.values(mapaCasos).map(c => {
        return { nome: c.nome, media: c.soma / c.qtd, totalSolves: c.qtd };
    });

    // Ordena do PIOR (Mais lento / Maior tempo médio) para o melhor
    listaAnalise.sort((a, b) => b.media - a.media);

    // Pega as 3 maiores fraquezas detectadas
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
    if (!ctx) return;

    if (evolutionChart) {
        evolutionChart.destroy();
    }

    const validSolves = [...solves]
        .filter(s => !s.isDNF)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (validSolves.length < 2) {
        const ctxCtx = ctx.getContext('2d');
        ctxCtx.fillStyle = '#8e8e93';
        ctxCtx.font = '11px monospace';
        ctxCtx.textAlign = 'center';
        ctxCtx.fillText('Gere mais dados para plotar o gráfico.', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    const dataDisplay = validSolves.slice(-30);
    const labels = dataDisplay.map((_, idx) => `#${idx + 1}`);
    const values = dataDisplay.map(s => s.time);

    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                borderColor: '#00f2fe',
                borderWidth: 1.5,
                backgroundColor: 'rgba(0, 242, 254, 0.02)',
                fill: true,
                tension: 0.15,
                pointRadius: 2,
                pointBackgroundColor: '#00f2fe'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(30, 41, 59, 0.2)' }, ticks: { color: '#8e8e93', font: { size: 9 } } },
                y: { grid: { color: 'rgba(30, 41, 59, 0.2)' }, ticks: { color: '#8e8e93', font: { size: 9 } } }
            }
        }
    });
}

function renderAveragesPanel(solves) {
    const panel = document.getElementById('averages-panel-target');
    if (!panel) return;

    if (solves.length === 0) {
        panel.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--text-muted); font-size: 11px; padding: 10px;">Sem dados nesta categoria.</div>`;
        return;
    }

    const validSolves = solves.filter(s => !s.isDNF);
    const pbSingle = validSolves.length > 0 ? Math.min(...validSolves.map(s => s.time)).toFixed(2) + 's' : 'DNF';

    panel.innerHTML = `
        <div style="background: #020617; border: 1px solid #1e293b; padding: 8px 10px; border-radius: var(--radius-sm);">
            <span style="font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">PB da Etapa</span>
            <strong style="display: block; font-size: 15px; color: var(--success); font-family: monospace; margin-top: 2px;">${pbSingle}</strong>
        </div>
        <div style="background: #020617; border: 1px solid #1e293b; padding: 8px 10px; border-radius: var(--radius-sm);">
            <span style="font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Média Global</span>
            <strong style="display: block; font-size: 15px; color: var(--text-main); font-family: monospace; margin-top: 2px;">
                ${validSolves.length > 0 ? (validSolves.reduce((acc, s) => acc + s.time, 0) / validSolves.length).toFixed(2) + 's' : '-'}
            </strong>
        </div>
    `;
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

        // Se a resolução foi vinculada a um caso específico de treino, exibe uma tag visível
        const badgeEtapa = s.caseName 
            ? `<span style="background: rgba(0, 242, 254, 0.1); color: var(--accent); border: 1px solid rgba(0, 242, 254, 0.2); font-size: 9px; padding: 1px 5px; border-radius: 4px; font-weight: 700;">${s.caseName}</span>`
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
                const updatedRaw = await discoverAndFetchSolves();
                initHistoryScreen();
                import('./dashboard.js').then(dash => { if (dash?.renderDashboard) dash.renderDashboard(); });
            }
        });
    });
}

// --- Backup Operations ---
async function exportData() {
    try {
        // Busca os dados reais usando as funções importadas e as tabelas corretas do seu db.js
        const rawSolves = await getAllFromStore('times') || [];
        const rawCases = await getAllFromStore('casesState') || [];

        // Comprime os tempos do histórico
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

        // Comprime os estados de aprendizado dos algoritmos (usando as propriedades reais: uid e learned)
        const compressedCases = rawCases.map(c => ({
            i: c.uid,
            l: c.learned ? 1 : 0
        }));

        const minifiedJsonText = JSON.stringify({
            solves: compressedSolves,
            cases: compressedCases,
            version: "2.0"
        });

        const blob = new Blob([minifiedJsonText], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cuber_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Erro ao exportar dados:", err);
        alert("Falha ao exportar os dados.");
    }
}

async function importData() {
    const txtArea = document.getElementById('txt-import-data');
    if (!txtArea || !txtArea.value.trim()) {
        alert("Por favor, cole o conteúdo do JSON ou carregue um arquivo antes.");
        return;
    }

    try {
        const parsed = JSON.parse(txtArea.value.trim());
        
        if (parsed.solves && Array.isArray(parsed.solves)) {
            for (const item of parsed.solves) {
                const isCompressed = item.t !== undefined;
                
                // Correção: Removido o 'db.' e mantido apenas 'saveToStore'
                await saveToStore('times', {
                    time: isCompressed ? item.t : item.time,
                    scramble: isCompressed ? item.s : item.scramble,
                    date: isCompressed ? item.d : item.date,
                    step: isCompressed ? (item.e || 'all') : (item.step || 'all'),
                    isDNF: isCompressed ? (item.f === 1) : !!item.isDNF,
                    hasPlusTwo: isCompressed ? (item.p === 1) : !!item.hasPlusTwo,
                    caseId: isCompressed ? item.c : (item.caseId || null),
                    caseName: isCompressed ? item.n : (item.caseName || null)
                });
            }
        }

        if (parsed.cases && Array.isArray(parsed.cases)) {
            for (const item of parsed.cases) {
                const isCompressed = item.i !== undefined;
                
                // Correção: Salva na store correta 'casesState' com os campos nativos (uid, learned)
                await saveToStore('casesState', {
                    uid: isCompressed ? item.i : item.uid,
                    learned: isCompressed ? (item.l === 1) : !!item.learned,
                    successCount: 0,
                    failCount: 0
                });
            }
        }

        alert("Dados processados e importados com sucesso!");
        txtArea.value = "";
        
        // Atualiza a interface do histórico imediatamente utilizando a sua função local existente
        initHistoryScreen();
    } catch (e) {
        console.error("Erro na importação de dados:", e);
        alert("Erro ao decodificar JSON. Verifique se o texto não está incompleto.");
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { document.getElementById('txt-import-data').value = evt.target.result; };
    reader.readAsText(file);
}

/**
 * 📈 Renderiza o Gráfico de Evolução dos Tempos (Filtro Ativo)
 * Certifique-se de que esta função esteja declarada no escopo global do arquivo.
 */
function renderHistoryChart(solves) {
    const ctx = document.getElementById('history-evolution-chart');
    if (!ctx) return;

    // Se já existir um gráfico ativo na memória, destrói para não sobrepor dados ao passar o mouse
    if (evolutionChart) {
        evolutionChart.destroy();
    }

    // Filtra apenas os tempos válidos (ignora DNF para o gráfico não quebrar indo a zero)
    const validSolves = solves.filter(s => !s.isDNF);
    const labels = validSolves.map((_, i) => i + 1);
    const dataPoints = validSolves.map(s => s.time);

    // Inicializa a instância do Chart.js utilizando o tema Solarized Dark
    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tempo (s)',
                data: dataPoints,
                borderColor: '#268bd2', // Azul Accent do Solarized
                backgroundColor: 'rgba(38, 139, 210, 0.06)',
                borderWidth: 2,
                pointRadius: labels.length > 50 ? 0 : 2, // Oculta pontos se houver muitas solves para limpar o visual
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } // Oculta legenda padrão desnecessária
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#657b83', font: { size: 9 } }
                },
                y: {
                    grid: { color: 'rgba(88, 110, 117, 0.1)' },
                    ticks: { color: '#657b83', font: { size: 9 } }
                }
            }
        }
    });
}