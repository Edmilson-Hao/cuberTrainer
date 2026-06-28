import { saveToStore, getAllFromStore, deleteFromStore } from '../db.js';
import { cuberData } from '../data.js';
import { agendarLembreteDeStreak } from '../app.js';

let timerInterval = null;
let startTime = 0;
let running = false;
let isInspecting = false;
let inspectionTime = 15;
let inspectionInterval = null;

let useInspection = false; 
let lastSolveId = null; 
let spacePressed = false; 
let isReadyToStart = false;
let justStopped = false;

// Array na memória para monitorar os tempos gerados APENAS desde que a tela abriu (Sessão Atual)
let currentSessionTimes = [];

let currentTimerStep = 'all'; 
let currentCaseDetected = null;

// Variáveis de controle de movimento por toque:
let touchStartX = 0;
let touchStartY = 0;

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
    
    const header = document.querySelector('header');
    if (header) {
        header.style.opacity = '1';
        header.style.pointerEvents = 'auto';
    }

    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
}

export async function initTimerScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;
    
    // Injeção de estilos para travar seleção de texto e melhorar usabilidade mobile
    container.innerHTML = `
        <style>
            .no-select {
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                -khtml-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
            }
        </style>
        <div class="timer-wrapper no-select" id="timer-wrapper-zone" style="width: 100%; height: 100%; min-height: 70vh; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; cursor: pointer;">
            <div id="achievement-toast-container" class="toast-container"></div>

            <div class="timer-controls" style="margin-bottom: 15px; text-align: center;">
                <label class="toggle-control" style="background: var(--bg-card); border: 1px solid #1e293b; padding: 6px 14px; border-radius: 20px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="chk-inspection" ${useInspection ? 'checked' : ''} style="accent-color: var(--accent);">
                    <span class="control-label" style="font-size: 12px; font-weight: 600; color: var(--text-muted);">Inspeção Opcional (15s)</span>
                </label>
            </div>
            
            <div id="scramble-generator" class="scramble-text" style="text-align: center; font-size: 16px; margin-bottom: 10px; padding: 0 10px;">Gerando Scramble...</div>
            
            <div id="timer-display" class="timer-big" style="font-size: 72px; font-weight: bold; text-align: center; margin: auto 0; font-family: monospace;">0.00</div>
            
            <div id="quick-actions-panel" class="quick-actions-container hidden" style="margin-bottom: 25px; display: flex; gap: 8px; justify-content: center; z-index: 10;">
                <button id="btn-quick-plus2" style="background: #1e293b; color: #eab308; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">+2s</button>
                <button id="btn-quick-dnf" style="background: #1e293b; color: var(--danger); border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">DNF</button>
                <button id="btn-quick-delete" style="background: rgba(239,68,68,0.06); color: var(--danger); border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">🗑️ Apagar</button>
            </div>

            <div id="live-averages" style="width: 100%; display: flex; justify-content: center; margin-top: auto;"></div>
        </div>
    `;

    document.getElementById('chk-inspection').addEventListener('change', (e) => {
        useInspection = e.target.checked;
    });

    generateScramble();
    updateLiveAverages();
    setupTimerEvents();
}

function generateScramble() {
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
    
    const target = document.getElementById('scramble-generator');
    if (target) target.textContent = scramble.join(" ");
}

function setupTimerEvents() {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const zone = document.getElementById('timer-wrapper-zone');
    if (zone) {
        // CORREÇÃO MOBILE: Captura o toque em qualquer lugar da tela ativa para iniciar/parar instantaneamente
        zone.ontouchstart = handleTouchStart;
        zone.ontouchend = handleTouchEnd;
    }

    const p2 = document.getElementById('btn-quick-plus2');
    const dnf = document.getElementById('btn-quick-dnf');
    const del = document.getElementById('btn-quick-delete');
    if (p2) p2.onclick = (e) => { e.stopPropagation(); applyQuickPlusTwo(); };
    if (dnf) dnf.onclick = (e) => { e.stopPropagation(); applyQuickDNF(); };
    if (del) del.onclick = (e) => { e.stopPropagation(); applyQuickDelete(); };
}

