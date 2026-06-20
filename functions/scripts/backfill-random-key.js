/*
 * Preenche randomKey apenas em questões que ainda não o possuem.
 * Requer credenciais administrativas do Firebase (Application Default Credentials).
 *
 * Execução real:
 *   $env:CONFIRM_BACKFILL = '1'
 *   node scripts/backfill-random-key.js
 */
const crypto = require('node:crypto');
const admin = require('firebase-admin');

const BATCH_SIZE = 400;
const shouldWrite = process.env.CONFIRM_BACKFILL === '1';

admin.initializeApp({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'simulados-concursos-22c91'
});
const db = admin.firestore();

function randomKey() {
  return crypto.randomBytes(6).readUIntBE(0, 6) / 0x1000000000000;
}

async function run() {
  let lastDoc = null;
  let scanned = 0;
  let updated = 0;

  do {
    let query = db.collection('questoes')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    let pendingWrites = 0;
    snapshot.forEach((doc) => {
      scanned += 1;
      if (typeof doc.data().randomKey !== 'number') {
        updated += 1;
        pendingWrites += 1;
        if (shouldWrite) batch.update(doc.ref, { randomKey: randomKey() });
      }
    });

    if (shouldWrite && pendingWrites) await batch.commit();
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    console.log(`Lote processado: ${scanned} lidas, ${updated} ${shouldWrite ? 'atualizadas' : 'a atualizar'}.`);
  } while (lastDoc);

  console.log(shouldWrite
    ? `Concluído: ${updated} questões receberam randomKey.`
    : `Simulação concluída: ${updated} questões precisam de randomKey. Defina CONFIRM_BACKFILL=1 para gravar.`);
}

run().catch((error) => {
  console.error('Falha no backfill de randomKey:', error);
  process.exitCode = 1;
});
