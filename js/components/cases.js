import { cuberData, getImagePath } from '../data.js';
import { saveToStore, getAllFromStore } from '../db.js';
import { renderDashboard } from './dashboard.js';

let currentTab = 'f2l';

export async function initCasesScreen() {
    const container = document.getElementById('app-container');
    const states = await getAllFromStore('casesState');
    const stateMap = new Map(states.map(s => [s.uid, s]));

    container.innerHTML = `
        <div class="cases-screen" style="padding: 15px; box-sizing: border-box;">
            
            <div class="tab-selector" style="display: flex; gap: 6px; background: rgba(2, 6, 23, 0.5); padding: 5px; border-radius: var(--radius-sm, 6px); margin-bottom: 20px; border: 1px solid rgba(88, 110, 117, 0.2);">
                <button class="${currentTab === 'f2l' ? 'active':''}" id="btn-tab-f2l" style="
                    flex: 1; 
                    padding: 8px 12px; 
                    font-size: 13px; 
                    font-weight: 600; 
                    border: none; 
                    border-radius: var(--radius-sm, 4px); 
                    cursor: pointer; 
                    background: ${currentTab === 'f2l' ? 'var(--accent)' : 'transparent'}; 
                    color: ${currentTab === 'f2l' ? 'var(--text-bright)' : 'var(--text-main)'};
                    transition: all 0.2s ease;
                ">F2L</button>
                
                <button class="${currentTab === 'oll' ? 'active':''}" id="btn-tab-oll" style="
                    flex: 1; 
                    padding: 8px 12px; 
                    font-size: 13px; 
                    font-weight: 600; 
                    border: none; 
                    border-radius: var(--radius-sm, 4px); 
                    cursor: pointer; 
                    background: ${currentTab === 'oll' ? 'var(--accent)' : 'transparent'}; 
                    color: ${currentTab === 'oll' ? 'var(--text-bright)' : 'var(--text-main)'};
                    transition: all 0.2s ease;
                ">OLL</button>
                
                <button class="${currentTab === 'pll' ? 'active':''}" id="btn-tab-pll" style="
                    flex: 1; 
                    padding: 8px 12px; 
                    font-size: 13px; 
                    font-weight: 600; 
                    border: none; 
                    border-radius: var(--radius-sm, 4px); 
                    cursor: pointer; 
                    background: ${currentTab === 'pll' ? 'var(--accent)' : 'transparent'}; 
                    color: ${currentTab === 'pll' ? 'var(--text-bright)' : 'var(--text-main)'};
                    transition: all 0.2s ease;
                ">PLL</button>
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