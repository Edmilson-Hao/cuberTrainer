import { getAllFromStore, saveToStore, deleteFromStore, clearAllDatabase } from '../db.js';

let REAL_SOLVES_STORE = 'times';
let currentFilter = 'all'; 

// Simplificado para mirar diretamente a store padrão unificada do seu sistema
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
        const filtrados = tempos.slice(1, -1);
        const media = filtrados.reduce((acc, t) => acc + t, 0) / filtrados.length;
        
        if (media < melhorMeda) {
            melhorMeda = media;
        }
    }
    return melhorMeda === Infinity ? '-' : melhorMeda.toFixed(2) + 's';
}

export async function initHistoryScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;
    
    const allSolves = await discoverAndFetchSolves();
    
    // Filtro inteligente baseado na tag inserida na resolução
    const filteredSolves = allSolves.filter(s => {
        if (currentFilter === 'all') return true;
        return s.step === currentFilter;
    });

    const validSolves = filteredSolves.filter(s => s && !s.isDNF);
    const records = [...validSolves].sort((a, b) => a.time - b.time).slice(0, 12);
    const chronological = [...filteredSolves].reverse();

    const currentAo5 = calcularAoN(filteredSolves, 5);
    const currentAo12 = calcularAoN(filteredSolves, 12);
    const bestSingle = records[0] ? records[0].time.toFixed(2) + 's' : '-';
    const bestAo5 = encontrarMelhorAoN(filteredSolves, 5);
    const bestAo12 = encontrarMelhorAoN(filteredSolves, 12);

    const totalSolvesCount = filteredSolves.length;
    const dnfCount = filteredSolves.filter(s => s.isDNF).length;
    const taxaSucesso = totalSolvesCount > 0 ? Math.round(((totalSolvesCount - dnfCount) / totalSolvesCount) * 100) : 100;

    // --- GERAÇÃO DO HISTOGRAMA ---
    const faixas = { 'Sub-25s': 0, '25s-30s': 0, '30s-35s': 0, '35s-40s': 0, '40s+': 0 };
    validSolves.forEach(s => {
        if (s.time < 25) faixas['Sub-25s']++;
        else if (s.time < 30) faixas['25s-30s']++;
        else if (s.time < 35) faixas['30s-35s']++;
        else if (s.time < 40) faixas['35s-40s']++;
        else faixas['40s+']++;
    });
    const maxFrequencia = Math.max(...Object.values(faixas)) || 1;

    container.innerHTML = `
        <div class="history-container" style="max-width: 600px; margin: 0 auto; padding: 10px;">
            
            <!-- 📊 PAINEL DE PERFORMANCE -->
            <div class="stats-overview-card" style="background: #1e1e2e; padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #313244;">
                <h3 style="margin-top:0; font-size:14px; color:var(--text-muted); display:flex; justify-content:space-between;">
                    <span>📊 Estatísticas Globais (${currentFilter.toUpperCase()})</span>
                    <span style="color:#a6e3a1;">Sucesso: ${taxaSucesso}% (${dnfCount} DNF)</span>
                </h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center;">
                    <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
                        <span style="font-size:10px; color: var(--text-muted); display:block;">Histórico (Best)</span>
                        <strong style="font-size:16px; color: #a6e3a1;">${bestSingle}</strong>
                    </div>
                    <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
                        <span style="font-size:10px; color: var(--text-muted); display:block;">Histórico (Best)</span>
                        <strong style="font-size:16px; color: #f9e2af;">${bestAo5}</strong>
                    </div>
                    <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
                        <span style="font-size:10px; color: var(--text-muted); display:block;">Histórico (Best)</span>
                        <strong style="font-size:16px; color: #89b4fa;">${bestAo12}</strong>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center; margin-top:8px;">
                    <div style="background: rgba(255,255,255,0.04); padding: 10px; border-radius: 8px;">
                        <span style="font-size:10px; color: var(--text-muted); display:block;">Atual</span>
                        <strong style="font-size:16px; color: #fff;">${filteredSolves.length > 0 && !filteredSolves[filteredSolves.length-1].isDNF ? filteredSolves[filteredSolves.length-1].time.toFixed(2) + 's' : '-'}</strong>
                    </div>
                    <div style="background: rgba(255,255,255,0.04); padding: 10px; border-radius: 8px;">
                        <span style="font-size:10px; color: var(--text-muted); display:block;">Atual</span>
                        <strong style="font-size:16px; color: #fff;">${currentAo5}</strong>
                    </div>
                    <div style="background: rgba(255,255,255,0.04); padding: 10px; border-radius: 8px;">
                        <span style="font-size:10px; color: var(--text-muted); display:block;">Atual</span>
                        <strong style="font-size:16px; color: #fff;">${currentAo12}</strong>
                    </div>
                </div>
            </div>

            <!-- 📈 HISTOGRAMA CONFORME EXIBIDO NA IMAGEM_70958A.PNG -->
            <div class="histogram-card" style="background: #1e1e2e; padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #313244;">
                <h3 style="margin-top:0; font-size:14px; color:var(--text-muted); margin-bottom:12px;">📈 Distribuição de Tempos (Consistência)</h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${Object.entries(faixas).map(([faixa, qtd]) => {
                        const pct = (qtd / maxFrequencia) * 100;
                        return `
                            <div style="display: flex; align-items: center; font-size: 12px;">
                                <span style="width: 65px; color: var(--text-muted); font-family:monospace;">${faixa}</span>
                                <div style="flex: 1; background: rgba(255,255,255,0.05); height: 14px; border-radius: 4px; margin: 0 10px; overflow:hidden;">
                                    <div style="background: #89b4fa; width: ${pct}%; height: 100%; border-radius: 4px; transition: width 0.4s ease;"></div>
                                </div>
                                <span style="width: 20px; text-align: right; font-weight: bold; color: #fff;">${qtd}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- ⏱️ CONTROLES DE FILTROS DA IMAGEM_70958A.PNG -->
            <div class="filter-bar" style="display: flex; gap: 8px; margin-bottom: 20px;">
                <button class="btn-filter" data-filter="all" style="flex:1; padding:10px; border-radius:8px; font-size:13px; font-weight:bold; cursor:pointer; background:${currentFilter === 'all' ? '#89b4fa' : '#313244'}; color:${currentFilter === 'all' ? '#11111b' : '#fff'}; border:none; transition: 0.2s;">Todas</button>
                <button class="btn-filter" data-filter="f2l" style="flex:1; padding:10px; border-radius:8px; font-size:13px; font-weight:bold; cursor:pointer; background:${currentFilter === 'f2l' ? '#89b4fa' : '#313244'}; color:${currentFilter === 'f2l' ? '#11111b' : '#fff'}; border:none; transition: 0.2s;">F2L</button>
                <button class="btn-filter" data-filter="oll" style="flex:1; padding:10px; border-radius:8px; font-size:13px; font-weight:bold; cursor:pointer; background:${currentFilter === 'oll' ? '#89b4fa' : '#313244'}; color:${currentFilter === 'oll' ? '#11111b' : '#fff'}; border:none; transition: 0.2s;">OLL</button>
                <button class="btn-filter" data-filter="pll" style="flex:1; padding:10px; border-radius:8px; font-size:13px; font-weight:bold; cursor:pointer; background:${currentFilter === 'pll' ? '#89b4fa' : '#313244'}; color:${currentFilter === 'pll' ? '#11111b' : '#fff'}; border:none; transition: 0.2s;">PLL</button>
            </div>

            <h3>🏆 Melhores Registros (Top 12)</h3>
            <div class="records-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px;">
                ${records.map((r, i) => `
                    <div class="record-badge" style="background: rgba(137,180,250,0.05); border: 1px solid rgba(137,180,250,0.1); padding: 6px; border-radius: 6px; text-align:center; font-size:12px;">
                        <span style="color:var(--text-muted); font-size:10px; display:block;">#${i+1}</span>
                        <strong style="color:#fff; font-family:monospace;">${r.time.toFixed(2)}s</strong>
                    </div>
                `).join('') || '<p style="color: var(--text-muted); grid-column: span 4; font-size:12px; text-align:center;">Sem registros.</p>'}
            </div>
            
            <div class="backup-actions-wrapper" style="margin-bottom: 25px;">
                <div class="backup-buttons" style="display:flex; gap:10px;">
                    <button id="btn-export-json" style="flex:1; background:#313244; color:#fff; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:11px;">📤 Exportar Backup</button>
                    <button id="btn-import-json" style="flex:1; background:#313244; color:#fff; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:11px;">📥 Importar Dados</button>
                </div>
                <div id="import-zone" class="import-input-zone hidden" style="margin-top:10px; display:none; flex-direction:column; gap:8px;">
                    <input type="file" id="file-import-picker" accept=".json">
                    <textarea id="txt-import-data" placeholder="Cole o JSON de backup aqui..." style="height:60px; background:#11111b; color:#fff; border:1px solid #313244; border-radius:6px; padding:6px; font-family:monospace; font-size:11px;"></textarea>
                    <button id="btn-confirm-import" style="background:#89b4fa; color:#11111b; border:none; padding:8px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">Confirmar</button>
                </div>
                <div id="backup-status-msg" style="color:#a6e3a1; font-size:12px; margin-top:5px; text-align:center;"></div>
            </div>
            
            <h3>⏱️ Linha do Tempo</h3>
            <div class="table-scroll-wrapper" style="overflow-x:auto;">
                <table class="history-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="border-bottom:2px solid #313244; color:var(--text-muted); font-size:12px;">
                            <th style="text-align:left; padding:8px;">Resolução</th>
                            <th style="text-align:right; padding:8px;">Modificadores WCA</th>
                        </tr>
                    </thead>
                    <tbody id="history-table-body">
                        ${chronological.map(s => `
                            <tr id="row-${s.id}" style="border-bottom:1px solid rgba(255,255,255,0.03);">
                                <td style="padding:10px 8px 4px 8px;">
                                    <div style="font-size:11px; color:var(--text-muted); margin-bottom:3px;">
                                        📅 ${new Date(s.date).toLocaleDateString()} 
                                        <span style="color:#f5c2e7; font-weight:bold; margin-left:8px;">[${(s.step || 'GLOBAL').toUpperCase()}]</span>
                                    </div>
                                    <strong style="font-size:15px; font-family:monospace; color:${s.isDNF ? '#f38ba8' : '#fff'};">
                                        ${s.isDNF ? 'DNF' : s.time.toFixed(2) + 's'}${s.hasPlusTwo ? ' (+2)' : ''}
                                    </strong>
                                </td>
                                <td style="text-align:right; padding:10px 8px 4px 8px; vertical-align:middle;">
                                    <button class="btn-penalty-wca" data-id="${s.id}" data-type="plus2" style="padding:3px 6px; font-size:11px; border-radius:4px; cursor:pointer; margin-right:4px; border:none; background:${s.hasPlusTwo ? '#f9e2af' : '#313244'}; color:${s.hasPlusTwo ? '#11111b' : '#fff'}; font-weight:bold;">+2s</button>
                                    <button class="btn-penalty-wca" data-id="${s.id}" data-type="dnf" style="padding:3px 6px; font-size:11px; border-radius:4px; cursor:pointer; margin-right:8px; border:none; background:${s.isDNF ? '#f38ba8' : '#313244'}; color:${s.isDNF ? '#11111b' : '#fff'}; font-weight:bold;">DNF</button>
                                    <button class="btn-delete-history" data-id="${s.id}" style="background:transparent; border:none; cursor:pointer; font-size:13px; color:#f38ba8; padding:0 4px;">🗑️</button>
                                </td>
                            </tr>
                            <tr id="row-scramble-${s.id}" style="border-bottom:1px solid #313244;">
                                <td colspan="2" style="padding:0px 8px 10px 8px;">
                                    <div style="background:rgba(0,0,0,0.2); padding:6px 10px; border-radius:6px; font-family:monospace; font-size:11px; color:#cdd6f4; word-break:break-word; line-height:1.3;">
                                        ${s.scramble || 'Sem scramble registrado'}
                                    </div>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="2" style="text-align:center; color:var(--text-muted); padding:30px; font-size:13px;">Nenhuma resolução nesta categoria.</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div style="margin-top:30px; border-top:1px dashed #f38ba8; padding-top:15px; text-align:center;">
                <button id="btn-reset-system" style="background:transparent; border:1px solid #f38ba8; color:#f38ba8; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;">⚠️ Limpar Toda a Base de Dados</button>
            </div>
        </div>
    `;

    // Listeners dos filtros
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentFilter = e.target.getAttribute('data-filter');
            initHistoryScreen();
        });
    });

    document.getElementById('btn-export-json').addEventListener('click', () => exportData(allSolves));
    document.getElementById('btn-import-json').addEventListener('click', toggleImportZone);
    document.getElementById('btn-confirm-import').addEventListener('click', importData);
    document.getElementById('file-import-picker').addEventListener('change', handleFileSelect);

    // Gerenciador central de cliques para Modificadores e Exclusão
    const tableBody = document.getElementById('history-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', async (e) => {
            const target = e.target;
            const solveId = target.getAttribute('data-id');
            if (!solveId) return;

            const dbId = parseInt(solveId) || solveId;

            if (target.classList.contains('btn-delete-history') || target.textContent === '🗑️') {
                if (confirm('Deseja deletar essa resolução do histórico?')) {
                    await deleteFromStore(REAL_SOLVES_STORE, dbId);
                    initHistoryScreen();
                }
                return;
            }

            if (target.classList.contains('btn-penalty-wca')) {
                const type = target.getAttribute('data-type');
                const solve = allSolves.find(x => x.id === dbId);
                if (!solve) return;

                if (type === 'plus2') {
                    if (!solve.hasPlusTwo) {
                        solve.hasPlusTwo = true;
                        solve.time = parseFloat((solve.time + 2.0).toFixed(2));
                    } else {
                        solve.hasPlusTwo = false;
                        solve.time = parseFloat((solve.time - 2.0).toFixed(2));
                    }
                } else if (type === 'dnf') {
                    solve.isDNF = !solve.isDNF;
                }

                await saveToStore(REAL_SOLVES_STORE, solve);
                initHistoryScreen();
            }
        });
    }

    const btnReset = document.getElementById('btn-reset-system');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            if (confirm("ATENÇÃO: Isso apagará permanentemente todos os seus treinos e tempos. Deseja continuar?")) {
                await clearAllDatabase();
                localStorage.clear();
                window.location.reload();
            }
        });
    }
}

