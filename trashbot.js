const Discord = require("discord.js");
const config = require("./config.json");
var request = require("request");
const client = new Discord.Client();
const facts = require(config.factFile);
const magic = require(config.eightBallFile);
const eventsFile = require(config.eventsFile);
const game = require(config.gameFile);
const trackedGames = require(config.trackedGamesFile);
const scratch = require(config.scratchFile);
const strings = require("./strings.json");
const baseTime = 25200000;
const lotteryBaseTime = 183600000;
const oneDay = 86400000;
const halfHour = 1800000;
//const responseObject = require("./commands.json");
const fs = require("fs");
var salesAnnounced = new Date(baseTime);
var statedFacts = new Array();
var lastWritten = 0;
var lastSent;
var rollOver = false;
var drawing = false;
var lastCommand;
var toDelete = false;
var written = true;
var thumbNail;
var scratchID;

/*
  ----------------Suggestion bin------------------
    Reminders - Not a command but allow a specific
      reminder to be broadcast periodically
        + Could have a command to change parameters
          -Work on after minigames update
    !avatar - Full avatar display of a given user
      Person calling the command or given name?
          -Work on after minigames update

    Spend trash coins on:
      Music plays?
*/

// Use token to log in. Provided by config.json
client.login(config.token);

// Initialization
client.on("ready", () => {
  console.log("TrashBot connected.");
  client.user.setGame(strings.gameSet);
  var timeInterval = setInterval(function(){doTick();}, 60000);
  var csInterval = setInterval(function(){checkCSSale();}, halfHour);
});

// Error handlers
client.on("error", (e) => console.error(e));
client.on("warn", (e) => console.warn(e));
client.on("debug", (e) => console.info(e));

// Directory handling
/*client.on("guildCreate", (guild) =>{
  fs.existsSync("./guilds/" + guild.id + "/users") || fs.mkdirSync("./guilds/" + guild.id + "/users");
});*/

