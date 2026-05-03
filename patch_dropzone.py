import re

with open('src/components/Sidebar.jsx', 'r') as f:
    content = f.read()

# Update DropZone definition to include className since we use it in the magic drop
dropzone_def_old = """const DropZone = ({ onFiles, label = "+", accept = "*" }) => {
    const [isOver, setIsOver] = useState(false);
    return (
        <div
            onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
            onDragLeave={() => setIsOver(false)}
            onDrop={(e) => { e.preventDefault(); setIsOver(false); if (e.dataTransfer.files) onFiles(Array.from(e.dataTransfer.files)); }}
            className={`w-6 h-6 rounded border-2 border-dashed flex items-center justify-center transition-all cursor-pointer ${isOver ? 'border-indigo-400 bg-indigo-500/20 scale-110' : 'border-slate-600 hover:border-slate-400 bg-slate-800/50'}`}"""

dropzone_def_new = """const DropZone = ({ onFiles, label = "+", accept = "*", className = "" }) => {
    const [isOver, setIsOver] = useState(false);
    return (
        <div
            onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
            onDragLeave={() => setIsOver(false)}
            onDrop={(e) => { e.preventDefault(); setIsOver(false); if (e.dataTransfer.files) onFiles(Array.from(e.dataTransfer.files)); }}
            className={`w-6 h-6 rounded border-2 border-dashed flex items-center justify-center transition-all cursor-pointer ${isOver ? 'border-indigo-400 bg-indigo-500/20 scale-110' : 'border-slate-600 hover:border-slate-400 bg-slate-800/50'} ${className}`}"""

content = content.replace(dropzone_def_old, dropzone_def_new)

with open('src/components/Sidebar.jsx', 'w') as f:
    f.write(content)
