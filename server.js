const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const crypto = require('crypto')
require('dotenv').config()

app.use(bodyParser.urlencoded({ extended: false }))
app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});
// connect to database
const uri = process.env.MONGO_URI;
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 5000 })
// catch failed connection
const connection = mongoose.connection;
connection.on('error', console.error.bind(console, 'connection error:'));
connection.once('open', () => {
  console.log('MongoDB database connection established successfully')
});
// models
const Schema = mongoose.Schema;
const exerciseSchema = new Schema({
  description: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  date: String,
  _id: false
});
const userSchema = new Schema({
  username: { type: String, required: true },
  log: [exerciseSchema],
})
const EXERCISE = mongoose.model('exercise', exerciseSchema)
const USER = mongoose.model('user', userSchema);

// post new user
app.post('/api/users', async function(req, res) {
  const uname = req.body.username
  try {
    // check if user exist in the database
    let findUser = await USER.findOne({
      'username': uname
    });
    if (findUser) {
      res.json({
        username: findUser.username,
        _id: findUser._id
      })
    } else {
      findUser = new USER({
        username: uname,
      });
      await findUser.save();
      res.json({
        username: findUser.username,
        _id: findUser._id
      })
    }
  } catch (err) {
    console.error(err);
    res.status(500).json('Server error...')
  }
})
app.get('/api/users', (req, res) => {
  USER.find().select('username _id').exec((err, data) => {
    if (err) console.error(err);
    res.json(data)
  })
})

// post exercise
app.post('/api/users/:_id/exercises', async function(req, res) {
  const id = req.params._id
  const date = req.body.date
  if (!date || new Date(date).toString() == 'Invalid Date') {
    //console.log('error handling date')
    let d = new Date()
    req.body.date = d.toDateString()
  } else {
    let d = new Date(date)
    req.body.date = d.toDateString()
  }
  try {
    const findUser = await USER.findById(id)
    if (findUser) {

      const exercise = new EXERCISE({
        description: req.body.description,
        duration: parseInt(req.body.duration),
        date: req.body.date
      })
      findUser.log.push(exercise)
      
      await findUser.save();
      res.json({
        username: findUser.username,
        ...exercise.toJSON(),
        _id: id
      });
    } else {
      res.json('No such user in the database')
    }
  } catch (error) {
    console.error(error)
    res.status(500).json('Server error...')
  }
});

// get log
app.get('/api/users/:_id/logs', async function(req, res) {
  // console.log('params', req.params);
  // console.log('query', req.query)
  const id = req.params._id;
  // process input, change date with .getTime
  let fromDate = req.query.from;
  let toDate = req.query.to;
  let limit = req.query.limit;

  try {
    // check for valid input _id
    const validId = new RegExp(/^[0-9a-fA-F]{24}$/)
    if (!id || !id.match(validId)) {
      console.log('invalid id')
      throw 'Invalid ID'
    }

    let findUser = await USER.findById(id);
    if (!findUser) {
      res.json('No such user on the database');
      throw 'No such user on the database'
    }
    console.log('users', findUser)
    const responseObj = {_id: id, username: findUser.username}
    let logs = findUser.log;

    if (fromDate) {
        fromDate = new Date(fromDate);
        responseObj.from = fromDate.toDateString()
        logs = logs.filter(item => {
        const itemDate = new Date(item.date);
        if (itemDate > fromDate) return true;
        else { return false }
      })
    }
    if (toDate) {
      toDate = new Date(toDate);
      responseObj.to = toDate.toDateString()
      logs = logs.filter(item => {
        const itemDate = new Date(item.date);
        if (itemDate < toDate) return true;
        else { return false }
      })
    }
    if (limit) {
      if (logs.length > limit) logs.length = parseInt(limit);
    }
    responseObj.count = logs.length,
    responseObj.log = logs
    return res.json(responseObj)
  } catch (error) {
    console.error(error)
    res.status(500).json('Server error...')
  }
})



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
