const Discord = require("discord.js");
const config = require("./config.json");
const facts = require("./facts.json");
//const responseObject = require("./commands.json");
const fs = require("fs");
const client = new Discord.Client();
var statedFacts = new Array;
var lastWritten = 0;
var lastSent = new Date().getTime()/1000;

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
if(message.content.startsWith("Slow down! It's only been ") && message.author.bot){
    message.delete(3000);
}

// Set a prefix
let prefix = config.prefix;

// Stop if it's not there or if the sender is a bot.
if (!message.content.startsWith(prefix) || message.author.bot) return;

  // Todo: Clean up handling of commands.
  // !fact
  // Todo: Clean this up
  if(message.content.startsWith(prefix + "fact")){
    var now = new Date().getTime()/1000;
    if (now-lastSent <= 5){
      message.channel.send("Slow down! It's only been " + Math.abs(Math.ceil(lastSent-now)) + " seconds since my last fact!");
      return;
    }
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
    lastSent = new Date().getTime()/1000;
    }
  } // end !fact

  // !addfact
  if(message.content.startsWith(prefix + "addfact") && message.channel.permissionsFor(message.member).hasPermission("ADMINISTRATOR")){
      var newFact = message.content.split(" ");
      var toAdd = "";
      for(i = 1; i<newFact.length; i++){
        if(i == newFact.length-1){
          toAdd = toAdd + newFact[i];
        }else{
        toAdd = toAdd + newFact[i] + " ";
        }
      }
      toAdd = writeFunFact(toAdd);
      if(toAdd == true){
        message.channel.send("Added!");
      }else{
        message.channel.send("I couldn't add that to my list. It may be a duplicate of an existing fact or the fact file is inaccessible.");
      }
  } // end !addfact
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

// Write new fun facts to the fact file. :^)
function writeFunFact(msg){
  let funFact = JSON.parse(fs.readFileSync("./facts.json", "utf8"));
  if(!funFact.toAdd){
    var num = facts.factNum;
    num++;
    facts[num] = msg;
    facts.factNum = num;
    fs.writeFile("./facts.json", JSON.stringify(facts), (err) => {
      if (err){
        console.error(err);
        return false;
      }
    });
    return true;
  }
}
