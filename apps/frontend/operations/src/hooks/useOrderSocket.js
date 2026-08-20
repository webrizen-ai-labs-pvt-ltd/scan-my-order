import { useEffect, useRef, useState, useCallback } from "react"
import { io } from "socket.io-client"

const SOCKET_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "")

// Web Audio API Chime Synthesizer for incoming orders
function playOrderChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    const playTone = (freq, duration, delay) => {
      setTimeout(() => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.value = freq

        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + duration)
      }, delay)
    }

    // Play double chime: C5 (523Hz) -> E5 (659Hz)
    playTone(523.25, 0.25, 0)
    playTone(659.25, 0.35, 200)
  } catch (err) {
    console.warn("Audio chime playback error:", err)
  }
}

export function useOrderSocket(storeId, options = {}) {
  const { onOrderCreated, onOrderUpdated, onTableServiceRequested } = options
  const [isConnected, setIsConnected] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [lastNotification, setLastNotification] = useState(null)
  const socketRef = useRef(null)

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev)
  }, [])

  useEffect(() => {
    if (!storeId) return

    console.log(`🔌 Connecting to Real-Time Order Socket at ${SOCKET_URL} for store ${storeId}...`)
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    socket.on("connect", () => {
      console.log(`✅ Connected to Order Socket: ${socket.id}`)
      setIsConnected(true)
      socket.emit("join_store", storeId)
    })

    socket.on("disconnect", (reason) => {
      console.warn(`🔌 Disconnected from Order Socket: ${reason}`)
      setIsConnected(false)
    })

    socket.on("order_created", (data) => {
      console.log("⚡ [SOCKET EVENT] order_created:", data)
      setLastNotification({
        type: "ORDER_CREATED",
        title: `New Order #${data?.order?.orderNumber}`,
        desc: `Table ${data?.order?.tableNumber} placed a ${data?.order?.paymentType} order!`,
        timestamp: new Date(),
      })

      if (soundEnabled) {
        playOrderChime()
      }

      if (typeof onOrderCreated === "function") {
        onOrderCreated(data.order)
      }
    })

    socket.on("order_updated", (data) => {
      console.log("⚡ [SOCKET EVENT] order_updated:", data)
      if (typeof onOrderUpdated === "function") {
        onOrderUpdated(data.order)
      }
    })

    socket.on("table_service_requested", (data) => {
      console.log("⚡ [SOCKET EVENT] table_service_requested:", data)
      setLastNotification({
        type: "TABLE_SERVICE_REQUESTED",
        title: `Table ${data?.tableNumber} Alert`,
        desc: `Requested: ${data?.serviceType || "Assistance"}`,
        timestamp: new Date(),
      })

      if (soundEnabled) {
        playOrderChime()
      }

      if (typeof onTableServiceRequested === "function") {
        onTableServiceRequested(data)
      }
    })

    return () => {
      if (socket) {
        socket.emit("leave_store", storeId)
        socket.disconnect()
      }
    }
  }, [storeId, soundEnabled, onOrderCreated, onOrderUpdated, onTableServiceRequested])

  return {
    isConnected,
    soundEnabled,
    toggleSound,
    lastNotification,
  }
}
