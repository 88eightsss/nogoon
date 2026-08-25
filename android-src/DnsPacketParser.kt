package com.nogoon.app

// ─── DnsPacketParser ─────────────────────────────────────────────────────────
//
// Parses raw DNS UDP packets and constructs NXDOMAIN response packets.
//
// WHY DNS-ONLY:
//   The VPN TUN device intercepts ALL traffic by default. We restrict it to
//   only route DNS (10.0.0.1:53) through the TUN. All other traffic bypasses
//   the VPN entirely — so there's no latency penalty, no privacy concern,
//   and no battery cost beyond the DNS queries themselves.
//
// DNS PACKET FORMAT (RFC 1035):
//   Header (12 bytes):
//     [0-1]  Transaction ID
//     [2-3]  Flags
//     [4-5]  QDCOUNT (number of questions)
//     [6-7]  ANCOUNT (number of answers)
//     [8-9]  NSCOUNT (number of nameservers)
//     [10-11] ARCOUNT (additional records)
//   Question section:
//     QNAME  — length-prefixed label sequence, terminated by 0x00
//     QTYPE  — 2 bytes
//     QCLASS — 2 bytes

object DnsPacketParser {

    // ── extractDomainFromDnsQuery ─────────────────────────────────────────────
    //
    // Parses the QNAME out of a raw DNS query UDP payload.
    // Returns the domain name in dotted notation (e.g., "instagram.com")
    // or null if the packet is malformed / too short.

    fun extractDomain(packet: ByteArray, length: Int): String? {
        // Minimum valid DNS query: 12-byte header + 1-byte QNAME terminator
        if (length < 13) return null

        try {
            val sb = StringBuilder()
            var i = 12 // skip 12-byte header

            while (i < length) {
                val labelLen = packet[i].toInt() and 0xFF
                if (labelLen == 0) break   // QNAME terminator
                if (i + labelLen >= length) return null

                if (sb.isNotEmpty()) sb.append('.')
                sb.append(String(packet, i + 1, labelLen, Charsets.US_ASCII))
                i += labelLen + 1
            }

            return if (sb.isNotEmpty()) sb.toString().lowercase() else null
        } catch (e: Exception) {
            return null
        }
    }

    // ── buildNxdomainResponse ─────────────────────────────────────────────────
    //
    // Constructs a minimal NXDOMAIN DNS response for a given query packet.
    //
    // Response format:
    //   - Same transaction ID as query
    //   - Flags: 0x8183 (response, non-authoritative, NXDOMAIN)
    //   - QDCOUNT = 1, ANCOUNT = 0, NSCOUNT = 0, ARCOUNT = 0
    //   - Question section echoed verbatim
    //
    // This tells the device: "this domain does not exist" — the OS treats it
    // like the server returned not-found, same effect as blocking the domain
    // via /etc/hosts but without requiring root.

    fun buildNxdomainResponse(query: ByteArray, queryLength: Int): ByteArray {
        // NXDOMAIN = rcode 3, QR=1 (response), OPCODE=0 (standard), AA=0, TC=0, RD=1, RA=0
        // Flags bytes: 0x81 (1000 0001) 0x83 (1000 0011)
        val response = ByteArray(queryLength)
        System.arraycopy(query, 0, response, 0, queryLength)

        // Copy transaction ID (bytes 0-1) — already copied above
        // Set flags: QR=1 (it's a response), RCODE=3 (NXDOMAIN)
        response[2] = 0x81.toByte()
        response[3] = 0x83.toByte()
        // Zero out answer/authority/additional counts
        response[6] = 0; response[7] = 0   // ANCOUNT = 0
        response[8] = 0; response[9] = 0   // NSCOUNT = 0
        response[10] = 0; response[11] = 0 // ARCOUNT = 0

        return response
    }

    // ── isDnsQuery ────────────────────────────────────────────────────────────
    //
    // Quick check: is this a standard DNS query (QR=0, OPCODE=0)?
    // QR bit is bit 15 of the flags word (byte[2] bit 7).
    // We only want to intercept queries — responses pass through.

    fun isDnsQuery(packet: ByteArray, length: Int): Boolean {
        if (length < 12) return false
        val flags = ((packet[2].toInt() and 0xFF) shl 8) or (packet[3].toInt() and 0xFF)
        val isQuery  = (flags and 0x8000) == 0     // QR bit = 0
        val isStdOp  = (flags and 0x7800) == 0     // OPCODE = 0 (standard query)
        return isQuery && isStdOp
    }
}
