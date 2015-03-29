import Message from './message'

class Progress extends Message {
  constructor(id, progress) {
    super('progress')
    this.id = id
    this.progress = progress
  }
}

export default Progress
