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

        // 🔔 Solicita permissão para notificações de forma amigável
        async function solicitarPermissaoNotificacoes() {
            if (!('Notification' in window)) {
                console.log('Este navegador não suporta notificações de desktop.');
                return;
            }

            if (Notification.permission === 'default') {
                const permissao = await Notification.requestPermission();
                if (permissao === 'granted') {
                    console.log('Permissão para notificações concedida!');
                    // Agenda o primeiro lembrete assim que aceitar
                    agendarLembreteDeStreak();
                }
            }
        }

        // Chame a função na inicialização do app
        solicitarPermissaoNotificacoes();

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

/**
 * ⏰ Agenda um lembrete local baseado no estado atual do streak
 * Exportada para ser disparada por outros módulos de forma segura
 */
export async function agendarLembreteDeStreak() {
    if (Notification.permission !== 'granted') return;

    // Garante que o Service Worker está pronto antes de interagir
    const registration = await navigator.serviceWorker.ready;
    
    // Configura o horário do alerta (Exemplo: Todos os dias às 20:00)
    const agora = new Date();
    const horarioAlerta = new Date();
    horarioAlerta.setHours(20, 0, 0, 0); 

    if (agora > horarioAlerta) {
        horarioAlerta.setDate(horarioAlerta.getDate() + 1);
    }

    const tempoRestante = horarioAlerta.getTime() - agora.getTime();

    setTimeout(() => {
        // Busca o banco dinamicamente para verificar se o usuário treinou hoje
        import('./db.js').then(async (db) => {
            const allSolves = await db.getAllFromStore('times') || [];
            const hojeStr = new Date().toISOString().split('T')[0];
            
            const treinouHoje = allSolves.some(s => {
                const dataSolve = new Date(s.date).toISOString().split('T')[0];
                return dataSolve === hojeStr;
            });

            // Se NÃO houver treinos na data de hoje, dispara o card de notificação
            if (!treinouHoje) {
                registration.showNotification('Mantenha o Fogo Aceso! 🔥', {
                    body: 'Você ainda não treinou seus algoritmos hoje. Não perca seu streak!',
                    icon: '/assets/icons/icon-192.png',
                    badge: '/assets/icons/icon-192.png',
                    tag: 'lembrete-streak',
                    renotify: true,
                    vibrate: [200, 100, 200],
                    data: { url: window.location.origin + '/#timer' }
                });
            }
            
            // Re-agenda o temporizador para o dia seguinte de forma contínua
            agendarLembreteDeStreak();
        });
    }, tempoRestante);
}