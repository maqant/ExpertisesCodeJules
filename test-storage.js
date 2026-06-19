import localforage from 'localforage';
import { readIndex, readData, saveFullDossier, ConflictError } from './src/services/storage/dossierStorage.js';

async function test() {
    console.log("Testing saveFullDossier...");
    try {
        const res = await saveFullDossier('test-id', 'Test', new Date().toISOString(), { foo: 'bar' }, 0, false);
        console.log("Success:", res);
    } catch (err) {
        console.error("Error:", err);
    }
}
test();
