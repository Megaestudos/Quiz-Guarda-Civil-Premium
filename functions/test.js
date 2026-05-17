const { onCall } = require('firebase-functions/v2/https');
exports.askProfessorAI = onCall((req) => {
  return { reply: "Hello world" };
});
