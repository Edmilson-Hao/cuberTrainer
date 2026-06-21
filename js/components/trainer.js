import { cuberData, getImagePath } from '../data.js';
import { getAllFromStore, saveToStore } from '../db.js';

let currentSessionQueue = [];
let queueIndex = 0;

let sessionStats = {
    totalCorrect: 0,
    totalWrong: 0,
    startTime: null,
    erradosNaSessao: new Set()
};

// Mapeamento nativo dos Subgrupos oficiais para filtragem inteligente
const SUBGRUPOS = {
    oll: [
        { id: 'all', name: 'Todos os Casos OLL (57)' },
        { id: 'cruz', name: 'OLLs de Cruz Orientada (Caso 21 ao 27)' },
        { id: 'ponto', name: 'OLLs de Ponto Puro (Caso 1 ao 4, 17-19)' },
        { id: 'linha', name: 'OLLs de Linha/Barra' }
    ],
    pll: [
        { id: 'all', name: 'Todos os Casos PLL (21)' },
        { id: 'meios', name: 'Apenas Meios (Ua, Ub, Z, H)' },
        { id: 'cantos', name: 'Apenas Cantos (Aa, Ab, E)' },
        { id: 'gperms', name: 'Permutações G (Ga, Gb, Gc, Gd)' }
    ]
};

export async function initTrainerScreen() {
    const container = document.getElementById('app-container');

    container.innerHTML = `
        <div class="trainer-setup" style="padding: 16px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid #1e293b;">
            <h3>🗂️ Treino Inteligente e Segmentado</h3>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px;">
                Selecione as etapas ou filtre por <strong>subgrupos específicos</strong> para focar nos seus pontos fracos.
            </p>
            
            <div class="form-group" style="margin-bottom: 15px;">
                <label style="font-weight: bold; font-size: 13px; color: var(--accent); display:block; margin-bottom: 8px;">Etapas Ativas</label>
                <div class="checkboxes-group" style="display:flex; flex-direction:column; gap: 8px;">
                    <label><input type="checkbox" id="chk-f2l" checked> F2L (Casos 1 a 41)</label>
                    <label><input type="checkbox" id="chk-oll"> OLL (Orientação do Topo)</label>
                    <label><input type="checkbox" id="chk-pll"> PLL (Permutação do Topo)</label>
                </div>
            </div>

            <div id="subgrupo-oll-box" style="margin-bottom: 15px; display: none;">
                <label style="font-size: 12px; color: var(--text-muted); display:block; margin-bottom: 4px;">Filtro de Subgrupo OLL:</label>
                <select id="sel-subgrupo-oll" style="width:100%; background:#020617; border:1px solid #1e293b; color:#fff; padding:8px; border-radius:6px; font-size:13px;"></select>
            </div>

            <div id="subgrupo-pll-box" style="margin-bottom: 20px; display: none;">
                <label style="font-size: 12px; color: var(--text-muted); display:block; margin-bottom: 4px;">Filtro de Subgrupo PLL:</label>
                <select id="sel-subgrupo-pll" style="width:100%; background:#020617; border:1px solid #1e293b; color:#fff; padding:8px; border-radius:6px; font-size:13px;"></select>
            </div>

            <button id="btn-start-session" class="btn-primary" style="width:100%; padding:12px; font-weight:bold; border-radius:var(--radius-sm);">🚀 Iniciar Sessão de Foco</button>
        </div>
    `;

    // Alimentando os selects de subgrupos nativamente
    const selOll = document.getElementById('sel-subgrupo-oll');
    const selPll = document.getElementById('sel-subgrupo-pll');
    SUBGRUPOS.oll.forEach(g => selOll.innerHTML += `<option value="${g.id}">${g.name}</option>`);
    SUBGRUPOS.pll.forEach(g => selPll.innerHTML += `<option value="${g.id}">${g.name}</option>`);

    // Mostrar/ocultar os subgrupos dependendo de quais etapas principais estão marcadas
    const chkOll = document.getElementById('chk-oll');
    const chkPll = document.getElementById('chk-pll');
    
    chkOll.onchange = () => document.getElementById('subgrupo-oll-box').style.display = chkOll.checked ? 'block' : 'none';
    chkPll.onchange = () => document.getElementById('subgrupo-pll-box').style.display = chkPll.checked ? 'block' : 'none';

    document.getElementById('btn-start-session').onclick = generateTrainerQueue;
}