function handleKeyDown(e) {
    if (e.code !== 'Space') return;
    e.preventDefault();

    if (running) {
        triggerTimer();
        justStopped = true;
        return;
    }

    if (spacePressed || isInspecting) return;
    spacePressed = true;

    const display = document.getElementById('timer-display');
    if (display) display.classList.add('ready-to-trigger');
    isReadyToStart = true;
}

function handleKeyUp(e) {
    if (e.code !== 'Space') return;
    e.preventDefault();
    spacePressed = false;

    if (justStopped) {
        justStopped = false;
        return;
    }

    if (isReadyToStart) {
        isReadyToStart = false;
        const display = document.getElementById('timer-display');
        if (display) display.classList.remove('ready-to-trigger');
        triggerTimer();
    }
}

function handleTouchStart(e) {
    if (e.target.closest('#quick-actions-panel') || e.target.closest('.timer-controls')) return;
    
    // Captura as coordenadas iniciais do toque
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;

    if (running) {
        triggerTimer();
        justStopped = true;
        return;
    }

    if (isInspecting) return;

    const display = document.getElementById('timer-display');
    if (display) display.style.color = 'var(--success)';
    isReadyToStart = true;
}

function handleTouchEnd(e) {
    if (e.target.closest('#quick-actions-panel') || e.target.closest('.timer-controls')) return;
    
    // Captura onde o toque terminou
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    // Calcula a distância do movimento
    const diffX = Math.abs(touchEndX - touchStartX);
    const diffY = Math.abs(touchEndY - touchStartY);

    // Se o usuário moveu o dedo mais de 15 pixels verticalmente ou horizontalmente, considera um arrasto de tela e cancela o timer!
    if (diffY > 15 || diffX > 15) {
        isReadyToStart = false;
        const display = document.getElementById('timer-display');
        if (display) display.style.color = 'var(--text-bright)';
        return;
    }
    
    if (justStopped) {
        justStopped = false;
        return;
    }
    
    if (isReadyToStart) {
        isReadyToStart = false;
        const display = document.getElementById('timer-display');
        if (display) display.style.color = 'var(--text-bright)';
        triggerTimer();
    }
}

function triggerTimer() {
    const display = document.getElementById('timer-display');
    const wrapper = document.getElementById('timer-wrapper-zone'); 
    const header = document.querySelector('header');

    if (!running && !isInspecting) {
        document.getElementById('quick-actions-panel').classList.add('hidden');
        if (useInspection) {
            isInspecting = true;
            inspectionTime = 15;
            display.textContent = inspectionTime;
            display.classList.add('inspecting');

            inspectionInterval = setInterval(() => {
                inspectionTime--;
                display.textContent = inspectionTime;
                if (inspectionTime <= 0) {
                    clearInterval(inspectionInterval);
                    isInspecting = false;
                    display.textContent = "DNF";
                    saveTime(0, true);
                    generateScramble();
                }
            }, 1000);
        } else {
            startRunningState(display, wrapper, header);
        }
    } else if (isInspecting) {
        clearInterval(inspectionInterval);
        isInspecting = false;
        startRunningState(display, wrapper, header);
    } else if (running) {
        clearInterval(timerInterval);
        running = false;
        
        if (wrapper) wrapper.classList.remove('running-mode');
        if (header) {
            header.style.opacity = '1';
            header.style.pointerEvents = 'auto';
        }
        
        display.classList.remove('running');
        
        const finalTime = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
        saveTime(finalTime, false);
        generateScramble();
    }
}

function startRunningState(display, wrapper, header) {
    running = true;
    if (wrapper) wrapper.classList.add('running-mode');
    if (header) {
        header.style.opacity = '0';
        header.style.pointerEvents = 'none';
    }
    display.classList.remove('inspecting');
    display.classList.add('running');
    startTime = Date.now();
    timerInterval = setInterval(() => {
        display.textContent = ((Date.now() - startTime) / 1000).toFixed(2);
    }, 10);
}

