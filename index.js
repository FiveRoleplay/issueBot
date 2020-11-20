const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const Discord = require('discord.js');
const { Octokit } = require("@octokit/rest");
const config = require('./config.json');
const api = require("twitch-api-v5");
const CronJob = require("cron").CronJob;
const jwt = require('jsonwebtoken');

app.set("Secret", config.secret);
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

api.clientID = "buemxzzsq0n2ttyfsyo080npaax118";

const ProtectedRoutes = express.Router();

app.use("/api", ProtectedRoutes);

ProtectedRoutes.use((req, res, next) => {
  // check header for the token
  var token = req.headers["access-token"];

  // decode token
  if (token) {
    // verifies secret and checks if the token is expired
    jwt.verify(token, app.get("Secret"), (err, decoded) => {
      if (err) {
        return res.json({message: "invalid token"});
      } else {

        if (decoded.name === config.wordpressName) {
          next();
        }
        else {
          res.send({
            message: "Access denied",
          })
        }
      }
    });
  } else {
    // if there is no token

    res.send({
      message: "No token provided.",
    });
  }
});

const client = new Discord.Client({
  fetchAllMembers: true,
});
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
      let lastStreamsCount = firstCall.streams.length;

      if (lastStreamsCount === 25) {
        offset++;
        while (lastStreamsCount === 25) {
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
          lastStreamsCount = test.length;
          streams.push(...test);
          offset++;
        }
      }

      let blacklist = JSON.parse(fs.readFileSync("blacklist.json"));

      const filterStreams = streams.filter(stream => stream.channel.status.toLowerCase().match(/\[five(-|\s)?rp\]/gm) && !blacklist.includes(stream.channel.url)).reduce((acc, item) => {
        if (!acc.some(elmt => elmt.channel.url === item.channel.url)) return [...acc, item];
        return acc;
      }, []);

      filterStreams.forEach(async stream => {
        currentStream++;
        if (!streamsOnLive.some(elmt => elmt.url === stream.channel.url)) {
          const channel = client.channels.cache.find((elmt) => elmt.name === 'streams');

          const embed = new Discord.MessageEmbed()
            .setColor("#FFD601")
            .setTitle(stream.channel.status)
            .setAuthor(stream.channel.display_name, stream.channel.logo, stream.channel.url)
            .setDescription(stream.channel.url)
            .setThumbnail("https://i.gyazo.com/334ed3ed08f0315d7eb8a08a3937a435.png")
            .setImage(stream.preview.large);

          const test = await channel.send(embed);
          streamsOnLive.push({ url: stream.channel.url, message: test });
          newStream++;
        }
        else {
          const currentData = streamsOnLive.find(elmt => elmt.url === stream.channel.url);

          if (currentData.message.embeds[0].title.trim() !== stream.channel.status.trim()) {
            const indexOf = streamsOnLive.indexOf(currentData);
            const newMessage = new Discord.MessageEmbed(currentData.message.embeds[0])
              .setTitle(stream.channel.status)
              .setImage(stream.preview.large);
  
            streamsOnLive[indexOf].message = await currentData.message.edit(newMessage);
          }
        }
      })

      streamsOnLive = streamsOnLive.filter(elmt => {
        if (!filterStreams.some(stream => stream.channel.url === elmt.url)) {
          elmt.message.delete();
          streamEnd++;
          return false;
        }
        return true;
      })

      console.log("Recherche terminée.");
      console.log(`${currentStream} streams en cours dont ${newStream} streams démarrés`);
      console.log(`${streamEnd} streams terminés`);
    }
  })
}