// Algoritmo de filtragem avançada por subgrupo
function filtrarCasosEspecificos(etapa, subgrupoId) {
    const todosOsCasos = cuberData[etapa] || [];
    if (!subgrupoId || subgrupoId === 'all') return todosOsCasos;

    if (etapa === 'oll') {
        if (subgrupoId === 'cruz') {
            // Casos oficiais de cruz orientada
            return todosOsCasos.filter(c => c.id >= 21 && c.id <= 27);
        }
        if (subgrupoId === 'ponto') {
            return todosOsCasos.filter(c => [1, 2, 3, 4, 17, 18, 19].includes(c.id));
        }
        if (subgrupoId === 'linha') {
            return todosOsCasos.filter(c => [13, 14, 15, 16, 51, 52, 55, 56].includes(c.id));
        }
    }

    if (etapa === 'pll') {
        if (subgrupoId === 'meios') {
            return todosOsCasos.filter(c => ['Ua', 'Ub', 'Z', 'H'].some(name => c.name.includes(name)));
        }
        if (subgrupoId === 'cantos') {
            return todosOsCasos.filter(c => ['Aa', 'Ab', 'E', 'V'].some(name => c.name.includes(name)));
        }
        if (subgrupoId === 'gperms') {
            return todosOsCasos.filter(c => c.name.toLowerCase().includes('g-'));
        }
    }

    return todosOsCasos;
}

async function generateTrainerQueue() {
    const useF2l = document.getElementById('chk-f2l').checked;
    const useOll = document.getElementById('chk-oll').checked;
    const usePll = document.getElementById('chk-pll').checked;

    let queue = [];

    if (useF2l) {
        cuberData.f2l.forEach(c => queue.push({ ...c, step: 'f2l', uid: `f2l-${c.id}` }));
    }
    if (useOll) {
        const subOll = document.getElementById('sel-subgrupo-oll').value;
        const filtrados = filtrarCasosEspecificos('oll', subOll);
        filtrados.forEach(c => queue.push({ ...c, step: 'oll', uid: `oll-${c.id}` }));
    }
    if (usePll) {
        const subPll = document.getElementById('sel-subgrupo-pll').value;
        const filtrados = filtrarCasosEspecificos('pll', subPll);
        filtrados.forEach(c => queue.push({ ...c, step: 'pll', uid: `pll-${c.id}` }));
    }

    if (queue.length === 0) {
        alert("Selecione ao menos uma etapa para treinar!");
        return;
    }

    // Embaralha o deck de flashcards
    currentSessionQueue = queue.sort(() => Math.random() - 0.5);
    queueIndex = 0;

    sessionStats = {
        totalCorrect: 0,
        totalWrong: 0,
        startTime: Date.now(),
        erradosNaSessao: new Set()
    };

    renderTrainerCard();
}

function renderTrainerCard() {
    const container = document.getElementById('app-container');

    if (queueIndex >= currentSessionQueue.length) {
        renderTrainerSummary();
        return;
    }

    const item = currentSessionQueue[queueIndex];

    container.innerHTML = `
        <div class="trainer-card-screen" style="text-align: center; background: var(--bg-card); padding: 20px; border-radius: var(--radius-md); border: 1px solid #1e293b;">
            <div style="display:flex; justify-content: space-between; font-size:12px; color: var(--text-muted); margin-bottom: 15px;">
                <span style="text-transform: uppercase; font-weight:700; color:var(--accent);">${item.step}</span>
                <span>Progresso: <strong>${queueIndex + 1}/${currentSessionQueue.length}</strong></span>
            </div>

            <div class="flashcard-box" style="background:#020617; padding: 20px; border-radius: var(--radius-sm); border:1px solid #1e293b; margin-bottom: 20px;">
                <img src="${getImagePath(item.step, item.id)}" alt="Caso do cubo" style="width: 120px; height: 120px; margin: 0 auto 15px auto; display: block; filter: drop-shadow(0 0 8px rgba(0,242,254,0.2));">
                <h2 id="case-name-blur" style="filter: blur(6px); transition: filter 0.2s; font-size: 20px; margin-bottom: 10px;">${item.name}</h2>
                <div id="alg-container-hidden" style="visibility: hidden; font-family: monospace; font-size: 14px; color: var(--accent); background: rgba(0,242,254,0.05); padding: 8px; border-radius:4px;">
                    ${item.algs && item.algs[0] ? item.algs[0] : 'Sem algoritmo cadastrado'}
                </div>
            </div>

            <div id="trainer-action-area" style="display:flex; flex-direction:column; gap: 10px;">
                <button id="btn-reveal-card" class="btn-primary" style="padding:12px; font-weight:bold;">👀 Revelar Resposta</button>
            </div>
        </div>
    `;

    document.getElementById('btn-reveal-card').onclick = () => {
        document.getElementById('case-name-blur').style.filter = 'none';
        document.getElementById('alg-container-hidden').style.visibility = 'visible';

        document.getElementById('trainer-action-area').innerHTML = `
            <div style="display:flex; gap:10px; width:100%;">
                <button id="btn-solve-wrong" style="flex:1; background: var(--danger-bg); border: 1px solid rgba(255,23,68,0.3); color: var(--danger); padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">❌ Errei / Travei</button>
                <button id="btn-solve-right" style="flex:1; background: var(--success-bg); border: 1px solid rgba(0,230,118,0.3); color: var(--success); padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">✅ Acertei</button>
            </div>
        `;

        document.getElementById('btn-solve-right').onclick = () => processAnswer(true);
        document.getElementById('btn-solve-wrong').onclick = processAnswer;
    };
}