client.on("message", (message) => {
  // Check if this a reply from TrashBot that should be deleted.
  deleteBotMsg(message);

  // Do nothing else if this is a bot message
  if(message.author.bot) return;

  // Do nothing if this is a DM
  if(message.guild == null) return;

  // Set a prefix
  let prefix = config.prefix;

  // Check if the user gets a game token, otherwise stop if the prefix isn't there
  if (!message.content.startsWith(prefix)){
      // Check if the user gets a game token for this message
    var totalTokens = gameToken(message.author.id);
    if(totalTokens <= 500){
      const trashCoin = message.guild.emojis.find("name", config.trashCoin);
      var str = strings.bonusCoin;
      str = str.replace("%n", message.author.id);
      str = str.replace(/%c/g, `${trashCoin}`);
      str = str.replace("%t", totalTokens);
      message.channel.send(str);
    }
    return;
  }

  // Cut the prefix out of the command, split the args
  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if(command == "eval" && message.author.id == config.ownerID){

    const clean = text => {
      if (typeof(text) === "string")
        return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
      else
        return text;
    };

    try{
      const code = args.join(" ");
      let evaled = eval(code);

      if(typeof evaled !== "string"){
        evaled = require("util").inspect(evaled);
      }

      message.delete();
    }catch(err){
      message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``);
      message.delete();
    }
  }

  if(command == "test"){
    /*var path = "./guilds/" + message.guild.id + ".json";
    if(fs.existsSync(path) == true){
      let reader = getReader(path);
      reader[message.author.id].coins = 10;
      reader[message.author.id].scratchUnlocked = "yes";
      writeFile(path, reader);
    }else{
      writeFile(path, "");
    }*/
  }

  // !scratch - DM the user a scratch ticket to be interacted with via reactions
  if(command == "scratch"){
    const trashCoin = message.guild.emojis.find("name", config.trashCoin); // TrashCoin emoji
    let coinReader = getReader(config.gameFile);
    let scratchReader = getReader(config.scratchFile);
    var coins = coinReader[message.author.id];
    /* Make sure the user is in the game list. This only happens if they
     attempt to play without having ever spoken. */
    if (!coinReader.hasOwnProperty(message.author.id)){
      gameToken(message.author.id);
      message.channel.send(strings.newCoins);
      return;
    }

    if(args[0] == "unlock"){
      if(coins < 50){
        str = strings.scratchUnlockFail;
        str = str.replace(/%c/g, `${trashCoin}`);
        str = str.replace("%t", coins);
        message.channel.send(str);
        message.delete(3000);
        return;
      }else{
        str = strings.scratchUnlock;
        str = str.replace(/%c/g, `${trashCoin}`);
        str = str.replace("%t", coins);
        str = str.replace("%n", message.author.id);
        scratchReader[message.author.id] = {
          "activeTicket" : false,
          "ticketID": null,
          "ticketNums": [0, 0, 0, 0, 0, 0, 0, 0, 0],
          "revealed": [],
          "playedToday": false
        };
        message.channel.send(str);
        writeFile(config.scratchFile, scratchReader);
        return;
      }
    }

    if(!scratchReader.hasOwnProperty(message.author.id)){
      str = strings.scratchNotUnlocked;
      str = str.replace(/%c/g, `${trashCoin}`);
      message.channel.send(str);
      message.delete(3000);
      return;
    }
    if(coins < 10){
      str = strings.scratchNSFCoins;
      str = str.replace(/%c/g, `${trashCoin}`);
      str = str.replace("%t", coins);
      message.channel.send(str);
      message.delete(3000);
      return;
    }

    if(scratchReader[message.author.id].activeTicket == true){
      message.channel.send(strings.scratchActiveTicket);
      message.delete(3000);
      return;
    }

    if(scratchReader[message.author.id].playedToday == true){
      message.channel.send(strings.scratchPlayedToday);
      message.delete(3000);
      return;
    }

    // Deduct coins
    coins -= 10;
    coinReader[message.author.id] = coins;
    writeFile(config.gameFile, coinReader);
    // Initial roll of the RNG to determine number arrangement

    // Fill the scratch ticket array with zeroes to overwrite
    for(i = 0; i < 9; i++){
      scratchReader[message.author.id].ticketNums[i] = 0;
    }

    // Get rng for default fill
    var rng = getRand(1, 10000);

    // Assign a scratch value to b eplaced three times into a ticket based on rng.
    var freebieVal;
    switch(true){
      case (rng <= 6000):
        freebieVal = 1;
        break;
      case (rng > 6000 && rng <= 7500):
        freebieVal = 2;
        break;
      case (rng > 7500 && rng <= 8500):
        freebieVal = 3;
        break;
      case (rng > 8500 && rng <= 9000):
        freebieVal = 4;
        break;
      case (rng > 9000 && rng <= 9300):
        freebieVal = 5;
        break;
      case (rng > 9300 && rng <= 9500):
        freebieVal = 6;
        break;
      case (rng > 9500 && rng <= 9700):
        freebieVal = 7;
        break;
      case (rng > 9700 && rng <= 9900):
        freebieVal = 8;
        break;
      case (rng > 9900):
        freebieVal = 9;
        break;
    }
    // Fill the freebie values
    var rngFilled = 0;
    while(rngFilled < 3){
      rng = getRand(0, 8);
      if(scratchReader[message.author.id].ticketNums[rng] == 0){
        scratchReader[message.author.id].ticketNums[rng] = freebieVal;
        rngFilled++;
      }
    }

    // Fill the remainder
    for(i = 0; i < scratchReader[message.author.id].ticketNums.length; i++){
      if(scratchReader[message.author.id].ticketNums[i] == 0){
        scratchReader[message.author.id].ticketNums[i] = getRand(1, 9);
      }
    }
    // Array of emoji to use for the reactions
    var reactArray = ["1⃣","2⃣","3⃣","4⃣","5⃣","6⃣","7⃣","8⃣","9⃣"];
    // Send the scratch ticket and reactions
    scratchID = message.author.id;
    scratchReader[message.author.id].playedToday = true;
    message. reply(strings.scratchSent);
    message.author.send(strings.scratchBase)
    .then(async function(message){
      scratchReader[scratchID].ticketID = message.id;
      scratchReader[scratchID].activeTicket = true;
      for(var i = 0 ; i < reactArray.length; i++){
        await replyMessage(message, reactArray[i]);
      }
      writeFile(config.scratchFile, scratchReader);
      var msgStr = message.cleanContent;
      msgStr = msgStr.replace("Please wait...", strings.scratchReady);
      message.edit(msgStr);
    });

  }

  // !cheapshark - Search for sales on a given game name
  if(command == "cheapshark"){
    //
    if(args.length < 1){
      message.channel.send("Need a title, dog. :^)");
      return;
    }
    var link = strings.csLink + strings.csTitleSearch;
    for(i = 0; i < args.length; i++){
      if(i == args.length-1){
        link += args[i];
      }else{
        link += args[i] + "%20";
      }
    }
    const shark = async() =>{
      var gameID = await getCSGameID(link);
      if(gameID == false){
        message.channel.send(strings.csSearchFail);
        return;
      }
      request({
        method: "GET",
        url: strings.csIDSearch + gameID,
        json: true
      }, function(e, r, body){
          var bestPrice = 0;
          for(i = 1; i < body["deals"].length; i++){
              if(parseInt(body["deals"][i].price) < parseInt(body["deals"][i-1].price)){
                bestPrice = i;
              }
          }
          const embed = new Discord.RichEmbed();
          embed.setAuthor("CheapShark", strings.csLink + "/img/logo_image.png");
          embed.setTitle(body["info"].title);
          embed.setThumbnail(thumbNail);
          embed.addField("Price","$" + body["deals"][parseInt(bestPrice)].price, true);
          embed.addField("Full Price","$" + body["deals"][parseInt(bestPrice)].retailPrice, true);
          embed.addField("Cheapest Ever","$" + body["cheapestPriceEver"].price, true);
          embed.addField("Purchase", strings.csDealSearch + body["deals"][bestPrice].dealID);
          message.channel.send({embed});
      });
    };
    shark();

  }

  // !lmgtfy
  if(command ==  "lmgtfy"){
    var url = "<http://www.lmgtfy.com/?q=";
    for (i = 0; i < args.length; i++){
      if(i > 0){
        url += "+" + args[i];
      }else{
        url += args[i];
      }
    }
    url += ">";
    message.channel.send(url);
  } // end !lmgtfy

  // !coins
  if(command == "coins"){
    const trashCoin = message.guild.emojis.find("name", config.trashCoin);
    let coinReader = getReader(config.gameFile);
    coins = coinReader[message.author.id];
    str = strings.getCoins;
    str = str.replace("%n", message.author.id);
    str = str.replace(/%c/g, `${trashCoin}`);
    str = str.replace("%t", coins);
    message.channel.send(str);
  }

  // !slot
  if(command == "slot" || command == "slots"){
    // Check if the user has 5 tokens
    var cost;

    if(Number.isInteger(parseInt(args[0])) == false){
      cost = 3;
    }else if(args[0] < 1){
      cost = 1;
    }else{
      cost = args[0];
    }

    if(cost > 20){
      cost = 20;
    }
    let tokenReader = getReader(config.gameFile);
    const trashCoin = message.guild.emojis.find("name", config.trashCoin);
    /* Make sure the user is in the game list. This only happens if they
     attempt to play without having ever spoken. */
    if (!tokenReader.hasOwnProperty(message.author.id)){
      gameToken(message.author.id);
      message.channel.send(strings.newCoins);
      return;
    }
    var tokens = tokenReader[message.author.id];
    if(tokens < cost){
        if(tokens <= 0){
          // If not, kick it back
          str = strings.nsfCoins;
          str = str.replace(/%c/g, `${trashCoin}`);
          str = str.replace(/%t/, tokens);
          message.channel.send(str);
          message.delete(3500);
          return;
        }else{
          cost = tokens;
        }
    }
    // Otherwise, deduct the tokens
    tokens -= cost;
    // Don't let tokens go negative
    if(tokens < 0){
      tokens - 0;
    }
    tokenReader[message.author.id] = tokens;
    var winValue;
    // Spin the "reels"
    rng = getRand(1, 10000);
    var slot = [];
    // Loss condition - RNG under 7500 (25% win chance)
    if(rng <= 7500){
      slot[0] = getRand(1, 10);
      slot[1] = getRand(1, 10);
      while (slot[1] == slot[0]){
        slot[1] = getRand(1, 10);
      }
      slot[2] = getRand(1, 10);
      winValue = 0;
      // Win condition ~18% of wins - slot val x2
    }else if(rng > 7500 && rng <= 9300){
      rng = getRand(1, 100);
      if(rng <= 45){
        slot[0] = 1;
      }else if(rng > 45 && rng <= 70){
        slot[0] = 2;
      }else if(rng > 70){
        slot[0] = 3;
      }
      slot[1] = slot[0];
      slot[2] = slot[0];
      winValue = 3;
      // Win condition ~5.5% of wins - slot val x3
    }else if (rng > 9300 && rng <= 9850){
      rng = getRand(1, 100);
      if(rng <= 75){
        slot[0] = 4;
      }else if(rng > 75 && rng <= 90){
        slot[0] = 5;
      }else if(rng > 90){
        slot[0] = 6;
      }
      slot[1] = slot[0];
      slot[2] = slot[0];
      winValue = 4;
      // Win condition ~0.9% of wins - slot val x4
    }else if(rng > 9850 && rng <= 9940){
      rng = getRand(1, 100);
      if(rng <= 90){
        slot[0] = 7;
      }else if(rng > 80){
        slot[0] = 8;
      }
      slot[1] = slot[0];
      slot[2] = slot[0];
      winValue = 5;
      // Win condition ~0.5% of wins - slot val x5
    }else if(rng > 9940 && rng <= 9990){
      slot[0] = 9;
      slot[1] = slot[0];
      slot[2] = slot[0];
      winValue = 6;
      // Win condition ~0.1% of wins - slot val x10
    }else if(rng > 9990 && rng <= 10000){
      slot[0] = 10;
      slot[1] = slot[0];
      slot[2] = slot[0];
      winValue = 10;
      // 10* win (10x pt value)
    }
    tokens += Math.floor((slot[0]*winValue)*(cost/config.winBase));
    message.channel.send({embed: {
      fields: [{
        name: "Result",
        value: game[slot[0]] + game[slot[1]] + game[slot[2]]
      },{
        name: "Winnings",
        value: `${trashCoin}` + "x" + Math.floor((slot[0]*winValue)*(cost/config.winBase)),
		inline: true
      },{
        name: "Total",
        value: `${trashCoin}` + "x" + tokens,
		inline: true
      }]
    }});
    // Update the user's points
    tokenReader[message.author.id] = tokens;
    // Write the whole thing to the game file
    writeFile(config.gameFile, tokenReader);
  }

  // !slut - Since my server is a bunch of fools <3
  if(command == "slut"){
    var timeOut = checkTimeout(message, 5, lastSent);
    if(timeOut == true){
      return;
    }
    rng = getRand(0, strings["slut"].length-1);
    str = strings["slut"][rng];
    message.channel.send(str);
  }

  // !lottery
  if(command == "lottery"){

    // Check if there are enough lotto numbers
    if(args.length < 5){
      message.channel.send(strings.lotterySyntax);
      message.delete(3500);
      return;
    }
    // Check that they're all integers between 1 and 9
    for(i = 0; i < args.length; i++){
      if(!Number.isInteger(parseInt(args[i]))){
        message.channel.send(strings.lotterySyntax);
        message.delete(3500);
        return;
      }else if(args[i] > 9 || args[i] < 1){
        message.channel.send(strings.lotterySyntax);
        message.delete(3500);
        return;
      }
    }
    // Get the file readers, check if the user is already in the drawing
    const trashCoin = message.guild.emojis.find("name", config.trashCoin);
    let coinReader = getReader(config.gameFile);
    let lottoReader = getReader(config.lottoFile);
    if(lottoReader.hasOwnProperty(message.author.id)){
      message.channel.send(strings.lotteryEntered);
      message.delete(3500);
      return;
    }
    // Check that the user has their starting coins, if not initialize them
    if(!coinReader.hasOwnProperty(message.author.id)){
      gameToken(message.author.id);
      message.channel.send(strings.newCoins);
      message.delete(3500);
      return;
    }
    // Check that the user has enough coins
    tokens = coinReader[message.author.id];
    if(tokens < 10){
      str = strings.nsfCoinsLot;
      str = str.replace(/%c/g, `${trashCoin}`);
      str = str.replace(/%t/, tokens);
      message.channel.send(str);
      message.delete(3500);
      return;
    }
    // Enter them into the drawing
    tokens -= 10;
    lottoReader.pot += 10;
    str = strings.lotterySuccess;
    str = str.replace(/%c/g, `${trashCoin}`);
    str = str.replace(/%t/, tokens);
    message.channel.send(str + lottoReader.pot);
    lottoReader[message.author.id] = args;
    coinReader[message.author.id] = tokens;
    writeFile(config.gameFile, coinReader);
    writeFile(config.lottoFile, lottoReader);
  }

  // Todo: Clean up handling of commands.
  // !fact - Have TrashBot recall one of his witty facts
  // Todo: Clean this up
  // Todo: Add handling for blank facts
  if(command == "fact"){
    timeOut = checkTimeout(message, 5, lastSent);
    if(timeOut == true){
      return;
    }

    var freshFact = false;
    var num = getRand(1, facts.factNum);
    // Check if the number pulled is in the repeat array
    while(freshFact == false){
      for (var i = 0; i <= statedFacts.length; i++){
        if (num == statedFacts[i]){
          num = getRand(1, facts.factNum);
          break;
        }else{
          freshFact = true;
        }
      }
    }
    // Store the fact in the fact array, return to the start if we've reached the end
    statedFacts[lastWritten] = num;
    if(lastWritten == config.factMemory){
      lastWritten = 0;
    }else{
      lastWritten++;
    }
    let factReader = getReader(config.factFile);
    var fact = factReader[num];
    if(num == 21){// Special handling for fact 21.
      message.channel.send(fact + "<@" + message.author.id + ">");
    }else{
    message.channel.send(fact);
    lastSent = new Date().getTime()/1000;
    let fileReader = getReader(config.dataFile);
    num = fileReader["fact"];
    num++;
    fileReader["fact"] = num;
    writeFile(config.dataFile, fileReader);
    }
  } // end !fact


  // todo: better permissioning
  // !addfact - Add a new fact to TrashBot's database
  if(command == "addfact" && message.channel.permissionsFor(message.member).has("MANAGE_CHANNELS")){
      if (args.length == 0){
        message.channel.send(strings.emptyFact + "<@" + message.author.id +">");
        message.delete(3500);
        return;
      }
      var toAdd = "";
      for(i = 0; i<args.length; i++){
        if(i == args.length-1){
          toAdd = toAdd + args[i];
        }else{
        toAdd = toAdd + args[i] + " ";
        }
      }
      let factReader = getReader(config.factFile);
      if(!factReader.toAdd){
        //
        num = factReader.factNum;
        num++;
        factReader[num] = toAdd;
        factReader.factNum = num;
        writeFile(config.factFile, factReader);
        message.channel.send(strings.success);
      }else{
        message.channel.send(strings.dupeFact);
      }
  } // end !addfact

  // !schedule - Schedule an event with TrashBot
  if (command ==  "schedule"){
    if(!message.channel.permissionsFor(message.member).has("MANAGE_CHANNELS" || !message.author.id == config.ownerID)){
      message.channel.send(strings.invalidPerms);
      message.delete(3500);
      return;
    }
    if (args.length < 1){
      message.channel.send(strings.evtName); // newEvent[1] is event name
      message.delete(3500);
      return;
    }else if(args.length < 2){
      message.channel.send(strings.evtDate); // newEvent[2] is event date
      message.delete(3500);
      return;
    }else if(args.length < 3){
      message.channel.send(strings.evtTime); // newEvent[3] is event time
      message.delete(3500);
      return;
    }

    var eventDate = valiDate(args[1], args[2]);  // All parts of the event date and time need to be present and in the correct form
    if(eventDate == false){
      message.channel.send(strings.evtSyntax); // Should it fail, provide a fail message
      message.delete(9500);
      return;
    }

    // Checks if the event already exists and notifies the user
    if(eventsFile.hasOwnProperty(args[0])){
      message.channel.send(strings.evtDupe);
      message.delete(3500);
      return;
    }

    // The scheduler is automatically listed as the host of the event.
    // Event name, event time, host, attendees array
    var eventData = [args[0], eventDate.getTime(), message.author.id, ["None"], "no"];

    // Write the new file with event details.
    let eventReader = getReader(config.eventsFile);
    var numEvents = eventReader.numEvents;
    if(numEvents >= 10){
      message.channel.send("There's already " + numEvents + " events on my calendar, I'm not keeping track of another one.");
      message.delete(3500);
      return;
    }
    numEvents++;
    eventReader.numEvents = numEvents;
    eventReader[eventData[0]] = eventData;
    writeFile(config.eventsFile, eventReader);
    message.channel.send(strings.success);
  } // end !schedule

  // !event - List the details of an event: Name, time, host, attendees
  if(command == "event"){
    // Stop if there is no event argument
    if(args.length < 1){
      message.channel.send(strings.noEvt);
      message.delete(3500);
      return;
    }

    // Open the event file
    let eventReader = getReader(config.eventsFile);

    // Stop if the event is not in the event file
    if(!eventReader.hasOwnProperty(args[0])){
      message.channel.send(strings.eventNotFound);
      message.delete(3500);
      return;
    }

    var attendees = "";
    if(eventReader[args[0]][3][0] == "None"){
      attendees += "None";
    }else{
      for(i = 0; i < eventReader[args[0]][3].length; i++){
        if(i == eventReader[args[0]][3].length - 1){
          attendees += client.users.get(eventReader[args[0]][3][i]).username;
        }else{
          attendees += client.users.get(eventReader[args[0]][3][i]).username + ", ";
        }
      }
    }


    var embedDate = new Date(parseInt(eventReader[args[0]][1]));

    message.channel.send({embed: {
      color: 0xffffff,
      title: eventReader[args[0]][0],
      fields: [{
        name: "Host",
        value: client.users.get(eventReader[args[0]][2]).username
      },
      {
        name: "Attendees",
        value: attendees
      },
      {
        name: "Date",
        value: embedDate.toDateString(),
        inline: true
      },
      {
        name: "Time",
        value: embedDate.toLocaleTimeString() + " (Pacific)",
        inline: true
      }
    ],
      timestamp: new Date(),
      footer: {
        icon_url: client.user.avatarURL,
        text: strings.TrashPlug
      }
    }});
  }

  // !signup - Sign up for an event
    if(command == "signup"){
      // Make sure the user entered an event to sign up for
      if (args.length < 2){
        message.channel.send(strings.noEvt);
        message.delete(3500);
        return;
      }

      // Validation for signups
      let eventReader = getReader(config.eventsFile);
      if(!eventReader.hasOwnProperty(args[0])){
        message.channel.send(strings.noEvt);
        message.delete(3500);
        return;
      }
      if(eventReader[args[1]][2] == message.author.id){
        message.channel.send(strings.isEventHost);
        message.delete(3500);
        return;
      }

      var nextAtten = eventReader[args[1]][3].length;
      // if there's attendees, make sure the sender isn't signed up
      if(!eventReader[args[1]][3][0] == "None"){
        for(i = 0; i < eventReader[args[1]][3].length; i++){
          if(eventReader[3][i] == message.author.id){
            message.channel.send(strings.isSignedUp);
            message.delete(3500);
            return;
          }
        }
      }else if(eventReader[args[1]][3][0] == "None"){ // if there's no attendees, just go ahead and sign them up
        eventReader[args[1]][3][0] = message.author.id;
        writeFile(config.eventsFile, eventReader);
        message.channel.send(strings.success);
        return;
      }else{
        // If there are attendees, and this user is not signed up, sign them up
        eventReader[args[1]][3][nextAtten] = message.author.id;
      }

      writeFile(config.eventsFile, eventReader);
      message.channel.send(strings.success);
    }


  // !unschedule [event] - Remove an event from TrashBot
  if(message.content.startsWith(prefix + "unschedule")){
    // Make sure the user entered an event to sign up for
    var eventToCancel = message.content.split(" ");
    if (eventToCancel.length < 2){
      message.channel.send(strings.noEvt);
      message.delete(3500);
      return;
    }

    let eventReader = getReader(config.eventsFile);
    if(!eventReader.hasOwnProperty(eventToCancel[1])){
      message.channel.send(strings.eventNotFound);
      message.delete(3500);
      return;
    }
    if(!eventReader[eventToCancel[1]][2] == message.author.id || !message.channel.permissionsFor(message.member).has("MANAGE_CHANNELS" || !message.author.id == config.ownerID)){
      message.channel.send(strings.invalidPerms);
      message.delete(3500);
      return;
    }

    eventReader.numEvents--;
    delete eventReader[eventToCancel[1]];
    writeFile(config.eventsFile, eventReader);
    message.channel.send(strings.successDel);
  }

  // !unsign - Remove your signup from an event
  if(message.content.startsWith(prefix + "unsign")){
    // Make sure the user entered an event to sign up for
    var unSign = message.content.split(" ");
    if (unSign.length < 2){
      message.channel.send(strings.noEvt);
      message.delete(3500);
      return;
    }

    let eventReader = getReader(config.eventsFile);
    if(!eventReader.hasOwnProperty(unSign[1])){
      message.channel.send(strings.eventNotFound);
      message.delete(3500);
      return;
    }

    if(!(eventReader[unSign[1]][3][0] == "None")){
      for(i = 0; i < eventReader[unSign[1]][3].length; i++){
        if(eventReader[unSign[1]][3][i] == message.author.id){
          if(eventReader[unSign[1]][3].length <= 1){
            eventReader[unSign[1]][3][i] = "None";
          }else{
            delete eventReader[unSign[1]][3][i];
          }
          writeFile(config.eventsFile, eventReader);
          message.channel.send(strings.successDel);
          return;
        }
      }
      message.channel.send(strings.notSignedUp);
      message.delete(3500);
      return;
    }
    message.channel.send(strings.notSignedUp);
    message.delete(3500);
    return;
  }

  // !8ball - It's a magic 8 ball
  if(command == "8ball"){
    timeOut = checkTimeout(message, 5, lastSent);
    if(timeOut == true){
      return;
    }
    num = getRand(1, magic.phrases);
    let ballReader = getReader(config.eightBallFile);
    fact = ballReader[num];
    message.channel.send("🎱 " + fact);
    let fileReader = getReader(config.dataFile);
    num = fileReader["eightball"];
    num++;
    fileReader["eightball"] = num;
    writeFile(config.dataFile, fileReader);
  }

  // !coin - Coin flip
  if(command == "coin"){
    timeOut = checkTimeout(message, 5, lastSent);
    if(timeOut == true){
      return;
    }
    if(getRand(1, 2) == 1){
      const heads = message.guild.emojis.find("name", config.coinHead);
      message.channel.send(`${heads}` + " heads!");
      let fileReader = getReader(config.dataFile);
      num = fileReader["coin"];
      num++;
      fileReader["coin"] = num;
      writeFile(config.dataFile, fileReader);
    }else{
      const tails = message.guild.emojis.find("name", config.coinTail);
      message.channel.send(`${tails}` + " tails!");
      let fileReader = getReader(config.dataFile);
      num = fileReader["coin"];
      num++;
      fileReader["coin"] = num;
      writeFile(config.dataFile, fileReader);
    }
  }

  // !trash - List of TrashBot's commands
  if(command == "trash"){
    timeOut = checkTimeout(message, 120, lastCommand);
    if (timeOut == true){
      return;
    }
    message.channel.send({embed: {
      color: 0xffffff,
      author: {
        name: client.user.username,
        icon_url: client.user.avatarURL
      },
      title: "TrashBot Commands",
      fields: [{
        name: "Scheduling",
        value: strings.cmdSched
      },
      {
        name: "Fun Stuff",
        value: strings.cmdFun
      }
    ],
      timestamp: new Date(),
      footer: {
        icon_url: client.user.avatarURL,
        text: strings.TrashPlug
      }
    }});
    lastCommand = new Date().getTime()/1000;
  }
});