// Funções de Gerenciamento do Sistema de Backup
async function exportData(allSolves) {
    const statusMsg = document.getElementById('backup-status-msg');
    try {
        let allCasesProgress = await getAllFromStore('casesState') || [];
        const jsonString = JSON.stringify({ times: allSolves, casesProgress: allCasesProgress }, null, 2);
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(jsonString);
        
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_cubertrainer_${Date.now()}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        if (statusMsg) statusMsg.textContent = "📋 Backup salvo e copiado!";
    } catch (e) { alert("Falha ao exportar."); }
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
            const current = await getAllFromStore(REAL_SOLVES_STORE) || [];
            
            // Função interna para normalizar qualquer tipo de data para milissegundos (número)
            const obterTimestampConstante = (dataInput) => {
                if (!dataInput) return 0; // Evita quebrar se a solve antiga não tiver data
                const parsedDate = new Date(dataInput);
                return isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
            };

            // Mapeia todas as combinações únicas de (Tempo + Scramble + Timestamp) já existentes no seu app
            const chavesExistentes = new Set(
                current.map(x => `${x.time.toFixed(2)}|${x.scramble.trim()}|${obterTimestampConstante(x.date)}`)
            );
            
            let inseridos = 0;

            for (let s of parsed.times) {
                // Normaliza os dados da solve que está vindo do arquivo JSON
                const tempoFormatado = s.time.toFixed(2);
                const scrambleFormatado = (s.scramble || '').trim();
                const timestampFormatado = obterTimestampConstante(s.date);
                
                // Cria a chave única da solve candidata
                const chaveCandidata = `${tempoFormatado}|${scrambleFormatado}|${timestampFormatado}`;
                
                // 🛡️ SÓ IMPORTA SE: a combinação exata de Tempo + Scramble + Milissegundo não existir no Set
                if (!chavesExistentes.has(chaveCandidata)) {
                    delete s.id; // Remove o ID antigo para o IndexedDB gerar um novo auto-incremental
                    await saveToStore(REAL_SOLVES_STORE, s);
                    
                    // Adiciona ao Set dinamicamente para evitar que resoluções repetidas dentro do PRÓPRIO JSON entrem duplicadas
                    chavesExistentes.add(chaveCandidata);
                    inseridos++;
                }
            }
            
            alert(`Importação concluída! ${inseridos} novas resoluções foram adicionadas sem duplicar nada.`);
            window.location.reload();
        }
    } catch (e) { 
        alert("Erro crítico ao processar o arquivo de importação. Verifique a estrutura do JSON."); 
        console.error(e);
    }
}

function toggleImportZone() {
    const zone = document.getElementById('import-zone');
    if (zone) zone.style.display = zone.style.display === 'none' || zone.style.display === '' ? 'flex' : 'none';
}