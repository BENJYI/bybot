const ytdl = require("ytdl-core");
const { YTSearcher } = require('ytsearcher');
const { ytapikey } = require('./configuration/config.json');
const searcher = new YTSearcher(ytapikey);

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
    const voiceChannel = message.member.voiceChannel;
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
    return contract;
  }

  async execute(message) {
    const args = message.content.split(/[ ]+/);
    const option = args[1];
    let contract = this.queue.get(message.guild.id);
    let url = "";

    if (!contract) {
      contract = await this.join(message);
    }

    if (contract.connection.dispatcher) {
      this.resume(message);
    }

    if (!option || option.trim().length === 0) {
      return;
    }

    const isUrlPrefix = this.validUrlPrefixes.reduce((acc, val) => {
      return acc || option.startsWith(val)
    }, false);

    if (isUrlPrefix) {
      url = option;
    } else {
      const searchQuery = args.slice(1).join(' ');
      const searchParams = {
        type: 'video',
        maxResults: 1
      }
      url = await searcher.search(searchQuery, searchParams)
        .then(res => res.first.url);
    }

    const songId = ytdl.getURLVideoID(url);
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
      .playStream(ytdl(song.url, { quality: "highestaudio" }))
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
      return message.channel.send(`Skipped!!`);
    }
  }

  pause(message) {
    const contract = this.queue.get(message.guild.id);
    if (contract && contract.playing) {
      contract.playing = false;
      contract.connection.dispatcher.pause();
    }
  }

  resume(message) {
    const contract = this.queue.get(message.guild.id);
    if (contract && !contract.playing) {
      contract.playing = true;
      contract.connection.dispatcher.resume();
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

  remove(message) {
    const args = message.content.split(/[ ]+/);
    const indexArg = args[1];
    if (isNaN(indexArg)) {
      return;
    }
    const index = parseInt(indexArg) - 1;
    const contract = this.queue.get(message.guild.id);
    if (index < 0 || index >= contract.songs.length) {
      return;
    }
    if (index === 0) {
      this.skip(message);
      return;
    }
    const deletedSong = contract.songs.splice(index, 1)[0];
    return message.channel.send(`${indexArg}. ${deletedSong.title} has been removed!`);
  }

  leave(message) {
    const contract = this.queue.get(message.guild.id);
    contract.voiceChannel.leave();
  }
}