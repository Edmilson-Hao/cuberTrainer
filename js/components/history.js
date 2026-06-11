import { getAllFromStore, saveToStore, deleteFromStore, clearAllDatabase } from '../db.js';

export async function initHistoryScreen() {
    const container = document.getElementById('app-container');
    const allSolves = await getAllFromStore('times');
    
    const records = [...allSolves]
        .filter(s => !s.isDNF)
        .sort((a, b) => a.time - b.time)
        .slice(0, 12);
        
    const chronological = [...allSolves].reverse();

    container.innerHTML = `
        <div class="history-container">
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
                    <button id="btn-export-json" class="btn-action-small">📤 Exportar JSON</button>
                    <button id="btn-import-json" class="btn-action-small">📥 Importar JSON</button>
                </div>
                <div id="import-zone" class="import-input-zone hidden">
                    <textarea id="txt-import-data" placeholder="Cole aqui o código JSON copiado..."></textarea>
                    <button id="btn-confirm-import" class="btn-primary" style="padding: 10px; font-size: 14px;">Confirmar Importação</button>
                </div>
                <div id="backup-status-msg" class="backup-status"></div>
            </div>
            
            <h3>⏱️ Histórico Completo</h3>
            <div class="table-scroll-wrapper">
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Tempo</th>
                            <th>Scramble</th>
                            <th style="text-align: center; width: 80px;">Ações</th>
                        </tr>
                    </thead>
                    <tbody id="history-table-body">
                        ${chronological.map(s => `
                            <tr id="row-${s.id}">
                                <td>${new Date(s.date).toLocaleDateString()}</td>
                                <td><strong class="${s.isDNF ? 'dnf-text' : ''}">${s.isDNF ? 'DNF' : s.time + 's'}</strong></td>
                                <td class="scramble-td">${s.scramble}</td>
                                <td style="text-align: center;">
                                    <button class="btn-delete-history" data-id="${s.id}" title="Excluir tempo">🗑️</button>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding: 20px;">Nenhum treino salvo.</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div class="danger-zone-container">
                <button id="btn-reset-system" class="btn-reset-danger">
                    <span class="icon">⚠️</span> Resetar Todos os Dados
                </button>
                <p class="danger-text">Isso apagará permanentemente todo o histórico, recordes e forçará a limpeza de caches do celular.</p>
            </div>
        </div>
    `;

    // Configuração dos Eventos de Importação / Exportação
    document.getElementById('btn-export-json').addEventListener('click', () => exportData(allSolves));
    document.getElementById('btn-import-json').addEventListener('click', toggleImportZone);
    document.getElementById('btn-confirm-import').addEventListener('click', importData);

    // Delegação de eventos para exclusão de tempos (Lixeira)
    const tableBody = document.getElementById('history-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-delete-history')) {
                const solveId = e.target.getAttribute('data-id');
                if (confirm('Deseja realmente apagar este tempo do seu histórico permanentemente?')) {
                    await deleteFromStore('times', solveId);
                    initHistoryScreen(); 
                }
            }
        });
    }

    // Configuração do Evento do Botão de Reset Absoluto
    const btnReset = document.getElementById('btn-reset-system');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            const confirmFirst = confirm("ATENÇÃO: Você perderá todos os seus tempos e recordes permanentemente. Deseja continuar?");
            if (confirmFirst) {
                const confirmSecond = confirm("Tem certeza absoluta? Esta ação NÃO pode ser desfeita.");
                if (confirmSecond) {
                    try {
                        // Deleta o banco de dados de tempos e estados
                        await clearAllDatabase();
                        
                        localStorage.clear();
                        sessionStorage.clear();

                        // Desinstala os service workers ativos para quebrar o cache de imagens antigo
                        if ('serviceWorker' in navigator) {
                            const registrations = await navigator.serviceWorker.getRegistrations();
                            for (let registration of registrations) {
                                await registration.unregister();
                            }
                        }
                        
                        // Deleta os storages de cache locais mapeados no navegador
                        if ('caches' in window) {
                            const cacheNames = await caches.keys();
                            for (let name of cacheNames) {
                                await caches.delete(name);
                            }
                        }

                        alert("Sistema resetado com sucesso! O aplicativo será reiniciado totalmente limpo.");
                        window.location.reload(true);

                    } catch (error) {
                        console.error("Erro ao resetar o sistema:", error);
                        alert("Ocorreu um erro ao limpar automaticamente. Limpe os dados de navegação do celular manualmente.");
                    }
                }
            }
        });
    }
}

// Mantenha suas funções auxiliares (exportData, toggleImportZone, importData, showStatus) declaradas logo abaixo no arquivo!
async function exportData(allSolves) {
    // Tenta buscar o progresso dos casos aprendidos do banco
    const allCasesProgess = await getAllFromStore('cases') || []; 
    
    const backupPayload = {
        times: allSolves,
        casesProgress: allCasesProgess,
        exportedAt: new Date().toISOString()
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cuber_trainer_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// Altere a função importData correspondente para ler essa nova estrutura:
async function importData() {
    const rawData = document.getElementById('txt-import-data').value;
    const statusMsg = document.getElementById('backup-status-msg');
    
    try {
        const parsed = JSON.parse(rawData);
        
        // Valida se o formato do JSON importado contém as tabelas corretas
        if (parsed.times && Array.isArray(parsed.times)) {
            // Importa o histórico de tempos
            for (let solve of parsed.times) {
                delete solve.id; // Remove id antigo para o IndexedDB auto-incrementar sem colisões
                await saveToStore('times', solve);
            }
            
            // Importa o progresso dos algoritmos (se existir no arquivo de backup)
            if (parsed.casesProgress && Array.isArray(parsed.casesProgress)) {
                for (let caseData of parsed.casesProgress) {
                    await saveToStore('cases', caseData);
                }
            }
            
            statusMsg.textContent = "✅ Dados importados com sucesso! Atualizando...";
            statusMsg.style.color = "#00ff66";
            setTimeout(() => window.location.reload(), 1000);
        } else {
            throw new Error("Formato inválido");
        }
    } catch (err) {
        statusMsg.textContent = "❌ Código de backup inválido ou corrompido.";
        statusMsg.style.color = "#ff4848";
    }
}

function toggleImportZone() {
    const zone = document.getElementById('import-zone');
    zone.classList.toggle('hidden');
    if (!zone.classList.contains('hidden')) {
        document.getElementById('txt-import-data').focus();
    }
}

function showStatus(text, type) {
    const statusMsg = document.getElementById('backup-status-msg');
    if (!statusMsg) return;
    statusMsg.textContent = text;
    statusMsg.className = `backup-status ${type}`;
    
    if (type === 'success') {
        setTimeout(() => { statusMsg.textContent = ''; }, 4000);
    }
}