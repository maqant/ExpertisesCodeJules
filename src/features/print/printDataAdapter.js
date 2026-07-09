import { getCompteDeName, findOccByCompteDe, fmtOccName } from '../../utils/formatters';
import { buildOccupantHierarchy } from '../../domain/occupantsHierarchy';

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
        responsablesIds = [],
        attachedPhotos = {}
    } = input;

    // Helper de formatage local
    const formatMontant = (val) => {
        const num = parseFloat((val || '0').toString().replace(',', '.'));
        return isNaN(num) ? 0 : num;
    };

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

    const getPagText = (id) => {
        const pagInfo = getPaginationInfo(id);
        return pagInfo ? pagInfo.text : null;
    };

    const orderedBlocks = getSortedBlocks();

    const reportData = {
        metadata: {
            isContradictoire: !!formData.isContradictoire,
            showSubtotals: !!showSubtotals,
            orgaAdvancedMode: !!orgaAdvancedMode
        },
        styles: { ...styles },
        blocks: orderedBlocks,
        customBlocks: customBlocks.map(cb => ({
            id: cb.id,
            title: cb.title || '',
            text: cb.text || ''
        }))
    };

    if (orderedBlocks.includes('titre')) {
        let dateFormatted = '...';
        if (formData.dateExp) {
            const d = new Date(formData.dateExp);
            dateFormatted = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        const heureFormatted = formData.heureExp ? ` à ${formData.heureExp.replace(':', 'h')}` : '';
        const refFormatted = formData.refPechard ? `- ${formData.refPechard}` : '';
        const resFormatted = formData.nomResidence ? `- ${formData.nomResidence}` : '';

        reportData.titre = {
            dateFormatted: `Expertise du ${dateFormatted}${heureFormatted} ${refFormatted} ${resFormatted}`.trim(),
            raw: {
                dateExp: formData.dateExp || '',
                heureExp: formData.heureExp || '',
                refPechard: formData.refPechard || '',
                nomResidence: formData.nomResidence || ''
            }
        };
    }

    if (orderedBlocks.includes('coord')) {
        reportData.coord = {
            title: blockTitles.coord || '',
            adresse: formData.adresse || '',
            franchise: formData.franchise || '',
            pertesIndirectes: formData.pertesIndirectes || '',
            expert: (formData.bureau ? formData.bureau + ' - ' : '') + (formData.expertInfos || ''),
            mailExpertiseAnnexe: getPagText('doc_mail_expertise'),
        };
        if (formData.isContradictoire) {
            reportData.coord.contradictoire = {
                cie: formData.cieContradictoire || '',
                expert: (formData.bureauContradictoire ? formData.bureauContradictoire + ' - ' : '') + (formData.expertContradictoire || ''),
                compteDe: formData.compteDeContradictoire || ''
            };
        }
    }

    if (orderedBlocks.includes('infos')) {
        const formatD = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '...';
        reportData.infos = {
            title: blockTitles.infos || '',
            sinistreDu: `Sinistre du ${formatD(formData.dateSinistre)}`,
            declareLe: `déclaré au Bureau Pechard le ${formatD(formData.dateDeclaration)}`,
            declarant: `par ${formData.declarant || '...'}`,
            declarationAnnexe: getPagText('doc_mail_declaration'),
            nomCie: formData.nomCie || '',
            nomContrat: formData.nomContrat || '',
            condPartAnnexe: getPagText('doc_cond_part'),
            numPolice: formData.numPolice || '',
            numeroPVPolice: formData.numeroPVPolice || '',
            pvPoliceAnnexe: getPagText('doc_pv_police'),
            numConditionsGenerales: formData.numConditionsGenerales || '',
            condGenAnnexe: getPagText('doc_cond_gen'),
            numSinistreCie: formData.numSinistreCie || '',
            references: references.map(r => ({ id: r.id, nom: r.nom || '', ref: r.ref || '' }))
        };
    }

    if (orderedBlocks.includes('cause')) {
        reportData.cause = {
            title: blockTitles.cause || '',
            timeline: (causeTimeline || []).map((item, idx) => ({
                id: item.id || String(idx),
                date: item.date || '',
                type: item.type || '',
                fileName: item.fileName || '',
                content: item.content || ''
            })),
            texte: formData.cause || '',
            rapportCauseAnnexe: getPagText('doc_rapport_cause')
        };
    }

    if (orderedBlocks.includes('orga')) {
        reportData.orga = {
            title: blockTitles.orga || '',
            occupants: buildOccupantHierarchy(occupants).map(o => ({
                id: o.id,
                depth: o._depth || 0,
                etage: o.etage || '-',
                statut: o.statut || '',
                nomComplet: `${o.nom || '___'} ${o.prenom || ''}`.trim(),
                isResponsible: responsablesIds.includes(o.id),
                iban: o.iban || '',
                tel: o.tel || '',
                email: o.email || '',
                rc: o.rc || '',
                rcPolice: o.rcPolice || '',
                secAssurance: o.secAssurance || '',
                secType: o.secType || '',
                secCie: o.secCie || '',
                secPolice: o.secPolice || '',
                rawNom: o.nom,
                rawContreExpert: o.contreExpert,
                rawNomContreExpert: o.nomContreExpert
            })),
            intervenants: (intervenantsList || []).map(i => ({
                id: i.id,
                nom: i.nom || '',
                prenom: i.prenom || '',
                role: i.role || '',
                societe: i.societe || '',
                tel: i.tel || '',
                email: i.email || ''
            }))
        };
    }

    if (orderedBlocks.includes('frais') || orderedBlocks.includes('frais_liste')) {
        let totalFraisNum = 0;
        const dettesMap = {};

        const lignes = expenses.map((exp, index) => {
            const num = formatMontant(exp.montant);
            totalFraisNum += num;

            const personneName = getCompteDeName(exp.compteDe, occupants);
            if (!dettesMap[personneName]) {
                dettesMap[personneName] = { HTVA: 0, TVAC: 0, Forfait: 0, Franchise: 0, lignes: [] };
            }

            if (exp.isFranchise) dettesMap[personneName].Franchise += num;
            else if (exp.typeMontant === 'HTVA') dettesMap[personneName].HTVA += num;
            else if (exp.typeMontant === 'TVAC') dettesMap[personneName].TVAC += num;
            else if (exp.typeMontant === 'Forfait') dettesMap[personneName].Forfait += num;

            dettesMap[personneName].lignes.push(exp);

            return {
                id: exp.id,
                index: index + 1,
                prestataire: exp.prestataire || '',
                type: exp.type || '',
                ref: exp.ref || '',
                desc: exp.desc || '',
                annexReference: getPagText(exp.id),
                compteDeCourt: formatShortCompteDe(exp.compteDe),
                montantFormate: (exp.montant || '').toString(),
                typeMontant: exp.typeMontant || '',
                isFranchise: !!exp.isFranchise,
                avisCouverture: exp.avisCouverture || ''
            };
        });

        const decomptes = Object.entries(dettesMap).map(([personne, data]) => {
            const matchOcc = occupants.find(o => fmtOccName(o) === personne);
            return {
                compteDeCourt: formatShortCompteDe(personne),
                isExpertClient: !!(matchOcc && matchOcc.contreExpert),
                nomContreExpert: matchOcc ? matchOcc.nomContreExpert : '',
                htvaFormate: data.HTVA.toFixed(2).replace('.', ','),
                tvacFormate: data.TVAC.toFixed(2).replace('.', ','),
                forfaitFormate: data.Forfait.toFixed(2).replace('.', ','),
                franchiseFormate: data.Franchise.toFixed(2).replace('.', ','),
                htvaNum: data.HTVA,
                tvacNum: data.TVAC,
                forfaitNum: data.Forfait,
                franchiseNum: data.Franchise,
                lignes: data.lignes.map(l => ({
                    prestataire: l.prestataire || '',
                    desc: l.desc || '',
                    montantFormate: (l.montant || '0').toString(),
                    typeMontant: l.typeMontant || '',
                    avisCouverture: l.avisCouverture || '',
                    // On conserve la trace brute si besoin
                    typeMontantBrut: l.typeMontant,
                    isFranchise: !!l.isFranchise
                }))
            };
        });

        reportData.frais = {
            title: blockTitles.frais || '',
            lignes,
            totalFraisNum,
            totalFraisFormate: totalFraisNum.toFixed(2).replace('.', ','),
            decomptes
        };
    }

    if (orderedBlocks.includes('photos')) {
        const occsWithP = occupants.filter(o => attachedPhotos[o.id] && attachedPhotos[o.id].length > 0);

        reportData.photos = {
            title: blockTitles.photos || '',
            occupantsWithPhotos: occsWithP.map(o => ({
                id: o.id,
                nom: o.nom || '',
                annexReference: getPagText('doc_photos_occ_' + o.id)
            }))
        };
    }

    if (orderedBlocks.includes('divers')) {
        reportData.divers = {
            title: blockTitles.divers || '',
            texte: formData.divers || ''
        };
    }

    return reportData;
};