async function processAnswer(isCorrect = false) {
    const item = currentSessionQueue[queueIndex];
    const states = await getAllFromStore('casesState') || [];
    let state = states.find(s => s.uid === item.uid) || { uid: item.uid, learned: false, successCount: 0, failCount: 0 };

    if (isCorrect) {
        state.successCount++;
        if (!sessionStats.erradosNaSessao.has(item.uid)) {
            sessionStats.totalCorrect++;
        }
        queueIndex++;
    } else {
        state.failCount++;
        sessionStats.totalWrong++;
        sessionStats.erradosNaSessao.add(item.uid);

        // Se errou, move o card 3 posições para trás ou para o fim da fila para forçar repetição imediata
        const cardErrado = currentSessionQueue.splice(queueIndex, 1)[0];
        const novaPosicao = Math.min(queueIndex + 3, currentSessionQueue.length);
        currentSessionQueue.splice(novaPosicao, 0, cardErrado);
    }

    await saveToStore('casesState', state);
    renderTrainerCard();
}

function renderTrainerSummary() {
    const container = document.getElementById('app-container');
    const totalTime = Date.now() - sessionStats.startTime;
    const elapsedMinutes = Math.floor(totalTime / 60000);
    const elapsedSeconds = Math.floor((totalTime % 60000) / 1000);

    const totalRespondidos = sessionStats.totalCorrect + sessionStats.erradosNaSessao.size;
    const precisao = totalRespondidos > 0 ? ((sessionStats.totalCorrect / totalRespondidos) * 100).toFixed(0) : 100;

    // ✅ BÔNUS: Cria um registro simbólico no histórico para computar a sessão de flashcards no seu Streak!
    saveToStore('times', {
        time: 0.00,
        scramble: `Treino de Flashcards: ${totalRespondidos} casos revisados`,
        date: new Date().toISOString(),
        step: 'all', 
        isDNF: false,
        hasPlusTwo: false
    }).then(() => {
        // Força o dashboard a recalcular o novo streak em background
        import('./dashboard.js').then(dash => { if (dash && dash.renderDashboard) dash.renderDashboard(); });
    });

    container.innerHTML = `
        <div class="trainer-summary" style="background: var(--bg-card); padding: 20px; border-radius: var(--radius-md); border: 1px solid #1e293b; text-align:center;">
            <h2 style="color: var(--success); margin-bottom: 5px;">🎉 Sessão Concluída!</h2>
            <p style="color: var(--text-muted); font-size:13px; margin-bottom: 20px;">Você limpou com sucesso todo o deck selecionado.</p>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 25px; text-align: left;">
                <div style="background:#020617; padding:10px; border-radius:6px; border:1px solid #1e293b;">
                    <span style="font-size: 11px; color: var(--text-muted);">⏱️ Tempo Gasto</span>
                    <strong style="display:block; font-size: 16px; color: #fff;">${elapsedMinutes}m ${elapsedSeconds}s</strong>
                </div>
                <div style="background:#020617; padding:10px; border-radius:6px; border:1px solid #1e293b;">
                    <span style="font-size: 11px; color: var(--text-muted);">🎯 Precisão Real</span>
                    <strong style="display:block; font-size: 16px; color: var(--accent);">${precisao}%</strong>
                </div>
                <div style="background:#020617; padding:10px; border-radius:6px; border:1px solid #1e293b;">
                    <span style="font-size: 11px; color: var(--text-muted);">✅ De Primeira</span>
                    <strong style="display:block; font-size: 16px; color: var(--success);">${sessionStats.totalCorrect}</strong>
                </div>
                <div style="background:#020617; padding:10px; border-radius:6px; border:1px solid #1e293b;">
                    <span style="font-size: 11px; color: var(--text-muted);">⚠️ Falhas Retidas</span>
                    <strong style="display:block; font-size: 16px; color: var(--danger);">${sessionStats.erradosNaSessao.size}</strong>
                </div>
            </div>

            <button id="btn-finish-summary" class="btn-primary" style="width: 100%; padding: 12px; font-weight: bold; border-radius: 6px;">Voltar ao Menu</button>
        </div>
    `;

    document.getElementById('btn-finish-summary').onclick = () => {
        import('./dashboard.js').then(d => d.renderDashboard());
        initTrainerScreen();
    };
}