// v6.0.0 - Context Vault & Mail Generator
import React, { useState, useRef } from 'react';

const GeneratedDocModal = ({ isOpen, generatedText, onClose }) => {
    const [copied, setCopied] = useState(false);
    const contentRef = useRef(null);

    if (!isOpen || !generatedText) return null;

    // Nettoyer les éventuels backticks markdown que l'IA pourrait ajouter
    const cleanHtml = generatedText.replace(/^```html\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

    const handleCopy = async () => {
        if (!contentRef.current) return;
        
        try {
            const html = contentRef.current.innerHTML;
            const text = contentRef.current.innerText;

            const htmlBlob = new Blob([html], { type: 'text/html' });
            const textBlob = new Blob([text], { type: 'text/plain' });

            const clipboardItem = new ClipboardItem({
                'text/html': htmlBlob,
                'text/plain': textBlob
            });

            await navigator.clipboard.write([clipboardItem]);
            
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.warn("ClipboardItem non supporté, utilisation du fallback texte brut.", err);
            // Fallback pour les navigateurs sans clipboard API avancée
            const textarea = document.createElement('textarea');
            textarea.value = contentRef.current.innerText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[800px] max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-800/50 shrink-0">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                        <span>📄</span> Déclaration générée (Éditable)
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                        title="Fermer"
                    >
                        ✕
                    </button>
                </div>

                {/* Corps — texte généré HTML rendu */}
                <div className="flex-1 overflow-y-auto p-5 min-h-0">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
                        <div 
                            ref={contentRef}
                            contentEditable={true}
                            suppressContentEditableWarning={true}
                            dangerouslySetInnerHTML={{ __html: cleanHtml }}
                            className="text-sm text-slate-200 font-sans leading-relaxed outline-none 
                                       [&>p]:mb-4 
                                       [&>table]:w-full [&>table]:border-collapse [&>table]:my-4 [&>table]:text-left
                                       [&>table>thead>tr>th]:border [&>table>thead>tr>th]:border-slate-600 [&>table>thead>tr>th]:bg-slate-700 [&>table>thead>tr>th]:p-2
                                       [&>table>tbody>tr>td]:border [&>table>tbody>tr>td]:border-slate-600 [&>table>tbody>tr>td]:p-2
                                       focus:ring-2 focus:ring-emerald-500/50 rounded transition-all"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-800/50 shrink-0">
                    <span className="text-xs text-slate-500 italic">
                        Généré par IA — Relisez avant envoi
                    </span>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded transition-colors"
                        >
                            Fermer
                        </button>
                        <button
                            onClick={handleCopy}
                            className={`px-4 py-2 text-white text-sm font-bold rounded shadow transition-all flex items-center gap-2 ${
                                copied 
                                    ? 'bg-green-600 hover:bg-green-500' 
                                    : 'bg-indigo-600 hover:bg-indigo-500'
                            }`}
                        >
                            {copied ? '✅ Copié !' : '📋 Copier dans le presse-papier'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeneratedDocModal;
