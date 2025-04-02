require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const express = require("express");
const app = express();

// Добавляем базовый маршрут для проверки
app.get("/", (req, res) => {
    res.send("Telegram Bot is running!");
});

// Запускаем сервер на порту, предоставленном Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

let newsEnabled = true; // Флаг включения/выключения новостей

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const userRequests = {}; // Храним активные запросы пользователей

const faq = [
    {
        id: 0,
        summary: "Какие документы нужно подать?",
        details: "Необходимые документы: аттестат об окончании средней школы или справку об обучении, копию паспорта, фотографии 3x4 см (4-6 шт), при необходимости - документы, подтверждающие льготы"
    },
    {
        id: 1,
        summary: "Как подать документы?",
        details: "Документы можно подать лично в приемной комиссии либо через Госуслуги"
    },
    {
        id: 2,
        summary: "Как узнать о результатах поступления?",
        details: "Результаты зачисления публикуются на сайте и в группе в Вконтакте"
    },
    {
        id: 3,
        summary: "Когда будут объявлены результаты?",
        details: "Результаты вступительных узнаёте в день вступительных. А объявление поступающих составляется не позже 19 августа"
    },
    {
        id: 4,
        summary: "Когда проходит день открытых дверей?",
        details: "Коллектив ГАПОУ \"Тетюшский государственный колледж гражданской защиты\" приглашает всех желающих на день открытых дверей, который состоится 26 апреля"
    }
]

const timelineData = [
    {
        step: 1,
        title: "Подача заявления и необходимых документов",
        description:
            "Подайте заявление на поступление через приемную комиссию или Госуслуги. Приложите необходимые документы, включая паспорт, документ об образовании и при необходимости — сертификаты о дополнительных достижениях.",
    },
    {
        step: 2,
        title: "Вступительные испытания",
        description:
            "Вступительные экзамены проводятся только для программ “ЗЧС”, “ПБ” и “ФК” в виде сдачи нормативов по физической подготовке, ежегодно устанавливаемых учебным заведением. Для программы “Организация оперативного реагирования в ЧС” проводится психологическое тестирование.",
    },
    {
        step: 3,
        title: "Зачисление в колледж",
        description:
            "После прохождения испытаний заявки ранжируются, и публикуются списки зачисленных. Подтвердите согласие на зачисление и предоставьте оригиналы документов для зачисления на бюджетные места.",
    },
];

// Главное меню команд
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Привет! Выберите команду:", {
        reply_markup: {
            keyboard: [
                ["📰 Включить/выключить новости"],
                ["❓ Часто задаваемые вопросы"],
                ["🎓 Как поступить"],
                ["📞 Контакты", "✉️ Связаться с нами"],
            ],
            resize_keyboard: true,
        },
    });
});

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const faq = await getFAQ();
    const steps = await getAdmissionSteps();

    if (text === "📰 Включить/выключить новости") {
        newsEnabled = !newsEnabled;
        bot.sendMessage(chatId, newsEnabled ? "✅ Новости включены!" : "❌ Новости отключены!");
    }

    if (text === "❓ Часто задаваемые вопросы") {
        try {
            const faq = await getFAQ();
            const message = faq && faq.trim() !== ""
                ? `📋 <b>Часто задаваемые вопросы</b>\n\n${faq}`
                : "FAQ пока не добавлены.";
            bot.sendMessage(chatId, message, { parse_mode: "HTML" });
        } catch (error) {
            console.error("Ошибка при получении FAQ:", error);
            bot.sendMessage(chatId, "Произошла ошибка при загрузке FAQ. Попробуйте позже.");
        }
    }

    if (text === "🎓 Как поступить") {
        try {
            const steps = getAdmissionSteps();
            if (!steps || steps.trim() === "") {
                await bot.sendMessage(chatId, "Шаги поступления пока не добавлены. 😔");
                return;
            }

            const messageHeader = `🎓 **Как поступить в колледж** 🎓\n\n`;
            const maxMessageLength = 4096 - messageHeader.length;
            let currentMessage = messageHeader;

            const stepItems = steps.split("\n\n");
            for (const item of stepItems) {
                if ((currentMessage + item).length > maxMessageLength) {
                    // Отправляем текущее сообщение и начинаем новое
                    await bot.sendMessage(chatId, currentMessage, { parse_mode: "Markdown" });
                    currentMessage = messageHeader;
                }
                currentMessage += `${item}\n\n`;
            }

            // Отправляем оставшееся сообщение
            if (currentMessage.trim() !== messageHeader.trim()) {
                await bot.sendMessage(chatId, currentMessage, { parse_mode: "Markdown" });
            }
        } catch (error) {
            console.error("Ошибка при получении шагов поступления:", error);
            await bot.sendMessage(chatId, "Произошла ошибка при загрузке шагов поступления. Попробуйте позже. 😔");
        }
    }

    if (text === "📞 Контакты") {
        try {
            const contactInfo = `📍 **Адрес:** 422370, г. Тетюши, ул. Фрунзе, д. 23\n\n` +
                `📞 **Телефоны:**\n+7(843)-732-56-36\n+7(843)-732-56-10\n\n` +
                `📧 **Почта:** [tetushi-tpu@mail.ru](mailto:tetushi-tpu@mail.ru)\n\n` +
                `⏰ **Время работы:**\nПн-Пт — 8:00-16:00\nСб — 8:00-14:00\nВс — Выходной\n\n` +
                `🌐 **Сайт:** [tetushi-tpu.ru](https://tetushi-tpu.ru/)\n\n` +
                `📱 **ВКонтакте:** [vk.com/club66275709](https://vk.com/club66275709)`;

            await bot.sendMessage(chatId, `📲 **Контактная информация** 📲\n\n${contactInfo}`, { parse_mode: "Markdown" });
        } catch (error) {
            console.error("Ошибка при отправке контактной информации:", error);
            await bot.sendMessage(chatId, "Произошла ошибка при загрузке контактной информации. Попробуйте позже. 😔");
        }
    }

    if (text === "✉️ Связаться с нами") {
        bot.sendMessage(chatId, "✍ Напишите ваш вопрос, и мы с вами свяжемся!");
        userRequests[chatId] = true; // Фиксируем пользователя, который хочет связаться
    } else if (userRequests[chatId]) {
        // Пересылаем сообщение админу
        bot.sendMessage(ADMIN_CHAT_ID, `📩 Новый запрос от пользователя (@${msg.from.username}):\n"${text}"`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Ответить", callback_data: `reply_${chatId}` }],
                ],
            },
        });

        bot.sendMessage(chatId, "✅ Ваше сообщение отправлено! Мы скоро ответим.");
        userRequests[chatId] = false;
    }

    if (text === "привет") {
        bot.sendMessage(chatId, "Привет! Чем могу помочь?");
    }
});

