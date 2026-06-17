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
    try {
        // 1. Inicializa o banco de dados IndexedDB
        await initDB();
        
        // 2. Renderiza as informações do cabeçalho / progresso
        renderDashboard();

        // Configura os botões de navegação da navbar (Otimizado para Mobile e Desktop)
        document.querySelectorAll('nav button').forEach(btn => {
            const handleNavigation = (e) => {
                e.preventDefault();
                
                // Remove estados e listeners globais do timer antes de trocar de tela
                clearTimerState();

                document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const targetScreen = btn.getAttribute('data-screen');
                if (screens[targetScreen]) {
                    screens[targetScreen]();
                }
            };

            // Escuta tanto clique quanto toque físico no smartphone sem atrasos
            btn.addEventListener('click', handleNavigation);
            btn.addEventListener('touchstart', handleNavigation, { passive: false });
        });

        // Força o estado limpo inicial e carrega a tela do cronômetro de forma segura
        clearTimerState();
        initTimerScreen();

        // Inicializa o Service Worker para suporte PWA offline
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('SW registrado com sucesso!', reg))
                .catch(err => console.error('Erro ao registrar o SW:', err));
        }

    } catch (error) {
        console.error("Erro crítico na inicialização do aplicativo:", error);
    } finally {
        // 🏁 Oculta a Splash Screen rapidamente
        const splash = document.getElementById('splash-screen');
        if (splash) {
            setTimeout(() => {
                splash.classList.add('fade-out');
            }, 400);
        }
    }
});