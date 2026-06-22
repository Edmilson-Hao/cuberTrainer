import { cuberData, getImagePath } from '../data.js';
import { getAllFromStore, saveToStore } from '../db.js';
// Importação correta na mesma pasta de componentes
import { gerarScrambleInverso, decomporAlgoritmo } from './scrambler.js';

// Máquina de Estados e Variáveis de Controle Global do Treinador
let modoTreinoAtual = 'workout'; // 'workout' (Padrão inicial agora), 'metronome' ou 'antipanic'
let filaDeCasosAtiva = [];
let indexCasoAtual = 0;

// Estado do Modo de Metas Diárias (Workout)
let currentWorkoutStep = 'cross'; // 'cross', 'f2l', 'oll', 'pll'
let workoutTimerInterval = null;
let workoutStartTime = 0;
let isWorkoutTimerRunning = false;
let workoutEspacoPressionado = false;

// Estado do Metrônomo (Otimizado com Auto-Restart e Bipes Exclusivos)
let tpsAlvo = 4.0;
let audioCtx = null;
let metronomeIntervalId = null;
let timeoutReiniciarId = null; // Controla a folga de 0.5s antes de reiniciar automaticamente
let movimentosDecompostos = [];
let indexMovimentoMetronome = 0;
let cronometroMetronomeStart = 0;
let deVoltaNoLoop = false; // Flag para rastrear e disparar o som diferenciado de reinício

// Estado do Modo Antipânico (Engine Stackmat)
let tempoStartAntipanic = 0;
let segurandoEspaco = false;
let temporizadorPronto = false;
let timeoutSegurarId = null;
let cronometroRodandoAntipanic = false;
let intervaloCronometroId = null;

/**
 * Inicializador principal da tela de Treino
 */
export async function initTrainerScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;

    // Renderiza o seletor com 3 abas agora, incluindo o novo ecossistema "Treinar por Metas"
    container.innerHTML = `
        <div class="trainer-screen" style="width: 100%; max-width: 600px; margin: 0 auto; padding: 10px; box-sizing: border-box;">
            
            <div class="tab-selector" style="display: flex; gap: 6px; background: rgba(2, 6, 23, 0.5); padding: 6px; border-radius: var(--radius-md, 8px); margin-bottom: 20px; border: 1px solid rgba(88, 110, 117, 0.2); width: 100%; box-sizing: border-box;">
                <button id="btn-modo-workout" class="${modoTreinoAtual === 'workout' ? 'active' : ''}" style="flex: 1; padding: 12px 6px; font-size: 12px; font-weight: bold; border: none; border-radius: var(--radius-sm, 6px); cursor: pointer; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    🎯 Metas do Dia
                </button>
                <button id="btn-modo-metronome" class="${modoTreinoAtual === 'metronome' ? 'active' : ''}" style="flex: 1; padding: 12px 6px; font-size: 12px; font-weight: bold; border: none; border-radius: var(--radius-sm, 6px); cursor: pointer; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    ⏱️ Metrônomo
                </button>
                <button id="btn-modo-antipanic" class="${modoTreinoAtual === 'antipanic' ? 'active' : ''}" style="flex: 1; padding: 12px 6px; font-size: 12px; font-weight: bold; border: none; border-radius: var(--radius-sm, 6px); cursor: pointer; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    🔥 Antipânico
                </button>
            </div>

            <div id="trainer-workspace" style="width: 100%; box-sizing: border-box;"></div>
        </div>
    `;

    // Vincula os seletores à máquina de estados expandida
    document.getElementById('btn-modo-workout').addEventListener('click', () => {
        mudarModoTreino('workout');
    });
    document.getElementById('btn-modo-metronome').addEventListener('click', () => {
        mudarModoTreino('metronome');
    });
    document.getElementById('btn-modo-antipanic').addEventListener('click', () => {
        mudarModoTreino('antipanic');
    });

    // Inicia o processamento baseado na aba ativa
    await carregarFilaDeCasos();
}

/**
 * Altera a máquina de estados e limpa loops em background
 */
function mudarModoTreino(novoModo) {
    limparLoopsTreinador();
    modoTreinoAtual = novoModo;
    initTrainerScreen();
}

/**
 * Limpa processos de áudio ou cronômetro ativos para evitar vazamento de memória
 */
