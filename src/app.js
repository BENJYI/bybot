require('dotenv').config();
const Discord = require('discord.js');
const Player = require('./player.js');
const player = new Player();
const client = new Discord.Client();

const {
  prefix,
  token,
} = require('./configuration/config.json');

client.once("ready", () => {
  console.log("Ready!");
});

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnect!");
});

client.on("message", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  if (message.content.startsWith(`${prefix}join`)) {
    await player.join(message);
    return;
  } else {
    if (!message.member.voice.channel) {
      return message.channel.send("You have to be in a voice channel!");
    }
    if (message.content.startsWith(`${prefix}play`)) {
      player.execute(message);
      return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
      player.skip(message);
      return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
      player.stop(message);
      return;
    } else if (message.content.startsWith(`${prefix}leave`)) {
      player.leave(message);
      return;
    } else if (message.content.startsWith(`${prefix}queue`)) {
      player.showQueue(message);
    } else {
      message.channel.send("You need to enter a valid command!");
    }
  }
});

client.login(token);