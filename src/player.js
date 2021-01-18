const ytdl = require("ytdl-core");

module.exports = class Player {
  constructor() {
    this.validUrlPrefixes = [
      "https://www.youtube.com",
      "http://www.youtube.com",
      "www.youtube.com",
      "youtube.com"
    ]
  }

  async join(message, queue) {
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
      return message.channel.send("You need to be in a voice channel to play music!")
    }

    const permissions = voiceChannel.permissionsFor(message.client.user);

    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
      return message.channel.send("I need the permissions to join and speak in your voice channel!");
    }

    let serverQueue = queue.get(message.guild.id);

    if (!serverQueue) {
      serverQueue = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 5,
        playing: false
      }

      queue.set(message.guild.id, serverQueue);
    }

    serverQueue.voiceChannel = voiceChannel;
    serverQueue.textChannel = message.channel;

    try {
      var connection = await voiceChannel.join();
      serverQueue.connection = connection;
    } catch (err) {
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  }

  async execute(message, queue) {
    const args = message.content.split(/[ ]+/);
    const urlArg = args[1];
    const serverQueue = queue.get(message.guild.id);

    const isUrlPrefix = this.validUrlPrefixes.reduce((acc, val) => {
      return acc || urlArg.startsWith(val)
    }, false);
    const songId = isUrlPrefix ? ytdl.getURLVideoID(urlArg) : urlArg;
    const songInfo = await ytdl.getInfo(songId);
    const song = {
      title: songInfo.videoDetails.title,
      url: songInfo.videoDetails.video_url,
    };

    serverQueue.songs.push(song);
    if (!serverQueue.playing) {
      this.play(message, queue);
    }

    return message.channel.send(`${song.title} has been added to the queue!`);
  }

  play(message, queue) {
    const serverQueue = queue.get(message.guild.id);
    if (serverQueue.songs.length === 0) {
      serverQueue.playing = false;
      return
    }

    const song = serverQueue.songs[0];
    const dispatcher = serverQueue.connection
      .play(ytdl(song.url))
      .on("finish", () => {
        serverQueue.songs.shift();
        this.play(message, queue);
      })
      .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
    serverQueue.playing = true;
  }

  skip(message, queue) {
    const serverQueue = queue.get(message.guild.id);
    if (!message.member.voice.channel)
      return message.channel.send(
        "You have to be in a voice channel to stop the music!"
      );
    if (!serverQueue)
      return message.channel.send("There is no song that I could skip!");
    serverQueue.playing = false;
    serverQueue.connection.dispatcher.end();
  }

  stop(message, queue) {
    const serverQueue = queue.get(message.guild.id);
    if (!message.member.voice.channel)
      return message.channel.send(
        "You have to be in a voice channel to stop the music!"
      );

    if (!serverQueue)
      return message.channel.send("There is no song that I could stop!");

    serverQueue.songs = [];
    serverQueue.playing = false;
    serverQueue.connection.dispatcher.end();
  }

  leave(message, queue) {
    if (!message.member.voice.channel)
      return message.channel.send(
        "You have to be in a voice channel to stop the music!"
      );
    const serverQueue = queue.get(message.guild.id);
    serverQueue.voiceChannel.leave();
  }
}