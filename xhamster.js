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
    const photosURL = `https://xhamsterlive.com/${modelName}/photos`;
    const response = await axios.get(photosURL);
    const $ = cheerio.load(response.data);

    // Extract photo links from the photos gallery
    const photoLinks = [];
    $('.photos-gallery-list-v2--5-items-layout .photos-gallery-item-v2__image').each((index, element) => {
      const photoSrc = $(element).attr('src');
      photoLinks.push(photoSrc);
    });

    // Log the extracted information to the console for debugging
    console.log('Photo Links:', photoLinks);

    // Wait for a moment to create the album
    setTimeout(async () => {
      // Accumulate photo data in an array
      const photoAlbum = [];
      for (const photoLink of photoLinks) {
        const photoBuffer = await uploadPhotoFromURL(photoLink);
        if (photoBuffer) {
          photoAlbum.push({ type: 'photo', media: { source: photoBuffer } });
        }
      }

      // Send photos as a Telegram album
      bot.sendMediaGroup(msg.chat.id, photoAlbum, { disable_notification: true })
        .then(() => console.log('Photo album sent successfully'))
        .catch((error) => {
          console.error('Error sending photo album:', error);
          bot.sendMessage(msg.chat.id, 'Error sending photo album');
        });
    }, 5000); // Adjust the delay (in milliseconds) as needed
  } catch (error) {
    console.error('Error fetching photos:', error);
    bot.sendMessage(msg.chat.id, 'Error fetching photos');
  }
});



bot.onText(/\/check (.+)/, async (msg, match) => {
  const modelName = match[1];

  try {
    const modelURL = `https://xhamsterlive.com/${modelName}`;
    const response = await axios.get(modelURL);
    const $ = cheerio.load(response.data);

    // Check if the model is online
    const isOnline = !response.data.includes('<div class="availability-status offline">Offline</div>');

    // Determine the appropriate image link based on online or offline status
    let imageURL;
    if (isOnline) {
      imageURL = modelURL;  // Use the modelURL if online
    } else {
      // Use the image link from the specified structure if offline
      imageURL = $('.wrapper .main .strut.view-cam-resizer-boundary-y .big-height.poster.view-cam-resizer-player .backdrop img.image-background').attr('src');

      // Extract the offline time from the specific structure
      const offlineTime = $('.vc-status-offline-inner .offline-status-time').text().trim();

      // Extract the next scheduled stream start and stop times from the button element
      const scheduleButton = $('.schedule-informer__add-to-calendar-button');
      const startTimeText = scheduleButton.find('span:first-child').text().trim();
      const stopTimeText = scheduleButton.find('span:last-child').text().trim();

      // Log the extracted information to the console for debugging
      console.log('Image Link:', imageURL);
      console.log('Offline Time:', offlineTime);
      console.log('Next Stream Start Time:', startTimeText);
      console.log('Next Stream Stop Time:', stopTimeText);

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

      // Create the status message with the appropriate image, offline time, and next stream information
      const statusMessage = isOnline
        ? 'Model is online'
        : `Model is offline. ${offlineTime}\nNext Stream: Start Time ${startTimeText}, Stop Time ${stopTimeText}`;

      // Send the status message with the appropriate image, offline time, and inline keyboard
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
    }
  } catch (error) {
    console.error('Error checking model status:', error);
    bot.sendMessage(msg.chat.id, 'Error checking model status');
  }
});


bot.onText(/\/.*/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Unknown command. Use /add, /check, /notify, or /stopnotify.');
});