bot.on("callback_query", (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith("reply_")) {
        const userId = data.split("_")[1];
        bot.sendMessage(chatId, `✍ Введите ваш ответ пользователю:`);

        bot.once("message", (msg) => {
            bot.sendMessage(userId, `📩 Ответ от администратора:\n"${msg.text}"`);
            bot.sendMessage(chatId, "✅ Ответ отправлен пользователю!");
        });
    }
});

// Получение новостей из VK
async function getLatestNews() {
    if (!newsEnabled) return null;

    try {
        const response = await axios.get(
            `https://api.vk.com/method/wall.get`,
            {
                params: {
                    access_token: process.env.VK_ACCESS_TOKEN,
                    owner_id: `-${process.env.VK_GROUP_ID}`,
                    count: 5, // Запрашиваем 5 последних постов
                    v: "5.131",
                },
            }
        );

        // Проверяем успешность ответа
        if (!response.data || !response.data.response || !response.data.response.items) {
            console.error("Неверный формат ответа от VK API:", response.data);
            return null;
        }

        const posts = response.data.response.items;
        if (posts.length === 0) return null;

        // Массив для хранения результатов
        const results = [];

        // Обрабатываем каждый пост
        for (const post of posts) {
            // Пропускаем репосты и рекламные посты
            if (post.marked_as_ads || post.copy_history) continue;

            // Базовая информация о посте
            const postInfo = {
                id: post.id,
                text: post.text ? post.text.substring(0, 250) + (post.text.length > 250 ? "..." : "") : "",
                date: post.date,
                link: `https://vk.com/wall-${process.env.VK_GROUP_ID}_${post.id}`,
                images: [],
                videos: [],
                docs: []
            };

            // Обрабатываем вложения
            if (post.attachments && post.attachments.length > 0) {
                post.attachments.forEach(attachment => {
                    // Обработка фото
                    if (attachment.type === "photo" && attachment.photo) {
                        const sizes = attachment.photo.sizes;
                        if (sizes && sizes.length > 0) {
                            // Выбираем размер изображения (предпочтительно большой, но не слишком)
                            let bestSize = null;
                            // Приоритет для X, Y, размеров (800-1000px)
                            ["x", "y", "z", "w", "r", "q", "p", "o", "m", "s"].some(sizeType => {
                                bestSize = sizes.find(size => size.type === sizeType);
                                return bestSize !== undefined;
                            });

                            // Если не нашли по типу, берем последний (обычно самый большой)
                            if (!bestSize && sizes.length > 0) {
                                bestSize = sizes[sizes.length - 1];
                            }

                            if (bestSize) {
                                postInfo.images.push(bestSize.url);
                            }
                        }
                    }
                    // Обработка видео
                    else if (attachment.type === "video" && attachment.video) {
                        const video = attachment.video;
                        if (video.image) {
                            // Получаем превью видео
                            const images = video.image;
                            if (images && images.length > 0) {
                                postInfo.videos.push({
                                    title: video.title || "Видео",
                                    preview: images[images.length - 1].url,
                                    link: `https://vk.com/video-${process.env.VK_GROUP_ID}_${video.id}`
                                });
                            }
                        }
                    }
                    // Обработка документов
                    else if (attachment.type === "doc" && attachment.doc) {
                        const doc = attachment.doc;
                        postInfo.docs.push({
                            title: doc.title,
                            url: doc.url,
                            size: doc.size
                        });
                    }
                });
            }

            results.push(postInfo);
        }

        // Возвращаем массив постов
        return results.length > 0 ? results : null;

    } catch (error) {
        console.error("Ошибка при получении новостей из ВК:", error);
        if (error.response) {
            console.error("Данные ответа:", error.response.data);
        }
        return null;
    }
}

