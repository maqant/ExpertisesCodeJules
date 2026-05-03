import re

with open('src/components/Workspace.jsx', 'r') as f:
    content = f.read()

# 1. Remove imports
content = content.replace("import ValidationAiModal from './ValidationAiModal';\nimport { extractDataFromDocument } from '../services/aiManager';\n", "")

# 2. Remove isAiLoading and aiValidationData state and functions
pattern = r"    const \[isAiLoading, setIsAiLoading\] = useState\(false\);\n    const \[aiValidationData, setAiValidationData\] = useState\(null\);\n\n    const handleMagicDrop = async.*?setAiValidationData\(null\);\n    };\n"
content = re.sub(pattern, "", content, flags=re.DOTALL)

# 3. Remove DropZone from frais block
pattern_dz = r'                    <div className="print:hidden mb-2 p-2 bg-slate-800/50 border border-slate-600 border-dashed rounded flex items-center justify-center">.*?</div>\n'
content = re.sub(pattern_dz, "", content, flags=re.DOTALL)

# 4. Remove ValidationAiModal
pattern_modal = r"            \{aiValidationData && \(\n                <ValidationAiModal \n                    extractedData=\{aiValidationData\.data\} \n                    onValidate=\{handleMagicDropValidate\} \n                    onCancel=\{\(\) => setAiValidationData\(null\)\} \n                />\n            \)\}\n"
content = re.sub(pattern_modal, "", content, flags=re.DOTALL)

# 5. Remove 'addExpense, handleAttachFile' from Context destructure (only if they aren't used elsewhere)
# They are only used by magic drop so we can safely remove them. Wait, let's keep them if they are.
content = content.replace(",\n        addExpense, handleAttachFile", "")


with open('src/components/Workspace.jsx', 'w') as f:
    f.write(content)
