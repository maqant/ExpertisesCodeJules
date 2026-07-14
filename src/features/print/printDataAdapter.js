import { getCompteDeName, findOccByCompteDe, fmtOccName, formatExpertDisplay } from '../../utils/formatters';
import { buildOccupantHierarchy } from '../../domain/occupantsHierarchy';
import { formatExpertiseTitle } from '../../utils/titleFormatter';
import { accumulateFrais, createTotauxAccumulator, normalizeTypeMontant, parseMontant } from '../../domain/montantTypes';

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
        responsablesIds = [],
        dynamicFreeAnnexes = []
    } = input;

    // Helper pour générer l'objet { id, text } de référence d'annexe
    const getAnnexRef = (docId) => {
        const info = getPaginationInfo(docId);
        return info ? { id: docId, text: info.text } : null;
    };

    // Calculs de base
    const totalFrais = expenses.reduce((acc, curr) => {
        return acc + parseMontant(curr.montant);
    }, 0);

    const dettesParPersonne = expenses.reduce((acc, exp) => {
        const p = getCompteDeName(exp.compteDe, occupants);
        if (!acc[p]) {
            acc[p] = { ...createTotauxAccumulator(), Franchise: 0, lignes: [] };
        }
        
        if (exp.isFranchise) {
            acc[p].Franchise += parseMontant(exp.montant);
        } else {
            accumulateFrais(acc[p], exp.typeMontant, exp.montant, `adapter/${p}`);
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
            formData: { ...formData },
            formattedTitle: formatExpertiseTitle(formData)
        },
        coord: {
            title: blockTitles.coord,
            formData: { ...formData },
            expertDisplay: formatExpertDisplay(formData.bureau, formData.expertInfos ?? formData.expert),
            expertContradictoireDisplay: formatExpertDisplay(formData.bureauContradictoire, formData.expertContradictoire),
            paginationDocMailExpertise: getAnnexRef('doc_mail_expertise')
        },
        infos: {
            title: blockTitles.infos,
            formData: { ...formData },
            references: [ ...references ],
            paginationDocMailDeclaration: getAnnexRef('doc_mail_declaration'),
            paginationDocCondPart: getAnnexRef('doc_cond_part'),
            paginationDocPvPolice: getAnnexRef('doc_pv_police'),
            paginationDocCondGen: getAnnexRef('doc_cond_gen')
        },
        cause: {
            title: blockTitles.cause,
            timeline: causeTimeline.map(item => ({ ...item, content: normalizeMultiline(item.content) })),
            formDataCause: normalizeMultiline(formData.cause),
            paginationDocRapportCause: getAnnexRef('doc_rapport_cause')
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
                const htva = data.HTVA || 0;
                const tvac = data.TVAC || 0;
                const forfait = data.Forfait || 0;
                const total = data.totalGlobal || 0;
                const aVentilation = [htva, tvac, forfait].filter(n => n !== 0).length >= 2;

                acc[personne] = {
                    ...data,
                    Total: total,
                    aVentilation,
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
                    Total: data.totalGlobal || 0,
                    lignes: data.lignes.map(l => ({
                        prestataire: l.prestataire,
                        desc: normalizeMultiline(l.desc),
                        montant: l.montant,
                        typeMontant: l.typeMontant,
                        typeMontantNormalise: normalizeTypeMontant(l.typeMontant, { silent: true }),
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
                    const annexeId = 'doc_photos_occ_' + occ.id;
                    return {
                        id: occ.id,
                        nom: occ.nom,
                        annexReference: getAnnexRef(annexeId),
                        imageUuids: (attachedPhotos[occ.id] || []).map(p => p.dbKey).filter(Boolean)
                    };
                })
        },
        divers: {
            title: blockTitles.divers,
            formDataDivers: normalizeMultiline(formData.divers)
        },
        annexesLibres: {
            title: blockTitles.annexes_libres || "Annexes supplémentaires",
            annexes: dynamicFreeAnnexes.map(file => {
                const docName = file.customName || file.name;
                const pagInfo = getPaginationInfo(file.id, docName);
                return {
                    id: file.id,
                    nom: docName,
                    description: pagInfo ? `Voir annexe n°${pagInfo.num} (Page ${pagInfo.startPage})` : ''
                };
            })
        },
        customBlocks: customBlocks.map(b => ({ ...b }))
    };
};
