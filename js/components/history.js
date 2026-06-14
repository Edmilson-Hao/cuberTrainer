import { getAllFromStore, saveToStore, deleteFromStore, clearAllDatabase } from '../db.js';

let REAL_SOLVES_STORE = 'times';

async function discoverAndFetchSolves() {
    return new Promise((resolve) => {
        const request = indexedDB.open('CuberTrainerDB');
        request.onsuccess = async (event) => {
            const db = event.target.result;
            const storeNames = Array.from(db.objectStoreNames);
            db.close(); 

            if (storeNames.includes('times')) REAL_SOLVES_STORE = 'times';
            else if (storeNames.includes('solves')) REAL_SOLVES_STORE = 'solves';

            try {
                const data = await getAllFromStore(REAL_SOLVES_STORE);
                resolve(data || []);
            } catch (err) {
                resolve([]);
            }
        };
        request.onerror = () => resolve([]);
    });
}

// Funções utilitárias para calcular Médias Móveis (Ao5 e Ao12)
function calcularAoN(solves, n) {
    if (solves.length < n) return '-';
    const recentes = solves.slice(0, n);
    if (recentes.some(s => s.isDNF)) return 'DNF';
    
    const tempos = recentes.map(s => s.time).sort((a, b) => a - b);
    // Remove o melhor e o pior tempo (Regra oficial da WCA)
    const temposFiltrados = tempos.slice(1, -1);
    const soma = temposFiltrados.reduce((acc, t) => acc + t, 0);
    return (soma / temposFiltrados.length).toFixed(2) + 's';
}

