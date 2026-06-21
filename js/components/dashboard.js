import { getAllFromStore } from '../db.js';

/**
 * 🔥 Calcula o Streak Atual baseado no histórico de solves (Calendário puro)
 */
function calcularStreakDinamico(allSolves) {
    if (!allSolves || allSolves.length === 0) return 0;

    // 1. Extrai as datas, remove as horas e elimina duplicatas (vários treinos no mesmo dia)
    const diasTreinados = [...new Set(allSolves.map(s => {
        const d = new Date(s.date);
        d.setHours(0, 0, 0, 0); // Foca apenas no dia do calendário
        return d.getTime();
    }))].sort((a, b) => b - a); // Ordena do mais recente para o mais antigo

    if (diasTreinados.length === 0) return 0;

    // 2. Define os marcadores de Hoje e Ontem com hora zerada
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const timeHoje = hoje.getTime();

    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    ontem.setHours(0, 0, 0, 0);
    const timeOntem = ontem.getTime();

    const ultimoDiaTreinado = diasTreinados[0];

    // Se o último treino não foi nem hoje nem ontem, o streak quebrou
    if (ultimoDiaTreinado !== timeHoje && ultimoDiaTreinado !== timeOntem) {
        return 0;
    }

    // 3. Varre o histórico contando os dias consecutivos para trás
    let streakCount = 1;
    for (let i = 0; i < diasTreinados.length - 1; i++) {
        const diffDias = (diasTreinados[i] - diasTreinados[i + 1]) / (1000 * 60 * 60 * 24);
        
        if (diffDias === 1) {
            streakCount++;
        } else {
            break; // Pulou um dia, encerra a contagem
        }
    }

    return streakCount;
}

export async function renderDashboard() {
    const el = document.getElementById('dashboard-summary');
    if (!el) return;

    // 1. Domínio de Casos (CFOP)
    const allStates = await getAllFromStore('casesState') || [];
    const learnedCount = allStates.filter(s => s.learned).length;
    const totalCases = 119;
    const domainPercentage = totalCases > 0 ? ((learnedCount / totalCases) * 100).toFixed(1) : 0;

    // 2. Busca o Histórico de Solves uma única vez para o PB e o Streak
    const allSolves = await getAllFromStore('times') || [];
    
    // 3. Calcula o Streak de forma dinâmica e automatizada
    const currentStreak = calcularStreakDinamico(allSolves);

    // 4. Busca Dinâmica do PB Real (Menor tempo do Histórico que não seja DNF)
    const validSolves = allSolves.filter(s => s && !s.isDNF);
    const pbSingle = validSolves.length > 0 ? Math.min(...validSolves.map(s => s.time)).toFixed(2) + 's' : '-';

    el.innerHTML = `
        <div class="dashboard-widget" style="padding: 15px; background: #1e1e2e; border-radius: 12px; border: 1px solid #313244;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div class="streak-badge" style="background: rgba(255,110,59,0.1); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,110,59,0.2); color: #ff6e3b; font-weight: bold;">
                    🔥 <span>${currentStreak} ${currentStreak === 1 ? 'dia' : 'dias'}</span>
                </div>
                <div style="background: rgba(166,227,161,0.1); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(166,227,161,0.2); color: #a6e3a1; font-weight: bold; font-family: monospace;">
                    PB: ${pbSingle}
                </div>
            </div>
            
            <div class="progress-container">
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; font-weight: bold; color: var(--text-muted);">
                    <span>Domínio CFOP</span>
                    <span style="color: #89b4fa;">${domainPercentage}% (${learnedCount}/${totalCases})</span>
                </div>
                <div class="progress-bar-bg" style="background: rgba(255,255,255,0.05); height: 10px; border-radius: 5px; overflow: hidden;">
                    <div class="progress-bar-fill" style="width: ${domainPercentage}%; background: linear-gradient(90deg, #89b4fa, #b4befe); height: 100%; border-radius: 5px;"></div>
                </div>
            </div>
        </div>
    `;
}