client.on('ready', async () => {
  console.log('Connecté au Discord!');

  const streamChannel = client.channels.cache.find((elmt) => elmt.name === "streams");

  // const lel = new Discord.MessageEmbed()
  //   .setColor("#FFD601")
  //   .setTitle("[FiveRP] Test [Alt:V]")
  //   .setAuthor('Sumsun', 'https://static-cdn.jtvnw.net/jtv_user_pictures/b443a53e-6870-4166-8b03-a9126a88ece0-profile_image-300x300.png', 'https://www.twitch.tv/sumsun93')
  //   .setDescription("https://www.twitch.tv/sumsun93")
  //   .setThumbnail("https://i.gyazo.com/334ed3ed08f0315d7eb8a08a3937a435.png")
  //   .setImage("https://static-cdn.jtvnw.net/previews-ttv/live_user_jltomy-640x360.jpg");

  // const test = await streamChannel.send(lel);

  // console.log(test.embeds[0]);

  // setTimeout(() => {
  //   test.edit(new Discord.MessageEmbed(test.embeds[0]).setTitle("New Title"));
  // }, 2000);

  if (streamChannel) {
    const streamMessages = await streamChannel.messages.fetch();
    if (streamMessages.size > 0) {
      streamChannel.bulkDelete(streamMessages.size, true);
    }
  
    // searchStreams();
    new CronJob("*/2 * * * *", searchStreams).start();
  }

  // new CronJob("*/1 * * * *", () => {
  //   const seb = client.users.find("discriminator", "2792");
  //   console.log(seb);
  //   seb.sendMessage("T'as cru t'étais qui?");
  // }).start();

  // FiveRP = 670702598285688833
  // TestRP = 670812620361564162
  let server = client.guilds.cache.find((guild) => guild.id === "670702598285688833");

  setInterval(() => {
    if (!server) {
      server = client.guilds.cache.find((guild) => guild.id === "670702598285688833");
    }
    else {
      client.user.setPresence({
        status: 'online',
        activity: {
          name: `${server.memberCount} SuperFive'Fan`,
          type: "WATCHING",
        }
      });
    }
  }, 1000);

  client.user.setStatus('available')
});

