const fs = require('fs')
const crypto = require('crypto')
const termkit = require('terminal-kit')

const ssh2 = require('ssh2')
const commands = require('./commands')
const splitArgs = require('splitargs')
 
const allowedUser = Buffer.from('root')

function loop(t, stream) {
  t.bold.green('root@kognise-box').styleReset(':').bold.blue('~').styleReset('# ')
  t.inputField((error, input) => {
    t('\n')
    if (error) {
      console.log('!', error)
    }
    if (!input) return loop(t, stream)

    console.log(`> ${input}`)
    const argv = splitArgs(input.trim())
    if (argv[0] in commands) {
      try {
        commands[argv[0]](t, loop.bind(undefined, t, stream), argv.slice(1), stream)
      } catch(error) {
        console.log('!', error)
        t('\n')
      }
    } else {
      console.log('! Not found')
      t(`${argv[0]}: command not found\n`)
      loop(t, stream)
    }
  })
}
 
const noop = () => {}
const welcome = () => (`Welcome to Ubuntu 18.04.2 LTS (GNU/Linux 4.15.0-50-generic x86_64)

* Documentation:  https://help.ubuntu.com
* Management:     https://landscape.canonical.com
* Support:        https://ubuntu.com/advantage

 System information as of Fri May 17 14:31:19 UTC 2019

 System load:                    ${Math.random().toFixed(2)}
 Usage of /:                     7.0% of 97.93GB
 Memory usage:                   ${Math.floor(10 + Math.random() * 10)}%
 Swap usage:                     0%
 Processes:                      14${Math.floor(Math.random() * 8)}
 Users logged in:                0
 IP address for ens18:           172.83.154.151
 IP address for docker0:         172.17.0.1

* Ubuntu's Kubernetes 1.14 distributions can bypass Docker and use containerd
  directly, see https://bit.ly/ubuntu-containerd or try it now with

    snap install microk8s --classic

* Canonical Livepatch is available for installation.
  - Reduce system reboots and improve kernel security. Activate at:
    https://ubuntu.com/livepatch

4 packages can be updated.
0 updates are security updates.


Last login: Fri May 17 13:52:24 2019 from 72.89.32.68
`)

const server = new ssh2.Server({
  hostKeys: [ fs.readFileSync('server.key') ]
}, (client) => {
  console.log('* Connected')
  client._sshstream._authFailure = client._sshstream.authFailure;
  client._sshstream.authFailure = () => {
    client._sshstream._authFailure([ 'password', 'publickey' ]);
  }
 
  client.on('authentication', (ctx) => {
    if (ctx.method === 'password') console.log(`* Login attempt: ${ctx.username}:${ctx.password}`)
    const user = Buffer.from(ctx.username)
    if (user.length !== allowedUser.length
        || !crypto.timingSafeEqual(user, allowedUser)) {
      return ctx.reject()
    }
 
    if (ctx.method === 'password') {
      ctx.accept()
    } else {
      ctx.reject()
    }
  }).on('ready', () => {
    console.log('* Logged in')
 
    client.on('session', (accept, reject) => {
      const session = accept()
      
      let rows = 24
      let cols = 80
      let term = 'ansi'
      let stream

      session.once('pty', (accept, reject, info) => {
        rows = info.rows
        cols = info.cols
        term = info.term
        accept && accept()
      })

      session.on('window-change', (accept, reject, info) => {
        rows = info.rows
        cols = info.cols
        if (stream) {
          stream.rows = rows
          stream.columns = cols
          stream.emit('resize')
        }
        accept && accept()
      })

      session.once('shell', (accept) => {
        stream = accept()

        stream.rows = rows
        stream.columns = cols
        stream.isTTY = true
        stream.setRawMode = noop
        stream.on('error', noop)

        const t = termkit.createTerminal({
          stdin: stream.stdin,
          stdout: stream.stdout,
          stderr: stream.stderr,
          isTTY: stream.isTTY,
          isSSH: true,
          generic: term
        })
        t.options.crlf = true
        
        t(welcome())
        loop(t, stream)
      })
    })
  }).on('end', () => {
    console.log('* Disconnected')
  })
}).listen(10000, () => {
  console.log('- Listening on port ' + server.address().port)
})