// Подключение Firebase Admin SDK для серверной части
const admin = require('firebase-admin');

// Инициализация Firebase с использованием файла ключа
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Инициализация Firestore для работы с базой данных
const db = admin.firestore();

// Экспортируем db для использования в других частях кода
module.exports = db;
