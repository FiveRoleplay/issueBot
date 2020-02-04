const Discord = require('discord.js');
const Octokit = require("@octokit/rest");
const config = require('./config.json');

const client = new Discord.Client();
const octokit = new Octokit({
  auth: config.githubToken,
});

client.on('ready', () => {
  console.log('Connecté au Discord!');

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

client.on('message', msg => {
  if (msg.content.includes('!issue')) {
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
  else if (msg.content.includes('!nico')) {
    const channel = client.channels.find('name', msg.channel.name);
    const nico = client.users.find('discriminator', '6682');
    channel.send(nico, { files: ['./blobfish2.jpg'] });
  }
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