function limparLoopsTreinador() {
    // 1. Limpa todos os loops de cronometragem ativos
    if (metronomeIntervalId) {
        clearInterval(metronomeIntervalId);
        metronomeIntervalId = null;
    }
    if (timeoutReiniciarId) {
        clearTimeout(timeoutReiniciarId);
        timeoutReiniciarId = null;
    }
    if (intervaloCronometroId) {
        clearInterval(intervaloCronometroId);
        intervaloCronometroId = null;
    }
    if (workoutTimerInterval) {
        clearInterval(workoutTimerInterval);
        workoutTimerInterval = null;
    }

    // 2. Remove listeners globais vinculados ao modo de metas (Workout)
    if (window._workoutKeyDownRef) {
        window.removeEventListener('keydown', window._workoutKeyDownRef);
        window._workoutKeyDownRef = null;
    }
    if (window._workoutKeyUpRef) {
        window.removeEventListener('keyup', window._workoutKeyUpRef);
        window._workoutKeyUpRef = null;
    }
    if (window._workoutKeyRef) {
        window.removeEventListener('keydown', window._workoutKeyRef);
        window._workoutKeyRef = null;
    }

    // 3. Remove listeners globais vinculados ao modo Antipânico
    if (typeof gerenciarKeyDownAntipanic !== 'undefined') {
        window.removeEventListener('keydown', gerenciarKeyDownAntipanic);
    }
    if (typeof gerenciarKeyUpAntipanic !== 'undefined') {
        window.removeEventListener('keyup', gerenciarKeyUpAntipanic);
    }

    // 4. Reseta as flags e estados de execução para o ponto neutro
    isWorkoutTimerRunning = false;
    workoutEspacoPressionado = false;
    cronometroRodandoAntipanic = false;
    segurandoEspaco = false;
    temporizadorPronto = false;
    deVoltaNoLoop = false;
}

/**
 * Carrega e ordena os algoritmos dinamicamente cruzando dados com o IndexedDB
 */
async function carregarFilaDeCasos() {
    limparLoopsTreinador();
    
    let todosOsCasos = [];
    if (cuberData.oll) todosOsCasos = todosOsCasos.concat(cuberData.oll.map(c => ({ ...c, grupo: 'oll' })));
    if (cuberData.pll) todosOsCasos = todosOsCasos.concat(cuberData.pll.map(c => ({ ...c, grupo: 'pll' })));

    if (modoTreinoAtual === 'workout') {
        renderizarModoWorkout();
    } else if (modoTreinoAtual === 'metronome') {
        filaDeCasosAtiva = todosOsCasos;
        indexCasoAtual = 0;
        renderizarModoMetronome();
    } else {
        const statusWorkspace = document.getElementById('trainer-workspace');
        if (statusWorkspace) statusWorkspace.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding: 20px;">Analisando estatísticas de performance...</p>';

        const todosOsTempos = await getAllFromStore('times') || [];
        const mapaMedias = new Map();
        
        todosOsCasos.forEach(c => mapaMedias.set(`${c.grupo}_${c.id}`, { caso: c, tempos: [], dnfCount: 0 }));

        todosOsTempos.forEach(s => {
            const chave = s.step;
            if (mapaMedias.has(chave)) {
                const estrutura = mapaMedias.get(chave);
                if (s.isDNF) {
                    estrutura.dnfCount++;
                } else {
                    estrutura.tempos.push(s.time);
                }
            }
        });

        const casosAvaliados = [];
        mapaMedias.forEach((val, chave) => {
            const ultimosTempos = val.tempos.slice(-5);
            const media = ultimosTempos.length > 0 ? (ultimosTempos.reduce((a, b) => a + b, 0) / ultimosTempos.length) : 0;
            const pontuacaoCritica = media + (val.dnfCount * 5);
            casosAvaliados.push({ ...val.caso, mediaReal: media, criticidade: pontuacaoCritica });
        });

        casosAvaliados.sort((a, b) => b.criticidade - a.criticidade);
        filaDeCasosAtiva = casosAvaliados.slice(0, 10);
        indexCasoAtual = 0;

        renderizarModoAntipanic();
    }
}

/* ==========================================================================
   🎯 ENGINE DO MODO NOVO: SESSÃO DE METAS DIÁRIAS DINÂMICAS
   ========================================================================== */
