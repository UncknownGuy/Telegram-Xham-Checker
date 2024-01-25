const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Function to upload a photo to Telegram and return the file ID
async function uploadPhotoFromURL(photoURL) {
  try {
    const response = await axios({
      url: photoURL,
      method: 'GET',
      responseType: 'arraybuffer',
    });

    if (!response.data) {
      console.error('Empty response data for photo:', photoURL);
      return null;
    }

    return Buffer.from(response.data, 'binary');
  } catch (error) {
    console.error('Error uploading photo to Telegram:', error);
    return null;
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
    $('.photos-gallery-list-v2 .photos-gallery-item-v2__image').each((index, element) => {
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
              .then(() => console.log('Photo sent successfully'))
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






bot.onText(/\/check (.+)/, async (msg, match) => {
  const modelName = match[1];

  try {
    const modelURL = `https://stripchat.com/${modelName}`;
    const response = await axios.get(modelURL);
    const $ = cheerio.load(response.data);

    // Check if the element indicating offline status is present
    const isOfflineElementPresent = response.data.includes('<div class="availability-status offline">Offline</div>');

    // Determine the appropriate image link based on online or offline status
    let imageURL;
    let offlineTime;  // Initialize offlineTime variable

    if (isOfflineElementPresent) {
      // Use the image link from the specified structure if offline
      imageURL = $('.wrapper .main .strut.view-cam-resizer-boundary-y .big-height.poster.view-cam-resizer-player .backdrop img.image-background').attr('src');

      // Extract the offline time from the specific structure
      offlineTime = $('.vc-status-offline-inner .offline-status-time').text().trim();

      // Log the extracted information to the console for debugging
      console.log('Image Link:', imageURL);
      console.log('Offline Time:', offlineTime);
    } else {
      // Model is online, no need to extract offline information
      imageURL = modelURL;
    }

    // Create inline keyboard
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: `Watch ${modelName} Live`,
            url: modelURL
          }
        ]
      ]
    };

    // Create the status message with the appropriate image and offline information if applicable
    const statusMessage = isOfflineElementPresent
      ? `Model is offline. Offline Time: ${offlineTime}`
      : 'Model is online';

    // Send the status message with the appropriate image and inline keyboard
    if (imageURL) {
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
});



bot.onText(/\/.*/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Unknown command. Use /add, /check, /notify, or /stopnotify.');
});
