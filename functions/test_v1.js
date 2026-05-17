const functions = require('firebase-functions');
exports.askProfessorAI = functions.region('southamerica-east1').https.onCall((data, context) => {
  return { reply: "Hello world v1" };
});
