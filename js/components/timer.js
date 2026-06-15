import { saveToStore, getAllFromStore } from '../db.js';
import { cuberData } from '../data.js'; // Importa os casos para gerar scrambles específicos

let timerInterval = null;
let startTime = 0;
let running = false;
let isInspecting = false;
let inspectionTime = 15;
let inspectionInterval = null;

let useInspection = false; 
let lastSolveId = null; 
let spacePressed = false; 
let touchStartTimer = null; 
let isReadyToStart = false;

let justStopped = false;

// NOVOS ESTADOS: Controle de treino de etapa no cronômetro
let currentTimerStep = 'all'; 
let currentCaseDetected = null;

/**
 * 🛠️ Limpa os estados e intervalos ativos do cronômetro.
 * Chamado pelo app.js ao desmontar a tela ou alternar abas para evitar memory leaks.
 */
export function clearTimerState() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (inspectionInterval) {
        clearInterval(inspectionInterval);
        inspectionInterval = null;
    }
    running = false;
    isInspecting = false;
    spacePressed = false;
    isReadyToStart = false;
    
    // Restaura visibilidade do cabeçalho caso tenha saído durante uma solve
    const header = document.querySelector('header');
    if (header) {
        header.style.opacity = '1';
        header.style.pointerEvents = 'auto';
    }
}

export async function initTimerScreen() {
    const container = document.getElementById('app-container');
    
    container.innerHTML = `
        <div class="timer-wrapper" id="timer-wrapper-zone">
            <div id="achievement-toast-container" class="toast-container"></div>

            <div class="timer-controls" style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 320px; margin: 0 auto 15px auto;">
                <label class="toggle-control" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <input type="checkbox" id="chk-inspection" ${useInspection ? 'checked' : ''}>
                    <span class="control-label">Inspeção (15s)</span>
                </label>
                
                <div style="display: flex; align-items: center; gap: 6px; background: rgba(2, 6, 23, 0.4); padding: 6px 10px; border-radius: var(--radius-sm, 8px); border: 1px solid #1e293b;">
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Treinar:</span>
                    <select id="sel-timer-step" style="flex: 1; background: transparent; border: none; color: var(--accent); font-size: 12px; font-weight: 700; cursor: pointer; outline: none;">
                        <option value="all" ${currentTimerStep === 'all' ? 'selected':''}>Cubo Inteiro (3x3)</option>
                        <option value="f2l" ${currentTimerStep === 'f2l' ? 'selected':''}>Apenas F2L</option>
                        <option value="oll" ${currentTimerStep === 'oll' ? 'selected':''}>Apenas OLL</option>
                        <option value="pll" ${currentTimerStep === 'pll' ? 'selected':''}>Apenas PLL</option>
                    </select>
                </div>
            </div>
            
            <div id="scramble-generator" class="scramble-text" style="font-size: 14px; min-height: 40px; text-align: center; color: var(--text-main); margin-bottom: 20px;">Gerando Scramble...</div>
            <div id="timer-display" class="timer-big" style="font-size: 64px; font-family: monospace; font-weight: 700; text-align: center; margin-bottom: 20px; cursor: pointer; user-select: none;">0.00</div>
            
            <div id="timer-stats-panel" style="margin-bottom: 20px;"></div>

            <div id="quick-actions-panel" class="quick-actions-container hidden" style="display: flex; justify-content: center; gap: 10px;">
                <button id="btn-plus-two" style="background: #1e293b; color: #fff; border: 1px solid #334155; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer;">+2s</button>
                <button id="btn-dnf" style="background: rgba(255,23,68,0.1); color: var(--danger); border: 1px solid rgba(255,23,68,0.3); padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer;">DNF</button>
            </div>
        </div>
    `;

    // Vincula a mudança de treino no seletor
    const selStep = document.getElementById('sel-timer-step');
    selStep.onchange = () => {
        currentTimerStep = selStep.value;
        generateScramble();
    };

    document.getElementById('chk-inspection').onchange = (e) => {
        useInspection = e.target.checked;
    };

    setupTimerTriggers();
    generateScramble();
    await renderStatsPanel();
}

