const DB_NAME = 'CuberTrainerDB';
const DB_VERSION = 1;

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Erro ao abrir o banco de dados:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // 1. Tabela de tempos cronometrados
            if (!db.objectStoreNames.contains('times')) {
                db.createObjectStore('times', { keyPath: 'id', autoIncrement: true });
            }
            
            // 2. Tabela de estado dos casos (F2L, OLL, PLL - aprendido, erros, acertos)
            if (!db.objectStoreNames.contains('casesState')) {
                db.createObjectStore('casesState', { keyPath: 'uid' }); // uid ex: "f2l-01"
            }

            // 3. Tabela de estatísticas gerais do usuário (como o Streak de dias)
            if (!db.objectStoreNames.contains('userStats')) {
                db.createObjectStore('userStats', { keyPath: 'key' });
            }
        };
    });
}

// 👑 BUSCAR UM ITEM ESPECÍFICO (Faltava esta função para o dashboard/streak)
export function getFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const getRequest = store.get(key);
            
            getRequest.onsuccess = () => {
                resolve(getRequest.result);
            };
            
            getRequest.onerror = (e) => {
                reject(e.target.error);
            };
        };
        
        request.onerror = (e) => reject(e.target.error);
    });
}

// BUSCAR TODOS OS ITENS DE UMA TABELA
export function getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = () => {
                resolve(getAllRequest.result);
            };
            
            getAllRequest.onerror = (e) => {
                reject(e.target.error);
            };
        };
        
        request.onerror = (e) => reject(e.target.error);
    });
}

// SALVAR OU ATUALIZAR DADOS
export function saveToStore(storeName, data) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const putRequest = store.put(data);
            
            putRequest.onsuccess = () => {
                resolve(putRequest.result); // Retorna o ID gerado (útil para o timer pegar o ID e deletar/aplicar DNF)
            };
            
            putRequest.onerror = (e) => {
                reject(e.target.error);
            };
        };
        
        request.onerror = (e) => reject(e.target.error);
    });
}

// DELETAR UM REGISTRO ESPECÍFICO (Usado no timer para apagar solves ruins)
export function deleteFromStore(storeName, id) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Se for a tabela de tempos, força a chave ser um número para o IndexedDB mapear o autoIncrement corretamente
            const key = storeName === 'times' && typeof id !== 'number' ? (Number(id) || id) : id;
            const deleteRequest = store.delete(key);
            
            deleteRequest.onsuccess = () => {
                resolve(true);
            };
            
            deleteRequest.onerror = (e) => {
                console.error(`Erro ao deletar item ${id} da store ${storeName}:`, e.target.error);
                reject(e.target.error);
            };
        };
        
        request.onerror = (e) => reject(e.target.error);
    });
}

// Remove completamente o banco de dados do navegador
// Função para resetar completamente o CuberTrainerDB
export function clearAllDatabase() {
    return new Promise((resolve, reject) => {
        // 🔥 PASSO CRÍTICO: Fecha a conexão ativa para o navegador não bloquear a exclusão.
        // Se a sua variável global de conexão tiver outro nome (como 'database' ou 'localDb'), 
        // mude o termo 'db' abaixo para o nome dela.
        if (typeof db !== 'undefined' && db) {
            db.close(); 
        }

        // 🎯 Alvo corrigido com o nome exato do seu banco de dados
        const req = indexedDB.deleteDatabase('CuberTrainerDB'); 
        
        req.onsuccess = () => {
            console.log("Banco CuberTrainerDB deletado com sucesso.");
            resolve();
        };
        req.onerror = (err) => {
            console.error("Erro ao deletar o banco:", err);
            reject(err);
        };
        req.onblocked = () => {
            console.warn("A exclusão foi bloqueada por uma aba ou conexão aberta. Limpando storages de segurança.");
            localStorage.clear();
            sessionStorage.clear();
            resolve();
        };
    });
}