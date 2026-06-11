import { getAllFromStore, saveToStore, deleteFromStore } from '../db.js';

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
            
            <!-- 📁 Sistema de Backup Data JSON -->
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
        </div>
    `;

    // Configuração dos Eventos de Importação / Exportação
    document.getElementById('btn-export-json').addEventListener('click', () => exportData(allSolves));
    document.getElementById('btn-import-json').addEventListener('click', toggleImportZone);
    document.getElementById('btn-confirm-import').addEventListener('click', importData);

    // Delegação de eventos para exclusão de tempos
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
}

// 📤 Função para exportar e copiar automaticamente o JSON
async function exportData(solves) {
    const statusMsg = document.getElementById('backup-status-msg');
    if (solves.length === 0) {
        showStatus('Nenhum dado encontrado para exportar.', 'error');
        return;
    }

    try {
        // Limpa os IDs autoincrementados originais para evitar colisões ao reimportar futuramente
        const cleanData = solves.map(({ time, isDNF, date, scramble }) => ({ time, isDNF, date, scramble }));
        const jsonString = JSON.stringify(cleanData, null, 2);
        
        await navigator.clipboard.writeText(jsonString);
        showStatus('🚀 JSON copiado para a área de transferência!', 'success');
    } catch (err) {
        console.error('Falha ao copiar dados: ', err);
        showStatus('Erro ao copiar dados automaticamente.', 'error');
    }
}

function toggleImportZone() {
    const zone = document.getElementById('import-zone');
    zone.classList.toggle('hidden');
    if (!zone.classList.contains('hidden')) {
        document.getElementById('txt-import-data').focus();
    }
}

// 📥 Função para ler, validar e processar o JSON injetado
async function importData() {
    const jsonInput = document.getElementById('txt-import-data').value.trim();
    
    if (!jsonInput) {
        showStatus('Por favor, cole um código JSON válido.', 'error');
        return;
    }

    try {
        const parsedData = JSON.parse(jsonInput);
        
        if (!Array.isArray(parsedData)) {
            throw new Error('O formato do JSON precisa ser uma lista de tempos.');
        }

        if (confirm(`Aviso: Foram encontrados ${parsedData.length} tempos. Deseja adicioná-los ao banco de dados atual?`)) {
            for (const solve of parsedData) {
                // Validação básica de propriedades obrigatórias do objeto para prevenir corrupção
                if (typeof solve.time === 'number' && solve.date) {
                    await saveToStore('times', {
                        time: solve.time,
                        isDNF: !!solve.isDNF,
                        date: solve.date,
                        scramble: solve.scramble || ''
                    });
                }
            }
            showStatus('🎉 Dados importados e mesclados com sucesso!', 'success');
            setTimeout(() => initHistoryScreen(), 1500);
        }
    } catch (err) {
        console.error('Erro de importação:', err);
        showStatus('Falha ao processar o JSON. Verifique a formatação do texto colado.', 'error');
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