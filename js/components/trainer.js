import { cuberData, getImagePath } from '../data.js';
import { getAllFromStore, saveToStore } from '../db.js';
import { incrementStreak } from './dashboard.js';

let currentSessionQueue = [];
let queueIndex = 0;

export async function initTrainerScreen() {
    const container = document.getElementById('app-container');

    // Renderiza a tela de configuração inicial para escolher as etapas de treino
    container.innerHTML = `
        <div class="trainer-setup">
            <h3>🗂️ Treino Inteligente por Flashcards</h3>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px;">
                Os casos serão exibidos em um sistema baseado em repetição e prioridade. Casos com mais falhas aparecerão com maior frequência.
            </p>
            <div class="form-group">
                <label>Etapas Ativas no Treino</label>
                <div class="checkboxes-group">
                    <label><input type="checkbox" id="chk-f2l" checked> F2L (Etapa 1)</label>
                    <label><input type="checkbox" id="chk-oll" checked> OLL (Etapa 2)</label>
                    <label><input type="checkbox" id="chk-pll" checked> PLL (Etapa 3)</label>
                </div>
            </div>
            <button id="btn-start-session" class="btn-primary">Iniciar Flashcards</button>
        </div>
    `;

    document.getElementById('btn-start-session').addEventListener('click', startStudySession);
}

async function startStudySession() {
    const useF2L = document.getElementById('chk-f2l').checked;
    const useOLL = document.getElementById('chk-oll').checked;
    const usePLL = document.getElementById('chk-pll').checked;

    const states = await getAllFromStore('casesState');
    const learnedUids = new Set(states.filter(s => s.learned).map(s => s.uid));
    const stateMap = new Map(states.map(s => [s.uid, s]));

    // 1. Reúne todos os casos das etapas selecionadas
    let pool = [];
    if (useF2L) cuberData.f2l.forEach(c => pool.push({ ...c, step: 'f2l', uid: `f2l-${c.id}` }));
    if (useOLL) cuberData.oll.forEach(c => pool.push({ ...c, step: 'oll', uid: `oll-${c.id}` }));
    if (usePLL) cuberData.pll.forEach(c => pool.push({ ...c, step: 'pll', uid: `pll-${c.id}` }));

    // 2. Filtra apenas os casos que o usuário marcou como aprendidos
    currentSessionQueue = pool.filter(item => learnedUids.has(item.uid));

    if (currentSessionQueue.length === 0) {
        alert('Por favor, marque alguns casos como "Aprendi" na tela de Casos antes de treinar!');
        return;
    }

    // 3. ALGORITMO DE ORDENAÇÃO INTELIGENTE (Prioridade Baseada em Desempenho)
    // Calcula um score simples onde quanto menor o valor, pior é o desempenho do usuário naquele caso.
    currentSessionQueue.sort((a, b) => {
        const stateA = stateMap.get(a.uid) || { successCount: 0, failCount: 0 };
        const stateB = stateMap.get(b.uid) || { successCount: 0, failCount: 0 };
        
        const scoreA = stateA.successCount - stateA.failCount;
        const scoreB = stateB.successCount - stateB.failCount;

        // Casos com menor score (mais falhas / menos acertos) sobem para o topo da fila
        return scoreA - scoreB;
    });

    queueIndex = 0;
    renderActiveSession();
}

function renderActiveSession() {
    const container = document.getElementById('app-container');
    
    // Mantém um loop contínuo na fila se o usuário treinar todos os cards disponíveis
    if (queueIndex >= currentSessionQueue.length) {
        queueIndex = 0;
    }

    const currentCard = currentSessionQueue[queueIndex];

    container.innerHTML = `
        <div class="session-container" style="max-width: 480px; margin: 0 auto; text-align: center;">
            <div class="session-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 13px; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 12px;">
                    Caso ${queueIndex + 1} de ${currentSessionQueue.length}
                </span>
                <button id="btn-abort-session" class="btn-action-small" style="background: rgba(255,255,255,0.1); border:none; padding: 6px 12px; border-radius: 6px; color:#fff; cursor:pointer;">Voltar</button>
            </div>
            
            <div class="flashcard" style="background: #1e1e2e; border: 2px solid #313244; border-radius: 16px; padding: 25px; min-height: 280px; display: flex; flex-direction: column; justify-content: center; align-items: center; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
                <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #f5c2e7; margin-bottom: 10px;">
                    ${currentCard.step.toUpperCase()} - ${currentCard.name || currentCard.id}
                </span>
                
                <img src="${getImagePath(currentCard.step, currentCard.id)}" id="flashcard-img" alt="Caso para Resolver" style="max-width: 130px; height: auto; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                
                <div id="flashcard-alg-target" class="hidden-alg" style="margin-top: 15px; width: 100%; min-height: 40px; font-size: 15px; color: var(--text-muted);">
                    👁️ Clique na imagem para revelar o algoritmo
                </div>
            </div>
            
            <div class="flashcard-actions" id="action-area" style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <button id="btn-card-errado" class="btn-danger" style="background: #f38ba8; color: #11111b; font-weight: bold; border: none; padding: 14px; border-radius: 12px; font-size: 16px; cursor: pointer;">Errei</button>
                <button id="btn-card-certo" class="btn-success" style="background: #a6e3a1; color: #11111b; font-weight: bold; border: none; padding: 14px; border-radius: 12px; font-size: 16px; cursor: pointer;">Acertei</button>
            </div>
        </div>
    `;

    // Revela os algoritmos cadastrados ao clicar na imagem
    document.getElementById('flashcard-img').addEventListener('click', () => {
        const target = document.getElementById('flashcard-alg-target');
        target.innerHTML = currentCard.algs.map(a => `
            <p style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; font-family: monospace; color: #a6e3a1; margin: 4px 0; word-break: break-word;">
                ${a}
            </p>
        `).join('');
        target.style.color = '#fff';
    });

    document.getElementById('btn-card-certo').addEventListener('click', () => handleCardAnswer(true));
    document.getElementById('btn-card-errado').addEventListener('click', () => handleCardAnswer(false));
    document.getElementById('btn-abort-session').addEventListener('click', () => initTrainerScreen());
}

async function handleCardAnswer(success) {
    const currentCard = currentSessionQueue[queueIndex];
    const states = await getAllFromStore('casesState');
    const stateMap = new Map(states.map(s => [s.uid, s]));
    
    let state = stateMap.get(currentCard.uid) || { 
        uid: currentCard.uid, 
        learned: true, 
        successCount: 0, 
        failCount: 0 
    };

    // Atualiza contadores com base no feedback dado
    if (success) {
        state.successCount++;
        await incrementStreak();
    } else {
        state.failCount++;
    }

    // Mantém o ID do IndexedDB se ele já existir na store para evitar registros duplicados
    if (state.id === undefined) {
        const savedState = states.find(s => s.uid === currentCard.uid);
        if (savedState) state.id = savedState.id;
    }

    await saveToStore('casesState', state);
    
    // Avança para o próximo caso da fila e re-renderiza o painel
    queueIndex++;
    renderActiveSession();
}