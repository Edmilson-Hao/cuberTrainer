import { getAllFromStore, saveToStore, deleteFromStore, clearAllDatabase } from '../db.js';

let REAL_SOLVES_STORE = 'times';
let currentFilter = 'all'; 
let evolutionChart = null;

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
    const rawSolves = await discoverAndFetchSolves();
    
    // CORREÇÃO AQUI: Filtro rígido para não misturar etapas com o Cubo Inteiro (Todos)
    const filteredSolves = rawSolves.filter(s => {
        if (currentFilter === 'all') {
            return !s.step || s.step === 'all';
        }
        return s.step === currentFilter;
    });

    container.innerHTML = `
        <div class="history-screen" style="background: var(--bg-card); border: 1px solid #1e293b; border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow); box-sizing: border-box; width: 100%; max-width: 100%;">
            
            <!-- Abas de Filtros de Etapas -->
            <div class="tab-selector" style="display: flex; gap: 6px; background: rgba(2, 6, 23, 0.4); padding: 4px; border-radius: var(--radius-sm); margin-bottom: 20px; border: 1px solid rgba(30, 41, 59, 0.5);">
                <button class="${currentFilter === 'all' ? 'active':''}" id="btn-filter-all" style="flex: 1; padding: 8px; font-size: 13px;">Todos</button>
                <button class="${currentFilter === 'f2l' ? 'active':''}" id="btn-filter-f2l" style="flex: 1; padding: 8px; font-size: 13px;">F2L</button>
                <button class="${currentFilter === 'oll' ? 'active':''}" id="btn-filter-oll" style="flex: 1; padding: 8px; font-size: 13px;">OLL</button>
                <button class="${currentFilter === 'pll' ? 'active':''}" id="btn-filter-pll" style="flex: 1; padding: 8px; font-size: 13px;">PLL</button>
            </div>

            <!-- Dashboard de Médias e PBs -->
            <div id="averages-panel-target" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 25px; box-sizing: border-box;"></div>

            <!-- ANÁLISE INTEGRADA: Casos Mais Demorados -->
            <div id="weakness-panel-container" style="margin-bottom: 25px; display: none;"></div>

            <!-- Canvas do Gráfico de Evolução -->
            <div style="background: #020617; border: 1px solid #1e293b; border-radius: var(--radius-sm); padding: 12px; margin-bottom: 25px; box-sizing: border-box;">
                <h4 style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">📈 Linha de Evolução Temporal</h4>
                <div style="position: relative; height: 160px; width: 100%;">
                    <canvas id="chart-evolution"></canvas>
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
                        <button id="btn-export-json" class="btn-primary" style="font-size: 11px; padding: 6px 12px; flex: 1;">📥 Exportar JSON</button>
                        <label style="background: #1e293b; color: var(--text-main); font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; flex: 1;">
                            📤 Enviar Arquivo
                            <input type="file" id="file-import-selector" accept=".json" style="display: none;">
                        </label>
                    </div>
                    <textarea id="txt-import-data" placeholder="Conteúdo JSON do backup..." style="width: 100%; height: 70px; background: #020617; border: 1px solid #1e293b; color: var(--accent); font-family: monospace; font-size: 11px; padding: 8px; border-radius: 5px; resize: none; margin-bottom: 10px; box-sizing: border-box;"></textarea>
                    <button id="btn-confirm-import" style="background: var(--success-bg); border: 1px solid rgba(16, 185, 129, 0.3); color: var(--success); font-size: 11px; font-weight: 700; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; width: 100%;">Confirmar e Mesclar Dados</button>
                </div>
            </div>
        </div>
    `;

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

    document.getElementById('btn-export-json').onclick = exportData;
    document.getElementById('file-import-selector').onchange = handleFileSelect;
    document.getElementById('btn-confirm-import').onclick = importData;

    renderAveragesPanel(filteredSolves);
    renderTop12Singles(filteredSolves, rawSolves); 
    renderHistoryList(filteredSolves, rawSolves);
    renderEvolutionChart(filteredSolves);
    calculateAndRenderWeaknesses(rawSolves);
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
        const solves = await getAllFromStore(REAL_SOLVES_STORE) || [];
        const cases = await getAllFromStore('casesState') || [];
        const stats = await getAllFromStore('userStats') || [];
        const backupContainer = { times: solves, casesState: cases, userStats: stats };
        const jsonString = JSON.stringify(backupContainer, null, 2);
        
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `backup_cubertrainer_${Date.now()}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { alert("Erro ao exportar."); }
}

function handleFileSelect(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { document.getElementById('txt-import-data').value = evt.target.result; };
    reader.readAsText(file);
}

async function importData() {
    try {
        const parsed = JSON.parse(document.getElementById('txt-import-data').value);
        if (parsed.times) {
            for (let s of parsed.times) {
                delete s.id; await saveToStore(REAL_SOLVES_STORE, s);
            }
            window.location.reload();
        }
    } catch (e) { alert("JSON Inválido."); }
}