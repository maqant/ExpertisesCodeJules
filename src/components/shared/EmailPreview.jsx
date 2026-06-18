import React, { useRef, useState, useEffect } from 'react';
import { sanitizeHtml } from '../../services/utils/htmlSanitizer';
import { copyHtmlToClipboard } from '../../services/utils/clipboardUtils';
import { Copy, Check } from 'lucide-react';

const EmailPreview = ({ htmlText, isFinalized, onContentChange }) => {
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

    const handleInput = () => {
        if (onContentChange && contentRef.current) {
            onContentChange(contentRef.current.innerHTML);
        }
    };

    return (
        <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden relative flex-1">
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-700">Aperçu Outlook</h3>
                    {isFinalized && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                            ✓ Finalisé
                        </span>
                    )}
                </div>
                {htmlText && (
                    <button
                        onClick={handleCopy}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copié !' : 'Copier'}
                    </button>
                )}
            </div>

            {htmlText ? (
                <div className="flex-1 overflow-y-auto p-5 min-h-[300px]">
                    <div 
                        ref={contentRef}
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onInput={handleInput}
                        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                        className="text-sm text-slate-800 font-sans leading-relaxed outline-none 
                                   [&>p]:mb-4 [&>br]:my-1
                                   [&>table]:w-full [&>table]:border-collapse [&>table]:my-4 [&>table]:text-left
                                   [&>table>thead>tr>th]:border [&>table>thead>tr>th]:border-slate-300 [&>table>thead>tr>th]:bg-slate-100 [&>table>thead>tr>th]:p-2
                                   [&>table>tbody>tr>td]:border [&>table>tbody>tr>td]:border-slate-300 [&>table>tbody>tr>td]:p-2
                                   focus:ring-2 focus:ring-indigo-500/50 rounded transition-all"
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-4 min-h-[300px]">
                    <p className="text-sm">Le brouillon d'email apparaîtra ici.</p>
                </div>
            )}
        </div>
    );
};

export default EmailPreview;
