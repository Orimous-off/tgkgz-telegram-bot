require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
// const db = require('./firebase');
const axios = require("axios");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

let newsEnabled = true; // Флаг включения/выключения новостей

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const userRequests = {}; // Храним активные запросы пользователей

const faq = [
    {
        summary: "Какие документы нужно подать?",
        details: "Необходимые документы: аттестат об окончании средней школы или справку об обучении, копию паспорта, фотографии 3x4 см (4-6 шт), при необходимости - документы, подтверждающие льготы"
    },
    {
        summary: "Как подать документы?",
        details: "Документы можно подать лично в приемной комиссии либо через Госуслуги"
    },
    {
        summary: "Как узнать о результатах поступления?",
        details: "Результаты зачисления публикуются на сайте и в группе в Вконтакте"
    },
    {
        summary: "Когда будут объявлены результаты?",
        details: "Результаты вступительных узнаёте в день вступительных. А объявление поступающих составляется не позже 19 августа"
    },
    {
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

// Включение/выключение новостей
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
                    count: 5,
                    v: "5.131",
                },
            }
        );

        const posts = response.data.response.items;
        if (!posts || posts.length === 0) return null;

        for (const post of posts) {
            if (post.attachments && post.text) {
                const text = post.text.substring(0, 250) + "...";
                const link = `https://vk.com/wall-${process.env.VK_GROUP_ID}_${post.id}`;

                const image = post.attachments.find((att) => att.type === "photo");
                if (image) {
                    const sizes = image.photo.sizes;
                    const bestSize = sizes[sizes.length - 1].url;
                    return { text, image: bestSize, link };
                }
            }
        }
        return null;
    } catch (error) {
        console.error("Ошибка при получении новостей:", error);
        return null;
    }
}

async function getFAQ() {
    /*const snapshot = await db.collection('faq').get();
    if (snapshot.empty) {
        return "";
    }
    return snapshot.docs.map((doc, index) => {
        const data = doc.data();
        // Форматируем каждый FAQ с номером, summary и details
        return `${index + 1}. <b>${data.summary}</b>\n${data.details}`;
    }).join("\n\n");*/
    if (!faq || faq.length === 0) {
        return "";
    }
    return faq.map(item => {
        return `📌 **Шаг ${item.step}: ${item.title}**\n${item.description}`;
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
setInterval(async () => {
    const news = await getLatestNews();
    if (news) {
        bot.sendMessage(123456789, `📰 Новость: ${news.text}\n\n[Читать дальше](${news.link})`, { parse_mode: "Markdown" });
    }
}, 21600000); // 6 часов в миллисекундах

console.log("Бот запущен...");