async function saveTime(timeValue, isDnfForced = false) {
    const currentScramble = document.getElementById('scramble-generator').textContent;
    const record = {
        time: timeValue,
        scramble: currentScramble,
        date: new Date().toISOString(),
        step: 'all', 
        isDNF: isDnfForced,
        hasPlusTwo: false
    };

    lastSolveId = await saveToStore('times', record);
    
    // Adiciona o tempo salvo à sessão local ativa
    currentSessionTimes.push({ time: timeValue, isDNF: isDnfForced });
    
    document.getElementById('quick-actions-panel').classList.remove('hidden');
    
    updateLiveAverages();
    import('./dashboard.js').then(dash => { if (dash && dash.renderDashboard) dash.renderDashboard(); });
    
    // CORRIGIDO: Removida a linha duplicada que quebrava o script e adicionado o await seguro
    if (typeof agendarLembreteDeStreak === 'function') {
        await agendarLembreteDeStreak();
    }
}

async function applyQuickPlusTwo() {
    if (!lastSolveId) return;
    const all = await getAllFromStore('times');
    const solve = all.find(x => x.id === lastSolveId);
    if (!solve) return;

    let diff = 2.0;
    if (!solve.hasPlusTwo) {
        solve.hasPlusTwo = true;
        solve.time = parseFloat((solve.time + 2.0).toFixed(2));
    } else {
        solve.hasPlusTwo = false;
        solve.time = parseFloat((solve.time - 2.0).toFixed(2));
        diff = -2.0;
    }
    await saveToStore('times', solve);
    
    if (currentSessionTimes.length > 0) {
        currentSessionTimes[currentSessionTimes.length - 1].time = solve.time;
    }

    document.getElementById('timer-display').textContent = solve.isDNF ? "DNF" : solve.time.toFixed(2);
    updateLiveAverages();
    import('./dashboard.js').then(dash => { if (dash && dash.renderDashboard) dash.renderDashboard(); });
}

async function applyQuickDNF() {
    if (!lastSolveId) return;
    const all = await getAllFromStore('times');
    const solve = all.find(x => x.id === lastSolveId);
    if (!solve) return;

    solve.isDNF = !solve.isDNF;
    await saveToStore('times', solve);
    
    if (currentSessionTimes.length > 0) {
        currentSessionTimes[currentSessionTimes.length - 1].isDNF = solve.isDNF;
    }

    document.getElementById('timer-display').textContent = solve.isDNF ? "DNF" : solve.time.toFixed(2);
    updateLiveAverages();
    import('./dashboard.js').then(dash => { if (dash && dash.renderDashboard) dash.renderDashboard(); });
}

async function applyQuickDelete() {
    if (!lastSolveId) return;
    await deleteFromStore('times', lastSolveId);
    
    currentSessionTimes.pop();

    document.getElementById('timer-display').textContent = "0.00";
    document.getElementById('quick-actions-panel').classList.add('hidden');
    lastSolveId = null;
    updateLiveAverages();
    import('./dashboard.js').then(dash => { if (dash && dash.renderDashboard) dash.renderDashboard(); });
}

