const mysql = require('mysql2/promise')
const express = require('express')
const rateLimit  = require("express-rate-limit");

const app = express()
const Rtttl = require('./rtttl.js')
const port = process.env.PORT || 3000
app.use(express.json())

const limiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 minute
	limit: 60, // Limit each IP to X requests per 'window'
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	// store: ... , // Redis, Memcached, etc. See below.
})
// app.use(limiter) // Globally apply the rate limit

const fs = require("fs");

const log4js = require('log4js');
log4js.configure({
  appenders: {
    logfile: {
      type: 'file',
      filename: 'logs.log',
      maxLogSize: 1048576 
    },
    console: {
      type: 'console'
    } 
  },
  categories: {
    default: {
      appenders: ['logfile', 'console'],
      level: 'ALL' 
    }
  }
})
const logger = log4js.getLogger()

const dbPool = mysql.createPool({
  connectionLimit: process.env.DB_CON_LIMIT,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABSE
})

app.use('/',express.static(`${__dirname}/public`));

app.use('/rts',express.static(`${__dirname}/public`));

app.get('/rts', (req, res) => {
  res.sendFile(`${__dirname}/public/index.html`)
})

app.get('/rts/logs', (req, res) => {
  res.sendFile(`${__dirname}/logs.log`)
})

app.get('/rts/errors', (req, res) => {
  res.sendFile(`${__dirname}/stderr.log`)
})

app.post('/rts/midi', limiter, (req, res) => {
  try {
    let tone = req.body.rtttl;
    let rtttl = Rtttl.parseRtttl(tone)
    if (rtttl.HasParseError == true) {
      res.status(418).send({ error: rtttl.ParseErrorMessage })
      return
    }
    let midi = Rtttl.convertRtttlToMidi(rtttl, process.env.MIDI_PROGRAM)
    res.writeHead(200, {
      'Content-Type': 'audio/midi',
      'Content-disposition': `attachment;filename=${rtttl.Name}.mid`,
      'Content-Length': midi.length
    })
    res.end(Buffer.from(midi, 'binary'))  
  } catch(ex) {
    res.status(418).send({ error: ex.message })
  }
})

app.get('/rts/midi/:id', limiter, (req, res) => {
  getTones(req.params.id).then((result) => {
    try {
      if(result.length > 0) {
        let rtttl = Rtttl.parseRtttl(result[0].Rtttl)
        if (rtttl.HasParseError == true) {
          res.send({ error: rtttl.ParseErrorMessage })
          return
        }    
        let midi = Rtttl.convertRtttlToMidi(rtttl, process.env.MIDI_PROGRAM)
        res.writeHead(200, {
          'Content-Type': 'audio/midi',
          'Content-disposition': `attachment;filename=${rtttl.Name}.mid`,
          'Content-Length': midi.length
        })
        res.end(Buffer.from(midi, 'binary'))
      } else {
        res.send({ error: 'Ringtone not found'})
      }        
    } catch(ex) {
      res.status(418).send({ error: ex.message })
    }
  }).catch(function(err) {
    logger.error(`Query error: ${err.message}`)
    res.send({error: err.message})
  })
})

app.get('/rts/stats', (req, res) => {
  getStats().then((result) => {
    res.send(result)
  }).catch(function(err) {
    logger.error(`Query error: ${err.message}`)
    res.send({error: err.message})
  })
})

app.get('/rts/stats/:stat', (req, res) => {
  getStats(req.params.stat).then((result) => {
    if(result.length > 0) {
      res.send(result[0])
    } else {
      res.send({error: 'Stat not found'})
    }
  }).catch(function(err) {
    logger.error(`Query error: ${err.message}`)
    res.send({error: err.message})
  })
})

app.get('/rts/categories', (req, res) => {
  incrementHitCounter().then((result) => {

  }).catch(function(err) {
    logger.error(`Query error: ${err.message}`)
    res.send({error: err.message})
    return
  })
  
  getCategories().then((result) => {
    res.send(result)
  }).catch(function(err) {
    logger.error(`Query error: ${err.message}`)
    res.send({error: err.message})
  })
})

app.get('/rts/categories/:category', (req, res) => {
  getCategory(req.params.category).then((result) => {
    if(result.length > 0) {
      res.send(result[0])
    } else {
      res.send({ error: 'Category not found'})
    }
  }).catch(function(err) {
    logger.error(`Query error: ${err.message}`)
    res.send({error: err.message})
  })
})

app.get('/rts/browse/:category', (req, res) => {
  getTonesByCategory(req.params.category).then((result) => {
    res.send(result)
  }).catch(function(err) {
    logger.error(`Query error: ${err.message}`)
    res.send({error: err.message})
  })
})

app.get('/rts/search/:term', (req, res) => {
  searchTones(req.params.term).then((result) => {
    res.send(result)
  }).catch(function(err) {
    logger.error(`Query error: ${err.message}`)
    res.send({error: err.message})
  })
})

app.get('/rts/tones', (req, res) => {
  getTones().then((result) => {
    res.send(result)
  }).catch(function(err) {
    logger.error(`Query error: ${err.message}`)
    res.send({error: err.message})
  })
})

app.get('/rts/tonecount', (req, res) => {
  getToneCount().then((result) => {
    if(result.length > 0) {
      res.send(result[0])
    } else {
      res.send({ error: 'Unable to get tone count'})
    }
  }).catch(function(err) {
    logger.error(`Query error: ${err.message}`)
    res.send({error: err.message})
  })
})

