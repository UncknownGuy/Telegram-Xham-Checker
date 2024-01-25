const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const models = loadModels(); // Load models from the file on bot start

// Function to load models from models.json file
function loadModels() {
  try {
    const data = fs.readFileSync('./models.json', 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading models:', error);
    return {};
  }
}

// Function to save models to models.json file
function saveModelsToFile() {
  fs.writeFileSync('./models.json', JSON.stringify(models, null, 2), 'utf-8');
}

// Function to check if a model is online
async function isModelOnline(modelURL) {
  try {
    const response = await axios.get(modelURL);
    return !response.data.includes('<div class="availability-status offline">Offline</div>');
  } catch (error) {
    console.error('Error checking model status:', error);
    throw new Error('Error checking model status. Please try again.');
  }
}

// Function to notify the user if a model goes online
async function notifyUserIfOnline(modelName, chatId) {
  const loadedModels = loadModels();
  const model = loadedModels[modelName];

  if (model) {
    const isOnline = await isModelOnline(model.url);
    if (isOnline) {
      const imageURL = model.url;  // Use the same URL for displaying the image
      const notificationMessage = `Model "${modelName}" is now online!`;

      // Send the photo along with the notification message
      if (imageURL) {
        bot.sendPhoto(chatId, imageURL, {
          caption: notificationMessage
        }).then(() => {
          // Update the model status and save to models.json
          model.status = 'online';
          saveModelsToFile(loadedModels);
        }).catch((error) => {
          console.error('Error sending photo:', error);
          bot.sendMessage(chatId, 'Error sending photo');
        });
      } else {
        console.error('Image not found');
        bot.sendMessage(chatId, 'Image not found');
      }
    }
  }
}


// Command handler for /photos
bot.onText(/\/photos (.+)/, async (msg, match) => {
  const modelName = match[1];

  try {
    const photosURL = `https://stripchat.com/${modelName}/photos`;
    const response = await axios.get(photosURL);
    const $ = cheerio.load(response.data);

    // Extract photo links from the photos gallery
    const photoLinks = [];
    $('.photos-gallery-list-v2--5-items-layout .photos-gallery-item-v2__image img').each((index, element) => {
      const photoSrc = $(element).attr('src');
      if (photoSrc) {
        photoLinks.push(photoSrc);
      }
    });

    // Log the extracted information to the console for debugging
    console.log('Photo Links:', photoLinks);

    // Send photos individually
    const sendPhotos = async () => {
      for (const photoLink of photoLinks) {
        try {
          const photoBuffer = await uploadPhotoFromURL(photoLink);
          if (photoBuffer) {
            bot.sendPhoto(msg.chat.id, photoBuffer, { disable_notification: true })
              .then(() => console.log(`${photoLinks}`))
              .catch((error) => {
                console.error('Error sending photo:', error);
                bot.sendMessage(msg.chat.id, 'Error sending photo');
              });
          }
        } catch (error) {
          console.error('Error uploading photo from URL:', error);
          bot.sendMessage(msg.chat.id, 'Error uploading photo from URL');
        }
      }
    };

    // Call the function to send photos
    sendPhotos();
  } catch (error) {
    console.error('Error fetching photos:', error);
    bot.sendMessage(msg.chat.id, 'Error fetching photos');
  }
});

// Function to upload a photo from URL and return it as a buffer
async function uploadPhotoFromURL(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data, 'binary');
}



bot.onText(/\/add (.+)/, (msg, match) => {
  const modelName = match[1];
  const modelURL = `https://xhamsterlive.com/${modelName}`;
  
  models[modelName] = {
    url: modelURL,
    status: 'offline'
  };
  saveModelsToFile(); // Save models to file

  bot.sendMessage(msg.chat.id, `Model "${modelName}" added successfully!`);
});

bot.onText(/\/check (.+)/, async (msg, match) => {
  const modelName = match[1];

  // Load models from models.json
  const models = loadModels();

  if (models[modelName]) {
    const model = models[modelName];

    try {
      const response = await axios.get(model.url);
      const $ = cheerio.load(response.data);

      // Check if the model is online
      const isOnline = !response.data.includes('<div class="availability-status offline">Offline</div>');

      // Determine the appropriate image link based on online or offline status
      let imageURL;
      if (isOnline) {
        imageURL = model.url;  // Use the model.url if online
      } else {
        // Use the image link from the specified structure if offline
        imageURL = $('.wrapper .main .strut.view-cam-resizer-boundary-y .big-height.poster.view-cam-resizer-player .backdrop img.image-background').attr('src');
      }

      // Extract the offline time from the specific structure
      const offlineTime = $('.vc-status-offline-inner .offline-status-time').text().trim();

      // Log the extracted image link and offline time to the console for debugging
      console.log('Image Link:', imageURL);
      console.log('Offline Time:', offlineTime);

      // Create inline keyboard
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: `Watch ${modelName} Live`,
              url: model.url
            }
          ]
        ]
      };

      // Send the status message with the appropriate image, offline time, and inline keyboard
      if (imageURL) {
        const statusMessage = isOnline ? 'Model is online' : `Model is offline. ${offlineTime}`;
        bot.sendPhoto(msg.chat.id, imageURL, {
          caption: statusMessage,
          reply_markup: keyboard
        }).catch((error) => {
          console.error('Error sending photo:', error);
          bot.sendMessage(msg.chat.id, 'Error sending photo');
        });
      } else {
        console.error('Image not found');
        bot.sendMessage(msg.chat.id, 'Image not found');
      }
    } catch (error) {
      console.error('Error checking model status:', error);
      bot.sendMessage(msg.chat.id, 'Error checking model status');
    }
  } else {
    bot.sendMessage(msg.chat.id, `Model "${modelName}" not found. Use /add to add the model.`);
  }
});

bot.onText(/\/.*/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Unknown command. Use /add, /check, /notify, or /stopnotify.');
});
