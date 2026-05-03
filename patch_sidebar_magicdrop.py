import re

with open('src/components/Sidebar.jsx', 'r') as f:
    content = f.read()

# 1. Imports
imports = "import ValidationAiModal from './ValidationAiModal';\nimport { extractDataFromDocument } from '../services/aiManager';\n"
content = content.replace("import AnnexModal from './AnnexModal';", imports + "import AnnexModal from './AnnexModal';")

# 2. State & Functions
states = """    const [showFranchiseDropdown, setShowFranchiseDropdown] = useState(false);

    // Magic Drop states
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiValidationData, setAiValidationData] = useState(null);

    const handleMagicDrop = async (files) => {
        if (!files || files.length === 0) return;
        setIsAiLoading(true);
        const aiProvider = localStorage.getItem('aiProvider') || 'openai';
        const aiModel = localStorage.getItem('aiModel') || 'gpt-4o';

        try {
            const result = await extractDataFromDocument(files[0], 'facture', aiProvider, aiModel);
            if (result.success && result.data && result.data.expenses) {
                setAiValidationData({ data: result.data.expenses, originalFile: files[0] });
            } else {
                alert("Erreur lors de l'extraction : " + (result.error || "Format invalide"));
            }
        } catch (err) {
            alert("Erreur : " + err.message);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleMagicDropValidate = (validatedData) => {
        const newExpId = crypto.randomUUID();
        const newExp = {
            id: newExpId,
            prestataire: validatedData.prestataire || '',
            type: validatedData.type || '',
            ref: validatedData.ref || '',
            desc: validatedData.desc || '',
            compteDe: validatedData.compteDe || '',
            montant: validatedData.montant || '',
            montantReclame: validatedData.montantReclame || '',
            montantValide: validatedData.montantValide || '',
            pourcentageVetuste: validatedData.pourcentageVetuste || 0,
            motifRefus: validatedData.motifRefus || '',
            typeMontant: validatedData.typeMontant || 'HTVA',
            avisCouverture: validatedData.avisCouverture || 'Oui',
            noteCouverture: validatedData.noteCouverture || ''
        };
        addExpense(newExp);
        if (aiValidationData.originalFile) {
            handleAttachFile(newExpId, aiValidationData.originalFile);
        }
        setAiValidationData(null);
    };
"""

content = content.replace("    const [showFranchiseDropdown, setShowFranchiseDropdown] = useState(false);", states)

# 3. Add DropZone to "6. Réclamations"
dropzone_ui = """                            <AccordionHeader id="frais" num="6" />
                            <div className="p-3 space-y-2">
                                <div className="mb-2 p-2 bg-slate-800/50 border border-slate-600 border-dashed rounded flex items-center justify-center">
                                    {isAiLoading ? (
                                        <span className="text-xs text-indigo-400 font-bold">⏳ Analyse IA en cours...</span>
                                    ) : (
                                        <DropZone
                                            className="w-full h-8 border-none bg-transparent hover:bg-slate-700/50 !scale-100"
                                            onFiles={handleMagicDrop}
                                            accept="image/*,application/pdf"
                                            label={<span className="text-xs font-bold text-slate-300">🪄 Magic Drop : Glissez une facture ici</span>}
                                        />
                                    )}
                                </div>"""

content = content.replace("""                            <AccordionHeader id="frais" num="6" />
                            <div className="p-3 space-y-2">""", dropzone_ui)


# 4. Render ValidationAiModal
modal_render = """
            {aiValidationData && (
                <ValidationAiModal
                    extractedData={aiValidationData.data}
                    occupants={occupants}
                    onValidate={handleMagicDropValidate}
                    onCancel={() => setAiValidationData(null)}
                />
            )}
        </div>
        <div className={`w-1.5 bg-slate-400 hover:bg-indigo-500 ${isResizing ? 'active' : ''}`} onMouseDown={startResizing} style={{cursor: 'col-resize'}}></div>
        </>
"""
content = content.replace("""        </div>
        <div className={`w-1.5 bg-slate-400 hover:bg-indigo-500 ${isResizing ? 'active' : ''}`} onMouseDown={startResizing} style={{cursor: 'col-resize'}}></div>
        </>""", modal_render)

with open('src/components/Sidebar.jsx', 'w') as f:
    f.write(content)
