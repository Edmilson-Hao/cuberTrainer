import { cuberData, getImagePath } from '../data.js';
import { saveToStore, getAllFromStore } from '../db.js';
import { renderDashboard } from './dashboard.js';

let currentTab = 'f2l';

export async function initCasesScreen() {
    const container = document.getElementById('app-container');
    const states = await getAllFromStore('casesState');
    const stateMap = new Map(states.map(s => [s.uid, s]));

    container.innerHTML = `
        <div class="cases-screen">
            <div class="tab-selector">
                <button class="${currentTab === 'f2l' ? 'active':''}" id="btn-tab-f2l">F2L</button>
                <button class="${currentTab === 'oll' ? 'active':''}" id="btn-tab-oll">OLL</button>
                <button class="${currentTab === 'pll' ? 'active':''}" id="btn-tab-pll">PLL</button>
            </div>
            <div class="cases-grid" id="cases-grid-target"></div>
        </div>
    `;

    // Bind das abas
    ['f2l', 'oll', 'pll'].forEach(tab => {
        document.getElementById(`btn-tab-${tab}`).addEventListener('click', () => {
            currentTab = tab;
            initCasesScreen();
        });
    });

    const grid = document.getElementById('cases-grid-target');
    const currentList = cuberData[currentTab];

    currentList.forEach(item => {
        const uid = `${currentTab}-${item.id}`;
        const isLearned = stateMap.get(uid)?.learned || false;
        
        const card = document.createElement('div');
        card.className = `case-card ${isLearned ? 'learned' : ''}`;
        card.innerHTML = `
            <img src="${getImagePath(currentTab, item.id)}" alt="${item.name}" class="case-img" loading="lazy">
            <div class="case-info">
                <h4>${item.name}</h4>
                <div class="alg-list hidden" id="alg-${uid}">
                    ${item.algs.map(a => `<p class="alg-text">${a}</p>`).join('')}
                </div>
                <button class="btn-learned" data-uid="${uid}">${isLearned ? '✓ Aprendido' : 'Aprender'}</button>
            </div>
        `;

        // Toggle para revelar algoritmos ao clicar no card
        card.querySelector('.case-img').addEventListener('click', () => {
            card.querySelector(`#alg-${uid}`).classList.toggle('hidden');
        });

        // Evento de marcar como aprendido
        card.querySelector('.btn-learned').addEventListener('click', async (e) => {
            e.stopPropagation();
            const currentState = stateMap.get(uid) || { uid, learned: false, successCount: 0, failCount: 0 };
            currentState.learned = !currentState.learned;
            await saveToStore('casesState', currentState);
            renderDashboard();
            initCasesScreen(); // Refresh local da tela
        });

        grid.appendChild(card);
    });
}