// Gerador Inteligente de Scramble focado na Etapa
function generateScramble() {
    const txtScramble = document.getElementById('scramble-generator');
    if (!txtScramble) return;

    if (currentTimerStep === 'all') {
        currentCaseDetected = null;
        // Gerador clássico WCA simplificado de 20 movimentos
        const moves = ["U", "D", "R", "L", "F", "B"];
        const modifiers = ["", "'", "2"];
        let scramble = [];
        let lastMove = "";
        
        for (let i = 0; i < 20; i++) {
            let move = moves[Math.floor(Math.random() * moves.length)];
            while (move === lastMove) {
                move = moves[Math.floor(Math.random() * moves.length)];
            }
            let mod = modifiers[Math.floor(Math.random() * modifiers.length)];
            scramble.push(move + mod);
            lastMove = move;
        }
        txtScramble.innerHTML = scramble.join(" ");
    } else {
        // Busca os casos oficiais da etapa vindos do data.js
        const listaCasos = cuberData[currentTimerStep] || [];
        if (listaCasos.length === 0) {
            txtScramble.innerHTML = "Sem scrambles cadastrados para esta etapa.";
            return;
        }
        
        const casoSorteado = listaCasos[Math.floor(Math.random() * listaCasos.length)];
        currentCaseDetected = {
            step: currentTimerStep,
            id: casoSorteado.id,
            name: casoSorteado.name
        };

        // Mostra o nome do caso em destaque e o algoritmo para emular o scramble dele
        if (casoSorteado.scramble) {
            txtScramble.innerHTML = `<span style="color: var(--accent); font-weight:bold;">[${casoSorteado.name}]</span><br>${casoSorteado.scramble}`;
        } else if (casoSorteado.algs && casoSorteado.algs[0]) {
            txtScramble.innerHTML = `<span style="color: var(--accent); font-weight:bold;">[${casoSorteado.name}]</span><br>${casoSorteado.algs[0]}`;
        } else {
            txtScramble.innerHTML = `Prepare o caso: <strong>${casoSorteado.name}</strong>`;
        }
    }
}

function setupTimerTriggers() {
    const display = document.getElementById('timer-display');
    const wrapper = document.getElementById('timer-wrapper-zone');
    const header = document.querySelector('header');

    const handleTriggerStart = () => {
        if (justStopped) return;
        if (!running && !isInspecting) {
            display.style.color = 'var(--success)';
            isReadyToStart = true;
        } else if (running) {
            stopTimer(display, wrapper, header);
        }
    };

    const handleTriggerEnd = () => {
        if (justStopped) {
            justStopped = false;
            return;
        }
        if (isReadyToStart) {
            isReadyToStart = false;
            display.style.color = '';
            startTimer(display, wrapper, header);
        }
    };

    // Eventos de Teclado
    window.onkeydown = (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!spacePressed) {
                spacePressed = true;
                handleTriggerStart();
            }
        }
    };

    window.onkeyup = (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            spacePressed = false;
            handleTriggerEnd();
        }
    };

    // Eventos Mobile (Toque)
    if (display) {
        display.ontouchstart = (e) => {
            e.preventDefault();
            handleTriggerStart();
        };
        display.ontouchend = (e) => {
            e.preventDefault();
            handleTriggerEnd();
        };
    }

    // Penalidades Rápidas
    document.getElementById('btn-plus-two').onclick = () => updateLastSolve('plus2');
    document.getElementById('btn-dnf').onclick = () => updateLastSolve('dnf');
}

function startTimer(display, wrapper, header) {
    if (useInspection && !isInspecting) {
        isInspecting = true;
        inspectionTime = 15;
        display.textContent = inspectionTime;
        display.classList.add('inspecting');

        inspectionInterval = setInterval(() => {
            inspectionTime--;
            display.textContent = inspectionTime;
            if (inspectionTime <= 0) {
                clearInterval(inspectionInterval);
                display.textContent = "DNF";
                isInspecting = false;
                saveTime(0, true, false);
            }
        }, 1000);
    } else {
        if (isInspecting) {
            clearInterval(inspectionInterval);
            isInspecting = false;
        }
        running = true;
        if (wrapper) wrapper.classList.add('running-mode');
        if (header) { header.style.opacity = '0'; header.style.pointerEvents = 'none'; }
        display.classList.add('running');
        startTime = Date.now();

        timerInterval = setInterval(() => {
            display.textContent = ((Date.now() - startTime) / 1000).toFixed(2);
        }, 10);
    }
}

