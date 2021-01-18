const ytdl = require("ytdl-core");

module.exports = class Player {
  constructor() {
    this.validUrlPrefixes = [
      "https://www.youtube.com",
      "http://www.youtube.com",
      "www.youtube.com",
      "youtube.com"
    ]
    this.queue = new Map();
  }

  async join(message) {
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
      return message.channel.send("You need to be in a voice channel to play music!")
    }

    const permissions = voiceChannel.permissionsFor(message.client.user);

    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
      return message.channel.send("I need the permissions to join and speak in your voice channel!");
    }

    let contract = this.queue.get(message.guild.id);

    if (!contract) {
      contract = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 5,
        playing: false
      }

      this.queue.set(message.guild.id, contract);
    }

    contract.voiceChannel = voiceChannel;
    contract.textChannel = message.channel;

    try {
      var connection = await voiceChannel.join();
      contract.connection = connection;
    } catch (err) {
      console.log(err);
      this.queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  }

  async execute(message) {
    const args = message.content.split(/[ ]+/);
    const urlArg = args[1];
    const contract = this.queue.get(message.guild.id);

    const isUrlPrefix = this.validUrlPrefixes.reduce((acc, val) => {
      return acc || urlArg.startsWith(val)
    }, false);
    const songId = isUrlPrefix ? ytdl.getURLVideoID(urlArg) : urlArg;
    const songInfo = await ytdl.getInfo(songId);
    const song = {
      title: songInfo.videoDetails.title,
      url: songInfo.videoDetails.video_url,
    };

    contract.songs.push(song);
    if (!contract.playing) {
      this.play(message);
    }

    return message.channel.send(`${song.title} has been added to the queue!`);
  }

  play(message) {
    const contract = this.queue.get(message.guild.id);
    if (contract.songs.length === 0) {
      contract.playing = false;
      return
    }

    const song = contract.songs[0];
    const dispatcher = contract.connection
      .play(ytdl(song.url))
      .on("finish", () => {
        contract.songs.shift();
        this.play(message);
      })
      .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(contract.volume / 5);
    contract.textChannel.send(`Start playing: **${song.title}**`);
    contract.playing = true;
  }

  skip(message) {
    const contract = this.queue.get(message.guild.id);
    if (contract) {
      contract.playing = false;
      contract.connection.dispatcher.end();
    }
  }

  stop(message) {
    const contract = this.queue.get(message.guild.id);
    if (contract) {
      contract.songs = [];
      contract.playing = false;
      contract.connection.dispatcher.end();
    }
  }

  showQueue(message) {
    const contract = this.queue.get(message.guild.id);
    const songs = contract.songs;

    if (songs.length === 0) {
      return message.channel.send(`There's nothing on this playlist!!`)
    }
    return message.channel.send(songs.map((song, index) =>
      `${index + 1}. ${song.title}`
    ));
  }

  leave(message) {
    const contract = this.queue.get(message.guild.id);
    contract.voiceChannel.leave();
  }
}