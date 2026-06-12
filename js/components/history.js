import { getAllFromStore, saveToStore, deleteFromStore, clearAllDatabase } from '../db.js';

// Variável global dinâmica para guardar o nome real da tabela de tempos que descobrirmos
let REAL_SOLVES_STORE = 'times';

/**
 * 🕵️ Função de Auto-Descoberta de Tabelas do IndexedDB
 */
async function discoverAndFetchSolves() {
    return new Promise((resolve) => {
        const request = indexedDB.open('CuberTrainerDB');

        request.onsuccess = async (event) => {
            const db = event.target.result;
            const storeNames = Array.from(db.objectStoreNames);
            db.close(); 

            console.log("📋 Tabelas reais encontradas no CuberTrainerDB:", storeNames);

            if (storeNames.includes('times')) {
                REAL_SOLVES_STORE = 'times';
            } else if (storeNames.includes('solves')) {
                REAL_SOLVES_STORE = 'solves';
            }

            console.log(`🎯 Tabela de tempos mapeada com sucesso: '${REAL_SOLVES_STORE}'`);

            try {
                const data = await getAllFromStore(REAL_SOLVES_STORE);
                resolve(data || []);
            } catch (err) {
                console.error(`Erro ao puxar dados da tabela mapeada '${REAL_SOLVES_STORE}':`, err);
                resolve([]);
            }
        };

        request.onerror = (event) => {
            console.error("Erro ao abrir CuberTrainerDB para auto-descoberta:", event.target.error);
            resolve([]);
        };
    });
}

export async function initHistoryScreen() {
    const container = document.getElementById('app-container');
    
    // Executa a auto-descoberta antes de montar a tela
    const allSolves = await discoverAndFetchSolves();
    
    const records = [...allSolves]
        .filter(s => s && !s.isDNF && s.time) 
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

    document.getElementById('btn-export-json').addEventListener('click', () => exportData(allSolves));
    document.getElementById('btn-import-json').addEventListener('click', toggleImportZone);
    document.getElementById('btn-confirm-import').addEventListener('click', importData);
    
    // Escuta quando o usuário escolhe um arquivo pelo seletor de arquivos
    document.getElementById('file-import-picker').addEventListener('change', handleFileSelect);

    const tableBody = document.getElementById('history-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-delete-history')) {
                const solveId = e.target.getAttribute('data-id');
                if (confirm('Deseja realmente apagar este tempo do seu histórico permanentemente?')) {
                    try {
                        await deleteFromStore(REAL_SOLVES_STORE, solveId);
                        initHistoryScreen(); 
                    } catch (err) {
                        console.error("Erro ao deletar tempo:", err);
                    }
                }
            }
        });
    }

    const btnReset = document.getElementById('btn-reset-system');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            const confirmFirst = confirm("ATENÇÃO: Você perderá todos os seus tempos e recordes permanentemente. Deseja continuar?");
            if (confirmFirst) {
                const confirmSecond = confirm("Tem certeza absoluta? Esta ação NÃO pode ser desfeita.");
                if (confirmSecond) {
                    try {
                        await clearAllDatabase();
                        localStorage.clear();
                        sessionStorage.clear();

                        if ('serviceWorker' in navigator) {
                            const registrations = await navigator.serviceWorker.getRegistrations();
                            for (let registration of registrations) {
                                await registration.unregister();
                            }
                        }
                        
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
                        alert("Ocorreu um erro ao limpar automaticamente.");
                    }
                }
            }
        });
    }
}

// Funções auxiliares de Exportação e Importação via Blob nativo
async function exportData(allSolves) {
    const statusMsg = document.getElementById('backup-status-msg');
    try {
        let allCasesProgress = [];

        try {
            allCasesProgress = await getAllFromStore('casesState') || []; 
        } catch (dbError) {
            console.warn("A store 'casesState' não respondeu. Exportando apenas os tempos disponíveis.");
            allCasesProgress = [];
        }
        
        const backupPayload = {
            times: allSolves,
            casesProgress: allCasesProgress,
            exportedAt: new Date().toISOString()
        };
        
        const jsonString = JSON.stringify(backupPayload, null, 2);

        // 🔥 NOVIDADE: Copia automaticamente para a Área de Transferência (Clipboard)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(jsonString);
            if (statusMsg) {
                statusMsg.textContent = "📋 Arquivo gerado e código copiado para o Clipboard!";
                statusMsg.style.color = "#00ff66";
            }
        }

        // Continua gerando o download do arquivo .json normalmente
        const blob = new Blob([jsonString], { type: "application/json" });
        const blobUrl = URL.createObjectURL(blob);
        
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = blobUrl;
        downloadAnchor.download = `cuber_trainer_backup_${Date.now()}.json`;
        
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        
        document.body.removeChild(downloadAnchor);
        URL.revokeObjectURL(blobUrl);
        
        console.log("Backup gerado com sucesso via Blob e copiado para o Clipboard!");

    } catch (error) {
        console.error("Erro crítico ao gerar arquivo de exportação:", error);
        alert("Não foi possível gerar o arquivo de backup.");
    }
}

// Função para ler o arquivo selecionado e jogar o conteúdo no textarea
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        // Coloca o conteúdo do arquivo lido direto na caixa de texto
        document.getElementById('txt-import-data').value = evt.target.result;
        
        const statusMsg = document.getElementById('backup-status-msg');
        statusMsg.textContent = "📂 Arquivo carregado! Clique em 'Confirmar Importação'.";
        statusMsg.style.color = "#33b5e5";
    };
    reader.readAsText(file);
}

async function importData() {
    const rawData = document.getElementById('txt-import-data').value;
    const statusMsg = document.getElementById('backup-status-msg');
    
    if (!rawData.trim()) {
        statusMsg.textContent = "❌ Escolha um arquivo ou cole os dados antes de confirmar.";
        statusMsg.style.color = "#ff4848";
        return;
    }

    try {
        const parsed = JSON.parse(rawData);
        
        if (parsed.times && Array.isArray(parsed.times)) {
            // Importa o histórico de tempos na tabela ativa descoberta dinamicamente
            for (let solve of parsed.times) {
                delete solve.id; 
                await saveToStore(REAL_SOLVES_STORE, solve);
            }
            
            // Importa o progresso dos algoritmos mapeando para 'casesState'
            if (parsed.casesProgress && Array.isArray(parsed.casesProgress)) {
                for (let caseData of parsed.casesProgress) {
                    await saveToStore('casesState', caseData).catch(() => {});
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