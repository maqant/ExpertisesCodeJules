import { usePromptStore } from '../../../store/promptStore.js';
import { useFinanceStore } from '../../../store/financeStore.js';
import { buildFranchiseResponsibilitySentence } from '../../responsibility/responsibilityService.js';

// v6.0.0 - Context Vault & Mail Generator

/**
 * buildDeclarationPrompt — Assemble le System Prompt et le User Content
 * pour générer un mail de déclaration de sinistre.
 * 
 * @param {Object} dossierState - { formData, rawContexts, references }
 * @returns {{ systemPrompt: string, userContent: string }}
 */
export const buildDeclarationPrompt = (dossierState) => {
    const { formData = {}, rawContexts = [], references = [], expenses = [], occupants = [] } = dossierState;

    // Extraction des données clés
    const dateSinistre = formData.dateSinistre || '[DATE INCONNUE]';
    const adresse = formData.adresse || '[ADRESSE INCONNUE]';
    const nomCie = formData.nomCie || '[COMPAGNIE INCONNUE]';
    const numPolice = formData.numPolice || '';
    const numSinistreCie = formData.numSinistreCie || '';
    const numeroPVPolice = formData.numeroPVPolice || '';
    const declarant = formData.declarant || '';
    const dateDeclaration = formData.dateDeclaration || '[DATE INCONNUE]';

    // Utilitaires de formatage de l'introduction (v7.14.1)
    const formatIntroductionText = (dSinistre, dDeclaration, addr) => {
        const adresseTexte = addr && addr !== '[ADRESSE INCONNUE]' ? ` à l'adresse ${addr}` : '';
        
        if (dSinistre && dSinistre !== '[DATE INCONNUE]' && dSinistre.trim() !== '') {
            return `Sinistre en date du ${dSinistre}, l'assuré a subi un sinistre${adresseTexte}.`;
        }
        
        if (dDeclaration && dDeclaration !== '[DATE INCONNUE]' && dDeclaration.trim() !== '') {
            return `En date du ${dDeclaration}, l'assuré nous DECLARE un sinistre${adresseTexte}.`;
        }
        
        return `L'assuré nous déclare un sinistre${adresseTexte}.`;
    };

    const introSentence = formatIntroductionText(dateSinistre, dateDeclaration, adresse);

    // Contexte brut concaténé
    const contextBrut = rawContexts.length > 0
        ? rawContexts.join('\n---\n')
        : '[Aucun contexte brut disponible. Utilise uniquement les données structurées.]';

    // Références tierces formatées
    const refsStr = references.length > 0
        ? references.map(r => `${r.nom || 'Ref'}: ${r.ref || ''}`).join(', ')
        : '';

    // Occupants formatés
    const occupantsStr = occupants.length > 0
        ? occupants.map(o => {
            const contact = o.hasContact && o.contactNom ? `Contact: ${o.contactNom} (${o.contactTel || ''})` : '';
            const expert = o.contreExpert && o.nomContreExpert ? `Expert: ${o.nomContreExpert}` : '';
            const assurance = o.rc === 'Oui' ? `RC Familiale: ${o.rcPolice || 'Inconnue'}` : '';
            const infosSup = [contact, expert, assurance].filter(Boolean).join(' | ');

            return `- Étage: ${o.etage || '-'} | Rôle: ${o.statut || '-'} | Nom: ${o.nom || ''} ${o.prenom || ''} | Tél: ${o.tel || '-'} | E-mail: ${o.email || '-'} ${infosSup ? `| Autres infos: ${infosSup}` : ''}`;
        }).join('\n')
        : '';

    // Helper pour récupérer le nom du Compte De
    const getCompteDeName = (expense) => {
        if (!expense.compteDe || expense.compteDe === 'unassigned') return '-';
        const occupant = occupants.find(o => o.id === expense.compteDe);
        if (occupant) {
            const nomComplet = `${occupant.nom || ''} ${occupant.prenom || ''}`.trim();
            return occupant.etage ? `${occupant.etage} - ${nomComplet}` : nomComplet;
        }
        return expense.compteDe;
    };

    // Frais (Réclamations) formatés structurés
    const expensesStr = expenses.length > 0
        ? expenses.map(e => {
            const montantFormat = e.montant ? `${e.montant} € ${e.typeMontant || ''}` : '0 €';
            const couvertureInfo = e.avisCouverture && e.avisCouverture !== 'Oui' ? `Couverture: ${e.avisCouverture} (${e.noteCouverture || ''})` : '';
            return `- Prestataire: ${e.prestataire || 'Inconnu'} | Type/Réf: ${e.type || ''} ${e.ref ? '/ ' + e.ref : ''} | Description: ${e.desc || ''} | Compte de: ${getCompteDeName(e)} | Montant: ${montantFormat} ${couvertureInfo ? `| Remarque: ${couvertureInfo}` : ''}`;
        }).join('\n')
        : '';

    // Phrase conditionnelle sur la responsabilité (CRE)
    const responsablesIds = useFinanceStore.getState().metier?.responsablesIds || [];
    const phraseResponsabilite = buildFranchiseResponsibilitySentence({
        occupants,
        responsablesIds,
        franchiseMontant: formData.franchise || null
    });

    const occupantName = declarant || "Le déclarant";
    const basePrompt = usePromptStore.getState().getPrompt('DECLARATION_MAIL');
    const systemPrompt = basePrompt.replace('${occupantName}', occupantName);

    const userContent = `--- DONNÉES DU DOSSIER ---
Date du sinistre : ${dateSinistre}
Adresse : ${adresse}
Compagnie : ${nomCie}
${numPolice ? `N° Police : ${numPolice}` : ''}
${numeroPVPolice ? `N° PV Police : ${numeroPVPolice}` : ''}
${numSinistreCie ? `N° Sinistre Cie : ${numSinistreCie}` : ''}
${declarant ? `Déclaré par : ${declarant}` : ''}
${refsStr ? `Références : ${refsStr}` : ''}

--- INTRODUCTION OBLIGATOIRE ---
${introSentence}

${occupantsStr ? `--- PARTIES IMPLIQUÉES ---\n${occupantsStr}\n` : ''}
${phraseResponsabilite ? `--- RESPONSABILITÉ ET FRANCHISE ---\nInclure mot pour mot cette phrase dans le compte rendu d'expertise :\n"${phraseResponsabilite}"\n` : ''}
${expensesStr ? `--- RÉCLAMATIONS (Frais) ---\n${expensesStr}\n` : ''}

--- TEXTES BRUTS / EMAILS / NOTES ---
${contextBrut}`;

    return { systemPrompt, userContent };
};