// Функция для отправки новостей в телеграм
async function sendNewsToUsers(chatIds) {
    try {
        const news = await getLatestNews();
        if (!news || news.length === 0) {
            console.log("Нет новых постов для отправки");
            return;
        }

        // Отправляем до 5 последних новостей (изменено с 3 на 5)
        const postsToSend = news.slice(0, 5);

        for (const chatId of chatIds) {
            // Проверяем, что чат активен и пользователь подписан на новости
            // Здесь можно добавить проверку из БД

            for (const post of postsToSend) {
                // Формируем сообщение
                const messageText = `📰 *Новость:*\n\n${post.text}\n\n[Читать полностью](${post.link})`;

                // Если есть изображения, отправляем с ними
                if (post.images && post.images.length > 0) {
                    // Отправляем до 5 изображений
                    const imagesToSend = post.images.slice(0, 5);

                    if (imagesToSend.length === 1) {
                        // Одно изображение отправляем с подписью
                        await bot.sendPhoto(chatId, imagesToSend[0], {
                            caption: messageText,
                            parse_mode: "Markdown"
                        });
                    } else {
                        // Сначала отправляем текст
                        await bot.sendMessage(chatId, messageText, { parse_mode: "Markdown" });

                        // Затем отправляем изображения как медиагруппу
                        const mediaGroup = imagesToSend.map(image => ({
                            type: 'photo',
                            media: image
                        }));

                        await bot.sendMediaGroup(chatId, mediaGroup);
                    }
                } else if (post.videos && post.videos.length > 0) {
                    // Если есть видео, отправляем превью с подписью
                    const video = post.videos[0];
                    await bot.sendPhoto(chatId, video.preview, {
                        caption: `${messageText}\n\n*Видео:* ${video.title}\n[Смотреть видео](${video.link})`,
                        parse_mode: "Markdown"
                    });
                } else {
                    // Если нет медиа, отправляем просто текст
                    await bot.sendMessage(chatId, messageText, { parse_mode: "Markdown" });
                }

                // Делаем паузу между отправкой сообщений, чтобы избежать ограничений Telegram
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`Отправлено ${postsToSend.length} новостей ${chatIds.length} пользователям`);
    } catch (error) {
        console.error("Ошибка при отправке новостей:", error);
    }
}

// Функция для получения списка подписчиков на новости
async function getNewsSubscribers() {
    return [123456789]; // Замените на реальные ID чатов
}

// Функция для запуска рассылки новостей
async function broadcastNews() {
    if (!newsEnabled) {
        console.log("Рассылка новостей отключена");
        return;
    }

    const subscribers = await getNewsSubscribers();
    if (subscribers.length === 0) {
        console.log("Нет подписчиков на новости");
        return;
    }

    await sendNewsToUsers(subscribers);
}

async function getFAQ() {
    if (!faq || faq.length === 0) {
        return "";
    }
    return faq.map(item => {
        return `${item.id + 1}. <b>${item.summary}</b>\n${item.details}`;
    }).join("\n\n");
}

// Функция получения шагов поступления
function getAdmissionSteps() {
    if (!timelineData || timelineData.length === 0) {
        return "";
    }
    return timelineData.map(item => {
        return `📌 **Шаг ${item.step}: ${item.title}**\n${item.description}`;
    }).join("\n\n");
}

// Автоматическая рассылка новостей каждые 6 часов (если включено)
setInterval(() => {
    broadcastNews().catch(error => {
        console.error("Ошибка при автоматической рассылке новостей:", error);
    });
}, 3 * 60 * 60 * 1000); // 6 часов в миллисекундах

console.log("Бот запущен...");
