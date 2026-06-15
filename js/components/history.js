import { getAllFromStore, saveToStore, deleteFromStore, clearAllDatabase } from '../db.js';

let REAL_SOLVES_STORE = 'times';
let currentFilter = 'all'; 

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
    
    const filteredSolves = currentFilter === 'all' 
        ? rawSolves 
        : rawSolves.filter(s => s.step === currentFilter);

    container.innerHTML = `
        <div class="history-screen" style="background: var(--bg-card); border: 1px solid #1e293b; border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow); box-sizing: border-box; width: 100%; max-width: 100%;">
            
            <div class="tab-selector" style="display: flex; gap: 6px; background: rgba(2, 6, 23, 0.4); padding: 4px; border-radius: var(--radius-sm); margin-bottom: 20px; border: 1px solid rgba(30, 41, 59, 0.5);">
                <button class="${currentFilter === 'all' ? 'active':''}" id="btn-filter-all" style="flex: 1; padding: 8px; font-size: 13px;">Todos</button>
                <button class="${currentFilter === 'f2l' ? 'active':''}" id="btn-filter-f2l" style="flex: 1; padding: 8px; font-size: 13px;">F2L</button>
                <button class="${currentFilter === 'oll' ? 'active':''}" id="btn-filter-oll" style="flex: 1; padding: 8px; font-size: 13px;">OLL</button>
                <button class="${currentFilter === 'pll' ? 'active':''}" id="btn-filter-pll" style="flex: 1; padding: 8px; font-size: 13px;">PLL</button>
            </div>

            <div id="averages-panel-target" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 25px; box-sizing: border-box;"></div>

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
                    <div id="history-list-target" style="height: 450px; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box;"></div>
                </div>
            </div>

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
                    
                    <div class="danger-zone-container" style="margin-top: 25px; padding: 15px; border-radius: var(--radius-sm); background: rgba(255, 72, 72, 0.02); border: 1px dashed rgba(255, 72, 72, 0.2); text-align: center; box-sizing: border-box;">
                        <button id="btn-wipe-database" style="background: transparent; color: #ff4848; border: 1px solid #ff4848; padding: 6px 14px; font-size: 11px; font-weight: 600; border-radius: var(--radius-sm); cursor: pointer; width: 100%;">🚨 Limpar Banco de Dados Inteiro</button>
                    </div>
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
    document.getElementById('btn-wipe-database').onclick = async () => {
        if (confirm("Deseja limpar todo o histórico?")) {
            await clearAllDatabase();
            window.location.reload();
        }
    };

    renderAveragesPanel(filteredSolves);
    renderTop12Singles(filteredSolves, rawSolves); 
    renderHistoryList(filteredSolves, rawSolves);
}

function renderAveragesPanel(solves) {
    const panel = document.getElementById('averages-panel-target');
    if (!panel) return;

    if (solves.length === 0) {
        panel.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--text-muted); font-size: 12px; padding: 10px;">Sem dados para médias.</div>`;
        return;
    }

    const validSolves = solves.filter(s => !s.isDNF);
    const pbSingle = validSolves.length > 0 ? Math.min(...validSolves.map(s => s.time)).toFixed(2) + 's' : 'DNF';

    panel.innerHTML = `
        <div style="background: #020617; border: 1px solid #1e293b; padding: 10px 12px; border-radius: var(--radius-sm); box-sizing: border-box; overflow: hidden;">
            <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; white-space: nowrap;">Melhor Single (PB)</span>
            <strong style="display: block; font-size: 16px; color: var(--success); font-family: monospace; margin-top: 2px;">${pbSingle}</strong>
        </div>
        <div style="background: #020617; border: 1px solid #1e293b; padding: 10px 12px; border-radius: var(--radius-sm); box-sizing: border-box; overflow: hidden;">
            <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; white-space: nowrap;">Média Global</span>
            <strong style="display: block; font-size: 16px; color: var(--text-main); font-family: monospace; margin-top: 2px;">
                ${validSolves.length > 0 ? (validSolves.reduce((acc, s) => acc + s.time, 0) / validSolves.length).toFixed(2) + 's' : '-'}
            </strong>
        </div>
        <div style="background: #020617; border: 1px solid #1e293b; padding: 10px 12px; border-radius: var(--radius-sm); box-sizing: border-box; overflow: hidden; grid-column: span 2;">
            <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Média Atual</span>
            <strong style="display: block; font-size: 11px; color: var(--accent); font-family: monospace; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                Ao5: ${calcularAoN(solves, 5)} | Ao12: ${calcularAoN(solves, 12)}
            </strong>
        </div>
        <div style="background: #020617; border: 1px solid #1e293b; padding: 10px 12px; border-radius: var(--radius-sm); box-sizing: border-box; overflow: hidden; grid-column: span 2;">
            <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Melhor Recorde</span>
            <strong style="display: block; font-size: 11px; color: #a855f7; font-family: monospace; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                Ao5: ${encontrarMelhorAoN(solves, 5)} | Ao12: ${encontrarMelhorAoN(solves, 12)}
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
        topContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 12px; padding: 10px; background: rgba(2,6,23,0.2); border: 1px dashed #1e293b; border-radius: var(--radius-sm); box-sizing: border-box;">
                Nenhum recorde válido disponível.
            </div>
        `;
        return;
    }

    let html = '';
    top12.forEach((s, idx) => {
        const numeroAbsoluto = rawCronologico.findIndex(x => x.id === s.id) + 1;
        const medalha = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

        html += `
            <div style="background: rgba(2, 6, 23, 0.5); border: 1px solid #1e293b; border-radius: var(--radius-sm); padding: 5px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; overflow: hidden; min-width: 0;" title="${s.scramble || ''}">
                <span style="font-size: 10px; font-weight: 700; color: var(--text-muted); margin-bottom: 1px;">${medalha}</span>
                <strong style="font-size: 11px; color: var(--text-main); font-family: monospace; white-space: nowrap;">${s.time.toFixed(2)}s</strong>
                <span style="font-size: 8px; color: var(--accent); font-family: monospace; white-space: nowrap;">#${numeroAbsoluto}</span>
            </div>
        `;
    });

    topContainer.innerHTML = html;
}

