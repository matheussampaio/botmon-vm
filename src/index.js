const spawn = require('child_process').spawn;
const firebase = require('firebase');

// Load config
const config = require('../configs/config.json');

if (!config.vm_id) {
  console.error('vm_id not found');
  process.exit(1);
}

firebase.initializeApp({
  serviceAccount: './configs/meowth-config.json',
  databaseURL: 'https://meowth-aed86.firebaseio.com'
});

const botsRef = firebase.database().ref('bots');
const vmRef = firebase.database().ref('vms').child(config.vm_id);

// heartbeat every 5 seconds
const heartbeatInterval = setInterval(() => {
  vmRef.update({
    status: 'online',
    timestamp: (new Date).getTime()
  });
}, 5000);

// listen for update on `/vms/<vm_id>/bots/`
vmRef.child('bots').on('child_added', snapshot => handleBot(snapshot.key));
vmRef.child('bots').on('child_changed', snapshot => handleBot(snapshot.key));

function handleBot(key) {
  botsRef.child(key).once('value', snapshot => {
    const bot = snapshot.val();

    console.log(key, bot);

    if (bot.vm === config.vm_id && bot.status === 'waiting_for_vm') {
      // update bot.status to 'starting_bot'
      botsRef.child(key).update({ status: 'starting_bot' });

      // start bot process
      const child = spawn('python', ['../bot/main.py', key], {
        detached: true,
        stdio: 'ignore'
      });

      // detached bot process
      child.unref();
    }
  });
}
