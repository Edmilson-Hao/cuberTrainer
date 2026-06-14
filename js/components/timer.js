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
let touchStartTimer = null; 
let isReadyToStart = false; // Novo estado: monitora se o tempo de retenção foi atingido

let justStopped = false;

export async function initTimerScreen() {
    const container = document.getElementById('app-container');
    
    container.innerHTML = `
        <div class="timer-wrapper" id="timer-wrapper-zone">
            <div id="achievement-toast-container" class="toast-container"></div>

            <div class="timer-controls">
                <label class="toggle-control">
                    <input type="checkbox" id="chk-inspection" ${useInspection ? 'checked' : ''}>
                    <span class="control-label">Inspeção (15s)</span>
                </label>
            </div>
            
            <div id="scramble-generator" class="scramble-text">Gerando Scramble...</div>
            <div id="timer-display" class="timer-big">0.00</div>
            
            <div id="quick-actions-panel" class="quick-actions-container hidden">
                <button id="btn-dnf-last" class="btn-action-small btn-dnf">DNF</button>
                <button id="btn-delete-last" class="btn-action-small btn-delete">Apagar</button>
            </div>

            <div class="timer-stats-panel" id="live-averages">
                <p>ao05: -- | ao12: -- | ao50: -- | ao100: --</p>
            </div>
        </div>
    `;

    document.getElementById('chk-inspection').addEventListener('change', (e) => {
        useInspection = e.target.checked;
    });

    document.getElementById('btn-dnf-last').addEventListener('click', markLastAsDNF);
    document.getElementById('btn-delete-last').addEventListener('click', deleteLastSolve);

    updateLiveAverages();
    setupTimerEvents();
    generateScramble();
}

function setupTimerEvents() {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const wrapper = document.getElementById('timer-wrapper-zone');
    if (wrapper) {
        wrapper.removeEventListener('touchstart', handleTouchStart);
        wrapper.removeEventListener('touchend', handleTouchEnd);
        wrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
        wrapper.addEventListener('touchend', handleTouchEnd);
    }
}

function handleKeyDown(e) {
    if (e.code !== 'Space' || document.activeElement.tagName === 'BUTTON') return;
    e.preventDefault();

    if (running) {
        stopTimerLogic();
        return;
    }

    if (!spacePressed && !isInspecting) {
        spacePressed = true;
        isReadyToStart = false;

        const display = document.getElementById('timer-display');
        if (display) {
            display.textContent = "0.00";
            display.classList.remove('ready-to-trigger');
            display.classList.add('holding-down');
        }

        touchStartTimer = setTimeout(() => {
            isReadyToStart = true;
            if (display && spacePressed) {
                display.classList.remove('holding-down');
                display.classList.add('ready-to-trigger');
            }
        }, 300);
    }
}

function handleKeyUp(e) {
    if (e.code !== 'Space' || document.activeElement.tagName === 'BUTTON') return;
    e.preventDefault();

    if (spacePressed) {
        spacePressed = false;
        clearTimeout(touchStartTimer);

        const display = document.getElementById('timer-display');
        if (display) display.classList.remove('holding-down', 'ready-to-trigger');

        if (isReadyToStart) startTimerLogic();
    }
}

function handleTouchStart(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('.timer-controls')) return;
    e.preventDefault(); e.stopPropagation();

    if (running) {
        stopTimerLogic();
        return;
    }

    if (!isInspecting) {
        isReadyToStart = false;
        const display = document.getElementById('timer-display');
        if (display) {
            display.textContent = "0.00";
            display.classList.remove('ready-to-trigger');
            display.classList.add('holding-down');
        }

        touchStartTimer = setTimeout(() => {
            isReadyToStart = true;
            if (display) {
                display.classList.remove('holding-down');
                display.classList.add('ready-to-trigger');
            }
        }, 300);
    }
}

function handleTouchEnd(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('.timer-controls')) return;
    e.preventDefault(); e.stopPropagation();

    if (running || isInspecting) return;
    clearTimeout(touchStartTimer);

    const display = document.getElementById('timer-display');
    if (display) display.classList.remove('holding-down', 'ready-to-trigger');

    if (isReadyToStart) {
        isReadyToStart = false;
        startTimerLogic();
    }
}

