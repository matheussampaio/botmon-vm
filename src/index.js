const path = require('path');
const spawn = require('child_process').spawn;
const firebase = require('firebase');

// Load config
const config = require(path.join(__dirname, '../configs/config.json'));

const CONFIG_VM_ID = process.env.CONFIG_VM_ID || config.vm_id;

if (!CONFIG_VM_ID) {
  console.error('vm_id not found');
  process.exit(1);
}

console.log('vm dir', __dirname);

firebase.initializeApp({
  serviceAccount: path.join(__dirname, '../configs/meowth-config.json'),
  databaseURL: 'https://meowth-aed86.firebaseio.com'
});

const botsRef = firebase.database().ref('bots');
const vmRef = firebase.database().ref('vms').child(CONFIG_VM_ID);

// heartbeat every 5 seconds
const heartbeatInterval = setInterval(() => {
  vmRef.once('value', snapshot => {
    vm = snapshot.val();

    if (vm.status === 'shut_down') {
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

}, 5000);

// listen for update on `/vms/<vm_id>/bots/`
vmRef.child('bots').on('child_added', snapshot => handleBot(snapshot.key));
vmRef.child('bots').on('child_changed', snapshot => handleBot(snapshot.key));

function handleBot(key) {
  botsRef.child(key).once('value', snapshot => {
    const bot = snapshot.val();

    if (bot && bot.vm === CONFIG_VM_ID && bot.status === 'waiting_for_vm') {
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
