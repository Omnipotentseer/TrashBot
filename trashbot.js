const Discord = require("discord.js");
const config = require("./config.json");
const facts = require("./facts.json");
const responseObject = require("./commands.json");
const fs = require("fs");
const client = new Discord.Client();
var statedFacts = new Array;
var lastWritten = 0;

// Use token to log in. Provided by config.json
client.login(config.token);

// Initialization
client.on("ready", () => {
  console.log("TrashBot connected.");
  client.user.setGame("I Eat Garbage");
});

// Error handlers
client.on("error", (e) => console.error(e));
client.on("warn", (e) => console.warn(e));
client.on("debug", (e) => console.info(e));

client.on("message", (message) => {
// Set a prefix
let prefix = config.prefix;

// Stop if it's not there or if the sender is a bot.
if (!message.content.startsWith(prefix) || message.author.bot) return;


  // Todo: Clean up handling of commands.
  if(message.content == responseObject[message.content]){
    message.channel.send(responseObject[message.content]);
  }
  // !fact
  // Todo: Add handling for repeats
  if(message.content.startsWith(prefix + "fact")){
    var freshFact = false;
    var num = getRand(1, facts.factNum);

    // Check if the number pulled is in the repeat array
    while(freshFact == false){
      for (var i = 0; i < statedFacts.length; i++){
        if (num == statedFacts[i]){
          num = getRand(1, facts.factNum);
          break;
        }
      }
      freshFact = true;
    }

    // Store the fact in the fact array, return to the start if we've reached the end
    statedFacts[lastWritten] = num;
    if(lastWritten == 5){
      lastWritten = 0;
    }else{
      lastWritten++;
    }

    // Special handling for fact 21.
    if(num == 21){
      var ohhai = getFunFact(num);
      message.channel.send(ohhai + "<@" + message.author.id + ">");
    }else{
    message.channel.send(getFunFact(num));
    }
  }
  // !secret
  // Todo: remove/replace
  if(message.content.startsWith(prefix + "secret")){
    // Exit if this command does not come from the bot's owner
    if(message.author.id !== config.ownerID) return;
    message.channel.send("Good job, Ved, you fucking cuck.");
  }
  // !admin
  // Todo: remove/replace
  if(message.content.startsWith(prefix + "admin")){
    if(!message.channel.permissionsFor(message.member).hasPermission("ADMINISTRATOR")) return;
    message.channel.send("Hey, good to see ya <@" + message.author.id + ">");
  }
  // !id
  // Todo: remove/replace
  if(message.content.startsWith(prefix + "id")){
    message.channel.send(message.author.id);
  }
});

// Fetch a number between min and max, inclusive
function getRand(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Return a fun fact from facts.json based on a provided integer
function getFunFact(num) {
  let funFact = JSON.parse(fs.readFileSync("./facts.json", "utf8"));
  return funFact[num];
}

/*function writeFunFact(funFact){

}*/
