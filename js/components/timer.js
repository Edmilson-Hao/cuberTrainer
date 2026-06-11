import { saveToStore, getAllFromStore, deleteFromStore } from '../db.js';

let timerInterval = null;
let startTime = 0;
let running = false;
let isInspecting = false;
let inspectionTime = 15;
let inspectionInterval = null;

// 📌 MODIFICAÇÃO 3: Inspeção vem DESATIVADA (false) por padrão agora
let useInspection = false; 

let lastSolveId = null; 
let spacePressed = false; // Controle para evitar disparos contínuos no teclado
let touchStartTimer = null; // Controle de tempo para o clique e segura no mobile

export async function initTimerScreen() {
    const container = document.getElementById('app-container');
    
    container.innerHTML = `
        <div class="timer-wrapper">
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
    // Remove listeners antigos para evitar duplicações de memória
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    
    // 💻 Listeners para Computador (Teclado)
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 📱 Listeners para Celular (Touch)
    const display = document.getElementById('timer-display');
    if (display) {
        display.removeEventListener('touchstart', handleTouchStart);
        display.removeEventListener('touchend', handleTouchEnd);
        
        display.addEventListener('touchstart', handleTouchStart, { passive: false });
        display.addEventListener('touchend', handleTouchEnd);
    }
}

// 💻 LOGICA DE TECLADO (PC)
function handleKeyDown(e) {
    if (e.code !== 'Space' || document.activeElement.tagName === 'BUTTON') return;
    e.preventDefault();

    if (running) {
        // Se já está rodando, qualquer toque para o cronômetro imediatamente
        stopTimerLogic();
    } else if (!spacePressed && !isInspecting) {
        // Se está parado, muda de cor indicando que está pronto para soltar
        spacePressed = true;
        const display = document.getElementById('timer-display');
        if (display) display.classList.add('ready-to-trigger'); 
    }
}

function handleKeyUp(e) {
    if (e.code !== 'Space' || document.activeElement.tagName === 'BUTTON') return;
    e.preventDefault();

    if (spacePressed) {
        spacePressed = false;
        const display = document.getElementById('timer-display');
        if (display) display.classList.remove('ready-to-trigger');
        
        // Só inicia o tempo quando SOLTAR a barra de espaço (Padrão de campeonatos)
        startTimerLogic();
    }
}

// 📱 LÓGICA DE TOQUE (CELULAR - SEGURAR E SOLTAR)
function handleTouchStart(e) {
    if (document.activeElement.tagName === 'BUTTON') return;
    e.preventDefault();

    if (running) {
        stopTimerLogic();
    } else if (!isInspecting) {
        const display = document.getElementById('timer-display');
        if (display) display.classList.add('ready-to-trigger');
        
        // Exige segurar por pelo menos 150ms para simular o Stackmat real
        touchStartTimer = setTimeout(() => {
            touchStartTimer = true; 
        }, 150);
    }
}

function handleTouchEnd(e) {
    if (running || isInspecting) return;
    
    const display = document.getElementById('timer-display');
    if (display) display.classList.remove('ready-to-trigger');

    if (touchStartTimer === true) {
        // Soltou após o tempo mínimo de retenção
        startTimerLogic();
    } else if (touchStartTimer) {
        // Soltou rápido demais antes dos 150ms
        clearTimeout(touchStartTimer);
    }
    touchStartTimer = null;
}

// Inicializa a contagem ou inspeção
function startTimerLogic() {
    const display = document.getElementById('timer-display');
    const wrapper = document.querySelector('.timer-wrapper');
    const header = document.querySelector('header');
    const actionsPanel = document.getElementById('quick-actions-panel');

    if (actionsPanel) actionsPanel.classList.add('hidden');

    if (useInspection && !isInspecting) {
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
                isInspecting = false;
                saveTime(0, true); // Salva como DNF automaticamente
            }
        }, 1000);
    } else {
        if (isInspecting) {
            clearInterval(inspectionInterval);
            isInspecting = false;
        }
        
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
}

// Interrompe o cronômetro e salva o resultado
function stopTimerLogic() {
    clearInterval(timerInterval);
    running = false;
    
    const display = document.getElementById('timer-display');
    const wrapper = document.querySelector('.timer-wrapper');
    const header = document.querySelector('header');
    
    if (wrapper) wrapper.classList.remove('running-mode');
    if (header) {
        header.style.opacity = '1';
        header.style.pointerEvents = 'auto';
    }
    
    if (display) display.classList.remove('running');
    const finalTime = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    saveTime(finalTime);
    generateScramble();
}

// ... O resto das suas funções (saveTime, updateLiveAverages, etc.) continuam iguais abaixo ...
export function clearTimerState() {
    clearInterval(timerInterval);
    clearInterval(inspectionInterval);
    window.removeEventListener('keydown', handleTrigger);
    running = false;
    isInspecting = false;
    lastSolveId = null;
    
    const header = document.querySelector('header');
    if (header) {
        header.style.opacity = '1';
        header.style.pointerEvents = 'auto';
    }
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

// 👑 FUNÇÃO ATUALIZADA: Deteta Recordes Pessoais e Entrada no Top 12 antes de salvar
async function saveTime(timeValue, isDNF = false) {
    const allSolves = await getAllFromStore('times');
    // Filtra apenas os tempos válidos (não DNF) e ordena do menor para o maior
    const validSolves = allSolves.filter(s => !s.isDNF).sort((a, b) => a.time - b.time);

    let achievementType = null;

    if (!isDNF) {
        if (validSolves.length === 0) {
            // Se for o primeiro tempo válido da história do app, é um PB inicial!
            achievementType = 'pb';
        } else {
            const currentPB = validSolves[0].time;
            
            if (timeValue < currentPB) {
                // 👑 NOVO RECORDE PESSOAL ABSOLUTO (Melhor que o #1 atual)
                achievementType = 'pb';
            } else if (validSolves.length < 12) {
                // Ainda não tem 12 tempos no banco, então qualquer tempo novo entra no Top 12
                achievementType = 'top12';
            } else if (timeValue < validSolves[11].time) {
                // Tem mais de 12 tempos, mas o tempo atual é melhor que o 12º colocado
                achievementType = 'top12';
            }
        }
    }

    const newSolve = {
        time: timeValue,
        isDNF: isDNF,
        date: new Date().toISOString(),
        scramble: document.getElementById('scramble-generator').textContent
    };
    
    const id = await saveToStore('times', newSolve);
    lastSolveId = id; 
    
    const actionsPanel = document.getElementById('quick-actions-panel');
    if (actionsPanel) actionsPanel.classList.remove('hidden');

    updateLiveAverages();

    // Dispara o alerta correto (nunca os dois ao mesmo tempo)
    if (achievementType) {
        triggerAchievementToast(achievementType, timeValue);
    }
}

// Constrói e exibe a notificação flutuante na tela
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

    // Remove o elemento após o término das animações de fade out (4 segundos)
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
        document.getElementById('timer-display').textContent = "DNF";
        document.getElementById('quick-actions-panel').classList.add('hidden');
        updateLiveAverages();
    }
}

async function deleteLastSolve() {
    if (!lastSolveId) return;
    await deleteFromStore('times', lastSolveId);
    document.getElementById('timer-display').textContent = "0.00";
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
        lastN.pop();
        lastN.shift();
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