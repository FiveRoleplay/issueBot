const Discord = require('discord.js');
const Octokit = require("@octokit/rest");
const config = require('./config.json');
const api = require("twitch-api-v5");
const CronJob = require("cron").CronJob;

api.clientID = "buemxzzsq0n2ttyfsyo080npaax118";

const client = new Discord.Client();
const octokit = new Octokit({
  auth: config.githubToken,
});

let streamsOnLive = [];

const searchStreams = () => {
  console.log('Lancement de la recherche de stream...');
  let offset = 0;
  let newStream = 0;
  let currentStream = 0;
  let streamEnd = 0;

  api.streams.live({ game: "Grand Theft Auto V", language: "fr", stream_type: "live", offset }, async (err, res) => {
    if(err) {
      console.log(err);
    } else {
      const firstCall = res;
      const maxOffset = Math.floor(firstCall._total / 25);
      const streams = firstCall.streams;

      if (maxOffset > 0) {
        offset++;
        while (offset < maxOffset) {
          const test = await new Promise((resolve) => {
              api.streams.live({ game: "Grand Theft Auto V", language: "fr", stream_type: "live", offset }, (err, res2) => {
              if (err) {
                console.log(err);
                resolve([]);
              }
              else {
                resolve(res2.streams);
              }
            })
          });
          streams.push(...test);
          offset++;
        }
      }

      const filterStreams = streams.filter(stream => stream.channel.status.toLowerCase().includes('ventura')).reduce((acc, item) => {
        if (!acc.some(elmt => elmt.channel.url === item.channel.url)) return [...acc, item];
        return acc;
      }, []);

      filterStreams.forEach(async stream => {
        currentStream++;
        if (!streamsOnLive.some(elmt => elmt.url === stream.channel.url)) {
          const channel = client.channels.find('name', 'test');
          const test = await channel.send(`Hey, y'a lui il stream ${stream.channel.url}`);
          streamsOnLive.push({ url: stream.channel.url, message: test });
          newStream++;
        }
      })

      streamsOnLive.forEach(elmt => {
        if (!filterStreams.some(stream => stream.channel.url === elmt.url)) {
          streamsOnLive.find(elmt2 => elmt2.url === elmt.url).message.delete();
          streamsOnLive = streamsOnLive.filter(elmt => elmt.url !== elmt.url);
          streamEnd++;
        }
      })

      console.log("Recherche terminée.");
      console.log(`${currentStream} streams en cours dont ${newStream} streams démarrés`);
      console.log(`${streamEnd} streams terminés`);
    }
  })
}

client.on('ready', () => {
  console.log('Connecté au Discord!');

  // new CronJob("*/2 * * * *", searchStreams).start();

  // setInterval(function () {
  //   const test = client.users.find('discriminator', '0439');
  //   test.send({ files: ['./blobfish2.jpg'] });
  // }, 1000);

  new CronJob("*/1 * * * *", () => {
    const seb = client.users.find("discriminator", "2792");
    console.log(seb);
    seb.sendMessage("T'as cru t'étais qui?");
  }).start();


  setInterval(function () {
    client.user.setPresence({
      game: {
        name: `${client.users.size} SuperFive'Fan`,
        type: "WATCHING",
      }
    });
  }, 10000);

  client.user.setStatus('available')
});

client.on('message', async msg => {
  if (msg.content.includes('!test')) {
    
  }
  else if (msg.content.includes('!issue')) {
    if (msg.channel.name.toLowerCase() !== config.issueChannelName.toLowerCase()) return;

    const args = msg.content.split('"');

    const title = `${args[1]}`;
    const body = args[3];

    octokit.issues.create({
      owner: config.usernameGithub,
      repo: config.repoGithub,
      title,
      body: `<h3>Ouvert par ${msg.author.username}</h3><br/>${body}`,
    }).then(() => {
      msg.reply('Une issue a bien été créé.');
    }).catch((err) => {
      msg.reply("C'est cassé, contact un dev (Genre Sumsun le BG) !");
      console.log('ERROR', err);
    })
  }
  // else if (msg.content.includes('!nico')) {
  //   const channel = client.channels.find('name', msg.channel.name);
  //   const nico = client.users.find('discriminator', '0001');
  //   channel.send(nico, { files: ['./blobfish2.jpg'] });
  // }
  else if (msg.content.includes('!dés')) {
    const args = msg.content.split(' ');
    const numberOfDice = parseInt(args[1]) || 1;

    if (numberOfDice > 195) {
      msg.reply("https://www.youtube.com/watch?v=fAlyj6Hcz3E");
      return;
    }

    const stringNumber = [
      ':one:',
      ':two:',
      ':three:',
      ':four:',
      ':five:',
      ':six:'
    ]

    const isDev = msg.member.roles.find(({ name }) => name.toLowerCase() === 'dev');

    if (numberOfDice && numberOfDice > 0) {
      let text = "Resultat: ";
      let total = 0;

      for (let i = 0; i < numberOfDice; i++) {
        const random = isDev ? 6 : Math.floor(Math.random() * 6) + 1;
        total += random;
        if (i !== numberOfDice - 1) {
          text += `${stringNumber[random - 1]} + `;
        }
        else if (i === numberOfDice - 1) {
          text += `${stringNumber[random - 1]}`;

          if (numberOfDice > 1) {
            text += ` = ${total}`;
          }
        }
      }

      msg.reply(text)
    }
  }
});

client.login(config.botDiscordToken);