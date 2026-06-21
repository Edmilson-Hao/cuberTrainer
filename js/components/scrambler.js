/**
 * 🎲 Utilitário de Engenharia de Scrambles para CubeSpeeding
 * Localizado em: ./js/components/scrambler.js
 */

/**
 * Inverte matematicamente um algoritmo para gerar um Scramble Inverso.
 * Aplique o resultado no cubo resolvido para gerar o caso exato.
 * @param {string} alg - O algoritmo original (Ex: "R U R' U'")
 * @returns {string} - O scramble inverso (Ex: "U R U' R'")
 */
export function gerarScrambleInverso(alg) {
    if (!alg) return '';

    // Limpa espaços extras e divide o algoritmo em movimentos individuais
    const movimentos = alg.trim().split(/\s+/);
    const movimentosInvertidos = [];

    // Varre o algoritmo de trás para frente
    for (let i = movimentos.length - 1; i >= 0; i--) {
        const mov = movimentos[i];
        
        if (mov.endsWith("'")) {
            // Se era anti-horário (R'), vira horário (R)
            movimentosInvertidos.push(mov.slice(0, -1));
        } else if (mov.endsWith('2')) {
            // Se era duplo (U2), continua duplo (U2)
            movimentosInvertidos.push(mov);
        } else if (mov.length > 0) {
            // Se era horário (R), vira anti-horário (R')
            movimentosInvertidos.push(mov + "'");
        }
    }

    return movimentosInvertidos.join(' ');
}

/**
 * Decompõe um algoritmo em movimentos atômicos para mapeamento do metrônomo.
 * Remove parênteses de gatilhos (triggers) comuns de speedcubing.
 * @param {string} alg - Ex: "(R U R' U') R' F R F'"
 * @returns {Array<string>} - Ex: ['R', 'U', 'R\'', 'U\'', 'R\'', 'F', 'R', 'F\'']
 */
export function decomporAlgoritmo(alg) {
    if (!alg) return [];
    // Remove parênteses utilizados para agrupar triggers visuais
    const limpo = alg.replace(/[()]/g, '');
    return limpo.trim().split(/\s+/);
}