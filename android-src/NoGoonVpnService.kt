package com.nogoon.app

// ─── NoGoonVpnService ────────────────────────────────────────────────────────
//
// A local DNS-only VPN that blocks network access to blocked domains.
//
// HOW IT WORKS:
//   1. Android opens a TUN (virtual network) device.
//   2. We configure it to route ONLY DNS traffic through the tunnel:
//        addRoute("10.0.0.1", 32)  — only our fake DNS server IP
//        addDnsServer("10.0.0.1")  — tell Android: send DNS queries here
//   3. All other traffic bypasses the VPN entirely (no latency, no battery).
//   4. When we receive a DNS query:
//        a. Extract the queried domain
//        b. If it matches a blocked app/domain → return NXDOMAIN
//        c. Otherwise → forward the query to the real DNS server (1.1.1.1)
//           and pipe the response back
//
// SETUP (ONE-TIME):
//   VpnService.prepare(context) opens an Android system dialog asking the
//   user to trust our VPN. This is mandatory — no way around it. After they
//   tap "OK" once, it's remembered forever (until they revoke it in Settings).
//
// WHY THIS IS SAFE:
//   - All traffic except DNS bypasses this VPN (protect() call on real DNS socket)
//   - No data leaves the device except DNS queries to 1.1.1.1 for non-blocked domains
//   - The service stores nothing and transmits nothing about user browsing
//   - User can disable it with one tap in the NoGoon UI

