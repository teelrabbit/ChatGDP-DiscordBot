// check for env vars
if (!process.env.discord_key || !process.env.org_key || !process.env.api_key) {
  console.error("One or more environment variables are missing.");
  process.exit(0);
}

// Prepare to connect to the Discord API
const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Prepare connection to OpenAI API
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  organization: process.env.org_key,
  apiKey: process.env.api_key,
});
const openai = new OpenAIApi(configuration);

//changes here ---------------------------------------------------------------
// Load the AWS SDK for JavaScript
console.log('AWS-SDK Prepapring to instakll');
const AWS = require("aws-sdk");

// Configure the SDK with your AWS credentials
AWS.config.update({
  region: "us-west-1",
  accessKeyId: process.env.aws_access_key_id,
  secretAccessKey: process.env.aws_secret_access_key,
});

// Test the connection to DynamoDB
const documentClient = new AWS.DynamoDB.DocumentClient();
const tableName = "GPT-Response-DB";
console.log('connection prepared!');

// Object to store chat history
const chatHistory = {};

// Check for when a message on Discord is sent

// Check for when a message on Discord is sent
client.on("messageCreate", async function (message) {
  try {
    console.log(message.content);
    if (message.author.bot) return;

    // Get the prompt from the message content
    const prompt = message.content;

    // Check if there is a cached response for the prompt
    if (chatHistory[prompt]) {
      message.reply(chatHistory[prompt]);
      return;
    }

    // Otherwise, generate a new response using OpenAI
    const gdpResponse = await openai.createCompletion({
      model: "text-davinci-002",
      prompt: `I am Elon Musk. I am here to answer your code questions. What would you like to know? \n\
        ${prompt}\n\
        H10:`,
      temperature: 0.8,
      max_tokens: 4000,
      stop: ["H10:", "F.Bueller:"],
    });

    const response = gdpResponse.data.choices[0].text;

    // Save the new response in the chat history
    chatHistory[prompt] = response;

    // Save the prompt and response in DynamoDB
    const item = {
      prompt: prompt,
      response: response,
    };
    const params = {
      TableName: tableName,
      Item: item,
    };
    documentClient.put(params, function (err, data) {
      if (err) {
        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
      } else {
        console.log("Item added:", JSON.stringify(item, null, 2));
      }
    });

    message.reply(response);
  } catch (err) {
    console.log(err);
    message.reply("There was an error processing your request.");
  }
});
console.log('testenv');
// Log the bot onto Discord
client
  .login(process.env.discord_key)
  .then(() => {
    console.log("ChatGDP Bot is online on Discord");
  })
  .catch((error) => {
    console.error("Failed to log in to Discord:", error);
  });
