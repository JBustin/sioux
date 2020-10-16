const dotenv = require('dotenv')
const http = require('http')

const httpBackend = require('./http-backend')
const testRunner = require('./test-runner')

dotenv.config()

const nodePort = process.env.BACKEND_PORT
const debug = !!process.env.BACKEND_DEBUG
const dryRun = !!process.env.DRY_RUN

const app = (req, res) => {
  const { url, method, headers } = req
  if (debug) console.log('Backend incoming url', { url, method })
  httpBackend.queue({ url, method, headers })
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.write('<html><body><p>Success</p></body></html>')
  res.end()
}

const server = http.createServer(app).listen(nodePort)

server.on('error', err => {
  console.log(err)
  process.exit(1)
})

process.on('uncaughtException', err => {
  console.log(err)
  process.exit(1)
})

process.on('SIGINT', () => server.close(() => process.exit(0)))

if (dryRun) {
  console.log('DRY RUN mode, no unit test')
  return process.exit(0)
}

testRunner({ httpBackend }, err => {
  if (err && err.code != 'ERR_FALSY_VALUE_REJECTION') console.log('err', err)
  console.log(`\n\nTests ${err ? 'failed' : 'succeed'}\n`)
  server.close(() => process.exit(!!err))
})