function startTimerLogic() {
    const display = document.getElementById('timer-display');
    const wrapper = document.querySelector('.timer-wrapper');
    const header = document.querySelector('header');
    const actionsPanel = document.getElementById('quick-actions-panel');

    if (actionsPanel) actionsPanel.classList.add('hidden');

    if (useInspection && !isInspecting) {
        isInspecting = true;
        inspectionTime = 15;
        if (display) {
            display.classList.add('inspecting');
            display.textContent = inspectionTime;
        }
        
        inspectionInterval = setInterval(() => {
            inspectionTime--;
            if (display) display.textContent = inspectionTime;
            if (inspectionTime <= 0) {
                clearInterval(inspectionInterval);
                if (display) display.textContent = "DNF";
                isInspecting = false;
                saveTime(0, true);
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
        if (display) {
            display.classList.remove('inspecting');
            display.classList.add('running');
        }
        startTime = Date.now();
        timerInterval = setInterval(() => {
            if (display) display.textContent = ((Date.now() - startTime) / 1000).toFixed(2);
        }, 10);
    }
}

function stopTimerLogic() {
    clearInterval(timerInterval);
    running = false;
    
    const display = document.getElementById('timer-display');
    const wrapper = document.querySelector('.timer-wrapper');
    const header = document.querySelector('header');
    
    if (wrapper) wrapper.classList.remove('running-mode');
    if (header) { header.style.opacity = '1'; header.style.pointerEvents = 'auto'; }
    if (display) display.classList.remove('running');
    
    const finalTime = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    saveTime(finalTime);
    generateScramble();
}

function generateScramble() {
    const moves = ["R", "L", "U", "D", "F", "B", "R'", "L'", "U'", "D'", "F'", "B'", "R2", "L2", "U2", "D2", "F2", "B2"];
    let scramble = [];
    let lastMove = "";
    
    for (let i = 0; i < 20; i++) {
        let move;
        do {
            move = moves[Math.floor(Math.random() * moves.length)];
        } while (move.charAt(0) === lastMove.charAt(0));
        scramble.push(move);
        lastMove = move;
    }
    const elem = document.getElementById('scramble-generator');
    if (elem) elem.textContent = scramble.join(" ");
}

async function saveTime(timeValue, isDNF = false) {
    const allSolves = await getAllFromStore('times');
    const validSolves = allSolves.filter(s => !s.isDNF).sort((a, b) => a.time - b.time);

    let achievementType = null;
    if (!isDNF) {
        if (validSolves.length === 0) {
            achievementType = 'pb';
        } else {
            const currentPB = validSolves[0].time;
            if (timeValue < currentPB) {
                achievementType = 'pb';
            } else if (validSolves.length < 12) {
                achievementType = 'top12';
            } else if (timeValue < validSolves[11].time) {
                achievementType = 'top12';
            }
        }
    }

    const newSolve = {
        time: timeValue,
        isDNF: isDNF,
        hasPlusTwo: false, // 🛡️ INTEGRAÇÃO: Propriedade necessária para o gerenciador do histórico
        step: 'global',    // 🛡️ INTEGRAÇÃO: Identifica que veio de treinos livres do timer principal
        date: new Date().toISOString(),
        scramble: document.getElementById('scramble-generator')?.textContent || ""
    };
    
    const id = await saveToStore('times', newSolve);
    lastSolveId = id; 
    
    const actionsPanel = document.getElementById('quick-actions-panel');
    if (actionsPanel) actionsPanel.classList.remove('hidden');

    updateLiveAverages();

    if (achievementType) {
        triggerAchievementToast(achievementType, timeValue);
    }
}

function triggerAchievementToast(type, time) {
    const container = document.getElementById('achievement-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `achievement-toast ${type}`;

    if (type === 'pb') {
        toast.innerHTML = `
            <div class="toast-icon">👑</div>
            <div class="toast-content">
                <h4>NOVO RECORDE PESSOAL!</h4>
                <p>Incrível! Você baixou seu melhor tempo para <strong>${time}s</strong></p>
            </div>
        `;
    } else if (type === 'top12') {
        toast.innerHTML = `
            <div class="toast-icon">🏆</div>
            <div class="toast-content">
                <h4>ENTROU NO TOP 12!</h4>
                <p>O tempo de <strong>${time}s</strong> entrou para os seus melhores tempos.</p>
            </div>
        `;
    }

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

async function markLastAsDNF() {
    if (!lastSolveId) return;
    const allSolves = await getAllFromStore('times');
    const solve = allSolves.find(s => s.id === lastSolveId);
    if (solve) {
        solve.isDNF = true;
        await saveToStore('times', solve);
        const display = document.getElementById('timer-display');
        if (display) display.textContent = "DNF";
        document.getElementById('quick-actions-panel').classList.add('hidden');
        updateLiveAverages();
    }
}

async function deleteLastSolve() {
    if (!lastSolveId) return;
    await deleteFromStore('times', lastSolveId);
    const display = document.getElementById('timer-display');
    if (display) display.textContent = "0.00";
    document.getElementById('quick-actions-panel').classList.add('hidden');
    lastSolveId = null;
    updateLiveAverages();
}

async function updateLiveAverages() {
    const allSolves = await getAllFromStore('times');
    const panel = document.getElementById('live-averages');
    if (!panel) return;
    if (allSolves.length === 0) {
        panel.innerHTML = `<p>ao05: -- | ao12: -- | ao50: -- | ao100: --</p>`;
        return;
    }

    const validTimes = allSolves.filter(s => !s.isDNF).map(s => s.time);
    const lastSolve = allSolves[allSolves.length - 1];
    
    const calcAo = (timesArr, n) => {
        if (timesArr.length < n) return '--';
        const lastN = timesArr.slice(-n);
        lastN.sort((a, b) => a - b);
        lastN.pop(); lastN.shift();
        const sum = lastN.reduce((acc, v) => acc + v, 0);
        return (sum / lastN.length).toFixed(2);
    };

    const displayCurrent = lastSolve.isDNF ? "DNF" : `${lastSolve.time.toFixed(2)}s`;

    panel.innerHTML = `
        <p>Último: <strong>${displayCurrent}</strong> | 
           ao05: <strong>${calcAo(validTimes, 5)}s</strong> | 
           ao12: <strong>${calcAo(validTimes, 12)}s</strong> | 
           ao50: <strong>${calcAo(validTimes, 50)}s</strong> | 
           ao100: <strong>${calcAo(validTimes, 100)}s</strong></p>
    `;
}

export function clearTimerState() {
    clearInterval(timerInterval);
    clearInterval(inspectionInterval);
    running = false;
    isInspecting = false;
    lastSolveId = null;
    const header = document.querySelector('header');
    if (header) { header.style.opacity = '1'; header.style.pointerEvents = 'auto'; }
}

function handleTrigger(e) {
    if (e.code === 'Space') {
        e.preventDefault();
    }
    if (document.activeElement.tagName === 'BUTTON') return;

    if (e.code === 'Space' || e.type === 'touchstart') {
        triggerTimerLogic();
    }
}

function triggerTimerLogic() {
    const display = document.getElementById('timer-display');
    const wrapper = document.querySelector('.timer-wrapper');
    const header = document.querySelector('header');
    const actionsPanel = document.getElementById('quick-actions-panel');

    if (!running && !isInspecting) {
        if (actionsPanel) actionsPanel.classList.add('hidden');
        
        if (useInspection) {
            isInspecting = true;
            inspectionTime = 15;
            display.classList.add('inspecting');
            display.textContent = inspectionTime;
            
            inspectionInterval = setInterval(() => {
                inspectionTime--;
                display.textContent = inspectionTime;
                if (inspectionTime <= 0) {
                    clearInterval(inspectionInterval);
                    display.textContent = "DNF";
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
        saveTime(finalTime);
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