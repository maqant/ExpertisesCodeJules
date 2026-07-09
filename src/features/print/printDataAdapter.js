import { getCompteDeName, findOccByCompteDe, fmtOccName } from '../../utils/formatters';
import { buildOccupantHierarchy } from '../../domain/occupantsHierarchy';

/**
 * Normalise un texte multiligne issu de données déstructurées.
 *  - \r\n → \n
 *  - 2+ sauts consécutifs → 1 seul
 *  - trim des lignes et du bloc
 */
export function normalizeMultiline(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim();
}

/**
 * Construit une structure de données unique, stable et sérialisable.
 * Indépendante du rendu Web et du rendu PDF.
 * Ne contient aucun composant React, accès DOM, Context ou fonction non sérialisable.
 * 
 * @param {Object} input - Données brutes issues des stores et contextes
 * @returns {Object} reportData
 */
export const buildPrintReportData = (input) => {
    const {
        formData = {},
        blockTitles = {},
        references = [],
        occupants = [],
        expenses = [],
        customBlocks = [],
        styles = {},
        showSubtotals = false,
        orgaAdvancedMode = false,
        getSortedBlocks = () => [],
        getPaginationInfo = () => null,
        causeTimeline = [],
        intervenantsList = [],
        attachedPhotos = {},
        responsablesIds = []
    } = input;

    // Calculs de base
    const totalFrais = expenses.reduce((acc, curr) => {
        const val = parseFloat((curr.montant || '0').toString().replace(',', '.'));
        return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const dettesParPersonne = expenses.reduce((acc, exp) => {
        const p = getCompteDeName(exp.compteDe, occupants);
        if (!acc[p]) acc[p] = { HTVA: 0, TVAC: 0, Forfait: 0, Franchise: 0, lignes: [] };
        const val = parseFloat((exp.montant || '0').toString().replace(',', '.'));
        const safeVal = isNaN(val) ? 0 : val;
        
        if (exp.isFranchise) {
            acc[p].Franchise += safeVal;
        } else if (exp.typeMontant === 'HTVA') {
            acc[p].HTVA += safeVal;
        } else if (exp.typeMontant === 'TVAC') {
            acc[p].TVAC += safeVal;
        } else if (exp.typeMontant === 'Forfait') {
            acc[p].Forfait += safeVal;
        }
        
        acc[p].lignes.push(exp);
        return acc;
    }, {});

    // Helper formatter sans React
    const formatShortCompteDe = (compteDeStr) => {
        if (!compteDeStr || typeof compteDeStr !== 'string') return '';
        const occupant = findOccByCompteDe(compteDeStr, occupants);
        if (occupant) {
            const nomAffiche = occupant.nom || '';
            if (occupant.etage && occupant.etage.trim() !== '') {
                return `${nomAffiche} (${occupant.etage.trim()})`;
            }
            return nomAffiche;
        }
        const namePart = compteDeStr.includes(' - ') ? compteDeStr.split(' - ').slice(1).join(' - ').trim() : compteDeStr.trim();
        return namePart.split(' ')[0];
    };

    // Assemblage final de reportData
    return {
        meta: {
            orderedBlocks: getSortedBlocks(),
            styles,
            showSubtotals,
            orgaAdvancedMode
        },
        titre: {
            formData: { ...formData }
        },
        coord: {
            title: blockTitles.coord,
            formData: { ...formData },
            references: [ ...references ],
            paginationDocMailExpertise: getPaginationInfo('doc_mail_expertise')?.text
        },
        infos: {
            title: blockTitles.infos,
            formData: { ...formData },
            paginationDocMailDeclaration: getPaginationInfo('doc_mail_declaration')?.text,
            paginationDocCondPart: getPaginationInfo('doc_cond_part')?.text,
            paginationDocPvPolice: getPaginationInfo('doc_pv_police')?.text,
            paginationDocCondGen: getPaginationInfo('doc_cond_gen')?.text
        },
        cause: {
            title: blockTitles.cause,
            timeline: causeTimeline.map(item => ({ ...item, content: normalizeMultiline(item.content) })),
            formDataCause: normalizeMultiline(formData.cause),
            paginationDocRapportCause: getPaginationInfo('doc_rapport_cause')?.text
        },
        orga: {
            title: blockTitles.orga,
            occupantsHierarchy: buildOccupantHierarchy(occupants).map(o => ({
                ...o,
                depth: o._depth ?? 0,
                isResponsible: responsablesIds.includes(o.id),
                formattedNomPrenom: `${o.nom || '___'} ${o.prenom || ''}`.trim()
            })),
            intervenants: intervenantsList.map(i => ({ ...i }))
        },
        frais: {
            title: blockTitles.frais,
            totalFrais,
            expenses: expenses.map(exp => {
                const pagInfo = getPaginationInfo(exp.id);
                return {
                    ...exp,
                    compteDeFormatted: formatShortCompteDe(exp.compteDe),
                    annexReference: pagInfo ? pagInfo.text : null
                };
            }),
            dettesParPersonne: Object.entries(dettesParPersonne).reduce((acc, [personne, data]) => {
                acc[personne] = {
                    ...data,
                    compteDeFormatted: formatShortCompteDe(personne)
                };
                return acc;
            }, {})
        },
        frais_liste: {
            dettesParPersonne: Object.entries(dettesParPersonne).map(([personne, data]) => {
                const matchOcc = occupants.find(o => fmtOccName(o) === personne);
                return {
                    personne,
                    compteDeFormatted: formatShortCompteDe(personne),
                    isExpertClient: matchOcc?.contreExpert,
                    nomContreExpert: matchOcc?.nomContreExpert || '',
                    HTVA: data.HTVA,
                    TVAC: data.TVAC,
                    Forfait: data.Forfait,
                    Franchise: data.Franchise,
                    lignes: data.lignes.map(l => ({
                        prestataire: l.prestataire,
                        desc: normalizeMultiline(l.desc),
                        montant: l.montant,
                        typeMontant: l.typeMontant,
                        avisCouverture: l.avisCouverture
                    }))
                };
            })
        },
        photos: {
            title: blockTitles.photos,
            occupantsWithPhotos: occupants
                .filter(o => attachedPhotos && attachedPhotos[o.id] && attachedPhotos[o.id].length > 0)
                .map(occ => {
                    const pagInfo = getPaginationInfo('doc_photos_occ_' + occ.id);
                    return {
                        id: occ.id,
                        nom: occ.nom,
                        annexReference: pagInfo ? pagInfo.text : null,
                        imageUuids: attachedPhotos[occ.id] || []
                    };
                })
        },
        divers: {
            title: blockTitles.divers,
            formDataDivers: normalizeMultiline(formData.divers)
        },
        customBlocks: customBlocks.map(b => ({ ...b }))
    };
};
