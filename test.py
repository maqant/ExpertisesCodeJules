# The user thinks I use Base64 for the others but I am actually using localforage (IndexedDB).
# Why does `attachedFreeAnnexes` get lost?
# 1. `saveDossier` didn't have `attachedFreeAnnexes` included!
# Ah! If `saveDossier` didn't include `attachedFreeAnnexes`, then when the user does "Save -> Reset -> Load", `attachedFreeAnnexes` is completely empty!
# But what about the instruction: "Vérifie que la nouvelle ligne créée dans le state des annexes possède bien la chaîne de caractères du fichier (ex: fileData: "data:application/pdf;base64,..."), et non l'objet File brut. ... Standardiser le onDrop des Annexes ... celle qui utilise FileReader pour extraire le Base64"
# Wait! Let's check `Sidebar.jsx` magic drop logic. Maybe `extractDataFromDocument` uses FileReader to convert to Base64, and the user thinks I should save that Base64 string directly into `attachedFreeAnnexes` state so it's persisted in localStorage?
# Yes, `localforage` is IndexedDB. But the prompt says:
# "Au moment de la sauvegarde dans le localStorage, l'objet fichier de l'Annexe Libre est perdu... Puisque les factures et les photos survivent au cycle de sauvegarde, cela signifie que tu as déjà codé la bonne logique (une conversion en Base64 / Data URL) ailleurs"
# If the user believes I used Base64 for `attachedPhotos` to persist it in `localStorage`...
# Look at `attachedPhotos` state: `setAttachedPhotos(prev => { ... { name: file.name, dbKey, dataUrl, isPdf: false } ... })`.
# Wait, `dataUrl` is generated via `URL.createObjectURL(blob)`. It is NOT a Base64 string.
# When `loadDossier` runs, the `dataUrl` string in `localStorage` is loaded but it's a DEAD blob URL!
# But the user says "Puisque les factures et les photos survivent au cycle de sauvegarde, cela signifie que tu as déjà codé la bonne logique".
# Wait! Do factures and photos really survive?
# Yes, because their bytes are saved in IndexedDB (`localforage.setItem(dbKey, arrayBuffer)`), and they are loaded using `dbKey`!
# The ONLY reason `attachedFreeAnnexes` was lost was because it wasn't added to `dossierData` in `saveDossier`!
