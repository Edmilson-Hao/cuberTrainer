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
    
    // 💻 Computador (Teclado)
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 📱 Celular (Toque em QUALQUER lugar do timer-wrapper)
    const wrapper = document.getElementById('timer-wrapper-zone');
    if (wrapper) {
        wrapper.removeEventListener('touchstart', handleTouchStart);
        wrapper.removeEventListener('touchend', handleTouchEnd);
        
        wrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
        wrapper.addEventListener('touchend', handleTouchEnd);
    }
}

// 💻 LÓGICA DE TECLADO (PC)
function handleKeyDown(e) {
    if (e.code !== 'Space' || document.activeElement.tagName === 'BUTTON') return;
    e.preventDefault();

    // 1. Se estiver rodando, apenas para o tempo na hora e ignora o resto
    if (running) {
        stopTimerLogic();
        return;
    }

    // 2. Se já estiver parado e a barra de espaço não estiver travada/pressionada
    if (!spacePressed && !isInspecting) {
        spacePressed = true;
        isReadyToStart = false;

        const display = document.getElementById('timer-display');
        if (display) {
            display.textContent = "0.00"; // Zera o cronômetro
            display.classList.remove('ready-to-trigger');
            display.classList.add('holding-down'); // Fica Vermelho
        }

        // Se continuar segurando por 300ms, valida para iniciar
        touchStartTimer = setTimeout(() => {
            isReadyToStart = true;
            if (display && spacePressed) {
                display.classList.remove('holding-down');
                display.classList.add('ready-to-trigger'); // Fica Verde
            }
        }, 300);
    }
}

function handleKeyUp(e) {
    if (e.code !== 'Space' || document.activeElement.tagName === 'BUTTON') return;
    e.preventDefault();

    // Só processa o levantamento da tecla se ela foi usada para tentar iniciar
    if (spacePressed) {
        spacePressed = false;
        clearTimeout(touchStartTimer);

        const display = document.getElementById('timer-display');
        if (display) {
            display.classList.remove('holding-down', 'ready-to-trigger');
        }

        // Só inicia se segurou o suficiente para ficar verde
        if (isReadyToStart) {
            startTimerLogic();
        }
    }
}

// 📱 LÓGICA DE TOQUE (CELULAR - EM QUALQUER PARTE DO WRAPPER)
function handleTouchStart(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('.timer-controls')) return;
    e.preventDefault();
    e.stopPropagation();

    // 1. Se estiver rodando, apenas para o tempo na hora e ignora o resto
    if (running) {
        stopTimerLogic();
        return;
    }

    // 2. Se estiver parado, inicia o processo de preparação
    if (!isInspecting) {
        isReadyToStart = false;
        const display = document.getElementById('timer-display');

        if (display) {
            display.textContent = "0.00"; // Zera o cronômetro
            display.classList.remove('ready-to-trigger');
            display.classList.add('holding-down'); // Fica Vermelho
        }

        // Se continuar segurando por 300ms, valida para iniciar
        touchStartTimer = setTimeout(() => {
            isReadyToStart = true;
            if (display) {
                display.classList.remove('holding-down');
                display.classList.add('ready-to-trigger'); // Fica Verde
            }
        }, 300);
    }
}

function handleTouchEnd(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('.timer-controls')) return;
    e.preventDefault();
    e.stopPropagation();

    // Se o cronômetro acabou de ser ativado ou está em inspeção, não inicia nada no levantamento do dedo
    if (running || isInspecting) return;

    // Se o usuário tirou o dedo antes dos 300ms (desistiu ou não deu o tempo), cancela
    clearTimeout(touchStartTimer);

    const display = document.getElementById('timer-display');
    if (display) {
        display.classList.remove('holding-down', 'ready-to-trigger');
    }

    // Só dispara se chegou a ficar verde
    if (isReadyToStart) {
        isReadyToStart = false; // Reseta para a próxima rodada
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
        display.classList.add('inspecting');
        display.textContent = inspectionTime;
        
        inspectionInterval = setInterval(() => {
            inspectionTime--;
            display.textContent = inspectionTime;
            if (inspectionTime <= 0) {
                clearInterval(inspectionInterval);
                display.textContent = "DNF";
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