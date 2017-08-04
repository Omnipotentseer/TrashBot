const Discord = require("discord.js");
const config = require("./config.json");
const client = new Discord.Client();
const facts = require(config.factFile);
const magic = require(config.eightBallFile);
//const responseObject = require("./commands.json");
const fs = require("fs");
var statedFacts = new Array;
var lastWritten = 0;
var lastSent = new Date().getTime()/1000;

/*
  ----------------Suggestion bin------------------
    Reminders - Not a command but allow a specific
      reminder to be broadcast periodically
        + Could have a command to change parameters
          -Work on after commands update
    !avatar - Full avatar display of a given user
      Person calling the command or given name?
          -Work on after scheduler update

    !slots - Match 3 emoji, get points
      Store player name as a key, time since last win as entry 1
      Time of last spin as entry 2
      Easier to match lower points, harder to match greater points.
      Usual slot machine shit.
      Use edits to simulate slot machine delay.
      Add username, points earned, and total points on last edit.
        -Work on after scheduler update
*/


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
    message.channel.send(getFunFact(config.factFile, num));
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
  if (message.content.startsWith(prefix + "schedule") && message.author.id == config.ownerID){
    var newEvent = message.content.split(" ");
    if (newEvent.length < 2){
      message.channel.send("Your event needs a name."); // newEvent[1] is event name
      message.delete(3500);
      return;
    }else if(newEvent.length < 3){
      message.channel.send("Your event needs a date."); // newEvent[2] is event date
      message.delete(3500);
      return;
    }else if(newEvent.length < 4){
      message.channel.send("Your event needs a time."); // newEvent[3] is event time
      message.delete(3500);
      return;
    }

    /*
        Date formatting - mm/dd/yyyy
        Time formatting - hhmm.p/a

        Todo: Bring back events.json, have the event writing method hold the event's
        filename. Have the method that's checking whether or not to announce an event
        iterate through the events file to read the individual event files.

        Todo: Max of 10 events.
    */


    var valid = valiDate(newEvent[2], newEvent[3]);
    if(valid == false){
      message.channel.send("The date or time provided was invalid.\nCorrect date syntax is: mm/dd/yyyy and this cannot preceed the current date.\nCorrect time syntax is: hmm.a or hmm.p and cannot preceed the current time.");
      message.delete(9500);
      return;
    }
    // TrashBot assumes an event exists until he checks.
    var fileName = "./" + newEvent[1] + ".json";
    var eventExists = fileExists(fileName);

    // If the event exists, it's left alone.
    if(eventExists == true){
      message.channel.send("This event already exists!");
      message.delete(3500);
      return;
    }

    // Todo: Actual time formatting/handling
    // The scheduler is automatically listed as the host of the event.
    var eventTime = {
      "name" : newEvent[1],
      "date" : newEvent[2],
      "time" : newEvent[3],
      "hostID" : message.author.id,
      "attendees" : ["None"],
      "isEvent" : true
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

  // !event - List the details of an event: Name, time, host, attendees
  if(message.content.startsWith(prefix + "event") && message.author.id == config.ownerID){
    var checkEvent = message.content.split(" ");
    if(checkEvent.length < 2){
      message.channel.send("I need an event to check.");
      message.delete(3500);
      return;
    }

    var filename = "./" + checkEvent[1] + ".json";

    if(fileExists(filename) == true){
      let eventRead = JSON.parse(fs.readFileSync(filename, "utf8"));
      message.channel.send("Event: " + eventRead.name + "\nDate: " + eventRead.date + "\nTime: " + eventRead.time + "\nHost: " + client.users.get(eventRead.hostID).username);
        var attendeeNames = "";
      for(i = 0; i < eventRead.attendees.length; i++){
        if(i == eventRead.attendees.length - 1){
          attendeeNames += client.users.get(eventRead.attendees[i]).username;
        }else{
          attendeeNames += client.users.get(eventRead.attendees[i]).username + ", ";
        }
      }
      message.channel.send("Attendees: " + attendeeNames);
    }else{
      message.channel.send("I couldn't find that event.");
      message.delete(3500);
    }

  }

  // Todo: This is a horrid mess.
  // !signup - Sign up for an event
    if(message.content.startsWith(prefix + "signup")){
      var signup = message.content.split(" ");
      if (signup.length < 2){
        message.channel.send("You need an event to sign up to.");
        message.delete(3500);
        return;
      }
      filename = "./" + signup[1] + ".json";
      let eventRead = JSON.parse(fs.readFileSync(filename, "utf8"));
      if(!eventRead.isEvent || !fileExists(filename)){
        message.channel.send("That's not a currently active event.");
        message.delete(3500);
        return;
      }
      if(eventRead.hostID == message.author.id){
        message.channel.send("You're already hosting this event.");
        return;
      }
      if(eventRead.attendees[0] == "None"){
        eventRead.attendees[0] = message.author.id;
        fs.writeFile(filename, JSON.stringify(eventRead), (err) => {
          if (err){
            console.error(err);
            message.channel.send("Sorry, I couldn't add you. Something went wrong.");
            return;
          }
          message.channel.send("See you there!");
          }
        );}else{
          for(i = 0; i < eventRead.attendees.length; i++){
            if (eventRead.attendees[i] == message.author.id){
              message.channel.send("You're already signed up for this event.");
              return;
            }
          }
          eventRead.attendees[eventRead.attendees.length] = message.author.id;
        fs.writeFile(filename, JSON.stringify(eventRead), (err) =>{
          if(err){
            console.error(err);
            message.channel.send("Sorry, I couldn't add you. Something went wrong.");
            return;
          }
          message.channel.send("See you there!");
        });
      }
    }


  // !remove [event] - Remove an event from TrashBot

  // !8ball - It's a magic 8 ball
  if(message.content.startsWith(prefix + "8ball")){
    now = new Date().getTime()/1000;
    if (now-lastSent <= 5){
      interval = "seconds";
      if(Math.abs(Math.ceil(lastSent-now)) == 1){
        interval = "second";
      }
      message.channel.send("Slow down! It's only been " + Math.abs(Math.ceil(lastSent-now)) + " " + interval + " since my last prediction!");
      message.delete(3500);
      return;
    }
    num = getRand(1, magic.phrases);
    message.channel.send("🎱 " + getFunFact(config.eightBallFile, num));
  }

  // !coin - Coin flip
  if(message.content.startsWith(prefix + "coin")){
    now = new Date().getTime()/1000;
    if (now-lastSent <= 5){
      interval = "seconds";
      if(Math.abs(Math.ceil(lastSent-now)) == 1){
        interval = "second";
      }
      message.channel.send("Slow down! It's only been " + Math.abs(Math.ceil(lastSent-now)) + " " + interval + " since your last flip!");
      message.delete(3500);
      return;
    }

    if(getRand(1, 2) == 1){
      const heads = message.guild.emojis.find("name", config.coinHead);
      message.channel.send(`${heads}` + " heads!");
    }else{
      const tails = message.guild.emojis.find("name", config.coinTail);
      message.channel.send(`${tails}` + " tails!");
    }
  }

  // !commands - List of TrashBot's commands
});


