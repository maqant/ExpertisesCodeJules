/**
 * Extracteur RTF minimaliste
 * Convertit le RTF en texte brut en gérant les groupes et les caractères hexadécimaux.
 */
export const extractTextFromRTF = (rtf) => {
    // Expression régulière pour capturer :
    // - Les commandes RTF (\cmd ou \cmd123)
    // - Les caractères encodés en hex (\'e9)
    // - Les accolades { }
    // - Les blocs de texte brut
    const rtfRegex = /\\\\([a-z]{1,32})(-?\d+)? ?|\\\\\\'([0-9a-fA-F]{2})|[{}]|[^\\\\{}]+/ig;
    
    let text = "";
    let match;
    let groupDepth = 0;
    let skipGroupDepth = -1;

    // Décodage Windows-1252 pour les hex \xx
    const decoder = new TextDecoder('windows-1252');

    while ((match = rtfRegex.exec(rtf)) !== null) {
        const token = match[0];
        
        if (token === "{") {
            groupDepth++;
        } else if (token === "}") {
            if (groupDepth === skipGroupDepth) {
                skipGroupDepth = -1;
            }
            groupDepth--;
        } else if (token.startsWith("\\*")) {
            if (skipGroupDepth === -1) skipGroupDepth = groupDepth;
        } else if (token.startsWith("\\'")) {
            if (skipGroupDepth === -1) {
                const hex = match[3];
                // Conversion hex -> char avec support étendu (Windows-1252)
                const charCode = parseInt(hex, 16);
                const bytes = new Uint8Array([charCode]);
                text += decoder.decode(bytes);
            }
        } else if (token.startsWith("\\")) {
            if (skipGroupDepth === -1) {
                const cmd = match[1];
                if (cmd === "par" || cmd === "line") {
                    text += "\\n";
                } else if (cmd === "tab") {
                    text += "\\t";
                } else if (["fonttbl", "colortbl", "stylesheet", "info"].includes(cmd)) {
                    // Commandes connues à ignorer avec leur contenu
                    skipGroupDepth = groupDepth;
                }
            }
        } else {
            // Texte normal
            if (skipGroupDepth === -1) {
                text += token.replace(/\\r|\\n/g, ""); // Le RTF ignore les retours à la ligne physiques
            }
        }
    }
    
    return text.trim();
};