// !scratch handling
client.on("messageReactionAdd", (messageReaction, user) =>{
  if(user.id == parseInt(config.botID)){
    const scratchReact = async() =>{
      return true;
    };
    scratchReact();
    return;
  }
  let scratchReader = getReader(config.scratchFile);
  if(messageReaction.message.id == scratchReader[user.id].ticketID && scratchReader[user.id].revealed.length < 5 && scratchReader[user.id].activeTicket == true){
    if(messageReaction.count > 1){
      var reactionID = messageReaction.emoji.toString().split("").slice(0);
      var msgStr = messageReaction.message.cleanContent;
      switch(parseInt(reactionID)){
        case 1:
          msgStr = msgStr.replace("1⃣", getNumberEmoji(scratchReader[user.id].ticketNums[0]));
          scratchReader[user.id].revealed[scratchReader[user.id].revealed.length] = scratchReader[user.id].ticketNums[0];
          messageReaction.message.edit(msgStr);
          messageReaction.remove();
          break;
        case 2:
          msgStr = msgStr.replace("2⃣", getNumberEmoji(scratchReader[user.id].ticketNums[1]));
          scratchReader[user.id].revealed[scratchReader[user.id].revealed.length] = scratchReader[user.id].ticketNums[1];
          messageReaction.message.edit(msgStr);
          messageReaction.remove();
          break;
        case 3:
          msgStr = msgStr.replace("3⃣", getNumberEmoji(scratchReader[user.id].ticketNums[2]));
          scratchReader[user.id].revealed[scratchReader[user.id].revealed.length] = scratchReader[user.id].ticketNums[2];
          messageReaction.message.edit(msgStr);
          messageReaction.remove();
          break;
        case 4:
          msgStr = msgStr.replace("4⃣", getNumberEmoji(scratchReader[user.id].ticketNums[3]));
          scratchReader[user.id].revealed[scratchReader[user.id].revealed.length] = scratchReader[user.id].ticketNums[3];
          messageReaction.message.edit(msgStr);
          messageReaction.remove();
          break;
        case 5:
          msgStr = msgStr.replace("5⃣", getNumberEmoji(scratchReader[user.id].ticketNums[4]));
          scratchReader[user.id].revealed[scratchReader[user.id].revealed.length] = scratchReader[user.id].ticketNums[4];
          messageReaction.message.edit(msgStr);
          messageReaction.remove();
          break;
        case 6:
          msgStr = msgStr.replace("6⃣", getNumberEmoji(scratchReader[user.id].ticketNums[5]));
          scratchReader[user.id].revealed[scratchReader[user.id].revealed.length] = scratchReader[user.id].ticketNums[5];
          messageReaction.message.edit(msgStr);
          messageReaction.remove();
          break;
        case 7:
          msgStr = msgStr.replace("7⃣", getNumberEmoji(scratchReader[user.id].ticketNums[6]));
          scratchReader[user.id].revealed[scratchReader[user.id].revealed.length] = scratchReader[user.id].ticketNums[6];
          messageReaction.message.edit(msgStr);
          messageReaction.remove();
          break;
        case 8:
          msgStr = msgStr.replace("8⃣", getNumberEmoji(scratchReader[user.id].ticketNums[7]));
          scratchReader[user.id].revealed[scratchReader[user.id].revealed.length] = scratchReader[user.id].ticketNums[7];
          messageReaction.message.edit(msgStr);
          messageReaction.remove();
          break;
        case 9:
          msgStr = msgStr.replace("9⃣", getNumberEmoji(scratchReader[user.id].ticketNums[8]));
          scratchReader[user.id].revealed[scratchReader[user.id].revealed.length] = scratchReader[user.id].ticketNums[8];
          messageReaction.message.edit(msgStr);
          messageReaction.remove();
          break;
      }

      const finalize = async() =>{
        var waiting = await writeFileSync(config.scratchFile, scratchReader);
        if(waiting == false){
          let coinReader = getReader(config.gameFile);
          var coins = coinReader[user.id];
          coins += 10;
          scratchReader[user.id].ticketNums = [];
          scratchReader[user.id].activeTicket = false;
          scratchReader[user.id].revealed = [];
          scratchReader[user.id].ticketID = null;
          scratchReader[user.id].playedToday = false;
          writeFile(config.gameFile, coinReader);
          writeFile(config.scratchFile, scratchReader);
          messageReaction.message.channel.send("Something went wrong. Your ticket has been cancelled and your coins refunded.");
        }
        if(scratchReader[user.id].revealed.length == 5){
          var coinsWon = 0;
          for(var i = 0; i < scratchReader[user.id].revealed.length; i++){
            for(var k = i+1; k < scratchReader[user.id].revealed.length; k++){
              if(scratchReader[user.id].revealed[i] == scratchReader[user.id].revealed[k]){
                coinsWon += parseInt(scratchReader[user.id].revealed[i]);
              }
            }
          }
          messageReaction.message.channel.send(getNumberEmoji(scratchReader[user.id].ticketNums[0]) + "" +  getNumberEmoji(scratchReader[user.id].ticketNums[1]) + "" +  getNumberEmoji(scratchReader[user.id].ticketNums[2]) + "\n" + getNumberEmoji(scratchReader[user.id].ticketNums[3]) + "" +  getNumberEmoji(scratchReader[user.id].ticketNums[4]) + "" +  getNumberEmoji(scratchReader[user.id].ticketNums[5]) + "\n" + getNumberEmoji(scratchReader[user.id].ticketNums[6]) + "" +  getNumberEmoji(scratchReader[user.id].ticketNums[7]) + "" +  getNumberEmoji(scratchReader[user.id].ticketNums[8]) + "\nWon: " + coinsWon);
          let coinReader = getReader(config.gameFile);
          coins = coinReader[user.id];
          coins += coinsWon;
          coinReader[user.id] = coins;
          scratchReader[user.id].ticketNums = [];
          scratchReader[user.id].activeTicket = false;
          scratchReader[user.id].revealed = [];
          scratchReader[user.id].ticketID = null;
          writeFile(config.scratchFile, scratchReader);
          writeFile(config.gameFile, coinReader);
        }
      };
      finalize();
    }
  }
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
  }else if(checkDate[0].length < 1 || checkDate[1].length < 1 || checkDate[2].length < 2){ // Fails if any field is too short
    return false;
  }

  // Date integer validation
  for(var i = 0; i < checkDate.length; i++){
    checkDate[i] = parseInt(checkDate[i]);
    if(!Number.isInteger(checkDate[i])){
      return false;
    }
  }

  var testDate = new Date(parseInt(checkDate[2]), parseInt(checkDate[0]-1), parseInt(checkDate[1]));
  // End date validation

  // Time syntax validation
  var checkTime = time.split(/[.:]/);
  if(checkTime.length < 3 || !Number.isInteger(parseInt(checkTime[0])) || !Number.isInteger(parseInt(checkTime[1]))){
    return false;
  }else if(checkTime[0].length < 1 || checkTime[0].length > 2){
    return false;
  }else if(checkTime[1].length < 1 || checkTime[1].length > 2){
    return false;
  }else if(!checkTime[2] == "pm" || !checkTime[2] == "am"){
    return false;
  }else if(checkTime[0] > 13 || checkTime [0] < 1){
    return false;
  }else if(checkTime[1] > 59 || checkTime[1] < 0){
    return false;
  }

  if(checkTime[2] == "pm"){
    checkTime[0] = parseInt(checkTime[0]) + 12;
  }

  testDate.setHours(parseInt(checkTime[0]));
  testDate.setMinutes(parseInt(checkTime[1]));

  var currentDate = new Date();

  if(testDate.getTime() <= currentDate.getTime()){
    return false;
  }
  return testDate;
}

