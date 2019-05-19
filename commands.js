module.exports = {
  'exit': (t, loop, args, stream) => {
    const code = parseInt(args[0]) || 0
    stream.exit(code)
    stream.end()
  },
  'whoami': (t, loop) => {
    t('root\n')
    loop()
  }
}