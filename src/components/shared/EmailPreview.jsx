import React, { useRef, useState, useEffect } from 'react';
import { sanitizeHtml } from '../../services/utils/htmlSanitizer';
import { copyHtmlToClipboard } from '../../services/utils/clipboardUtils';
import { Copy, Check } from 'lucide-react';

const EmailPreview = ({ htmlText, isFinalized, isLoading, onContentChange }) => {
    const contentRef = useRef(null);
    const [copied, setCopied] = useState(false);
    const [sanitizedHtml, setSanitizedHtml] = useState('');

    useEffect(() => {
        if (htmlText) {
            setSanitizedHtml(sanitizeHtml(htmlText));
        } else {
            setSanitizedHtml('');
        }
    }, [htmlText]);

    const handleCopy = async () => {
        if (!contentRef.current) return;
        const success = await copyHtmlToClipboard(contentRef.current);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleBlur = () => {
        if (onContentChange && contentRef.current) {
            onContentChange(contentRef.current.innerHTML);
        }
    };

    return (
        <div className="flex flex-col bg-slate-900 border border-slate-700 rounded-xl overflow-hidden relative flex-1">
            <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-400/80" />
                    <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                    <h3 className="text-xs font-medium text-slate-400 ml-2">Aperçu Outlook</h3>
                    {isFinalized && (
                        <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full font-medium ml-2">
                            ✓ Finalisé
                        </span>
                    )}
                </div>
                {htmlText && (
                    <button
                        onClick={handleCopy}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${copied ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                    >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copié !' : 'Copier'}
                    </button>
                )}
            </div>

            <div className="relative flex-1 overflow-auto p-5 min-h-[300px]">
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
                        <span className="animate-pulse text-sm text-slate-300">Génération en cours…</span>
                    </div>
                )}
                
                {htmlText ? (
                    <div 
                        ref={contentRef}
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onBlur={handleBlur}
                        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                        className="text-sm text-slate-200 font-sans leading-relaxed outline-none 
                                   [&>p]:mb-4 [&>br]:my-1
                                   [&>table]:w-full [&>table]:border-collapse [&>table]:my-4 [&>table]:text-left
                                   [&>table>thead>tr>th]:border [&>table>thead>tr>th]:border-slate-600 [&>table>thead>tr>th]:bg-slate-700 [&>table>thead>tr>th]:p-2
                                   [&>table>tbody>tr>td]:border [&>table>tbody>tr>td]:border-slate-600 [&>table>tbody>tr>td]:p-2
                                   focus:ring-2 focus:ring-emerald-500/50 rounded transition-all"
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-4 h-full">
                        <p className="text-sm">Le brouillon d'email apparaîtra ici.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmailPreview;
