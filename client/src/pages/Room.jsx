import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Users, Copy, Settings } from 'lucide-react'
import { io } from 'socket.io-client'
import VideoPlayer from '../components/VideoPlayer'
import VoiceChat from '../components/VoiceChat'
import RoomControls from '../components/RoomControls'

const Room = () => {
  const { roomId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { username, isHost } = location.state || {}
  
  const [users, setUsers] = useState([])
  const [roomState, setRoomState] = useState({
    videoUrl: '',
    isPlaying: false,
    currentTime: 0,
    host: null
  })
  const [showVoiceChat, setShowVoiceChat] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  
  const socketRef = useRef(null)

  useEffect(() => {
    if (!username) {
      navigate('/')
      return
    }

    // Initialize Socket.IO connection
    console.log('Connecting to server...')
    socketRef.current = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001')
    
    const socket = socketRef.current

    // Connection status handlers
    socket.on('connect', () => {
      console.log('Connected to server:', socket.id)
      setConnectionStatus('connected')
      
      // Join the room
      socket.emit('join-room', { 
        roomId: roomId.toUpperCase(), 
        username, 
        isHost 
      })
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from server')
      setConnectionStatus('disconnected')
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      setConnectionStatus('error')
    })

    // Room event handlers
    socket.on('room-state', (state) => {
      console.log('Received room state:', state)
      setUsers(state.users || [])
      setRoomState({
        videoUrl: state.videoUrl || '',
        isPlaying: state.isPlaying || false,
        currentTime: state.currentTime || 0,
        host: state.host
      })
    })

    socket.on('room-members', (members) => {
      console.log('Received room members:', members)
      setUsers(members)
    })

    socket.on('user-joined', ({ userId, username: joinedUsername, isHost: joinedIsHost }) => {
      console.log(`${joinedUsername} joined the room`)
      setUsers(prev => {
        // Check if user already exists
        const existingUser = prev.find(u => u.id === userId)
        if (existingUser) return prev
        
        return [...prev, {
          id: userId,
          username: joinedUsername,
          isHost: joinedIsHost,
          joinedAt: new Date()
        }]
      })
    })

    socket.on('user-left', ({ userId, username: leftUsername }) => {
      console.log(`${leftUsername} left the room`)
      setUsers(prev => prev.filter(user => user.id !== userId))
    })

    socket.on('host-changed', ({ newHostId, isHost: newIsHost }) => {
      console.log('Host changed:', newHostId)
      if (socket.id === newHostId) {
        // Update local state if we're the new host
        setRoomState(prev => ({ ...prev, host: newHostId }))
      }
    })

    // Video sync handlers
    socket.on('video-play', () => {
      console.log('Received video play event')
      setRoomState(prev => ({ ...prev, isPlaying: true }))
    })

    socket.on('video-pause', () => {
      console.log('Received video pause event')
      setRoomState(prev => ({ ...prev, isPlaying: false }))
    })

    socket.on('video-seek', (time) => {
      console.log('Received video seek event:', time)
      setRoomState(prev => ({ ...prev, currentTime: time }))
    })

    socket.on('video-url-change', (url) => {
      console.log('Received video URL change:', url)
      setRoomState(prev => ({ ...prev, videoUrl: url }))
    })

    socket.on('sync-time', (time) => {
      console.log('Received sync time:', time)
      setRoomState(prev => ({ ...prev, currentTime: time }))
    })

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up socket connection')
      if (socket) {
        socket.disconnect()
      }
    }
  }, [username, roomId, isHost, navigate])

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      // You could add a toast notification here
      console.log('Room code copied to clipboard')
    } catch (err) {
      console.error('Failed to copy room code:', err)
    }
  }

  const goBack = () => {
    navigate('/')
  }

  // Debug function to request room members
  const refreshRoomMembers = () => {
    if (socketRef.current) {
      socketRef.current.emit('get-room-members', { roomId: roomId.toUpperCase() })
    }
  }

  if (!username) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-effect border-b border-white/10 p-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={goBack}
              className="control-button"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            
            <div>
              <h1 className="text-xl font-bold text-white">Room {roomId}</h1>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-400">Welcome, {username}</p>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-400' :
                  connectionStatus === 'connecting' ? 'bg-yellow-400' :
                  'bg-red-400'
                }`}></div>
                <span className="text-xs text-gray-500">{connectionStatus}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Room Code */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={copyRoomCode}
              className="control-button"
              title="Copy room code"
            >
              <Copy className="w-4 h-4" />
            </motion.button>

            {/* Users Count */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={refreshRoomMembers}
              className="control-button"
              title="Room members (click to refresh)"
            >
              <Users className="w-4 h-4" />
              <span className="ml-1 text-sm">{users.length}</span>
            </motion.button>

            {/* Settings */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSettings(!showSettings)}
              className="control-button"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Video Player */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3"
          >
            <VideoPlayer 
              roomId={roomId}
              username={username}
              isHost={isHost}
              socket={socketRef.current}
              roomState={roomState}
            />
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            {/* Voice Chat */}
            <VoiceChat 
              roomId={roomId}
              username={username}
              isOpen={showVoiceChat}
              onToggle={() => setShowVoiceChat(!showVoiceChat)}
            />

            {/* Room Controls */}
            <RoomControls 
              roomId={roomId}
              username={username}
              isHost={isHost}
            />

            {/* Users List */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="room-card"
            >
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Room Members ({users.length})
              </h3>
              
              <div className="space-y-2">
                {users.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-sm text-white">{user.username}</span>
                    </div>
                    {user.isHost && (
                      <span className="text-xs bg-primary px-2 py-1 rounded-full text-white">
                        Host
                      </span>
                    )}
                  </motion.div>
                ))}
                
                {/* Show message if no other users */}
                {users.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-400">You're alone in this room</p>
                    <p className="text-xs text-gray-500 mt-1">Share the room code to invite friends</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default Room