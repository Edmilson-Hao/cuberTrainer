import { cuberData, getImagePath } from '../data.js';
import { getAllFromStore, saveToStore } from '../db.js';
import { incrementStreak } from './dashboard.js';

let sessionTimer = null;
let sessionActive = false;
let currentSessionQueue = [];
let queueIndex = 0;

export async function initTrainerScreen() {
    const container = document.getElementById('app-container');
    if (sessionActive) {
        renderActiveSession();
        return;
    }

    // Substitua o trecho de innerHTML dentro de initTrainerScreen por este:
container.innerHTML = `
    <div class="trainer-setup">
        <h3>Sessão de Estudo Flashcard</h3>
        <div class="form-group">
            <label>Duração da Sessão</label>
            <select id="session-duration">
                <option value="5">5 Minutos</option>
                <option value="10">10 Minutos</option>
            </select>
        </div>
        <div class="form-group">
            <label>Etapas Ativas</label>
            <div class="checkboxes-group">
                <label><input type="checkbox" id="chk-f2l" checked> F2L (Etapa 1)</label>
                <label><input type="checkbox" id="chk-oll" checked> OLL (Etapa 2)</label>
                <label><input type="checkbox" id="chk-pll" checked> PLL (Etapa 3)</label>
            </div>
        </div>
        <button id="btn-start-session" class="btn-primary">Gerar Sessão Decrescente</button>
    </div>
`;

    document.getElementById('btn-start-session').addEventListener('click', startStudySession);
}

async function startStudySession() {
    const durationMin = parseInt(document.getElementById('session-duration').value);
    const useF2L = document.getElementById('chk-f2l').checked;
    const useOLL = document.getElementById('chk-oll').checked;
    const usePLL = document.getElementById('chk-pll').checked;

    const states = await getAllFromStore('casesState');
    const learnedUids = new Set(states.filter(s => s.learned).map(s => s.uid));
    const stateMap = new Map(states.map(s => [s.uid, s]));

    // Gera fila baseado nos casos ativados e marcados como "Aprendi"
    let pool = [];
    if (useF2L) cuberData.f2l.forEach(c => pool.push({ ...c, step: 'f2l', uid: `f2l-${c.id}` }));
    if (useOLL) cuberData.oll.forEach(c => pool.push({ ...c, step: 'oll', uid: `oll-${c.id}` }));
    if (usePLL) cuberData.pll.forEach(c => pool.push({ ...c, step: 'pll', uid: `pll-${c.id}` }));

    // Filtrar apenas o que já foi marcado como aprendido para praticar fixação
    currentSessionQueue = pool.filter(item => learnedUids.has(item.uid));

    if (currentSessionQueue.length === 0) {
        alert('Por favor, marque alguns casos como "Aprendi" na tela de Casos antes de iniciar o treino!');
        return;
    }

    // Ordenação inteligente: Casos com mais falhas aparecem antes
    currentSessionQueue.sort((a, b) => {
        const stateA = stateMap.get(a.uid) || { failCount: 0 };
        const stateB = stateMap.get(b.uid) || { failCount: 0 };
        return stateB.failCount - stateA.failCount;
    });

    sessionActive = true;
    queueIndex = 0;

    let totalSeconds = durationMin * 60;
    renderActiveSession(totalSeconds);

    sessionTimer = setInterval(() => {
        totalSeconds--;
        const timerEl = document.getElementById('session-countdown');
        if (timerEl) {
            const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
            const s = String(totalSeconds % 60).padStart(2, '0');
            timerEl.textContent = `${m}:${s}`;
        }

        if (totalSeconds <= 0) {
            endSession();
        }
    }, 1000);
}

function renderActiveSession(initialSeconds = 300) {
    const container = document.getElementById('app-container');
    if (queueIndex >= currentSessionQueue.length) queueIndex = 0; // Loop na fila se acabar os cards

    const currentCard = currentSessionQueue[queueIndex];
    const m = String(Math.floor(initialSeconds / 60)).padStart(2, '0');
    const s = String(initialSeconds % 60).padStart(2, '0');

    container.innerHTML = `
        <div class="session-container">
            <div class="session-header">
                <span id="session-countdown">${m}:${s}</span>
                <button id="btn-abort-session">Encerrar</button>
            </div>
            <div class="flashcard">
                <img src="${getImagePath(currentCard.step, currentCard.id)}" id="flashcard-img" alt="Caso para Resolver">
                <div id="flashcard-alg-target" class="hidden-alg">Clique na imagem para revelar o algoritmo</div>
            </div>
            <div class="flashcard-actions">
                <button id="btn-card-errado" class="btn-danger">Errei</button>
                <button id="btn-card-certo" class="btn-success">Acertei</button>
            </div>
        </div>
    `;

    document.getElementById('flashcard-img').addEventListener('click', () => {
        document.getElementById('flashcard-alg-target').innerHTML = currentCard.algs.map(a => `<p>${a}</p>`).join('');
        document.getElementById('flashcard-alg-target').classList.remove('hidden-alg');
    });

    document.getElementById('btn-card-certo').addEventListener('click', () => handleCardAnswer(true));
    document.getElementById('btn-card-errado').addEventListener('click', () => handleCardAnswer(false));
    document.getElementById('btn-abort-session').addEventListener('click', endSession);
}

async function handleCardAnswer(success) {
    const currentCard = currentSessionQueue[queueIndex];
    const states = await getAllFromStore('casesState');
    const stateMap = new Map(states.map(s => [s.uid, s]));
    let state = stateMap.get(currentCard.uid) || { uid: currentCard.uid, learned: true, successCount: 0, failCount: 0 };

    if (success) {
        state.successCount++;
        await incrementStreak();
    } else {
        state.failCount++;
    }

    await saveToStore('casesState', state);
    queueIndex++;
    renderActiveSession(parseInt(document.getElementById('session-countdown').textContent.split(':')[0]) * 60 + parseInt(document.getElementById('session-countdown').textContent.split(':')[1]));
}

function endSession() {
    clearInterval(sessionTimer);
    sessionActive = false;
    alert('Sessão concluída! Bom trabalho.');
    initTrainerScreen();
}