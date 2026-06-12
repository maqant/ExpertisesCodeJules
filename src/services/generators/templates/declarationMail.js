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
    const declarant = formData.declarant || '';

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

    const systemPrompt = `Ton but va être de transformer le mail d'un client ou un échange de mail de clients à propos d'un sinistre, en une déclaration de sinistre à la compagnie d'assurance.
Je suis courtier et mon job est de déclarer les sinistres à la compagnie.
Tu fais donc des phrases courtes et claires pour la compréhension.
Le style c'est genre "en date du x, l'assuré a subi x," . 
Tu parles à la 3ème personne, et tu fais attention à bien dire à la compagnie le "qui que quoi dont où " du sinistre.
IMPORTANT : Sépare bien chaque idée par un double saut de ligne <br><br> pour que le texte soit très aéré (une ligne, espace vide, ligne suivante).

Tu feras précéder ton texte par 
"Bonjour, <br><br>Nouvelle déclaration pour le contrat dont réfs. en objet."

Juste avant "À vous lire & bien cordialement", Insère les tableaux demandés avec des titres soulignés.

IMPORTANT POUR LES TABLEAUX :
- Ajoute d'abord le titre : <br>&nbsp;<br><u>Tableau des intervenants</u><br>
- Pour le tableau des parties, utilise exactement les colonnes suivantes : Étage/Unité, Rôle, Nom, Téléphone, E-mail, Autres informations.
- Ensuite ajoute le titre du second tableau en forçant un espace : <br>&nbsp;<br><u>Tableau des réclamations</u><br>
- Pour le tableau des réclamations, utilise exactement les colonnes suivantes : Prestataire, Type/Réf, Description, Compte de, Montant, Remarque. Calcule un "TOTAL DE LA RÉCLAMATION" sur la dernière ligne dans la colonne Montant (fusionne les cellules précédentes avec colspan="5"). Ne laisse aucune colonne vide. S'il n'y a pas d'info, mets un tiret "-".

Et tu le termineras par : "<br>&nbsp;<br>À vous lire & bien cordialement"

IMPORTANT : Formate TOUTE ta réponse en HTML valide. N'utilise PAS de balises <p>. Utilise UNIQUEMENT la combinaison <br>&nbsp;<br> pour créer un vrai espace vide entre tes paragraphes et entre les tableaux. Outlook supprime les <br> simples, donc tu DOIS utiliser <br>&nbsp;<br> pour forcer la ligne vide.
Pour les tableaux, utilise cette structure exacte :
<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; text-align: left;">
  <thead style="background-color: #f2f2f2;">...</thead>
  <tbody>...</tbody>
</table>
N'utilise PAS de Markdown, uniquement du HTML pur.`;

    const userContent = `--- DONNÉES DU DOSSIER ---
Date du sinistre : ${dateSinistre}
Adresse : ${adresse}
Compagnie : ${nomCie}
${numPolice ? `N° Police : ${numPolice}` : ''}
${numSinistreCie ? `N° Sinistre Cie : ${numSinistreCie}` : ''}
${declarant ? `Déclaré par : ${declarant}` : ''}
${refsStr ? `Références : ${refsStr}` : ''}

${occupantsStr ? `--- PARTIES IMPLIQUÉES ---\n${occupantsStr}\n` : ''}
${expensesStr ? `--- RÉCLAMATIONS (Frais) ---\n${expensesStr}\n` : ''}

--- TEXTES BRUTS / EMAILS / NOTES ---
${contextBrut}`;

    return { systemPrompt, userContent };
};
