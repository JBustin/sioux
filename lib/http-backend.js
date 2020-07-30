const EventEmitter = require('events')

class HttpBackend extends EventEmitter {
  constructor() {
    super()
    this.stack = []
  }
  queue(data) {
    this.stack.push(data)
    this.emit('incoming', data)
  }
  unqueue() {
    return this.stack.pop()
  }
  flush() {
    this.stack = []
  }
  count() {
    return this.stack.size()
  }
  calls() {
    return this.stack
  }
  noExpectations() {
    return this.stack.length === 0
  }
}

module.exports = new HttpBackend()
