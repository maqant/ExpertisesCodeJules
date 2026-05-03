import re

with open('src/context/ExpertiseContext.jsx', 'r') as f:
    content = f.read()

# Update handleOpenFile
handle_open_file_old = """  const handleOpenFile = async (dbKey, isPdf = true) => {
      try {
          const fileBytes = await localforage.getItem(dbKey);
          if (!fileBytes) return alert("Fichier introuvable dans la base locale.");

          const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';
          const blob = new Blob([fileBytes], { type: mimeType });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');

          // Libération de la mémoire si ce n'est pas utilisé après
          // setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (err) {
          console.error("Erreur d'ouverture du fichier", err);
          alert("Erreur lors de l'ouverture : " + err.message);
      }
  };"""

handle_open_file_new = """  const handleOpenFile = async (dbKey) => {
      try {
          const fileBytes = await localforage.getItem(dbKey);
          if (!fileBytes) return alert("Fichier introuvable dans la base locale.");

          let mimeType = 'application/pdf';
          if (dbKey.startsWith('img_')) {
              mimeType = 'image/jpeg';
          } else if (dbKey.startsWith('file_')) {
              // Try to guess from magic bytes or keep application/pdf
              const arr = new Uint8Array(fileBytes).subarray(0, 4);
              const header = Array.from(arr).map(b => b.toString(16)).join('');
              if (header.startsWith('89504e47')) mimeType = 'image/png';
              else if (header.startsWith('ffd8ff')) mimeType = 'image/jpeg';
          }

          const blob = new Blob([fileBytes], { type: mimeType });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
      } catch (err) {
          console.error("Erreur d'ouverture du fichier", err);
          alert("Erreur lors de l'ouverture : " + err.message);
      }
  };"""

content = content.replace(handle_open_file_old, handle_open_file_new)

with open('src/context/ExpertiseContext.jsx', 'w') as f:
    f.write(content)
