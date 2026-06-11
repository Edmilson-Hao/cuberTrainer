import { getAllFromStore, getFromStore, saveToStore } from '../db.js';

export async function renderDashboard() {
    const el = document.getElementById('dashboard-summary');
    const allStates = await getAllFromStore('casesState');
    const learnedCount = allStates.filter(s => s.learned).length;
    const totalCases = 119;
    const domainPercentage = ((learnedCount / totalCases) * 100).toFixed(1);

    // Gerenciador de Streak Simples baseado na data local
    let streakData = await getFromStore('userStats', 'streak') || { key: 'streak', count: 0, lastDate: '' };
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (streakData.lastDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (streakData.lastDate !== todayStr && streakData.lastDate !== yesterdayStr) {
            streakData.count = 0; // Perdeu o streak
            await saveToStore('userStats', streakData);
        }
    }

    el.innerHTML = `
        <div class="dashboard-widget">
            <div class="streak-badge">🔥 🔥 <span>${streakData.count} dias</span></div>
            <div class="progress-container">
                <span class="progress-label">Domínio CFOP: ${domainPercentage}%</span>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${domainPercentage}%"></div>
                </div>
            </div>
        </div>
    `;
}

export async function incrementStreak() {
    let streakData = await getFromStore('userStats', 'streak') || { key: 'streak', count: 0, lastDate: '' };
    const todayStr = new Date().toISOString().split('T')[0];
    if (streakData.lastDate !== todayStr) {
        if (streakData.lastDate === new Date(Date.now() - 86400000).toISOString().split('T')[0] || streakData.count === 0) {
            streakData.count++;
        }
        streakData.lastDate = todayStr;
        await saveToStore('userStats', streakData);
        renderDashboard();
    }
}