function stopTimer(display, wrapper, header) {
    clearInterval(timerInterval);
    running = false;
    justStopped = true;
    
    if (wrapper) wrapper.classList.remove('running-mode');
    if (header) { header.style.opacity = '1'; header.style.pointerEvents = 'auto'; }
    display.classList.remove('running');
    
    const finalTime = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    display.textContent = finalTime.toFixed(2);
    
    saveTime(finalTime, false, false);
    generateScramble();
}

async function saveTime(seconds, isDNF = false, hasPlusTwo = false) {
    const scrambleText = document.getElementById('scramble-generator').innerText.replace(/\[.*?\]\n/, '');
    
    const solveData = {
        time: seconds,
        scramble: scrambleText,
        date: new Date().toISOString(),
        isDNF: isDNF,
        hasPlusTwo: hasPlusTwo,
        // Injeta os metadados do caso sorteado para que a tela History saiba calcular os piores casos
        step: currentCaseDetected ? currentCaseDetected.step : 'all',
        caseId: currentCaseDetected ? currentCaseDetected.id : null,
        caseName: currentCaseDetected ? currentCaseDetected.name : null
    };

    try {
        const savedId = await saveToStore('times', solveData);
        lastSolveId = savedId;
        document.getElementById('quick-actions-panel').classList.remove('hidden');
        await renderStatsPanel();
    } catch(err) {
        console.error("Erro ao salvar tempo", err);
    }
}

async function updateLastSolve(type) {
    if (!lastSolveId) return;
    
    const db = await import('../db.js');
    const solves = await db.getAllFromStore('times');
    const lastSolve = solves.find(s => s.id === lastSolveId);
    
    if (lastSolve) {
        if (type === 'plus2' && !lastSolve.hasPlusTwo) {
            lastSolve.hasPlusTwo = true;
            lastSolve.time += 2;
        } else if (type === 'dnf') {
            lastSolve.isDNF = true;
        }
        await db.saveToStore('times', lastSolve);
        document.getElementById('timer-display').textContent = lastSolve.isDNF ? 'DNF' : lastSolve.time.toFixed(2);
        document.getElementById('quick-actions-panel').classList.add('hidden');
        await renderStatsPanel();
    }
}

// Renderiza o seu painel inferior de médias locais originais
async function renderStatsPanel() {
    const panel = document.getElementById('timer-stats-panel');
    if (!panel) return;

    const rawSolves = await getAllFromStore('times') || [];
    // Filtra apenas resoluções pertencentes ao modo selecionado para manter as estatísticas precisas
    const filtered = rawSolves.filter(s => s.step === currentTimerStep);
    
    if (filtered.length === 0) {
        panel.innerHTML = `<div style="text-align:center; font-size:11px; color:var(--text-muted);">Sem resoluções registradas nesta categoria hoje.</div>`;
        return;
    }

    const totalContagem = filtered.length;
    const lastSolve = filtered[filtered.length - 1];
    const validTimes = filtered.filter(s => !s.isDNF).map(s => s.time);

    const calcAo = (timesArr, n) => {
        if (timesArr.length < n) return '--';
        const lastN = timesArr.slice(-n);
        lastN.sort((a, b) => a - b);
        lastN.pop();
        lastN.shift();
        const sum = lastN.reduce((acc, v) => acc + v, 0);
        return (sum / lastN.length).toFixed(2) + 's';
    };

    const displayCurrent = lastSolve.isDNF ? "DNF" : lastSolve.time.toFixed(2) + (lastSolve.hasPlusTwo ? ' (+2)' : '') + 's';

    panel.innerHTML = `
        <div style="display: flex; gap: 14px; font-size: 12px; color: var(--text-muted); font-weight: 600; background: var(--bg-card); padding: 10px 18px; border-radius: var(--radius-md); border: 1px solid #1e293b; box-shadow: var(--shadow); justify-content: center; align-items: center; flex-wrap: wrap;">
            <span>Última (<span style="color:var(--accent);">#${totalContagem}</span>): <strong style="color: var(--accent); font-family: monospace;">${displayCurrent}</strong></span>
            <span style="color: #1e293b;">|</span>
            <span>ao05: <strong style="color: var(--text-main); font-family: monospace;">${calcAo(validTimes, 5)}</strong></span>
            <span style="color: #1e293b;">|</span>
            <span>ao12: <strong style="color: var(--text-main); font-family: monospace;">${calcAo(validTimes, 12)}</strong></span>
        </div>
    `;
}