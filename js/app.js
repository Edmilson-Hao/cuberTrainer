import { initDB } from './db.js';
import { renderDashboard } from './components/dashboard.js';
import { initCasesScreen } from './components/cases.js';
import { initTrainerScreen } from './components/trainer.js';
import { initTimerScreen, clearTimerState } from './components/timer.js';
import { initHistoryScreen } from './components/history.js';

const screens = {
    cases: initCasesScreen,
    trainer: initTrainerScreen,
    timer: initTimerScreen,
    history: initHistoryScreen
};

document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    renderDashboard();

    // Configura os botões de navegação da navbar
    document.querySelectorAll('nav button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove estados e listeners globais do timer antes de trocar de tela
            clearTimerState();

            document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const targetScreen = e.target.getAttribute('data-screen');
            if (screens[targetScreen]) {
                screens[targetScreen]();
            }
        });
    });

    // Força o estado limpo inicial e carrega a tela do cronômetro de forma segura
    clearTimerState();
    initTimerScreen();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW Error:', err));
    }
});