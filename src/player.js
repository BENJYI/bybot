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

    const serverQueue = queue.get(message.guild.id);

    if (!serverQueue) {
      const queueConstruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 5,
        playing: false
      }

      queue.set(message.guild.id, queueConstruct);

      try {
        var connection = await voiceChannel.join();
        queueConstruct.connection = connection;
        console.log(queueConstruct);
      } catch (err) {
        console.log(err);
        queue.delete(message.guild.id);
        return message.channel.send(err);
      }
    }
  }

  async play(message, queue) {
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
    serverQueue.playing = true;
    const dispatcher = serverQueue.connection
      .play(ytdl(song.url))
      .on("finish", () => {
        serverQueue.songs.shift();
        if (serverQueue.songs.length > 0)
          this.play(message, queue);
      })
      .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
    return message.channel.send(`${song.title} has been added to the queue!`);
  }

  skip(message, queue) {
    const serverQueue = queue.get(message.guild.id);
    if (!message.member.voice.channel)
      return message.channel.send(
        "You have to be in a voice channel to stop the music!"
      );
    if (!serverQueue)
      return message.channel.send("There is no song that I could skip!");
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
    serverQueue.connection.dispatcher.end();
  }
}