import { saveToStore, getAllFromStore, deleteFromStore } from '../db.js';

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

    // Remove listeners globais para evitar duplicação em reinicializações futuras
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
}

export async function initTimerScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="timer-wrapper" id="timer-wrapper-zone">
            <div id="achievement-toast-container" class="toast-container"></div>

            <div class="timer-controls" style="margin-bottom: 25px;">
                <label class="toggle-control" style="background: var(--bg-card); border: 1px solid #1e293b; padding: 6px 14px; border-radius: 20px; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="chk-inspection" ${useInspection ? 'checked' : ''} style="accent-color: var(--accent);">
                    <span class="control-label" style="font-size: 12px; font-weight: 600; color: var(--text-muted);">Inspeção Opcional (15s)</span>
                </label>
            </div>
            
            <div id="scramble-generator" class="scramble-text">Gerando Scramble...</div>
            
            <div id="timer-display" class="timer-big">0.00</div>
            
            <div id="quick-actions-panel" class="quick-actions-container hidden" style="margin-bottom: 25px; display: flex; gap: 8px; justify-content: center;">
                <button id="btn-quick-plus2" style="background: #1e293b; color: #eab308; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.15s;">+2s</button>
                <button id="btn-quick-dnf" style="background: #1e293b; color: var(--danger); border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.15s;">DNF</button>
                <button id="btn-quick-delete" style="background: rgba(239,68,68,0.06); color: var(--danger); border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.15s;">🗑️ Apagar</button>
            </div>

            <div id="live-averages" style="width: 100%; display: flex; justify-content: center;"></div>
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
        zone.ontouchstart = handleTouchStart;
        zone.ontouchend = handleTouchEnd;
    }

    const p2 = document.getElementById('btn-quick-plus2');
    const dnf = document.getElementById('btn-quick-dnf');
    const del = document.getElementById('btn-quick-delete');
    if (p2) p2.onclick = applyQuickPlusTwo;
    if (dnf) dnf.onclick = applyQuickDNF;
    if (del) del.onclick = applyQuickDelete;
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
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('label')) return;
    e.preventDefault();

    if (running) {
        triggerTimer();
        justStopped = true;
        return;
    }

    if (isInspecting) return;

    const display = document.getElementById('timer-display');
    if (display) display.classList.add('ready-to-trigger');
    isReadyToStart = true;
}

function handleTouchEnd(e) {
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
    document.getElementById('quick-actions-panel').classList.remove('hidden');
    
    updateLiveAverages();

    import('./dashboard.js').then(dash => { if (dash && dash.renderDashboard) dash.renderDashboard(); });
}

async function applyQuickPlusTwo() {
    if (!lastSolveId) return;
    const all = await getAllFromStore('times');
    const solve = all.find(x => x.id === lastSolveId);
    if (!solve) return;

    if (!solve.hasPlusTwo) {
        solve.hasPlusTwo = true;
        solve.time = parseFloat((solve.time + 2.0).toFixed(2));
    } else {
        solve.hasPlusTwo = false;
        solve.time = parseFloat((solve.time - 2.0).toFixed(2));
    }
    await saveToStore('times', solve);
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
    document.getElementById('timer-display').textContent = solve.isDNF ? "DNF" : solve.time.toFixed(2);
    updateLiveAverages();
    import('./dashboard.js').then(dash => { if (dash && dash.renderDashboard) dash.renderDashboard(); });
}

async function applyQuickDelete() {
    if (!lastSolveId) return;
    await deleteFromStore('times', lastSolveId);
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

    const totalContagem = allSolves.length;

    if (totalContagem === 0) {
        panel.innerHTML = `
            <div style="display: flex; gap: 16px; font-size: 12px; color: var(--text-muted); font-weight: 600; justify-content: center; width: 100%;">
                <span>Última: <strong style="color: var(--text-main);">--</strong></span> |
                <span>ao05: <strong style="color: var(--text-main);">--</strong></span> |
                <span>ao12: <strong style="color: var(--text-main);">--</strong></span> |
                <span>ao50: <strong style="color: var(--text-main);">--</strong></span>
            </div>
        `;
        return;
    }

    const validTimes = allSolves.filter(s => !s.isDNF).map(s => s.time);
    const lastSolve = allSolves[allSolves.length - 1];
    
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
            <span style="color: #1e293b;">|</span>
            <span>ao50: <strong style="color: var(--text-main); font-family: monospace;">${calcAo(validTimes, 50)}</strong></span>
        </div>
    `;
}