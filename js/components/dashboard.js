import { getAllFromStore, getFromStore, saveToStore } from '../db.js';

export async function renderDashboard() {
    const el = document.getElementById('dashboard-summary');
    if (!el) return;

    // 1. Domínio de Casos (CFOP)
    const allStates = await getAllFromStore('casesState');
    const learnedCount = allStates.filter(s => s.learned).length;
    const totalCases = 119;
    const domainPercentage = totalCases > 0 ? ((learnedCount / totalCases) * 100).toFixed(1) : 0;

    // 2. Gerenciador de Streak Baseado na Store Correta ('userStats')
    let streakData = await getFromStore('userStats', 'streak') || { key: 'streak', count: 0, lastDate: '' };
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (streakData.lastDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (streakData.lastDate !== todayStr && streakData.lastDate !== yesterdayStr) {
            streakData.count = 0; // Perdeu o streak por inatividade
            await saveToStore('userStats', streakData);
        }
    }

    // 3. Busca Dinâmica do PB Real (Menor tempo do Histórico que não seja DNF)
    const allSolves = await getAllFromStore('times') || [];
    const validSolves = allSolves.filter(s => s && !s.isDNF);
    const pbSingle = validSolves.length > 0 ? Math.min(...validSolves.map(s => s.time)).toFixed(2) + 's' : '-';

    el.innerHTML = `
        <div class="dashboard-widget" style="padding: 15px; background: #1e1e2e; border-radius: 12px; border: 1px solid #313244;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div class="streak-badge" style="background: rgba(255,110,59,0.1); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,110,59,0.2); color: #ff6e3b; font-weight: bold;">
                    🔥 🔥 <span>${streakData.count} dias</span>
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

export async function incrementStreak() {
    let streakData = await getFromStore('userStats', 'streak') || { key: 'streak', count: 0, lastDate: '' };
    const todayStr = new Date().toISOString().split('T')[0];
    if (streakData.lastDate !== todayStr) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (streakData.lastDate === yesterday || streakData.count === 0) {
            streakData.count++;
        }
        streakData.lastDate = todayStr;
        await saveToStore('userStats', streakData);
        renderDashboard();
    }
}