app.get('/rts/tones/:id', (req, res) => {
  getTones(req.params.id).then((result) => {
    if(result.length > 0) {
      incrementToneCounter(req.params.id).then((result) => {

      }).catch(function(err) {
        logger.error(`Query error: ${err.message}`)
        res.send({error: err.message})
        return
      })
      res.send(result[0])
    } else {
      res.send({ error: 'Ringtone not found'})
    }
  }).catch(function(err) {
    logger.error(`Query error: ${err.message}`)
    res.send({error: err.message})
  })

})

async function getTones(id) {
  let conn
  try {
    conn = await dbPool.getConnection()
    let sql = ''
    let params = []
    if (id != null && id != '') {
      sql = 'SELECT * FROM Tone WHERE ToneId = ?'
      params = [id]
    } else {
      sql = 'SELECT * FROM Tone ORDER BY Counter DESC LIMIT 20'
    }
    let [rows, fields] = await conn.query(sql, params)
    return rows
  } catch (err) {
    logger.error(`Query error: ${err.message}`)
    throw err
  } finally {
    dbPool.releaseConnection(conn)
  }
}

async function getStats(stat) {
  let conn
  try {
    conn = await dbPool.getConnection()
    let sql = ''
    let params = []
    if (stat != null && stat != '') {
      sql = 'SELECT * FROM Stats WHERE UPPER(StatName) = UPPER(?)'
      params = [stat]
    } else {
      sql = 'SELECT * FROM Stats'
    }
    let [rows, fields] = await conn.query(sql, params)
    return rows
  } catch (err) {
    logger.error(`Query error: ${err.message}`)
    throw err
  } finally {
    dbPool.releaseConnection(conn)
  }
}

async function getCategories() {
  let conn
  try {
    conn = await dbPool.getConnection()
    let sql = 'SELECT * FROM Category ORDER BY SortId ASC'
    let params = []
    let [rows, fields] = await conn.query(sql, params)
    return rows
  } catch (err) {
    logger.error(`Query error: ${err.message}`)
    throw err
  } finally {
    dbPool.releaseConnection(conn)
  }
}

async function incrementHitCounter() {
  let conn
  try {
    conn = await dbPool.getConnection()
    let sql = `UPDATE Stats SET StatValue = StatValue + 1 WHERE UPPER(StatName) = 'PAGEVIEWS'`
    let params = []
    let [rows, fields] = await conn.query(sql, params)
    return { result: 'Success' }
  } catch (err) {
    logger.error(`Query error: ${err.message}`)
    throw err
  } finally {
    dbPool.releaseConnection(conn)
  }
}

async function incrementToneCounter(id) {
  let conn
  try {
    conn = await dbPool.getConnection()
    let sql = `UPDATE Tone SET Counter = Counter + 1 WHERE ToneId = ?`
    let params = [id]
    let [rows, fields] = await conn.query(sql, params)
    return { result: 'Success' }
  } catch (err) {
    logger.error(`Query error: ${err.message}`)
    throw err
  } finally {
    dbPool.releaseConnection(conn)
  }
}

async function getCategory(category) {
  if (category == null || category == '') {
    return []
  }
  let conn
  try {
    conn = await dbPool.getConnection()
    let sql = 'SELECT * FROM Category WHERE UPPER(CategoryCode) = UPPER(?)'
    let params = [ category ]
    let [rows, fields] = await conn.query(sql, params)
    return rows
  } catch (err) {
    logger.error(`Query error: ${err.message}`)
    throw err
  } finally {
    dbPool.releaseConnection(conn)
  }
}

async function getToneCount() {
  let conn
  try {
    conn = await dbPool.getConnection()
    let sql = 'SELECT COUNT(*) AS ToneCount FROM Tone'
    let params = [ ]
    let [rows, fields] = await conn.query(sql, params)
    return rows
  } catch (err) {
    logger.error(`Query error: ${err.message}`)
    throw err
  } finally {
    dbPool.releaseConnection(conn)
  }
}

async function getTonesByCategory(category) {
  if (category == null || category == '') {
    return [];
  }
  let conn
  try {
    let sql = 'SELECT * FROM Tone WHERE UPPER(Category) LIKE UPPER(?) ORDER BY Artist, Title'
    let params = [ `%-${category}-%` ]
    conn = await dbPool.getConnection()
    let [rows, fields] = await conn.query(sql, params)
    return rows
  } catch (err) {
    logger.error(`Query error: ${err.message}`)
    throw err
  } finally {
    dbPool.releaseConnection(conn)
  }
}

async function searchTones(term) {
  if (term == null || term.length < 3) {
    return []
  }
  let conn
  try {
    conn = await dbPool.getConnection()
    let sql = `
      SELECT * FROM Tone
      WHERE
        UPPER(Artist) LIKE UPPER(?)
        OR UPPER(Title) LIKE UPPER(?)
    `
    let params = [ `%${term}%`, `%${term}%` ]
    let [rows, fields] = await conn.query(sql, params)
    return rows
  } catch (err) {
    logger.error(`Query error: ${err.message}`)
    throw err
  } finally {
    dbPool.releaseConnection(conn)
  }
}

app.listen(port, () => {
  logger.debug(`App listening on port ${port}`)
})