function renderHistoryList(filteredSolves, rawSolves) {
    const listContainer = document.getElementById('history-list-target');
    if (!listContainer) return;

    if (filteredSolves.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">Nenhuma resolução cadastrada.</div>`;
        return;
    }

    const listaExibicao = [...filteredSolves].sort((a, b) => new Date(b.date) - new Date(a.date));
    const rawCronologico = [...rawSolves].sort((a, b) => new Date(a.date) - new Date(b.date));

    let html = '';
    listaExibicao.forEach((s) => {
        const numeroAbsolutoSolve = rawCronologico.findIndex(x => x.id === s.id) + 1;

        const dataFormatada = new Date(s.date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        let displayTime = s.time.toFixed(2) + 's';
        if (s.isDNF) displayTime = 'DNF';
        else if (s.hasPlusTwo) displayTime += ' (+2)';

        const badgeEtapa = s.step && s.step !== 'all' 
            ? `<span style="background: #1e293b; color: var(--accent); font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: 600; text-transform: uppercase;">${s.step}</span>`
            : '';

        // ALTERADO: Mudança para align-items: flex-start para que o contêiner expanda verticalmente de forma correta
        html += `
            <div class="history-item" style="background: rgba(2, 6, 23, 0.3); border: 1px solid #1e293b; border-radius: var(--radius-sm); padding: 10px; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; box-sizing: border-box; width: 100%; max-width: 100%;">
                <div style="display: flex; align-items: flex-start; gap: 8px; min-width: 0; flex: 1;">
                    <span style="font-family: monospace; font-size: 11px; font-weight: 700; color: var(--text-muted); min-width: 28px; flex-shrink: 0; margin-top: 2px;">
                        #${numeroAbsolutoSolve}
                    </span>
                    <div style="display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 3px;">
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;">
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
                const updatedFiltered = currentFilter === 'all' ? updatedRaw : updatedRaw.filter(x => x.step === currentFilter);
                
                renderAveragesPanel(updatedFiltered);
                renderTop12Singles(updatedFiltered, updatedRaw);
                renderHistoryList(updatedFiltered, updatedRaw);

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
        a.href = url;
        a.download = `backup_cubertrainer_${Date.now()}.json`;
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