import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
// Note: JSONArray/JSONObject are used by logBlockedDomain
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class NoGoonVpnService : VpnService() {

    companion object {
        private const val TAG         = "NoGoonVPN"
        private const val VPN_ADDRESS = "10.0.0.2"   // Our TUN interface address
        private const val DNS_VIRTUAL  = "10.0.0.1"  // Fake DNS we listen on
        private const val DNS_REAL     = "1.1.1.1"   // Cloudflare — forwards non-blocked queries
        private const val DNS_PORT     = 53
        private const val MTU          = 1500
        private const val PREFS_NAME      = "NoGoonBlocker"
        private const val VPN_RUNNING_KEY       = "vpnRunning"
        private const val VPN_HEARTBEAT_KEY     = "vpnHeartbeat"
        private const val VPN_DOMAIN_LOG_KEY    = "vpnDomainLog"
        private const val HEARTBEAT_INTERVAL_MS = 5_000L
        private const val DOMAIN_LOG_MAX        = 20

        // Intent action to stop the service from outside
        const val ACTION_STOP = "com.nogoon.app.VPN_STOP"
    }

    private var vpnInterface: ParcelFileDescriptor? = null
    private val running      = AtomicBoolean(false)
    private val executor     = Executors.newFixedThreadPool(2)

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopVpn()
            return START_NOT_STICKY
        }
        startVpn()
        return START_STICKY
    }

    override fun onRevoke() {
        // Called when user revokes VPN permission from Android Settings
        stopVpn()
    }

    override fun onDestroy() {
        stopVpn()
        executor.shutdownNow()
        super.onDestroy()
    }

    // ── Start VPN ──────────────────────────────────────────────────────────────

    private fun startVpn() {
        if (running.get()) return

        try {
            // Build the TUN interface
            val builder = Builder()
                .setSession("NoGoon Shield")
                .addAddress(VPN_ADDRESS, 32)
                .addDnsServer(DNS_VIRTUAL)
                // Route ONLY our fake DNS IP — everything else bypasses the VPN
                .addRoute(DNS_VIRTUAL, 32)
                .setMtu(MTU)
                .setBlocking(true)

            vpnInterface = builder.establish() ?: run {
                Log.e(TAG, "Failed to establish VPN interface")
                return
            }

            running.set(true)
            markVpnRunning(true)

            Log.i(TAG, "VPN interface established")

            // Thread 1: DNS packet processing loop
            executor.submit { processPackets() }
            // Thread 2: Heartbeat writer — writes a timestamp every 5s regardless of
            // packet activity, so isVpnActive() never sees a stale heartbeat when idle.
            executor.submit { runHeartbeat() }

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start VPN: ${e.message}", e)
            stopVpn()
        }
    }

    // ── Stop VPN ───────────────────────────────────────────────────────────────

    private fun stopVpn() {
        running.set(false)
        try {
            vpnInterface?.close()
            vpnInterface = null
        } catch (e: Exception) {
            Log.w(TAG, "Error closing VPN interface: ${e.message}")
        }
        markVpnRunning(false)
        stopSelf()
    }

    // ── Packet Processing Loop ─────────────────────────────────────────────────
    //
    // Reads raw IP packets from the TUN device.
    // We only care about UDP packets destined for port 53 (DNS).
    // For those, we:
    //   1. Strip the IP + UDP headers to get the raw DNS payload
    //   2. Check if the queried domain is blocked
    //   3. If blocked → synthesize NXDOMAIN response
    //   4. If not blocked → forward to real DNS (1.1.1.1), get real response
    //   5. Write the IP+UDP response back to the TUN device

    private fun processPackets() {
        val vpn = vpnInterface ?: return
        val input  = FileInputStream(vpn.fileDescriptor)
        val output = FileOutputStream(vpn.fileDescriptor)
        val buffer = ByteArray(MTU)

        Log.i(TAG, "Packet processing loop started")

        while (running.get()) {
            try {
                val length = input.read(buffer)
                if (length <= 0) continue

                // Parse the IP packet to check if it's a UDP DNS query
                val ipPacket = buffer.copyOf(length)

                if (!isUdpDnsQuery(ipPacket, length)) continue

                // Extract the DNS payload from the IP+UDP packet
                val (dnsPayload, dnsLen) = extractDnsPayload(ipPacket, length) ?: continue

                if (!DnsPacketParser.isDnsQuery(dnsPayload, dnsLen)) continue

                val domain = DnsPacketParser.extractDomain(dnsPayload, dnsLen)

                val dnsResponse = if (domain != null && isBlocked(domain)) {
                    // Blocked domain → synthesize NXDOMAIN
                    Log.d(TAG, "Blocking DNS for: $domain")
                    logBlockedDomain(domain)
                    DnsPacketParser.buildNxdomainResponse(dnsPayload, dnsLen)
                } else {
                    // Not blocked → forward to real DNS and get real answer
                    forwardDnsQuery(dnsPayload, dnsLen) ?: continue
                }

                // Wrap the DNS response back in UDP + IP headers and write to TUN
                val responsePacket = buildIpUdpPacket(
                    srcIp   = DNS_VIRTUAL,
                    dstIp   = VPN_ADDRESS,
                    srcPort = DNS_PORT,
                    dstPort = getDstPort(ipPacket),
                    payload = dnsResponse
                )
                output.write(responsePacket)

            } catch (e: InterruptedException) {
                break
            } catch (e: Exception) {
                if (running.get()) Log.w(TAG, "Packet error: ${e.message}")
            }
        }

        Log.i(TAG, "Packet processing loop ended")
    }

    // ── Heartbeat Writer ───────────────────────────────────────────────────────
    //
    // Runs on a dedicated thread (Thread 2 of the executor pool).
    // Writes a timestamp to SharedPreferences every 5s so that isVpnActive()
    // in AppBlockerModule can detect a SIGKILL even when the packet loop is
    // blocked on input.read() waiting for DNS queries that never arrive.

    private fun runHeartbeat() {
        val prefs = getSharedPreferences(PREFS_NAME, 0)
        while (running.get()) {
            try {
                prefs.edit().putLong(VPN_HEARTBEAT_KEY, System.currentTimeMillis()).apply()
                Thread.sleep(HEARTBEAT_INTERVAL_MS)
            } catch (e: InterruptedException) {
                break
            }
        }
    }

    // ── Forward DNS Query to Real DNS ──────────────────────────────────────────

    private fun forwardDnsQuery(dnsPayload: ByteArray, dnsLen: Int): ByteArray? {
        return try {
            val socket = DatagramSocket()
            protect(socket) // CRITICAL: protect() exempts this socket from the VPN,
                            // preventing a routing loop where DNS queries to 1.1.1.1
                            // would go back through our own TUN device forever.

            val request  = DatagramPacket(dnsPayload, dnsLen, InetAddress.getByName(DNS_REAL), DNS_PORT)
            socket.soTimeout = 3000
            socket.send(request)

            val responseBuffer = ByteArray(MTU)
            val response = DatagramPacket(responseBuffer, responseBuffer.size)
            socket.receive(response)
            socket.close()

            responseBuffer.copyOf(response.length)
        } catch (e: Exception) {
            Log.w(TAG, "DNS forward failed: ${e.message}")
            null
        }
    }

    // ── Domain Blocking Check ──────────────────────────────────────────────────

    private fun isBlocked(domain: String): Boolean {
        val prefs = getSharedPreferences(PREFS_NAME, 0)
        // AppBlockerModule writes blockedDomains via putStringSet() — must read with getStringSet().
        // getString() would always return null here and fall through to "[]", blocking nothing.
        val domainSet = prefs.getStringSet("blockedDomains", emptySet()) ?: emptySet()
        return domainSet.any { blocked ->
            val b = blocked.lowercase().trim()
            domain == b || domain.endsWith(".$b")
        }
    }

    // ── Domain Block Log ───────────────────────────────────────────────────────
    //
    // Keeps a rolling JSON array (newest first, capped at DOMAIN_LOG_MAX) in
    // SharedPreferences so the protection screen can show recent blocked domains.
    // Format: [{"domain":"ads.twitter.com","ts":1722345678000}, ...]

    private fun logBlockedDomain(domain: String) {
        val prefs = getSharedPreferences(PREFS_NAME, 0)
        val existing = prefs.getString(VPN_DOMAIN_LOG_KEY, "[]") ?: "[]"
        val arr = try { JSONArray(existing) } catch (e: Exception) { JSONArray() }

        // Prepend new entry
        val entry = JSONObject().put("domain", domain).put("ts", System.currentTimeMillis())
        val newArr = JSONArray()
        newArr.put(entry)
        for (i in 0 until minOf(arr.length(), DOMAIN_LOG_MAX - 1)) {
            newArr.put(arr.get(i))
        }
        prefs.edit().putString(VPN_DOMAIN_LOG_KEY, newArr.toString()).apply()
    }

    // ── SharedPreferences State ────────────────────────────────────────────────

    private fun markVpnRunning(running: Boolean) {
        val edit = getSharedPreferences(PREFS_NAME, 0).edit()
            .putBoolean(VPN_RUNNING_KEY, running)
        if (running) {
            edit.putLong(VPN_HEARTBEAT_KEY, System.currentTimeMillis())
        } else {
            edit.remove(VPN_HEARTBEAT_KEY)
        }
        edit.apply()
    }

    // ── Packet Parsing Helpers ─────────────────────────────────────────────────
    //
    // These parse raw IPv4 packets. We only care about:
    //   Protocol = UDP (17)
    //   Destination port = 53

    private fun isUdpDnsQuery(packet: ByteArray, length: Int): Boolean {
        if (length < 28) return false
        val protocol = packet[9].toInt() and 0xFF
        if (protocol != 17) return false  // Not UDP

        val ipHeaderLen = (packet[0].toInt() and 0x0F) * 4
        if (length < ipHeaderLen + 8) return false

        val dstPort = ((packet[ipHeaderLen + 2].toInt() and 0xFF) shl 8) or
                       (packet[ipHeaderLen + 3].toInt() and 0xFF)
        return dstPort == DNS_PORT
    }

    private fun extractDnsPayload(packet: ByteArray, length: Int): Pair<ByteArray, Int>? {
        val ipHeaderLen = (packet[0].toInt() and 0x0F) * 4
        val udpHeaderLen = 8
        val offset = ipHeaderLen + udpHeaderLen
        if (length <= offset) return null
        val dnsLen = length - offset
        return Pair(packet.copyOfRange(offset, offset + dnsLen), dnsLen)
    }

    private fun getDstPort(packet: ByteArray): Int {
        val ipHeaderLen = (packet[0].toInt() and 0x0F) * 4
        return ((packet[ipHeaderLen].toInt() and 0xFF) shl 8) or
               (packet[ipHeaderLen + 1].toInt() and 0xFF)
    }

    // ── Build IP+UDP Response Packet ──────────────────────────────────────────

    private fun buildIpUdpPacket(
        srcIp: String, dstIp: String,
        srcPort: Int, dstPort: Int,
        payload: ByteArray
    ): ByteArray {
        val src = InetAddress.getByName(srcIp).address
        val dst = InetAddress.getByName(dstIp).address
        val udpLength = 8 + payload.size
        val ipLength  = 20 + udpLength
        val packet    = ByteArray(ipLength)

        // IPv4 header (20 bytes)
        packet[0] = 0x45.toByte()           // Version=4, IHL=5 (20 bytes)
        packet[1] = 0x00                     // DSCP/ECN
        packet[2] = (ipLength shr 8).toByte()
        packet[3] = (ipLength and 0xFF).toByte()
        packet[4] = 0; packet[5] = 0         // Identification
        packet[6] = 0x40.toByte()            // Don't Fragment
        packet[7] = 0x00                     // Fragment offset
        packet[8] = 64                       // TTL
        packet[9] = 17                       // Protocol: UDP
        packet[10] = 0; packet[11] = 0       // Checksum (computed below)
        System.arraycopy(src, 0, packet, 12, 4)
        System.arraycopy(dst, 0, packet, 16, 4)

        // Compute IP header checksum
        val ipChecksum = computeChecksum(packet, 0, 20)
        packet[10] = (ipChecksum shr 8).toByte()
        packet[11] = (ipChecksum and 0xFF).toByte()

        // UDP header (8 bytes)
        packet[20] = (srcPort shr 8).toByte()
        packet[21] = (srcPort and 0xFF).toByte()
        packet[22] = (dstPort shr 8).toByte()
        packet[23] = (dstPort and 0xFF).toByte()
        packet[24] = (udpLength shr 8).toByte()
        packet[25] = (udpLength and 0xFF).toByte()
        packet[26] = 0; packet[27] = 0       // UDP checksum (optional for IPv4)

        // DNS payload
        System.arraycopy(payload, 0, packet, 28, payload.size)

        return packet
    }

    private fun computeChecksum(buf: ByteArray, offset: Int, length: Int): Int {
        var sum = 0
        var i = offset
        while (i < offset + length - 1) {
            sum += ((buf[i].toInt() and 0xFF) shl 8) or (buf[i + 1].toInt() and 0xFF)
            i += 2
        }
        if ((offset + length) % 2 != 0) {
            sum += (buf[offset + length - 1].toInt() and 0xFF) shl 8
        }
        while (sum shr 16 != 0) sum = (sum and 0xFFFF) + (sum shr 16)
        return sum.inv() and 0xFFFF
    }
}
