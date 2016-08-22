process.env.TZ = 'utc';

const path = require('path');
const spawn = require('child_process').spawn;
const firebase = require('firebase');

let botsRef = null;
let vmRef = null;
let CONFIG_VM_ID = null;

init();

function init() {
  console.log('vm dir', __dirname);
  console.log('initializing...');

  firebase.initializeApp({
    serviceAccount: path.join(__dirname, '../configs/meowth-config.json'),
    databaseURL: 'https://meowth-aed86.firebaseio.com'
  });

  firebase.database()
    .ref('vms')
    .orderByChild('status')
    .equalTo('starting')
    .limitToFirst(1)
    .once('value', snapshot => {
      if (snapshot) {
        const vms = Object.keys(snapshot.val());

        CONFIG_VM_ID = vms[0];

        return main();
      }

      console.error('vm_id not found');
      process.exit(1);
    });
}

function main() {
  console.log('creating refs');
  botsRef = firebase.database().ref('bots');
  vmRef = firebase.database().ref('vms').child(CONFIG_VM_ID);

  // listen for update on `/vms/<vm_id>/bots/`
  console.log('creating listeners');
  vmRef.child('bots').on('child_added', snapshot => handleBot(snapshot.key));
  vmRef.child('bots').on('child_changed', snapshot => handleBot(snapshot.key));

  // heartbeat every 5 seconds
  console.log('starting heartbeat');
  setInterval(heartbeat, 5000);
}

function heartbeat() {
  vmRef.once('value', snapshot => {
    vm = snapshot.val();

    if (vm && vm.status === 'shut_down') {
      console.log(`shuting down vm ${CONFIG_VM_ID}`);

      vmRef.update({
        status: 'offline',
        timestamp: (new Date).getTime()
      }, () => {
        process.exit(0);
      });

    } else {
      vmRef.update({
        status: 'online',
        timestamp: (new Date).getTime()
      });
    }
  });
}

function handleBot(key) {
  botsRef.child(key).once('value', snapshot => {
    const bot = snapshot.val();

    if (bot && bot.vm === CONFIG_VM_ID && bot.status === 'waiting_for_vm') {
      // update bot.status to 'starting_bot'
      botsRef.child(key).update({ status: 'starting_bot' });

      // start bot process
      console.log('starting bot proccess', key);

      const child = spawn('python', ['/botmon-bot/pokecli.py',
        '-cf', 'configs/config.json',
        '-bi', `"${key}"`
      ], {
        detached: true,
        stdio: 'ignore'
      });

      // detached bot process
      child.unref();
    }
  });
}
