const Discord = require("discord.js");
const config = require("./config.json");
const facts = require(config.factFile);
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
  // Check if this a reply from TrashBot that should be deleted.
  deleteBotMsg(message);

  // Set a prefix
  let prefix = config.prefix;

  // Stop if it's not there or if the sender is a bot
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  // Todo: Clean up handling of commands.
  // !fact - Have TrashBot recall one of his witty facts
  // Todo: Clean this up
  // Todo: Add handling for blank facts
  if(message.content.startsWith(prefix + "fact")){
    var now = new Date().getTime()/1000;
    if (now-lastSent <= 5){
      var interval = "seconds";
      if(Math.abs(Math.ceil(lastSent-now)) == 1){
        interval = "second";
      }
      message.channel.send("Slow down! It's only been " + Math.abs(Math.ceil(lastSent-now)) + " " + interval + " since my last fact!");
      message.delete(3500);
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

  // !addfact - Add a new fact to TrashBot's database
  if(message.content.startsWith(prefix + "addfact") && message.channel.permissionsFor(message.member).has("MANAGE_CHANNELS")){
      var newFact = message.content.split(" ");
      if (newFact.length < 2){
        message.channel.send("Uh. I can't remember a fact about nothing. I'm not SeinfeldBot, <@" + message.author.id +">");
        message.delete(3500);
        return;
      }
      var toAdd = "";
      for(i = 1; i<newFact.length; i++){
        if(i == newFact.length-1){
          toAdd = toAdd + newFact[i];
        }else{
        toAdd = toAdd + newFact[i] + " ";
        }
      }
      toAdd = writeToFile(config.factFile, toAdd);
      if(toAdd == true){
        message.channel.send("Added!");
      }else{
        message.channel.send("I couldn't add that to my list. It may be a duplicate of an existing fact or the fact file is inaccessible.");
      }
  } // end !addfact

  // !schedule - Schedule an event with TrashBot
  if (message.content.startsWith(prefix+ "schedule") && message.author.id == config.ownerID){
    var newEvent = message.content.split(" ");
    if (newEvent.length < 2){
      message.channel.send("Your event needs a name!");
      return;
    }else if(newEvent.length < 3){
      message.channel.send("Your event needs a time!");
      return;
    }
    // TrashBot assumes an event exists until he checks.
    var fileName = "./" + newEvent[1] + ".json";
    var eventExists = fileExists(fileName);

    // If the event exists, it's left alone.
    if(eventExists == true){
      message.channel.send("This event already exists!");
      return;
    }

    // Todo: Actual time formatting/handling
    // The scheduler is automatically listed as the host of the event.
    var eventTime = {
      "time" : newEvent[2],
      "host" : message.author.id
    };

    // todo: Work this into the existing file writing method
    // todo: Check if the file exists, return a message that it does.
    // Write the new file with event details.
    fs.writeFile("./" + newEvent[1]+ ".json", JSON.stringify(eventTime), (err) =>{
      if (err){
        console.error(err);
      }
    });
    message.channel.send("Added!");
  } // end !schedule

  // !event
});

// Fetch a number between min and max, inclusive
function getRand(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Check that a file exists
function fileExists(name){
  if(fs.existsSync(name)){
    return true;
  }else {
    return false;
  }
}

// Check if a message should be deleted and clear it
function deleteBotMsg(message){
  if(message.author.id == config.botID){
    if(message.content.startsWith("Slow down! It's only been ")){
        message.delete(3000);
      }else if(message.content.startsWith("Uh. I can't remember a fact about nothing. I'm not SeinfeldBot")){
        message.delete(3000);
      }
    }
}

// Return a fun fact from facts.json based on a provided integer
function getFunFact(num) {
  let funFact = JSON.parse(fs.readFileSync("./facts.json", "utf8"));
  return funFact[num];
}

// Todo: Update file writing to not use the string literal for modularity
// Write new fun facts to the fact file. :^)
function writeToFile(filename, msg){
  let funFact = JSON.parse(fs.readFileSync(filename, "utf8"));
  if(!funFact.toAdd){
    var num = facts.factNum;
    num++;
    facts[num] = msg;
    facts.factNum = num;
    fs.writeFile(filename, JSON.stringify(facts), (err) => {
      if (err){
        console.error(err);
        return false;
      }
    });
    return true;
  }
}