// Fetch a number between min and max, inclusive
function getRand(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Check if a message should be deleted and clear it
function deleteBotMsg(message){
  if(message.author.id == config.botID){
    let messageReader = getReader(config.botMsgFile);
    for(var i = 1; i <= messageReader.entries; i++){
      var text = messageReader[i];
      if(message.content.startsWith(text)){
        message.delete(4000);
      }
    }
  }
}

// Perform functions on a timed interval
function doTick(forceLottery){
  // check for daily token refresh
  var date = new Date(); // current time
  if((date.getTime() - baseTime)%oneDay >= 0 && (date.getTime() - baseTime)%oneDay <= 300000){ // If it is midnight or within five minutes
    dailyTokenRefresh();
  }

  if((date.getTime() - baseTime)%oneDay > 300000 && rollOver == true){ // If it is past 12:05am and rollover has occurred - reset
    rollOver = false;
  }

  // Todo: Move this to an async function you fucking swine.
  if((date.getTime() - lotteryBaseTime)%(oneDay*7) >= 0 && (date.getTime() - lotteryBaseTime)%(oneDay*7) <= 300000 || forceLottery == true){
    var rng = new Array();
    var winners = [];
    if(drawing == true && forceLottery != true){
      return;
    }
    let lottoReader = getReader(config.lottoFile);
    var keys = Object.keys(lottoReader);
    var userIDs = Object.getOwnPropertyNames(lottoReader);
    if (keys.length < 3){
      drawing = true;
      winners[0] = "nse";
    }
    for(var i = 0; i < 5; i++){
      rng[i] = getRand(1, 9);
    }
    for(i = 1; i < keys.length; i++){
      for(var k = 0; k < 5; k++){
        if(lottoReader[keys[i]][k] != rng[k]){
          break;
        }else if(k == 4 && lottoReader[keys[i]][k] == rng[k]){
          winners[winners.length] = userIDs[i];
        }
      }
    }
    if(winners.length == 0){
      winners[0] = "None";
    }
    drawing = true;
    const trashCoin = client.emojis.find("name", config.trashCoin);
    var lottoPot = lottoReader.pot;
    if(winners[0] == "nse"){
        lottoPot = lottoPot - Math.floor(lottoPot/4);
        if(lottoPot < 10){
          lottoPot = 10;
        }
        client.channels.find("name", config.announceChannel).send(strings.lotteryNSE + "\nNew Jackpot: " + `${trashCoin}` + "x" + lottoPot);
    }
    if(winners[0] == "None"){
      lottoPot = lottoPot - Math.floor(lottoPot/4);
      if(lottoPot < 10){
        lottoPot = 10;
      }
      client.channels.find("name", config.announceChannel).send("Lottery numbers: " + rng[0] + " " + rng[1] + " " + rng[2] + " " + rng[3] + " " + rng[4] + "\nNo Winner\nCurrent Jackpot: " + `${trashCoin}` + "x" + lottoPot);
    }else if(winners[0] != "nse" && winners[0] != "None"){
      let gameReader = getReader(config.gameFile);
      var winnings = Math.floor(lottoPot/winners.length);
      var winnerNames = "";
      lottoPot = 10;
      for(i = 0; i < winners.length; i++){
        gameReader[winners[i]] += winnings;
        if(i == winners.length-1){
          winnerNames += client.users.get(winners[i]).username;
        }else{
          winnerNames += client.users.get(winners[i]).username + ", ";
        }

      }
      client.channels.find("name", config.announceChannel).send("Lottery numbers: " + rng[0] + " " + rng[1] + " " + rng[2] + " " + rng[3] + " " + rng[4] + "\nWinners: " + winnerNames + "\nWinnings: " + `${trashCoin}` + "x" + winnings);
      writeFile(config.gameFile, gameReader);
    }
    lottoReader.pot = lottoPot;
    for(i = 1; i < keys.length; i++){
      delete lottoReader[keys[i]];
    }
    writeFile(config.lottoFile, lottoReader);
  }

  if((date.getTime() - lotteryBaseTime)%(oneDay*7) > 300000 && drawing == true){
    drawing = false;
  }

  var numEvtsRdr = getReader(config.eventsFile);

  if(numEvtsRdr.numEvents <= 0){
    return;
  }

  if(toDelete == false){
  // Iterate through the events file, starting at index 1, as index 0 is numEvents
  for(i = 1; i <= eventsFile.numEvents; i++){
    // Read the events file
    let eventReader = getReader(config.eventsFile);
    // Get its keys
    var key = Object.keys(eventReader);
    // Get the event's date and time, place them into a date object
    var eventDate = new Date(parseInt(eventReader[key[i]][1]));
    // Compare with the current date
    if (date.getTime() >= eventDate.getTime()){ // If it is time for, or later than, the event we proceed
      // Get the host and attendee IDs
      var attendeeIDs = [eventReader[key[i]][2]];
      if(!eventReader[key[i]][3][0] == "None"){
        for(k = 0; k < eventReader[key[i]][3][k]; k++){
          attendeeIDs[k+1] = eventReader[key[i]][3][k];
        }
      }
      // Todo: Do this more elegantly
      // Create a second array for mentions for use in the embed
      var attendeeMentions = "<@" + attendeeIDs[0] + ">";
      for(k = 1; k < attendeeIDs.length; k++){
        if(!attendeeIDs[k] == "None"){
          attendeeMentions[k] += "<@" + attendeeIDs[k] + ">";
        }
      }
      // Announce the event
      client.channels.find("name", config.announceChannel).send(attendeeMentions);
      client.channels.find("name", config.announceChannel).send({embed:{
        color: 0xfaa61a,
        title: eventReader[key[i]][0],
        fields: [{
          name: "Event",
          value: eventReader[key[i]][0]
        },
        {
          name: "Date",
          value: eventDate.toDateString(),
          inline: true
        },
        {
          name: "Time",
          value: eventDate.toLocaleTimeString() + " (Pacific)",
          inline: true
        }
      ],
        timestamp: new Date(),
        footer: {
          icon_url: client.user.avatarURL,
          text: strings.trashPlug
        }
      }});
      eventReader[key[i]][4] = "yes";
      writeFile(config.eventsFile, eventReader);
      toDelete = true;
    }// Else we do nothing
  }
}else if(toDelete == true){
  if (written == true){
    written == false;
    let eventReader = getReader(config.eventsFile);
    key = Object.keys(eventReader);
    for(var l = 1; l <= eventReader.numEvents; l++){
      // Delete all events flagged for deletion
      if(eventReader[key[l]][4] == "yes"){
        eventReader.numEvents--;
        delete eventReader[key[l]];
      }
    }
    writeFile(config.eventsFile, eventReader);
    toDelete = false;
    written = true;
    }
  }
}

// Handling for per-message game tokens.
function gameToken(authID){
  if(authID == config.botID){
    return false;
  }
  let readFile = getReader(config.gameFile);
  if(!readFile.hasOwnProperty(authID)){
    readFile[authID] = 10;
    writeFile(config.gameFile, readFile);
    return;
  }
  var num = getRand(1, 1000);
  if(num >  980){
    var tokens = readFile[authID];
    if(tokens >= 10){
      return 999;
    }
    tokens+=3;
    readFile[authID] = tokens;
    writeFile(config.gameFile, readFile);
    return tokens;
  }

}

// Return a file sync to be assigned to a variable.
function getReader(filename){
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

// Write indicated data to an indicated file.
function writeFile(filename, data){
  fs.writeFile(filename, JSON.stringify(data), (err) =>{
    if(err){
      console.error(err);
    }
  });
}

async function writeFileSync(filename, data){
  return new Promise(resolve =>{
    fs.writeFileSync(filename, JSON.stringify(data), (err) =>{
      if(err){
        console.error(err);
        resolve(false);
      }
    });
    resolve(true);
  });
}

// Daily token refresh. Set to 10 tokens if the total tokens is less than 10
function dailyTokenRefresh(force){

  if(rollOver == true && force != true){ // If rollover has happened but we are within the timing window, do nothing.
    return;
  }

  // coin refresh
  let gameReader = getReader(config.gameFile);
  var keys = Object.keys(gameReader);
  for(var i = 10; i < Object.keys(gameReader).length; i++){
    if (gameReader[keys[i]] < 10){
      var num = gameReader[keys[i]];
      num = 10;
      gameReader[keys[i]] = num;
    }
  }
  // Scratch refresh
  let scratchReader = getReader(config.scratchFile);
  keys = Object.keys(scratchReader);
  for(i = 0; i < Object.keys(scratchReader).length; i++){
    if(scratchReader[keys[i]].playedToday == true){
      scratchReader[keys[i]].playedToday = false;
    }
  }
  // Write files and send reset.
  writeFile(config.gameFile, gameReader);
  writeFile(config.scratchFile, scratchReader);
  client.channels.find("name", config.announceChannel).send(strings.dailyReset);
  rollOver = true;
}

function checkTimeout(message, secs, timer){
  var now = new Date().getTime()/1000;
  if (now-timer <= secs){
    var interval = "seconds";
    if(Math.abs(Math.ceil(timer-now)) == 1){
      interval = "second";
    }
    message.channel.send("Slow down! It's only been " + Math.abs(Math.ceil(timer-now)) + " " + interval + "!");
    message.delete(3500);
    return true;
  }
  return false;
}

function getCSGameID(link){
  var gameID;
  return new Promise(function(resolve, reject) {
    request.get({url:link, json:true}, function(e, r, body){
      if(e){
        reject(e);
      }
      if(body.length < 1){
        gameID = false;
      }else{
        thumbNail = body[0].thumb;
        gameID = body[0].gameID;
      }
      resolve(gameID);
    });
  });
}

function checkCSSale(){
  // Check if the file has tracked games, exit if not
  if(trackedGames.trackedGames < 1){
    return;
  }

  // Iterate through the tracked games
  var now = new Date();
  for(var i = 1; i <= trackedGames.trackedGames; i++){
    if(salesAnnounced != "undefined"){
      if (now.getTime() - salesAnnounced.getTime() < 21600000){
        return;
      }
    }
    // Pull the game's details from CheapShark
    request.get({url:trackedGames[i], json:true}, function(e, r, body){
      var bestPrice = 0;
      var sale = false;
      // Check the game's deals
      for (var k = 0; k < body["deals"].length; k++){
        if(body["deals"][k].savings > 0){          // Mark if the game is on sale and the best price
          sale = true;
          if(body["deals"][k].savings > body["deals"][bestPrice].savings){
            bestPrice = k;
          }

        }
      }
      // If no sale was found, we exit.
      if(sale == false){
        return;
      // Otherwise, we announce it
      }else if(sale == true){
        const embed = new Discord.RichEmbed();
        embed.setAuthor("CheapShark", strings.csLink + strings.csImg);
        embed.setDescription(body["info"].title + " is on sale!");
        embed.setThumbnail(trackedGames.thumbs[i-1]);
        embed.addField("Price","$" + body["deals"][bestPrice].price, true);
        embed.addField("Full Price","$" + body["deals"][bestPrice].retailPrice, true);
        embed.addField("Cheapest Ever","$" + body["cheapestPriceEver"].price, true);
        embed.addField("Purchase", strings.csDealSearch + body["deals"][bestPrice].dealID);
        client.channels.find("name", config.announceChannel).send({embed});
        salesAnnounced = now;
      }
    });
  }
}

async function replyMessage(message, reaction){
  return new Promise(resolve =>{
    var reacted = message.react(reaction);
    resolve(reacted);
  });
}
function getNumberEmoji(num){
  switch(num){
    case 1:
      return "🍏";
    case 2:
      return "🍎";
    case 3:
      return "🍓";
    case 4:
      return "🍑";
    case 5:
      return "🍊";
    case 6:
      return "🍍";
    case 7:
      return "🍉";
    case 8:
      return "🍇";
    case 9:
      return "🍈";
  }
}

// ADMIN COMMANDS
function updateCoins(userID, coinChange){
  let coinReader = getReader(config.gameFile);
  if(!coinReader.hasOwnProperty(userID)){
    throw Error("Invalid User ID");
  }

  coinReader[userID] += coinChange;
  writeFileSync(config.gameFile, coinReader);
  client.channels.find("name", config.announceChannel).send("Updated coins for " + client.users.get(userID).username + ": " + coinReader[userID]);
}

function setCoins(userID, coins){
  let coinReader = getReader(config.gameFile);
  if(!coinReader.hasOwnProperty(userID)){
    throw Error("Invalid User ID");
  }

  coinReader[userID] = coins;
  writeFileSync(config.gameFile, coinReader);
  client.channels.find("name", config.announceChannel).send("Updated coins for " + client.users.get(userID).username + ": " + coinReader[userID]);
}

function resetScratch(userID){
  let scratchReader = getReader(config.scratchFile);
  if(!scratchReader.hasOwnProperty(userID)){
    throw Error("Invalid User ID. This user either does not have this feature unlocked or the User ID is invalid.");
  }

  scratchReader[userID].activeTicket = false;
  scratchReader[userID].playedToday = false;
  scratchReader[userID].ticketNums = [];
  scratchReader[userID].revealed = [];
  scratchReader[userID].ticketID = null;

  writeFileSync(config.scratchFile, scratchReader);

  client.channels.find("name", config.announceChannel).send(client.users.get(userID).username + " has had their scratch ticket reset.");
}
