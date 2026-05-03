import re

with open('src/components/Sidebar.jsx', 'r') as f:
    content = f.read()

# Add the state variables if missing
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

with open('src/components/Sidebar.jsx', 'w') as f:
    f.write(content)