export async function initHistoryScreen() {
    const container = document.getElementById('app-container');
    const allSolves = await discoverAndFetchSolves();
    
    // Filtra e ordena para estatísticas
    const validSolves = allSolves.filter(s => s && !s.isDNF);
    const records = [...validSolves].sort((a, b) => a.time - b.time).slice(0, 12);
    const chronological = [...allSolves].reverse(); // Mais recentes primeiro

    // Cálculos de Médias Atuais (baseado nas últimas resoluções cronológicas)
    const currentAo5 = calcularAoN(allSolves.slice(-5).reverse(), 5);
    const currentAo12 = calcularAoN(allSolves.slice(-12).reverse(), 12);
    const melhorTempo = records[0] ? records[0].time + 's' : '-';

    container.innerHTML = `
        <div class="history-container">
            <div class="stats-overview-card" style="background: var(--bg-card, #1e1e2e); padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <h3 style="margin-top:0; font-size:15px; color:var(--text-muted);">📊 Resumo de Performance</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center;">
                    <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px;">
                        <span style="font-size:11px; color: var(--text-muted); display:block;">Melhor Single</span>
                        <strong style="font-size:18px; color: #a6e3a1;">${melhorTempo}</strong>
                    </div>
                    <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px;">
                        <span style="font-size:11px; color: var(--text-muted); display:block;">Média Móvel (Ao5)</span>
                        <strong style="font-size:18px; color: #f9e2af;">${currentAo5}</strong>
                    </div>
                    <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px;">
                        <span style="font-size:11px; color: var(--text-muted); display:block;">Média Móvel (Ao12)</span>
                        <strong style="font-size:18px; color: #89b4fa;">${currentAo12}</strong>
                    </div>
                </div>

                <div class="mini-chart-container" style="margin-top:15px; height: 60px; display:flex; align-items:flex-end; gap:3px; background:rgba(0,0,0,0.15); padding: 5px; border-radius:6px;">
                    ${validSolves.slice(-20).map(s => {
                        const maxTime = Math.max(...validSolves.slice(-20).map(x => x.time)) || 1;
                        const heightPct = (s.time / maxTime) * 100;
                        return `<div style="flex:1; background:#89b4fa; height:${heightPct}%; border-radius:2px; min-height:10%;" title="${s.time}s em ${new Date(s.date).toLocaleDateString()}"></div>`;
                    }).join('') || '<p style="font-size:12px; color:var(--text-muted); width:100%; text-align:center;">Evolução gráfica visível após os primeiros treinos.</p>'}
                </div>
            </div>

            <h3>🏆 Recordes Pessoais (Top 12 Melhores Tempos)</h3>
            <div class="records-grid">
                ${records.map((r, i) => `
                    <div class="record-badge">
                        <span class="rank">#${i+1}</span>
                        <span class="time">${r.time}s</span>
                    </div>
                `).join('') || '<p style="color: var(--text-muted); grid-column: span 4;">Nenhum tempo válido registrado.</p>'}
            </div>
            
            <div class="backup-actions-wrapper">
                <div class="backup-buttons">
                    <button id="btn-export-json" class="btn-action-small">📤 Exportar JSON e Copiar</button>
                    <button id="btn-import-json" class="btn-action-small">📥 Importar Dados</button>
                </div>
                
                <div id="import-zone" class="import-input-zone hidden">
                    <div style="margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
                        <label style="display:block; font-size:12px; margin-bottom: 6px; color:var(--text-muted);">Opção 1: Selecionar arquivo de backup (.json)</label>
                        <input type="file" id="file-import-picker" accept=".json" style="font-size:13px; color: #fff;">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; margin-bottom: 6px; color:var(--text-muted);">Opção 2: Cole o código JSON copiado</label>
                        <textarea id="txt-import-data" placeholder="Cole aqui o código JSON copiado..."></textarea>
                    </div>
                    <button id="btn-confirm-import" class="btn-primary" style="padding: 10px; font-size: 14px; margin-top: 10px; width: 100%;">Confirmar Importação</button>
                </div>
                <div id="backup-status-msg" class="backup-status"></div>
            </div>
            
            <h3>⏱️ Histórico Completo</h3>
            <div class="table-scroll-wrapper">
                <table class="history-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 10px;">Informações da Solve</th>
                            <th style="text-align: center; width: 60px;">Ações</th>
                        </tr>
                    </thead>
                    <tbody id="history-table-body">
                        ${chronological.map(s => `
                            <tr id="row-${s.id}" style="border-top: 1px solid rgba(255,255,255,0.05);">
                                <td style="padding: 10px 10px 2px 10px;">
                                    <span style="color: var(--text-muted); font-size: 12px; margin-right: 15px;">📅 ${new Date(s.date).toLocaleDateString()}</span>
                                    <strong class="${s.isDNF ? 'dnf-text' : ''}" style="font-size: 15px;">⏱️ ${s.isDNF ? 'DNF' : s.time + 's'}</strong>
                                </td>
                                <td rowspan="2" style="text-align: center; vertical-align: middle;">
                                    <button class="btn-delete-history" data-id="${s.id}" title="Excluir tempo" style="background:transparent; border:none; cursor:pointer; font-size:16px;">🗑️</button>
                                </td>
                            </tr>
                            <tr id="row-scramble-${s.id}">
                                <td colspan="1" style="padding: 0px 10px 10px 10px; color: var(--text-muted); font-size: 12px; font-family: monospace; line-height: 1.4; word-break: break-word;">
                                    <div style="background: rgba(0,0,0,0.15); padding: 6px; border-radius: 4px; color: #cdd6f4;">${s.scramble}</div>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="2" style="text-align:center; color:var(--text-muted); padding: 20px;">Nenhum treino salvo.</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div class="danger-zone-container">
                <button id="btn-reset-system" class="btn-reset-danger">
                    <span class="icon">⚠️</span> Resetar Todos os Dados
                </button>
            </div>
        </div>
    `;

    document.getElementById('btn-export-json').addEventListener('click', () => exportData(allSolves));
    document.getElementById('btn-import-json').addEventListener('click', toggleImportZone);
    document.getElementById('btn-confirm-import').addEventListener('click', importData);
    document.getElementById('file-import-picker').addEventListener('change', handleFileSelect);

    const tableBody = document.getElementById('history-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-delete-history')) {
                const solveId = e.target.getAttribute('data-id');
                if (confirm('Deseja realmente apagar este tempo do seu histórico?')) {
                    try {
                        await deleteFromStore(REAL_SOLVES_STORE, parseInt(solveId) || solveId);
                        initHistoryScreen(); 
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
        });
    }

    const btnReset = document.getElementById('btn-reset-system');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            if (confirm("Você perderá todos os seus tempos e recordes permanentemente. Continuar?") && confirm("Tem certeza absoluta?")) {
                try {
                    await clearAllDatabase();
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.reload();
                } catch (error) {
                    alert("Erro ao limpar dados.");
                }
            }
        });
    }
}

async function exportData(allSolves) {
    const statusMsg = document.getElementById('backup-status-msg');
    try {
        let allCasesProgress = [];
        try { allCasesProgress = await getAllFromStore('casesState') || []; } catch (e) { allCasesProgress = []; }
        
        const backupPayload = { times: allSolves, casesProgress: allCasesProgress, exportedAt: new Date().toISOString() };
        const jsonString = JSON.stringify(backupPayload, null, 2);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(jsonString);
            if (statusMsg) {
                statusMsg.textContent = "📋 Código copiado e arquivo JSON baixado!";
                statusMsg.style.color = "#00ff66";
            }
        }

        const blob = new Blob([jsonString], { type: "application/json" });
        const blobUrl = URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = blobUrl;
        downloadAnchor.download = `cuber_trainer_backup_${Date.now()}.json`;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
        URL.revokeObjectURL(blobUrl);
    } catch (error) {
        alert("Erro ao exportar.");
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        document.getElementById('txt-import-data').value = evt.target.result;
        document.getElementById('backup-status-msg').textContent = "📂 Arquivo carregado! Clique em 'Confirmar Importação'.";
    };
    reader.readAsText(file);
}

async function importData() {
    const rawData = document.getElementById('txt-import-data').value;
    const statusMsg = document.getElementById('backup-status-msg');
    
    try {
        const parsed = JSON.parse(rawData);
        if (parsed.times && Array.isArray(parsed.times)) {
            const currentSolves = await getAllFromStore(REAL_SOLVES_STORE) || [];
            
            // 🛡️ MODIFICAÇÃO 1: Evita duplicados comparando propriedades estruturais chaves
            let novosTemposAdicionados = 0;
            for (let solve of parsed.times) {
                const jaExiste = currentSolves.some(existente => 
                    existente.time === solve.time && 
                    existente.scramble === solve.scramble &&
                    new Date(existente.date).getTime() === new Date(solve.date).getTime()
                );

                if (!jaExiste) {
                    const solveClean = { ...solve };
                    delete solveClean.id; // Garante auto-incremento sem colisões
                    await saveToStore(REAL_SOLVES_STORE, solveClean);
                    novosTemposAdicionados++;
                }
            }
            
            if (parsed.casesProgress && Array.isArray(parsed.casesProgress)) {
                const currentCases = await getAllFromStore('casesState') || [];
                for (let caseData of parsed.casesProgress) {
                    const casoExistente = currentCases.find(c => c.uid === caseData.uid);
                    // Mescla apenas se trouxer contagens mais avançadas ou dados novos
                    if (!casoExistente || (caseData.successCount + caseData.failCount > casoExistente.successCount + casoExistente.failCount)) {
                        const caseClean = { ...caseData };
                        if (casoExistente) caseClean.id = casoExistente.id;
                        await saveToStore('casesState', caseClean).catch(() => {});
                    }
                }
            }
            
            statusMsg.textContent = `✅ Importação concluída! ${novosTemposAdicionados} novas solves adicionadas.`;
            statusMsg.style.color = "#00ff66";
            setTimeout(() => window.location.reload(), 1200);
        }
    } catch (err) {
        statusMsg.textContent = "❌ JSON inválido ou corrompido.";
    }
}

function toggleImportZone() {
    document.getElementById('import-zone').classList.toggle('hidden');
}