client.on('message', async msg => {
  if (msg.content[0] !== '!') {
    return;
  }

  const isStaff = msg.member.roles.cache.some(
    ({name}) =>
      name.toLowerCase() === "dev" ||
      name.toLowerCase() === "admin(no-mp)" ||
      name.toLowerCase() === "ux design" ||
      name.toLowerCase() === "modération" ||
      name.toLowerCase() === "communication" ||
      name.toLowerCase() === "helper"
  );

  if (!isStaff) {
    msg.reply('Tu ne disposes pas des droits nécessaires');
    return;
  }

  if (msg.content.includes('!banstream')) {
    const url = msg.content.split(' ')[1];
    if (!url) {
      msg.reply("stream invalide");
      return;
    }

    let blacklist = JSON.parse(fs.readFileSync("blacklist.json"));

    if (!blacklist.includes(url)) {
      blacklist.push(url);
      streamsOnLive = streamsOnLive.filter(stream => {
        if (stream.url !== url) {
          return true;
        }
        
        stream.message.delete();
        return false;
      });
      fs.writeFileSync("blacklist.json", JSON.stringify(blacklist));
    }

    msg.delete();
  }
  else if (msg.content.includes('!unbanstream')) {
    const url = msg.content.split(" ")[1];
    if (!url) {
      msg.reply("stream invalide");
      return;
    }

    let blacklist = JSON.parse(fs.readFileSync("blacklist.json"));

    if (blacklist.includes(url)) {
      blacklist = blacklist.filter((elmt) => elmt !== url);
      fs.writeFileSync("blacklist.json", JSON.stringify(blacklist));
    }

    msg.delete();
  }
  else if (msg.content.includes('!mochemk')) {
    const channel = client.channels.cache.find((test) => test.name === msg.channel.name);
    channel.send({ files: ['./boutonvert.png'] });
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
  else if (msg.content.includes('!seb?')) {
    const channel = client.channels.cache.find(elmt => elmt.name === msg.channel.name);
    channel.send({ files: ['./seb.mp4'] });
  }
  else if (msg.content.includes('!mmk?')) {
    const channel = client.channels.cache.find(elmt => elmt.name === msg.channel.name);
    channel.send({ files: ['./mmk.mp4'] });
  }
  else if (msg.content.includes('!dams?')) {
    const channel = client.channels.cache.find(elmt => elmt.name === msg.channel.name);
    channel.send({ files: ['./dams.ogg'] });
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

    const isDev = msg.member.roles.cache.some(({ name }) => name.toLowerCase() === 'dev');
    const isModo = msg.member.roles.cache.some(({ name }) => name.toLowerCase() === 'modération');

    if (numberOfDice && numberOfDice > 0) {
      let text = "Resultat: ";
      let total = 0;

      for (let i = 0; i < numberOfDice; i++) {
        let random = Math.floor(Math.random() * 6) + 1;

        if (isDev) random = 6;
        else if (isModo) random = 1;

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

app.post("/auth", (req, res) => {
  const { name } = req.body;

  const token = jwt.sign({
    name,
  }, app.get('Secret'));

  res.json({
    message: "Token created",
    token,
  });
})

ProtectedRoutes.post("/check", function (req, res) {
  const { username, client_id } = req.body;

  if (!username && !client_id) {
    res.send('Invalid params');
    return;
  }

  let name;
  let discriminator;

  if (username) {
    const splitUsername = username.split('#');

    if (splitUsername.length <= 1) {
      res.send({
        exist: false,
      });
      return;
    }
    discriminator = splitUsername.pop();
    name = '';
    splitUsername.forEach((elmt, index) => {
      if(index !== 0) {
        name += '#';
      }
      name += elmt
    })
  }
  
  const user = client.users.cache.find((user) => (client_id && user.id === client_id) || (username && user.username === name && user.discriminator === discriminator))

  const exist = user ? true : false;

  res.send({
    exist,
    id: (exist && user.id) ? user.id : null,
  });
});

ProtectedRoutes.post("/message", function (req, res) {
  const { client_id, state } = req.body;

  if (!client_id || !state) {
    res.send("Invalid params");
    return;
  }

  const user = client.users.cache.find(user => user.id === client_id);
  const server = client.guilds.cache.find((guild) => guild.id === "670702598285688833");
  const serverUser = server.members.cache.find(member => member.user.id === user.id);
  let addRole;
  let removeRole;
  let removeSecondRole;

  if (user) {
    let color;
    let message;
    let gif;

    switch(state) {
      case 'WHITELIST_GOOD': {
        addRole = server.roles.cache.find(role => role.name === "Whitelist");
        removeRole = server.roles.cache.find(role => role.name === "En attente d'entretien");
        color = "#00FF00";
        gif = "https://media.giphy.com/media/l1J9xV815LOOTUju0/giphy.gif";
        message = [
          `Salutation ${user.username},`,
          "",
          "Tu as passé la whitelist FiveRP avec succès ! Une fois le plugin vocal installé, tu pourras te connecter au serveur teamspeak puis au serveur de jeu.",
          "Pour te guider dans l'installation : https://wiki.five-rp.fr/installer-le-plugin-vocal",
          "",
          "Bon jeu à toi !",
          "L'équipe FiveRP",
        ];
        break;
      }
      // case 'WHITELIST_PROGRESS': {
      //   color = "#FFD601";
      //   gif = "https://media.giphy.com/media/Hovfs6SeMERMc/giphy.gif";
      //   message = [
      //     "**Whitelist FiveRP**",
      //     "",
      //     `Salutations ${user.username},`,
      //     "",
      //     "nous avons bien reçus ta candidature pour rejoindre la whitelist de FiveRP. Nous corrigeons en général sous 48h les QCM, inutile de t'inquiéter tu recevras un message privée lorsque la correction sera effectué.",
      //     "",
      //     "À bientôt !",
      //   ];
      //   break;
      // }
      case 'WHITELIST_BAD': {
        removeRole = server.roles.cache.find(role => role.name === "Whitelist");
        removeSecondRole = server.roles.cache.find(role => role.name === "En attente d'entretien");
        color = "#FF0000";
        gif = "https://media.giphy.com/media/y65VoOlimZaus/giphy.gif";
        message = [
          `${user.username},`,
          "",
          "Nous avons le regret de t'informer que tu n'as pas passé avec succès la whitelist FiveRP.",
          "Nous te souhaitons bonne continuation et bon jeu,",
          "",
          "L'équipe FiveRP.",
        ];
        break;
      }
      case 'WHITELIST_WAIT_VOCAL': {
        addRole = server.roles.cache.find(role => role.name === "En attente d'entretien");
        color = "#FFD601";
        gif = "https://media.giphy.com/media/9PnP3QnWhxI6lMiYWY/giphy.gif";
        message = [
          `Oyez ! Oyez !`,
          "",
          "Nous avons bien reçu ta demande de whitelist et tu sais quoi ?",
          "Tu as validé ton QCM ! Bravo !",
          "Prochaine étape ? L'entretien !",
          "",
          "Plus d'info sur la suite du processus de whitelist sur : https://five-rp.fr/whitelist/",
          "",
          "A très bientôt,",
          "L'équipe FiveRP",
        ];
        break;
      }
      case 'WHITELIST_SECOND': {
        removeRole = server.roles.cache.find(role => role.name === "Whitelist");
        removeSecondRole = server.roles.cache.find(role => role.name === "En attente d'entretien");
        color = "#FF0000";
        gif = "https://media.giphy.com/media/xUn3BWwJsCgIkLi8Ba/giphy.gif";
        message = [
          `Bonjour, bonsoir, ${user.username},`,
          "",
          "Tu n'as pas réussi à valider ta whitelist mais pas de panique ! Tu peux encore tenter ta chance en repassant ton QCM et ton entretien. La persévérance est une vertu !",
          "",
          "Bon courage,",
          "L'équipe FiveRP"
        ];
        break;
      }
    }

    if (!message) {
      res.send("Invalid state param");
      return;
    }

    if (addRole) {
      serverUser.roles.add(addRole);
    }

    if (removeRole) {
      serverUser.roles.remove(removeRole);
    }

    if (removeSecondRole) {
      serverUser.roles.remove(removeSecondRole);
    }

    if (message) {
      let embed = new Discord.MessageEmbed()
        .setColor(color)
        .setTitle("Whitelist FiveRP")
        .setThumbnail("https://i.gyazo.com/334ed3ed08f0315d7eb8a08a3937a435.png")
        .setDescription(message)
        .setTimestamp()
        .setFooter("L'équipe de FiveRP");
        // .addField("Inline field title", "Some value here", true);
      
      let embed2 = new Discord.MessageEmbed()
        .setColor(color)
        .setImage(gif);
  
      user.send(embed);
      user.send(embed2);
    }
  }

  res.send(user ? 'Message sended' : 'Message failed');
});

const staffLogImages = [
  "https://pngimg.com/uploads/policeman/_PNG15920.png",
  "https://lh3.googleusercontent.com/proxy/a16L9BFh23wcJgnglQYjWHAyz5o-8KAGv7URjp1cPdMsWKFLK2zHkklfYNLqrHkbd-zn0hEcGb-Ki7g-RrD8XHPP-VNpYLn9AlNf8QCTPNuAw96RdbPqgpEe9SgsrOwd7VCtfknNvQI",
  "https://pngimg.com/uploads/policeman/_PNG15918.png",
  "https://pngimg.com/uploads/policeman/_PNG15921.png",
  "https://www.sentinel.fr/wp-content/uploads/2018/11/07.png",
]; 
let lastStaffLogImages = 0;

const logImages = [
  "https://pngimage.net/wp-content/uploads/2018/06/secretary-png-3.png",
  "https://i.dlpng.com/static/png/6849903_preview.png",
  "https://i.dlpng.com/static/png/6594827_preview.png",
  "http://www.pngmart.com/files/7/Secretary-PNG-Transparent.png",
  "https://www.redfieldassoc.com/wp-content/uploads/2015/08/lawyer-assistant.png",
];
let lastLogImages = 0;

ProtectedRoutes.post("/stafflog", function (req, res) {
  const { text } = req.body;

  if (!text) {
    res.send("Bad params");
    return;
  }

  const channel = client.channels.cache.find((test) => test.name === 'api-log');
  
  const images = staffLogImages.filter((e, index) => index !== lastStaffLogImages);
  const imagesIndex = Math.floor(Math.random() * images.length);
  lastStaffLogImages = imagesIndex;

  let embed = new Discord.MessageEmbed()
    .setAuthor(
      "Log'Inator",
      "https://lh3.googleusercontent.com/proxy/lqrjDxXrUXMt4r4zYnhACU36u-lXfcY5nxzKxy-3jFp1AkDENYveHX0Ormvs3wK3ENiCE_An5fMp0EbWHImAJzoxBJwHkaHPKPpt4bBw0HmaZv7Fwdli7Yslb94"
    )
    .setThumbnail(images[imagesIndex])
    .setColor("#FFD601")
    .setDescription(text)
    .setTimestamp()
    .setFooter("Force et Honneur");

  channel.send(embed);

  res.send("Log message sended");
});

ProtectedRoutes.post("/log", function (req, res) {
  const {text} = req.body;

  if (!text) {
    res.send("Bad params");
    return;
  }

  const helperChannel = client.channels.cache.find((test) => test.name === "helper");
  const modoChannel = client.channels.cache.find((test) => test.name === "modération");

  const images = logImages.filter((e, index) => index !== lastLogImages);
  const imagesIndex = Math.floor(Math.random() * images.length);
  lastLogImages = imagesIndex;

  let embed = new Discord.MessageEmbed()
    .setAuthor(
      "Log'Woman",
      "https://dineconsulting.net/wp-content/uploads/2019/06/kisspng-computer-icons-businessperson-management-5af335f5aaaee6.6709792515258885016991.png"
    )
    .setThumbnail(images[imagesIndex])
    .setColor("#FFD601")
    .setDescription(text)
    .setTimestamp()
    .setFooter("#BalanceTonFondateur");

  helperChannel.send(embed);
  modoChannel.send(embed);

  res.send("Log message sended");
});

app.listen(80);