async function renderizarModoWorkout() {
    const workspace = document.getElementById('trainer-workspace');
    if (!workspace) return;

    // Garante compatibilidade de nome com o seu chamador original
    if (typeof renderModoWorkout === 'undefined') {
        window.renderModoWorkout = renderizarModoWorkout;
    }

    // Busca os tempos históricos direto da store para calcular o progresso das missões
    const todosOsTempos = await getAllFromStore('times') || [];
    
    const countCross = todosOsTempos.filter(s => s.step === 'cross').length;
    const countF2L = todosOsTempos.filter(s => s.step === 'f2l').length;
    const countOLL = todosOsTempos.filter(s => s.step === 'oll').length;
    const countPLL = todosOsTempos.filter(s => s.step === 'pll').length;

    const pctCross = Math.min((countCross / 10) * 100, 100);
    const pctF2L = Math.min((countF2L / 10) * 100, 100);
    const pctOLL = Math.min((countOLL / 10) * 100, 100);
    const pctPLL = Math.min((countPLL / 10) * 100, 100);

    let metasConcluidas = 0;
    if (countCross >= 10) metasConcluidas++;
    if (countF2L >= 10) metasConcluidas++;
    if (countOLL >= 10) metasConcluidas++;
    if (countPLL >= 10) metasConcluidas++;

    const scrambleGerado = gerarScramblePorEtapa(currentWorkoutStep);

    workspace.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; box-sizing: border-box;">
            
            <div style="background: rgba(2, 6, 23, 0.4); padding: 15px; border-radius: var(--radius-md, 8px); border: 1px solid rgba(88, 110, 117, 0.15);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="font-size: 12px; color: var(--text-bright); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">🎯 Missões Diárias de Eficiência</span>
                    <span style="font-size: 11px; color: var(--accent); font-family: monospace; font-weight: bold;">${metasConcluidas}/4 Concluídas</span>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                    <div class="workout-goal-card" data-workout-step="cross" style="background: rgba(0,0,0,0.2); border: 1px solid ${currentWorkoutStep === 'cross' ? 'var(--accent)' : 'transparent'}; padding: 8px 10px; border-radius: 6px; cursor: pointer;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: ${currentWorkoutStep === 'cross' ? 'var(--text-bright)' : 'var(--text-muted)'}; margin-bottom: 4px;">
                            <span>✝️ 1. A Cruz</span> <span>${countCross}/10</span>
                        </div>
                        <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
                            <div style="width: ${pctCross}%; height: 100%; background: var(--accent);"></div>
                        </div>
                    </div>

                    <div class="workout-goal-card" data-workout-step="f2l" style="background: rgba(0,0,0,0.2); border: 1px solid ${currentWorkoutStep === 'f2l' ? 'var(--success)' : 'transparent'}; padding: 8px 10px; border-radius: 6px; cursor: pointer;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: ${currentWorkoutStep === 'f2l' ? 'var(--text-bright)' : 'var(--text-muted)'}; margin-bottom: 4px;">
                            <span>🧱 2. F2L Completo</span> <span>${countF2L}/10</span>
                        </div>
                        <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
                            <div style="width: ${pctF2L}%; height: 100%; background: var(--success);"></div>
                        </div>
                    </div>

                    <div class="workout-goal-card" data-workout-step="oll" style="background: rgba(0,0,0,0.2); border: 1px solid ${currentWorkoutStep === 'oll' ? '#b58900' : 'transparent'}; padding: 8px 10px; border-radius: 6px; cursor: pointer;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: ${currentWorkoutStep === 'oll' ? 'var(--text-bright)' : 'var(--text-muted)'}; margin-bottom: 4px;">
                            <span>🟡 3. OLL Pura</span> <span>${countOLL}/10</span>
                        </div>
                        <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
                            <div style="width: ${pctOLL}%; height: 100%; background: #b58900;"></div>
                        </div>
                    </div>

                    <div class="workout-goal-card" data-workout-step="pll" style="background: rgba(0,0,0,0.2); border: 1px solid ${currentWorkoutStep === 'pll' ? '#2aa198' : 'transparent'}; padding: 8px 10px; border-radius: 6px; cursor: pointer;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: ${currentWorkoutStep === 'pll' ? 'var(--text-bright)' : 'var(--text-muted)'}; margin-bottom: 4px;">
                            <span>🟢 4. PLL Pura</span> <span>${countPLL}/10</span>
                        </div>
                        <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
                            <div style="width: ${pctPLL}%; height: 100%; background: #2aa198;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="dashboard-widget" style="text-align: center; padding: 20px; display: flex; flex-direction: column; gap: 15px; border: 1px solid rgba(88, 110, 117, 0.2);">
                <div>
                    <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: var(--accent); letter-spacing: 0.5px;">
                        Foco de Entrada: Solves de <strong>${currentWorkoutStep.toUpperCase()}</strong>
                    </span>
                </div>

                <div id="workout-scramble-text" style="background: rgba(0,0,0,0.25); padding: 14px; border-radius: 6px; border: 1px dashed var(--border-color); font-family: monospace; font-size: 14px; color: var(--text-bright); line-height: 1.4; word-break: break-word;">
                    ${scrambleGerado}
                </div>

                <div id="workout-timer-box" style="background: rgba(0,0,0,0.25); padding: 60px 10px; border-radius: 8px; border: 2px solid rgba(38, 139, 210, 0.3); cursor: pointer; user-select: none; width: 100%; box-sizing: border-box; text-align: center; margin-top: 10px;">
                    <div id="workout-timer-num" style="font-size: 72px; font-family: monospace; font-weight: 800; color: var(--text-bright); line-height: 1;">0.00</div>
                    <span id="workout-timer-tip" style="font-size: 12px; color: var(--text-muted); display: block; margin-top: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Clique aqui ou Pressione <kbd style="background:rgba(255,255,255,0.1); padding: 2px 6px; border-radius:4px; font-family:monospace;">ESPAÇO</kbd> para rodar</span>
                </div>

                <div style="border-top: 1px solid rgba(88, 110, 117, 0.1); padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                    <span style="color: var(--text-muted);">Sessão Recente:</span>
                    <div id="workout-mini-panel" style="font-family: monospace; color: var(--success); font-weight: bold;">--</div>
                </div>
            </div>

        </div>
    `;
    
    // 1. Ouvintes Inteligentes para Toque na Tela (Celular e Mouse) - CORRIGIDO
    // 1. Ouvintes Simplificados e Unificados para Tela (Celular e Mouse)
    // 1. Ouvintes Inteligentes para Toque na Tela (Telemóvel e Rato)
    const timerBoxEl = document.getElementById('workout-timer-box');
    if (timerBoxEl) {
        // Bloqueia cliques fantasmas no telemóvel
        timerBoxEl.addEventListener('touchstart', (e) => {
            e.preventDefault(); 
            if (isWorkoutTimerRunning) {
                alternarCronometroWorkout(); // Para imediatamente ao tocar
            } else {
                workoutEspacoPressionado = true;
                const displayNum = document.getElementById('workout-timer-num');
                if (displayNum) displayNum.style.color = 'var(--danger)'; // Vermelho: Preparado...
            }
        }, { passive: false });

        timerBoxEl.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!isWorkoutTimerRunning && workoutEspacoPressionado) {
                workoutEspacoPressionado = false;
                alternarCronometroWorkout(); // Inicia ao largar o ecrã
            }
        }, { passive: false });

        // Suporte para Rato (Ambiente de Trabalho)
        timerBoxEl.addEventListener('mousedown', (e) => {
            if (e.pointerType === 'touch') return; 
            if (isWorkoutTimerRunning) {
                alternarCronometroWorkout(); // Para ao clicar
            } else {
                workoutEspacoPressionado = true;
                const displayNum = document.getElementById('workout-timer-num');
                if (displayNum) displayNum.style.color = 'var(--danger)';
            }
        });

        timerBoxEl.addEventListener('mouseup', (e) => {
            if (e.pointerType === 'touch') return;
            if (!isWorkoutTimerRunning && workoutEspacoPressionado) {
                workoutEspacoPressionado = false;
                alternarCronometroWorkout(); // Inicia ao largar o clique
            }
        });
    }

    // 2. Ouvintes corrigidos para a Barra de Espaço (Teclado)
    const gerenciarKeyDownWorkout = (e) => {
        if (e.code === 'Space' && modoTreinoAtual === 'workout') {
            e.preventDefault();
            
            if (isWorkoutTimerRunning) {
                alternarCronometroWorkout(); // Se está a rodar, para imediatamente no keydown
                return;
            }

            if (!workoutEspacoPressionado) {
                workoutEspacoPressionado = true;
                const displayNum = document.getElementById('workout-timer-num');
                if (displayNum) displayNum.style.color = 'var(--danger)'; // Fica vermelho à espera
            }
        }
    };

    const gerenciarKeyUpWorkout = (e) => {
        if (e.code === 'Space' && modoTreinoAtual === 'workout') {
            e.preventDefault();
            
            // Só inicia o cronómetro se ele estava em modo de preparação (vermelho)
            if (!isWorkoutTimerRunning && workoutEspacoPressionado) {
                workoutEspacoPressionado = false;
                alternarCronometroWorkout(); // Inicia de facto ao soltar a barra
            }
        }
    };

    // Escutadores de eventos dos cards de metas (Abas superiores)
    document.querySelectorAll('.workout-goal-card').forEach(card => {
        card.addEventListener('click', () => {
            if (isWorkoutTimerRunning) return;
            currentWorkoutStep = card.getAttribute('data-workout-step');
            renderizarModoWorkout();
        });
    });

    // Renderiza os últimos 3 tempos salvos no painel inferior
    const miniPanel = document.getElementById('workout-mini-panel');
    const filtrados = todosOsTempos.filter(s => s.step === currentWorkoutStep).slice(-3).map(s => s.time.toFixed(2) + 's');
    if (filtrados.length > 0) miniPanel.innerHTML = filtrados.join(' <span style="color:var(--text-muted)">|</span> ');

    // Limpa referências antigas para evitar a duplicação na troca de abas
    window.removeEventListener('keydown', window._workoutKeyDownRef);
    window.removeEventListener('keyup', window._workoutKeyUpRef);

    // Guarda as referências atuais para limpeza futura
    window._workoutKeyDownRef = gerenciarKeyDownWorkout;
    window._workoutKeyUpRef = gerenciarKeyUpWorkout;

    // Aplica os escutadores na janela global
    window.addEventListener('keydown', window._workoutKeyDownRef);
    window.addEventListener('keyup', window._workoutKeyUpRef);
}



// CONTROLADOR UNIFICADO E BLINDADO CONTRA SEGUNDOS DISPAROS
// CONTROLADOR CENTRALIZADO - CRONÓMETRO DE METAS
async function alternarCronometroWorkout() {
    const displayNum = document.getElementById('workout-timer-num');
    const displayTip = document.getElementById('workout-timer-tip');
    if (!displayNum) return;

    if (isWorkoutTimerRunning) {
        // PARAR O CRONÓMETRO
        clearInterval(workoutTimerInterval);
        isWorkoutTimerRunning = false;
        workoutEspacoPressionado = false;
        
        const tempoFinal = (performance.now() - workoutStartTime) / 1000;

        displayNum.innerText = tempoFinal.toFixed(2);
        displayNum.style.color = 'var(--text-bright)';
        if (displayTip) displayTip.innerText = "Salvo! A atualizar metas...";

        await salvarTempoDeMetaNoBanco(tempoFinal);
    } else {
        // INICIAR O CRONÓMETRO
        isWorkoutTimerRunning = true;
        workoutStartTime = performance.now();
        
        displayNum.style.color = 'var(--success)';
        if (displayTip) displayTip.innerText = "A executar etapa... Pressione ESPAÇO ou Toque para parar";

        clearInterval(workoutTimerInterval);
        workoutTimerInterval = setInterval(() => {
            const diff = (performance.now() - workoutStartTime) / 1000;
            displayNum.innerText = diff.toFixed(2);
        }, 10);
    }
}

// CORRIGIDO: Nome da função de renderização corrigido para renderizarModoWorkout()
async function salvarTempoDeMetaNoBanco(tempo) {
    try {
        await saveToStore('times', {
            id: 'workout_' + Date.now(), // ID do tipo String
            time: parseFloat(tempo.toFixed(2)),
            scramble: `Treino de Meta Isolada: ${currentWorkoutStep.toUpperCase()}`,
            date: new Date().toISOString(),
            step: currentWorkoutStep, 
            isDNF: false,
            hasPlusTwo: false
        });
        
        // Chamada corrigida com o nome correto da função
        renderizarModoWorkout();
    } catch (e) {
        console.error("Erro ao persistir tempo de meta:", e);
    }
}

// Adicione suporte ao ESPAÇO no Modo Workout dentro da sua função limparLoopsTreinador e initTrainerScreen
// Altere o topo da sua função initTrainerScreen para escutar o espaço globalmente se estiver no modo workout:

function gerarScramblePorEtapa(etapa) {
    // Retorna embaralhamentos focados em isolar cada step do CFOP
    const bancoScrambles = {
        cross: "D R2 U2 B2 U2 F2 D' L2 B2 F2 R2 B' R2 U B2 F' R F' L' D2",
        f2l: "U R U' R' U' L' U L F2 R2 U' R2 U R2 F2",
        oll: "R U2 R2 F R F' U2 R' F R F'",
        pll: "M2 U M2 U2 M2 U M2"
    };
    return bancoScrambles[etapa] || bancoScrambles['cross'];
}

/* ==========================================================================
   ⚙️ ENGINE DO MODO A: METRÔNOMO DE TPS AUTOMATIZADO
   ========================================================================== */
function renderizarModoMetronome() {
    const workspace = document.getElementById('trainer-workspace');
    if (!workspace || filaDeCasosAtiva.length === 0) return;

    const caso = filaDeCasosAtiva[indexCasoAtual];
    const algPrincipal = caso.algs[0];
    movimentosDecompostos = decomporAlgoritmo(algPrincipal);
    
    const tempoEstimatedTeorico = (movimentosDecompostos.length / tpsAlvo).toFixed(2);

    workspace.innerHTML = `
        <div class="dashboard-widget" style="text-align: center; padding: 20px; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 15px;">
            
            <div style="width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
                <label for="select-caso-metronome" style="font-size: 11px; color: var(--accent); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Selecionar Caso Diretamente:</label>
                <select id="select-caso-metronome" style="width: 100%; padding: 10px; font-size: 14px; background: #020617; color: var(--text-bright); border: 1px solid var(--border-color); border-radius: var(--radius-sm, 6px); font-family: sans-serif; cursor: pointer; outline: none;">
                    ${filaDeCasosAtiva.map((c, idx) => `
                        <option value="${idx}" ${idx === indexCasoAtual ? 'selected' : ''}>
                            [${c.grupo.toUpperCase()}] ${c.name.toUpperCase()}
                        </option>
                    `).join('')}
                </select>
            </div>
            
            <div style="width: 100%; max-width: 110px; aspect-ratio: 1/1; display: flex; align-items: center; justify-content: center; margin-top: 5px;">
                <img src="${getImagePath(caso.grupo, caso.id)}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="Caso">
            </div>
            
            <div style="background: rgba(0,0,0,0.2); padding: 14px; border-radius: var(--radius-sm, 6px); font-family: monospace; font-size: 16px; color: var(--text-bright); width: 100%; box-sizing: border-box; border: 1px dashed var(--border-color); white-space: normal; word-break: break-word;">
                ${algPrincipal}
            </div>

            <div style="display: flex; width: 100%; gap: 10px; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 10px; border-radius: var(--radius-sm, 6px); box-sizing: border-box; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 120px; text-align: left;">
                    <span style="display:block; font-size: 11px; color: var(--text-muted);">TPS ALVO</span>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                        <button id="btn-tps-menos" class="btn-primary" style="padding: 4px 12px; font-size: 14px; min-width: 32px;">-</button>
                        <strong id="display-tps" style="font-size: 18px; color: var(--text-bright); font-family: monospace;">${tpsAlvo.toFixed(1)}</strong>
                        <button id="btn-tps-mais" class="btn-primary" style="padding: 4px 12px; font-size: 14px; min-width: 32px;">+</button>
                    </div>
                </div>
                <div style="flex: 1; min-width: 140px; text-align: right; border-left: 1px solid rgba(88, 110, 117, 0.2); padding-left: 10px;">
                    <span style="font-size: 11px; color: var(--text-muted); display: block;">METRICA DETALHADA</span>
                    <strong style="font-size: 13px; color: var(--text-bright); font-family: monospace; display: block; margin-top: 2px;">${movimentosDecompostos.length} giros / <span style="color:var(--success);">${tempoEstimatedTeorico}s</span></strong>
                </div>
            </div>

            <div id="metronome-flow-box" style="display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; width: 100%; box-sizing: border-box; margin: 5px 0;">
                ${movimentosDecompostos.map((m, idx) => `<span id="step-mov-${idx}" style="padding: 5px 8px; background: rgba(255,255,255,0.04); border-radius: 4px; font-family: monospace; font-size: 13px; color: var(--text-muted); transition: all 0.1s ease; display: inline-block;">${m}</span>`).join('')}
            </div>

            <button id="btn-disparar-metronome" class="btn-primary" style="width: 100%; padding: 14px; font-size: 15px; font-weight: bold; margin-top: 5px; background: var(--accent);">
                🔊 Iniciar Loops Estáveis
            </button>
            
            <div style="display: flex; justify-content: space-between; width: 100%; border-top: 1px solid rgba(88, 110, 117, 0.1); padding-top: 12px; margin-top: 5px;">
                <button id="btn-prev-metronome" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:13px; padding: 5px 10px;">⏮️ Anterior</button>
                <button id="btn-next-metronome" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:13px; padding: 5px 10px;">Próximo ⏭️</button>
            </div>
        </div>
    `;

    document.getElementById('select-caso-metronome').addEventListener('change', (e) => {
        limparLoopsTreinador();
        indexCasoAtual = parseInt(e.target.value);
        renderizarModoMetronome();
    });

    document.getElementById('btn-tps-menos').addEventListener('click', () => { if (tpsAlvo > 1.0) { tpsAlvo -= 0.5; renderizarModoMetronome(); } });
    document.getElementById('btn-tps-mais').addEventListener('click', () => { if (tpsAlvo < 12.0) { tpsAlvo += 0.5; renderizarModoMetronome(); } });

    document.getElementById('btn-prev-metronome').addEventListener('click', () => { if (indexCasoAtual > 0) { limparLoopsTreinador(); indexCasoAtual--; renderizarModoMetronome(); } });
    document.getElementById('btn-next-metronome').addEventListener('click', () => { if (indexCasoAtual < filaDeCasosAtiva.length - 1) { limparLoopsTreinador(); indexCasoAtual++; renderizarModoMetronome(); } });

    document.getElementById('btn-disparar-metronome').addEventListener('click', gerenciarGatilhoMetronome);
}

function gerenciarGatilhoMetronome() {
    const btn = document.getElementById('btn-disparar-metronome');
    
    if (metronomeIntervalId || timeoutReiniciarId) {
        limparLoopsTreinador();
        if (btn) {
            btn.innerText = "🔊 Iniciar Loops Estáveis";
            btn.style.background = "var(--accent)";
        }
        movimentosDecompostos.forEach((_, idx) => {
            const el = document.getElementById(`step-mov-${idx}`);
            if (el) { el.style.background = 'rgba(255,255,255,0.04)'; el.style.color = 'var(--text-muted)'; }
        });
        return;
    }

    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (btn) {
        btn.innerText = "⏹️ Interromper Loop de Cadência";
        btn.style.background = "var(--danger)";
    }
    
    deVoltaNoLoop = false;
    executarCicloMetronomeEngine();
}

function ejecutarCicloMetronomeEngine() {
    indexMovimentoMetronome = 0;
    movimentosDecompostos.forEach((_, idx) => {
        const el = document.getElementById(`step-mov-${idx}`);
        if (el) { el.style.background = 'rgba(255,255,255,0.04)'; el.style.color = 'var(--text-muted)'; }
    });

    const intervaloMs = 1000 / tpsAlvo;
    cronometroMetronomeStart = performance.now();

    metronomeIntervalId = setInterval(() => {
        if (indexMovimentoMetronome >= movimentosDecompostos.length) {
            clearInterval(metronomeIntervalId);
            metronomeIntervalId = null;
            deVoltaNoLoop = true;

            timeoutReiniciarId = setTimeout(() => {
                timeoutReiniciarId = null;
                executarCicloMetronomeEngine();
            }, 500);
            return;
        }

        try {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            let frequenciaBipe = 750;
            if (indexMovimentoMetronome === 0) {
                frequenciaBipe = deVoltaNoLoop ? 1600 : 1100;
            }

            osc.frequency.setValueAtTime(frequenciaBipe, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.03);
        } catch (e) { console.warn("Audio Context suspenso."); }

        const elAnterior = document.getElementById(`step-mov-${indexMovimentoMetronome - 1}`);
        if (elAnterior) { elAnterior.style.background = 'rgba(133, 153, 0, 0.15)'; elAnterior.style.color = 'var(--success)'; }

        const elAtual = document.getElementById(`step-mov-${indexMovimentoMetronome}`);
        if (elAtual) {
            elAtual.style.background = 'var(--accent)';
            elAtual.style.color = 'var(--text-bright)';
            elAtual.style.transform = 'scale(1.08)';
            setTimeout(() => { elAtual.style.transform = 'scale(1)'; }, 70);
        }

        indexMovimentoMetronome++;
    }, intervaloMs);
}

/* ==========================================================================
   ⚙️ ENGINE DO MODO B: LABORATÓRIO ANTIPÂNICO ORIGINAL INTEGRAL
   ========================================================================== */
function renderizarModoAntipanic() {
    const workspace = document.getElementById('trainer-workspace');
    if (!workspace) return;

    if (filaDeCasosAtiva.length === 0) {
        workspace.innerHTML = `
            <div class="dashboard-widget" style="text-align:center; padding: 30px; width:100%; box-sizing:border-box;">
                <h3 style="color:var(--success); margin:0;">🎉 Alvos Limpos!</h3>
                <p style="color:var(--text-muted); font-size:13px; margin: 10px 0 0 0;">Parabéns! Nenhuma fraqueza extrema encontrada no histórico recente da sua base de dados.</p>
            </div>
        `;
        return;
    }

    const caso = filaDeCasosAtiva[indexCasoAtual];
    const algPrincipal = caso.algs[0];
    const scrambleInverso = gerarScrambleInverso(algPrincipal);

    workspace.innerHTML = `
        <div class="dashboard-widget" style="text-align: center; padding: 20px; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 15px; position: relative;">
            
            <div style="display:flex; justify-content:space-between; align-items:center; width: 100%; box-sizing: border-box;">
                <span style="background: rgba(220,50,47,0.12); border: 1px solid rgba(220,50,47,0.25); color: var(--danger); font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: bold;">
                    ⚠️ ALVO CRÍTICO #${indexCasoAtual + 1}
                </span>
                <span style="font-family: monospace; font-size:12px; color: var(--text-muted);">
                    Histórico: <strong style="color: var(--text-bright);">${caso.mediaReal > 0 ? caso.mediaReal.toFixed(2) + 's' : '--'}</strong>
                </span>
            </div>

            <div>
                <h2 id="antipanic-title" style="color: var(--text-bright); margin: 0; font-size: 24px; transition: opacity 0.15s ease;">${caso.name.toUpperCase()}</h2>
            </div>
            
            <div id="antipanic-visual-box" style="width: 100%; max-width: 100px; aspect-ratio: 1/1; display: flex; align-items: center; justify-content: center; transition: opacity 0.15s ease;">
                <img src="${getImagePath(caso.grupo, caso.id)}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="Caso">
            </div>

            <div id="antipanic-scramble-box" style="background: rgba(2, 6, 23, 0.4); padding: 14px; border-radius: var(--radius-sm, 6px); border: 1px solid var(--border-color); width: 100%; box-sizing: border-box; transition: opacity 0.15s ease;">
                <span style="display:block; font-size: 11px; color: var(--accent); font-weight:bold; text-transform:uppercase; margin-bottom: 6px; letter-spacing:0.5px;">Scramble Inverso (Gere o Caso no Cubo):</span>
                <strong style="font-size: 15px; color: var(--text-bright); font-family: monospace; word-spacing: 2px; white-space: normal; word-break: break-word; display: block;">${scrambleInverso}</strong>
            </div>

            <div style="background: rgba(0,0,0,0.15); padding: 15px 10px; border-radius: var(--radius-md, 8px); border: 1px solid rgba(255,255,255,0.03); width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div id="antipanic-timer-display" class="timer-big" style="font-size: 56px; font-weight: 800; font-family: monospace; color: var(--text-muted); user-select: none; line-height: 1; transition: color 0.05s ease;">
                    0.00
                </div>
                <p id="antipanic-tip" style="font-size:11px; color: var(--text-muted); margin: 8px 0 0 0; transition: opacity 0.15s ease;">Segure <kbd style="background:rgba(255,255,255,0.1); padding: 1px 5px; border-radius:4px;">ESPAÇO</kbd> ou Toque para Armar</p>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; border-top: 1px solid rgba(88, 110, 117, 0.1); padding-top: 12px; box-sizing: border-box; gap: 10px;">
                <button id="btn-next-antipanic" style="background:transparent; border:none; color:var(--text-main); cursor:pointer; font-size:13px; font-weight: 600; padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;">
                    Próximo Alvo ⏭️
                </button>
                <button id="btn-ignorar-antipanic" style="background:transparent; border:none; color:var(--success); cursor:pointer; font-size:13px; font-weight:bold; padding: 6px 12px;">
                    Superado ✓
                </button>
            </div>
        </div>
    `;

    document.getElementById('btn-next-antipanic').addEventListener('click', () => {
        if (indexCasoAtual < filaDeCasosAtiva.length - 1) { indexCasoAtual++; } else { indexCasoAtual = 0; }
        renderizarModoAntipanic();
    });

    document.getElementById('btn-ignorar-antipanic').addEventListener('click', () => {
        filaDeCasosAtiva.splice(indexCasoAtual, 1);
        if (indexCasoAtual >= filaDeCasosAtiva.length) indexCasoAtual = 0;
        renderizarModoAntipanic();
    });

    window.addEventListener('keydown', gerenciarKeyDownAntipanic);
    window.addEventListener('keyup', gerenciarKeyUpAntipanic);

    const painelNumerico = document.getElementById('antipanic-timer-display');
    painelNumerico.addEventListener('touchstart', (e) => { e.preventDefault(); dispararGatilhoPressionado(); });
    painelNumerico.addEventListener('touchend', (e) => { e.preventDefault(); dispararGatilhoSolto(); });
}

function gerenciarKeyDownAntipanic(e) {
    if (e.code === 'Space') {
        e.preventDefault();
        dispararGatilhoPressionado();
    }
}

function gerenciarKeyUpAntipanic(e) {
    if (e.code === 'Space') {
        e.preventDefault();
        dispararGatilhoSolto();
    }
}

function dispararGatilhoPressionado() {
    if (cronometroRodandoAntipanic) {
        pararCronometroAntipanic();
        return;
    }

    if (segurandoEspaco) return;
    segurandoEspaco = true;

    const display = document.getElementById('antipanic-timer-display');
    if (display) {
        display.innerText = "0.00";
        display.classList.remove('ready-to-trigger');
        display.classList.add('holding-down'); 
    }

    temporizadorPronto = false;
    timeoutSegurarId = setTimeout(() => {
        if (segurandoEspaco) {
            temporizadorPronto = true;
            if (display) {
                display.classList.remove('holding-down');
                display.classList.add('ready-to-trigger');
            }
        }
    }, 300);
}

function dispararGatilhoSolto() {
    clearTimeout(timeoutSegurarId);
    segurandoEspaco = false;

    const display = document.getElementById('antipanic-timer-display');

    if (!temporizadorPronto) {
        if (display) display.classList.remove('holding-down', 'ready-to-trigger');
        return;
    }

    if (temporizadorPronto && !cronometroRodandoAntipanic) {
        temporizadorPronto = false;
        cronometroRodandoAntipanic = true;
        tempoStartAntipanic = performance.now();

        if (display) {
            display.classList.remove('holding-down', 'ready-to-trigger');
            display.style.color = 'var(--text-bright)';
        }

        aplicarEfeitoOcultacaoGhost(true);

        intervaloCronometroId = setInterval(() => {
            const tempoPassado = (performance.now() - tempoStartAntipanic) / 1000;
            if (display) display.innerText = tempoPassado.toFixed(2);
        }, 10);
    }
}

async function pararCronometroAntipanic() {
    clearInterval(intervaloCronometroId);
    cronometroRodandoAntipanic = false;

    const tempoFinalCalculado = (performance.now() - tempoStartAntipanic) / 1000;
    
    const display = document.getElementById('antipanic-timer-display');
    if (display) {
        display.innerText = tempoFinalCalculado.toFixed(2);
        display.style.color = 'var(--text-muted)';
    }

    aplicarEfeitoOcultacaoGhost(false);

    const caso = filaDeCasosAtiva[indexCasoAtual];
    try {
        await saveToStore('times', {
            id: 'solve_' + Date.now(),
            time: parseFloat(tempoFinalCalculado.toFixed(2)),
            scramble: `Drill Antipânico: ${caso.name}`,
            date: new Date().toISOString(),
            step: `${caso.grupo}_${caso.id}`,
            isDNF: false,
            hasPlusTwo: false
        });

        import('./dashboard.js').then(dash => { if (dash && dash.renderDashboard) dash.renderDashboard(); });
    } catch (err) { console.error("Falha ao computar dados do treino:", err); }
}

function aplicarEfeitoOcultacaoGhost(ocultar) {
    const elementos = [
        document.getElementById('antipanic-title'),
        document.getElementById('antipanic-visual-box'),
        document.getElementById('antipanic-scramble-box'),
        document.getElementById('antipanic-tip')
    ];
    
    elementos.forEach(el => {
        if (el) {
            el.style.opacity = ocultar ? '0.01' : '1';
            el.style.pointerEvents = ocultar ? 'none' : 'auto';
        }
    });
}