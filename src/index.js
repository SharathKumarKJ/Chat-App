const path = require('path')
const http = require('http')
const express = require('express')
const Filter = require('bad-words')
const router = express.Router()
const publicDirectoryPath = path.join(__dirname, '../public')
const socketio = require('socket.io')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)
const portNumber = 8081;
app.use(express.json())


// Setup static directory to serve
app.use(express.static(publicDirectoryPath))

router.get('', async (req, res) => {
    try {
        res.send('Home')
    } catch (e) {
        res.send('' + e)
    }
})

app.use(router)

io.on('connection', (socket) => {
    console.log('New Web Socket Connection')

    socket.on('join', ({ username, room }, callback) => {
        const { error, user } = addUser({ id: socket.id, username, room })
        if (error) {

            return callback(error)
        }
        socket.join(user.room)
        socket.emit('message', generateMessage('Admin', 'Welcome!'))
        socket.broadcast.to(user.room).emit('message', generateMessage(`${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        filter = new Filter();
        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed')
        }

        const user = getUser(socket.id)
        if (user) {
            io.to(user.room).emit('message', generateMessage(user.username, message))
        }
        callback()
    })

    socket.on('sendLocation', (location, callback) => {
        const user = getUser(socket.id)
        io.emit('locationMessage', generateLocationMessage(user.username, `https://www.google.com/maps?q=${location.latitude},${location.longitude}`))
        callback('Location shared!')
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)
        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }

    })
})

server.listen(portNumber, () => {
    console.log('Server up and running ', portNumber);
})

