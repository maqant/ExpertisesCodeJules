import re

with open('src/components/Sidebar.jsx', 'r') as f:
    content = f.read()

# Add addExpense and handleAttachFile to the context destructuring
context_destructure_old = """    const {
        occupants, setOccupants, coverPageCount, setCoverPageCount, hideAnnexIndex, setHideAnnexIndex,
        blocksVisible, customBlocks, setCustomBlocks, blockWidths, setBlockWidths, styles, setStyles, setBlockOrder, setBlocksVisible,
        showSubtotals, setShowSubtotals, orgaAdvancedMode, setOrgaAdvancedMode,
        expenses, setExpenses,
        showFranchiseDropdown, setShowFranchiseDropdown, prestatairesList, handleAddPrestataire, formData, setFormData, blockTitles, setBlockTitles,
        addOcc, updateOcc, removeOcc, sortOccupantsByFloor, updateExpense, removeExpense, reorganizeExpenses,
        generatePDF, isMerging, downloadDossierPDF,
        attachedFiles, attachedPhotos, attachedFreeAnnexes, handleRemoveFile, handleAttachPhoto, handleRemovePhoto,
        handleAttachFreeAnnex, handleRemoveFreeAnnex, handleUpdateFreeAnnex,
        fitBlocks, setFitBlocks,
        updateAttachedPhotoDesc
    } = useContext(ExpertiseContext);"""

context_destructure_new = """    const {
        occupants, setOccupants, coverPageCount, setCoverPageCount, hideAnnexIndex, setHideAnnexIndex,
        blocksVisible, customBlocks, setCustomBlocks, blockWidths, setBlockWidths, styles, setStyles, setBlockOrder, setBlocksVisible,
        showSubtotals, setShowSubtotals, orgaAdvancedMode, setOrgaAdvancedMode,
        expenses, setExpenses,
        showFranchiseDropdown, setShowFranchiseDropdown, prestatairesList, handleAddPrestataire, formData, setFormData, blockTitles, setBlockTitles,
        addOcc, updateOcc, removeOcc, sortOccupantsByFloor, addExpense, updateExpense, removeExpense, reorganizeExpenses,
        generatePDF, isMerging, downloadDossierPDF,
        attachedFiles, attachedPhotos, attachedFreeAnnexes, handleAttachFile, handleRemoveFile, handleAttachPhoto, handleRemovePhoto,
        handleAttachFreeAnnex, handleRemoveFreeAnnex, handleUpdateFreeAnnex,
        fitBlocks, setFitBlocks,
        updateAttachedPhotoDesc
    } = useContext(ExpertiseContext);"""

content = content.replace(context_destructure_old, context_destructure_new)

with open('src/components/Sidebar.jsx', 'w') as f:
    f.write(content)
