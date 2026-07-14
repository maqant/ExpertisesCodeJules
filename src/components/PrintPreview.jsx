import React, { useContext } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';
import { useFinanceStore } from '../store/financeStore';
import { buildPrintReportData } from '../features/print/printDataAdapter';
import PrintPreviewWeb from '../features/print/web/PrintPreviewWeb';

const PrintPreview = () => {
    const context = useContext(ExpertiseContext);
    if (!context) return null;

    const {
        setIsPreviewMode, formData, blockTitles, references, occupants, expenses,
        customBlocks, styles, showSubtotals, orgaAdvancedMode,
        getSortedBlocks, getPaginationInfo, causeTimeline,
        intervenantsList, telemetry, attachedPhotos, dynamicFreeAnnexes
    } = context;

    const responsablesIds = useFinanceStore(state => state.metier?.responsablesIds) || [];

    const reportData = buildPrintReportData({
        formData, blockTitles, references, occupants, expenses,
        customBlocks, styles, showSubtotals, orgaAdvancedMode,
        getSortedBlocks, getPaginationInfo, causeTimeline,
        intervenantsList, attachedPhotos, responsablesIds, dynamicFreeAnnexes
    });

    const handleBack = () => {
        if (telemetry) telemetry.logEvent('CLICK', 'btn_print_preview_retour');
        setIsPreviewMode(false);
    };

    const handlePrint = () => {
        if (telemetry) telemetry.logEvent('CLICK', 'btn_print_preview_lancer');
        window.print();
    };

    return (
        <PrintPreviewWeb 
            reportData={reportData} 
            onBack={handleBack} 
            onPrint={handlePrint} 
        />
    );
};

export default PrintPreview;
