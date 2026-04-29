import React, { useState, useRef } from 'react';

const DragTest = () => {
    const [items, setItems] = useState(['Pomme', 'Banane', 'Cerise', 'Datte']);
    const [expandedId, setExpandedId] = useState(null);
    const [log, setLog] = useState([]);
    const dragSrcRef = useRef(null);

    const addLog = (msg) => setLog(prev => [...prev.slice(-15), msg]);

    return (
        <div style={{ padding: 20, background: '#0f172a', color: 'white', minHeight: '100vh' }}>
            <h2 style={{ marginBottom: 10 }}>Test Drag &amp; Drop - useRef (survit aux re-renders)</h2>
            <div style={{ display: 'flex', gap: 20 }}>

                <div style={{ width: 340, background: '#1e293b', height: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                        <details open style={{ background: '#1e293b80', border: '1px solid #334155', borderRadius: 6, marginBottom: 8 }}>
                            <summary style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #334155', fontSize: 12, fontWeight: 'bold', color: '#818cf8' }}>
                                5. Organisation du bâtiment
                            </summary>
                            <div style={{ padding: 12 }}>
                                {items.map((item, index) => {
                                    const isExp = expandedId === index;
                                    return (
                                        <div
                                            key={item + index}
                                            draggable={!isExp}
                                            onDragStart={(e) => {
                                                if (isExp) { e.preventDefault(); return; }
                                                dragSrcRef.current = index;
                                                e.dataTransfer.effectAllowed = 'move';
                                                e.dataTransfer.setData('text/html', 'x');
                                                addLog(`dragStart: ${index} (${item})`);
                                            }}
                                            onDragEnter={(e) => { e.preventDefault(); addLog(`dragEnter: ${index}`); }}
                                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const src = dragSrcRef.current;
                                                addLog(`DROP: from=${src} to=${index}`);
                                                if (src === null || src === index) return;
                                                const n = [...items];
                                                const [moved] = n.splice(src, 1);
                                                n.splice(index, 0, moved);
                                                setItems(n);
                                                dragSrcRef.current = null;
                                            }}
                                            onDragEnd={() => { addLog('dragEnd'); dragSrcRef.current = null; }}
                                            style={{
                                                padding: '8px 12px',
                                                margin: '4px 0',
                                                background: '#0f172a',
                                                border: `1px solid ${isExp ? '#6366f1' : '#475569'}`,
                                                borderRadius: 4,
                                                cursor: isExp ? 'default' : 'move',
                                                fontSize: 12,
                                                position: 'relative',
                                            }}
                                        >
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setItems(prev => prev.filter((_, i) => i !== index)); }}
                                                style={{ position: 'absolute', top: 4, right: 8, color: '#f87171', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}
                                            >✕</button>

                                            {!isExp ? (
                                                <div onClick={() => setExpandedId(index)} style={{ paddingRight: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ color: '#64748b', cursor: 'grab' }}>⠿</span>
                                                    <span><strong style={{ color: 'white' }}>Étage</strong> - Locataire : {item}</span>
                                                </div>
                                            ) : (
                                                <div>
                                                    <input type="text" value={item} readOnly style={{ background: '#1e293b', border: '1px solid #475569', color: 'white', padding: '4px 8px', borderRadius: 4, width: '100%', fontSize: 12 }} />
                                                    <button onClick={() => setExpandedId(null)} style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Réduire</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <button onClick={() => setItems(prev => [...prev, `Fruit ${prev.length + 1}`])} style={{ width: '100%', marginTop: 8, background: '#4f46e5', padding: '6px', borderRadius: 4, fontSize: 12, fontWeight: 'bold', border: 'none', color: 'white', cursor: 'pointer' }}>
                                    + Ajouter
                                </button>
                            </div>
                        </details>
                    </div>
                </div>

                <div style={{ flex: 1, background: '#0f172a', padding: 12, borderRadius: 6, fontSize: 11, fontFamily: 'monospace', maxHeight: '80vh', overflowY: 'auto' }}>
                    <strong>Console:</strong>
                    {log.map((l, i) => <div key={i} style={{ color: l.startsWith('DROP') ? '#4ade80' : '#94a3b8' }}>{l}</div>)}
                </div>
            </div>
        </div>
    );
};

export default DragTest;