// Validation for date and time input in !schedule
function valiDate(date, time){
  var checkDate = date.split("/");

  // Date syntax validation
  if(checkDate.length < 3){ // Fails if more than 3 splits are present
    return false;
  }
  if(checkDate[0].length > 2 || checkDate[1].length > 2 || checkDate[2].length > 4){ // Fails if any field is too long
    return false;
  }else if(checkDate[0].length < 2 || checkDate[1].length < 2 || checkDate[2].length < 4){ // Fails if any field is too short
    return false;
  }

  // Date integer validation
  for(var i = 0; i < checkDate.length; i++){
    checkDate[i] = parseInt(checkDate[i]);
    if(!Number.isInteger(checkDate[i])){
      return false;
    }
  }
  // End date validation

  // Time syntax validation
  var checkTime = time.split(".");
  if(checkTime.length < 2 || !Number.isInteger(parseInt(checkTime[0]))){
    return false;
  }
  if(checkTime[0].length < 3){
    return false;
  }
  checkTime[1] == checkTime[1].toLowerCase();
  if(!checkTime[1] == "p" || !checkTime[1] == "a"){
    return false;
  }

  if(checkTime[0] > 1259){
    return false;
  }else if (checkTime[0] < 100){
    return false;
  }


  if(checkTime[0].length == 3){
    var timeSplit = [parseInt(checkTime[0].substring(0, 1)), parseInt(checkTime[0].substring(1))];
  }else{
    timeSplit = [parseInt(checkTime[0].substring(0, 2)), parseInt(checkTime[0].substring(2))];
  }

  var testDate = new Date(parseInt(checkDate[2]), parseInt(checkDate[0]-1), parseInt(checkDate[1]), parseInt(timeSplit[0]), parseInt(timeSplit[1]));
  var currentDate = new Date;


  if(testDate.getFullYear() < currentDate.getFullYear()){
    console.log("evt yr: " + testDate.getFullYear() + "cur yr: " + currentDate.getFullYear());
    return false;
  }else if(testDate.getMonth() < currentDate.getMonth()){
    console.log("evt mo: " + testDate.getMonth() + "cur mo: " + currentDate.getMonth());
    return false;
  }else if(testDate.getDay() < currentDate.getDay()){
    console.log("evt day: " + testDate.getDay() + "cur day: " + currentDate.getDay());
    return false;
  }else if(testDate.getTime() <= currentDate.getTime()){
    console.log("evt tm: " + testDate.getTime() + "cur tm: " + currentDate.getTime());
    return false;
  }
}

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

// Todo: Migrate the message text to a file to be checked rather than a giant if block.
// Check if a message should be deleted and clear it
function deleteBotMsg(message){
  if(message.author.id == config.botID){
    if(message.content.startsWith("Slow down! It's only been ")){
        message.delete(3000);
      }else if(message.content.startsWith("Uh. I can't remember a fact about nothing. I'm not SeinfeldBot")){
        message.delete(3000);
      }else if(message.content.startsWith("Your event needs a name.")){
        message.delete(3000);
      }else if(message.content.startsWith("Your event needs a time.")){
        message.delete(3000);
      }else if(message.content.startsWith("I need an event to check.")){
        message.delete(3000);
      }else if(message.content.startsWith("I couldn't find that event.")){
        message.delete(3000);
      }else if(message.content.startsWith("You need an event to sign up to.")){
        message.delete(3000);
      }else if(message.content.startsWith("That's not a currently active event")){
        message.delete(3000);
      }else if(message.content.startsWith("Your event needs a date.")){
        message.delete(3000);
      }else if(message.content.startsWith("The date or time provided was invalid.")){
        message.delete(9000);
      }else if(message.content.startsWith("This event already exists!")){
        message.delete(3000);
      }
    }
}

// Return a fun fact from facts.json based on a provided integer
function getFunFact(filename, num) {
  let funFact = JSON.parse(fs.readFileSync(filename, "utf8"));
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
