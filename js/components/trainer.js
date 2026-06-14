import { cuberData, getImagePath } from '../data.js';
import { getAllFromStore, saveToStore } from '../db.js';
import { incrementStreak } from './dashboard.js';

let currentSessionQueue = [];
let queueIndex = 0;

// Métricas exclusivas da sessão ativa
let sessionStats = {
    totalCorrect: 0,
    totalWrong: 0,
    startTime: null,
    // Set para rastrear quais uids foram errados pelo menos uma vez nesta sessão
    erradosNaSessao: new Set()
};

export async function initTrainerScreen() {
    const container = document.getElementById('app-container');

    container.innerHTML = `
        <div class="trainer-setup">
            <h3>🗂️ Treino Inteligente por Flashcards</h3>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px;">
                A sessão continuará rodando até que você <strong>acerte todos os casos</strong> selecionados ou decida encerrar manualmente.
            </p>
            <div class="form-group">
                <label>Etapas Ativas no Treino</label>
                <div class="checkboxes-group">
                    <label><input type="checkbox" id="chk-f2l" checked> F2L (Etapa 1)</label>
                    <label><input type="checkbox" id="chk-oll" checked> OLL (Etapa 2)</label>
                    <label><input type="checkbox" id="chk-pll" checked> PLL (Etapa 3)</label>
                </div>
            </div>
            <button id="btn-start-session" class="btn-primary">Iniciar Sessão de Estudo</button>
        </div>
    `;

    document.getElementById('btn-start-session').addEventListener('click', startStudySession);
}

async function startStudySession() {
    const useF2L = document.getElementById('chk-f2l').checked;
    const useOLL = document.getElementById('chk-oll').checked;
    const usePLL = document.getElementById('chk-pll').checked;

    const states = await getAllFromStore('casesState') || [];
    const learnedUids = new Set(states.filter(s => s.learned).map(s => s.uid));
    const stateMap = new Map(states.map(s => [s.uid, s]));

    let pool = [];
    if (useF2L) cuberData.f2l.forEach(c => pool.push({ ...c, step: 'f2l', uid: `f2l-${c.id}` }));
    if (useOLL) cuberData.oll.forEach(c => pool.push({ ...c, step: 'oll', uid: `oll-${c.id}` }));
    if (usePLL) cuberData.pll.forEach(c => pool.push({ ...c, step: 'pll', uid: `pll-${c.id}` }));

    currentSessionQueue = pool.filter(item => learnedUids.has(item.uid));

    if (currentSessionQueue.length === 0) {
        alert('Por favor, marque alguns casos como "Aprendi" na tela de Casos antes de treinar!');
        return;
    }

    // Ordenação inicial por Prioridade de Falhas
    currentSessionQueue.sort((a, b) => {
        const stateA = stateMap.get(a.uid) || { successCount: 0, failCount: 0 };
        const stateB = stateMap.get(b.uid) || { successCount: 0, failCount: 0 };
        return (stateA.successCount - stateA.failCount) - (stateB.successCount - stateB.failCount);
    });

    // Reset completo de variáveis de controle da rodada
    queueIndex = 0;
    sessionStats.totalCorrect = 0;
    sessionStats.totalWrong = 0;
    sessionStats.startTime = Date.now();
    sessionStats.erradosNaSessao.clear();

    renderActiveSession();
}

function renderActiveSession() {
    const container = document.getElementById('app-container');
    
    // 🛡️ CORREÇÃO DE FILA INFINITA: Se a fila esvaziou completamente, a sessão terminou com sucesso.
    if (currentSessionQueue.length === 0) {
        renderSessionSummary();
        return;
    }

    // Se o index passar do tamanho atual da fila por rotações de erro, volta de forma segura para o começo
    if (queueIndex >= currentSessionQueue.length) {
        queueIndex = 0;
    }

    const currentCard = currentSessionQueue[queueIndex];

    container.innerHTML = `
        <div class="session-container" style="max-width: 480px; margin: 0 auto; text-align: center;">
            <div class="session-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 13px; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 12px;">
                    Restam: <strong style="color: #89b4fa;">${currentSessionQueue.length} casos</strong> para eliminar
                </span>
                <button id="btn-abort-session" class="btn-action-small" style="background: rgba(255,255,255,0.1); border:none; padding: 6px 12px; border-radius: 6px; color:#fff; cursor:pointer;">Abandonar</button>
            </div>
            
            <div class="flashcard" style="background: #1e1e2e; border: 2px solid #313244; border-radius: 16px; padding: 25px; min-height: 280px; display: flex; flex-direction: column; justify-content: center; align-items: center; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
                <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #f5c2e7; margin-bottom: 10px;">
                    ${currentCard.step.toUpperCase()} - ${currentCard.name || currentCard.id}
                </span>
                
                <img src="${getImagePath(currentCard.step, currentCard.id)}" id="flashcard-img" alt="Caso para Resolver" style="max-width: 130px; height: auto; cursor: pointer; transition: transform 0.2s;">
                
                <div id="flashcard-alg-target" class="hidden-alg" style="margin-top: 15px; width: 100%; min-height: 40px; font-size: 15px; color: var(--text-muted); cursor:pointer;">
                    👁️ Clique na imagem para revelar o algoritmo
                </div>
            </div>
            
            <div class="flashcard-actions" style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <button id="btn-card-errado" class="btn-danger" style="background: #f38ba8; color: #11111b; font-weight: bold; border: none; padding: 14px; border-radius: 12px; font-size: 16px; cursor: pointer;">❌ Errei</button>
                <button id="btn-card-certo" class="btn-success" style="background: #a6e3a1; color: #11111b; font-weight: bold; border: none; padding: 14px; border-radius: 12px; font-size: 16px; cursor: pointer;">✅ Acertei</button>
            </div>
        </div>
    `;

    const revealAlg = () => {
        const target = document.getElementById('flashcard-alg-target');
        target.innerHTML = currentCard.algs.map(a => `
            <p style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; font-family: monospace; color: #a6e3a1; margin: 4px 0; word-break: break-word;">${a}</p>
        `).join('');
    };

    document.getElementById('flashcard-img').addEventListener('click', revealAlg);
    document.getElementById('flashcard-alg-target').addEventListener('click', revealAlg);

    document.getElementById('btn-card-certo').addEventListener('click', () => handleCardAnswer(true));
    document.getElementById('btn-card-errado').addEventListener('click', () => handleCardAnswer(false));
    document.getElementById('btn-abort-session').addEventListener('click', () => {
        if (confirm("Deseja interromper o treino e ir direto para o painel de resumo?")) renderSessionSummary();
    });
}

