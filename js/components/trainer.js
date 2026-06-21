import { cuberData, getImagePath } from '../data.js';
import { getAllFromStore, saveToStore } from '../db.js';
// Importação correta na mesma pasta de componentes
import { gerarScrambleInverso, decomporAlgoritmo } from './scrambler.js';

// Máquina de Estados e Variáveis de Controle Global do Treinador
let modoTreinoAtual = 'metronome'; // 'metronome' ou 'antipanic'
let filaDeCasosAtiva = [];
let indexCasoAtual = 0;

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

    // Renderiza o esqueleto estrutural perfeitamente responsivo, integrado ao CSS global
    container.innerHTML = `
        <div class="trainer-screen" style="width: 100%; max-width: 600px; margin: 0 auto; padding: 10px; box-sizing: border-box;">
            
            <div class="tab-selector" style="display: flex; gap: 8px; background: rgba(2, 6, 23, 0.5); padding: 6px; border-radius: var(--radius-md, 8px); margin-bottom: 20px; border: 1px solid rgba(88, 110, 117, 0.2); width: 100%; box-sizing: border-box;">
                <button id="btn-modo-metronome" class="${modoTreinoAtual === 'metronome' ? 'active' : ''}" style="flex: 1; padding: 12px 8px; font-size: 13px; font-weight: bold; border: none; border-radius: var(--radius-sm, 6px); cursor: pointer; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    ⏱️ Metrônomo
                </button>
                <button id="btn-modo-antipanic" class="${modoTreinoAtual === 'antipanic' ? 'active' : ''}" style="flex: 1; padding: 12px 8px; font-size: 13px; font-weight: bold; border: none; border-radius: var(--radius-sm, 6px); cursor: pointer; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    🔥 Antipânico
                </button>
            </div>

            <div id="trainer-workspace" style="width: 100%; box-sizing: border-box;"></div>
        </div>
    `;

    // Vincula os seletores de modo à máquina de estados
    document.getElementById('btn-modo-metronome').addEventListener('click', () => {
        mudarModoTreino('metronome');
    });
    document.getElementById('btn-modo-antipanic').addEventListener('click', () => {
        mudarModoTreino('antipanic');
    });

    // Inicia o processamento da fila baseado no modo escolhido
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
    window.removeEventListener('keydown', gerenciarKeyDownAntipanic);
    window.removeEventListener('keyup', gerenciarKeyUpAntipanic);
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

    if (modoTreinoAtual === 'metronome') {
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
   ⚙️ ENGINE DO MODO A: METRÔNOMO DE TPS AUTOMATIZADO
   ========================================================================== */
function renderizarModoMetronome() {
    const workspace = document.getElementById('trainer-workspace');
    if (!workspace || filaDeCasosAtiva.length === 0) return;

    const caso = filaDeCasosAtiva[indexCasoAtual];
    const algPrincipal = caso.algs[0];
    movimentosDecompostos = decomporAlgoritmo(algPrincipal);
    
    const tempoEstimadoTeorico = (movimentosDecompostos.length / tpsAlvo).toFixed(2);

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
                    <strong style="font-size: 13px; color: var(--text-bright); font-family: monospace; display: block; margin-top: 2px;">${movimentosDecompostos.length} giros / <span style="color:var(--success);">${tempoEstimadoTeorico}s</span></strong>
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

    // Handler para o dropdown de seleção direta de casos
    document.getElementById('select-caso-metronome').addEventListener('change', (e) => {
        limparLoopsTreinador(); // Limpa áudios pendentes antes de mudar
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

function executarCicloMetronomeEngine() {
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
            
            // Ativa o gatilho para usar a frequência diferenciada no próximo ciclo
            deVoltaNoLoop = true;

            // Aguarda meio segundo (500ms) de descanso e reinicia o loop automaticamente
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
            
            let frequenciaBipe = 750; // Som padrão para o fluxo interno do algoritmo
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