async function updateLiveAverages() {
    const allSolves = await getAllFromStore('times') || [];
    const panel = document.getElementById('live-averages');
    if (!panel) return;

    // Filtra apenas solves do cubo completo 3x3 (step === 'all').
    // Treinos de etapa isolada (cross, f2l, oll, pll) e drills anti-pânico
    // têm step diferente de 'all' e NÃO devem entrar nas médias do cronômetro.
    const fullSolves = allSolves.filter(s => !s.step || s.step === 'all' || s.step === '');

    const totalContagem = fullSolves.length;

    if (totalContagem === 0) {
        panel.innerHTML = `
            <div style="display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); font-weight: 600; justify-content: center; width: 100%; flex-wrap: wrap;">
                <span>Sessão: <strong style="color: var(--text-main);">--</strong></span> |
                <span>ao5: <strong style="color: var(--text-main);">--</strong></span> |
                <span>ao12: <strong style="color: var(--text-main);">--</strong></span> |
                <span>ao50: <strong style="color: var(--text-main);">--</strong></span> |
                <span>ao100: <strong style="color: var(--text-main);">--</strong></span>
            </div>
        `;
        return;
    }

    const validTimes = fullSolves.filter(s => !s.isDNF).map(s => s.time);
    const lastSolve = fullSolves[fullSolves.length - 1];
    
    // Função helper para calcular a média WCA cortando o melhor e o pior tempo
    const calcAo = (timesArr, n) => {
        if (timesArr.length < n) return { current: null, color: 'var(--text-main)' };
        
        // Média Atual (últimos N)
        const lastN = timesArr.slice(-n);
        const lastNSorted = [...lastN].sort((a, b) => a - b);
        lastNSorted.pop();
        lastNSorted.shift();
        const currentAvg = lastNSorted.reduce((acc, v) => acc + v, 0) / lastNSorted.length;

        // Média Anterior (para fins de comparação da cor)
        if (timesArr.length >= n + 1) {
            const prevN = timesArr.slice(-(n + 1), -1);
            const prevNSorted = [...prevN].sort((a, b) => a - b);
            prevNSorted.pop();
            prevNSorted.shift();
            const prevAvg = prevNSorted.reduce((acc, v) => acc + v, 0) / prevNSorted.length;
            
            // Se a média atual for maior que a anterior, piorou (Vermelho), caso contrário melhorou/manteve (Verde)
            const color = currentAvg > prevAvg ? '#ef4444' : '#10b981';
            return { text: currentAvg.toFixed(2) + 's', color };
        }

        return { text: currentAvg.toFixed(2) + 's', color: 'var(--text-main)' };
    };

    // Média Simples da Sessão Atual
    let sessionText = '--';
    const validSession = currentSessionTimes.filter(s => !s.isDNF).map(s => s.time);
    if (validSession.length > 0) {
        const sessionSum = validSession.reduce((acc, v) => acc + v, 0);
        sessionText = (sessionSum / validSession.length).toFixed(2) + 's';
    }

    const resAo5 = calcAo(validTimes, 5);
    const resAo12 = calcAo(validTimes, 12);
    const resAo50 = calcAo(validTimes, 50);
    const resAo100 = calcAo(validTimes, 100);

    const displayCurrent = lastSolve.isDNF ? "DNF" : lastSolve.time.toFixed(2) + (lastSolve.hasPlusTwo ? ' (+2)' : '') + 's';

    panel.innerHTML = `
        <div style="display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); font-weight: 600; background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid #1e293b; box-shadow: var(--shadow); justify-content: center; align-items: center; flex-wrap: wrap; width: 100%; max-width: 480px; margin: 0 auto;">
            <span>Última (<span style="color:var(--accent);">#${totalContagem}</span>): <strong style="color: var(--accent); font-family: monospace;">${displayCurrent}</strong></span>
            <span style="color: #1e293b;">|</span>
            <span>Sessão: <strong style="color: var(--text-main); font-family: monospace;">${sessionText}</strong></span>
            <span style="color: #1e293b;">|</span>
            <span>ao5: <strong style="color: ${resAo5.color}; font-family: monospace;">${resAo5.text || '--'}</strong></span>
            <span style="color: #1e293b;">|</span>
            <span>ao12: <strong style="color: ${resAo12.color}; font-family: monospace;">${resAo12.text || '--'}</strong></span>
            <span style="color: #1e293b;">|</span>
            <span>ao50: <strong style="color: ${resAo50.color}; font-family: monospace;">${resAo50.text || '--'}</strong></span>
            <span style="color: #1e293b;">|</span>
            <span>ao100: <strong style="color: ${resAo100.color}; font-family: monospace;">${resAo100.text || '--'}</strong></span>
        </div>
    `;
}

export function getCurrentSessionSolves() {
    return currentSessionTimes;
}