async function handleCardAnswer(success) {
    const currentCard = currentSessionQueue[queueIndex];
    const states = await getAllFromStore('casesState') || [];
    
    let state = states.find(s => s.uid === currentCard.uid) || { 
        uid: currentCard.uid, learned: true, successCount: 0, failCount: 0 
    };

    if (success) {
        // Regra do feedback no banco de dados baseado no comportamento geral da sessão:
        // Se errou esse card alguma vez nesta sessão, conta estritamente como falha no IndexedDB de forma permanente!
        if (sessionStats.erradosNaSessao.has(currentCard.uid)) {
            state.failCount++;
            sessionStats.totalWrong++; 
        } else {
            state.successCount++;
            sessionStats.totalCorrect++;
            await incrementStreak();
        }

        // Remove com sucesso o caso do treino atual
        currentSessionQueue.splice(queueIndex, 1);
        
        // Mantemos o ponteiro do queueIndex parado, porque o item da frente subiu e ocupou o index dele.
    } else {
        // Adiciona ao registro para penalizar a nota mesmo se acertar mais tarde
        sessionStats.erradosNaSessao.add(currentCard.uid);
        sessionStats.totalWrong++;

        // Passa para o próximo item, jogando este caso esquecido para trás na fila rotativa
        queueIndex++;
    }

    // Garante IDs corretos do banco para dar o update limpo
    if (state.id === undefined) {
        const savedState = states.find(s => s.uid === currentCard.uid);
        if (savedState) state.id = savedState.id;
    }

    await saveToStore('casesState', state);
    renderActiveSession();
}

function renderSessionSummary() {
    const container = document.getElementById('app-container');
    const elapsedMinutes = Math.floor((Date.now() - sessionStats.startTime) / 1000 / 60);
    const elapsedSeconds = Math.floor(((Date.now() - sessionStats.startTime) / 1000) % 60);

    const totalCasosIniciais = sessionStats.totalCorrect + sessionStats.erradosNaSessao.size;
    const precisao = totalCasosIniciais > 0 ? Math.round((sessionStats.totalCorrect / totalCasosIniciais) * 100) : 0;

    container.innerHTML = `
        <div class="summary-container" style="max-width: 450px; margin: 0 auto; text-align: center; padding: 20px;">
            <h2 style="color: #a6e3a1; margin-bottom: 10px;">🏁 Sessão Concluída!</h2>
            <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 25px;">O treino finalizou porque você superou todos os algoritmos!</p>
            
            <div style="background: #1e1e2e; border: 1px solid #313244; border-radius: 12px; padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; text-align: left;">
                <div>
                    <span style="font-size: 12px; color: var(--text-muted);">⏱️ Tempo Decorrido</span>
                    <strong style="display:block; font-size: 18px; color: #fff;">${elapsedMinutes}m ${elapsedSeconds}s</strong>
                </div>
                <div>
                    <span style="font-size: 12px; color: var(--text-muted);">🎯 Precisão (Primeira Vista)</span>
                    <strong style="display:block; font-size: 18px; color: #f9e2af;">${precisao}%</strong>
                </div>
                <div>
                    <span style="font-size: 12px; color: var(--text-muted);">✅ Acertados de Primeira</span>
                    <strong style="display:block; font-size: 18px; color: #a6e3a1;">${sessionStats.totalCorrect}</strong>
                </div>
                <div>
                    <span style="font-size: 12px; color: var(--text-muted);">⚠️ Casos com Falha Retidos</span>
                    <strong style="display:block; font-size: 18px; color: #f38ba8;">${sessionStats.erradosNaSessao.size}</strong>
                </div>
            </div>

            <button id="btn-finish-summary" class="btn-primary" style="width: 100%; padding: 12px; font-weight: bold; border-radius: 8px;">Concluir e Voltar</button>
        </div>
    `;

    document.getElementById('btn-finish-summary').addEventListener('click', () => {
        initTrainerScreen();
    });
}