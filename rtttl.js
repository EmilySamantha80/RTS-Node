module.exports = {
    parseRtttl: function (str) {
        return Rtttl.ParseRtttl(str)
    },

    convertRtttlToMidi: function (rtttl, program) {
        return Rtttl.ConvertRtttlToMidi(rtttl, program)
    }
}

class Rtttl {
    static CopyrightString = "(c)2024 Emily Johnson"
    static ErrorRtttl = "Error converting to RTTTL"

    static ParseRtttl(str) {
        str = str.replace(/\r?\n|\r/g, "")

        const invalidDefaultMessage = "Invalid control pair: "
        const rtttl = {
            Name: "",
            Defaults: {
                Duration: 4,
                Octave: 6,
                BPM: 63
            },
            Notes: [],
            HasParseError: false,
            ParseErrorMessage: ""
        }

        const sections = str.split(':')

        if (sections.length === 3) {
            rtttl.Name = sections[0]

            const defaults = sections[1].split(',')

            for (const param of defaults) {
                const paramSplit = param.split('=')
                if (paramSplit.length < 2) {
                    rtttl.HasParseError = true
                    rtttl.ParseErrorMessage = invalidDefaultMessage + param
                    return rtttl
                }
                const paramName = paramSplit[0].toLowerCase()
                const paramValue = paramSplit[1]

                if (paramName === "o") {
                    try {
                        rtttl.Defaults.Octave = parseInt(paramValue)
                    } catch {
                        rtttl.HasParseError = true
                        rtttl.ParseErrorMessage = invalidDefaultMessage + param
                        return rtttl
                    }
                    if (!this.ValidateNoteOctave(rtttl.Defaults.Octave)) {
                        rtttl.HasParseError = true
                        rtttl.ParseErrorMessage = invalidDefaultMessage + param
                        return rtttl
                    }
                } else if (paramName === "d") {
                    try {
                        rtttl.Defaults.Duration = parseInt(paramValue)
                    } catch {
                        rtttl.HasParseError = true
                        rtttl.ParseErrorMessage = invalidDefaultMessage + param
                        return rtttl
                    }
                    if (!this.ValidateNoteDuration(rtttl.Defaults.Duration)) {
                        rtttl.HasParseError = true
                        rtttl.ParseErrorMessage = invalidDefaultMessage + param
                        return rtttl
                    }
                } else if (paramName === "b") {
                    try {
                        rtttl.Defaults.BPM = parseInt(paramValue)
                    } catch {
                        rtttl.HasParseError = true
                        rtttl.ParseErrorMessage = invalidDefaultMessage + param
                        return rtttl
                    }
                } else {
                    rtttl.HasParseError = true
                    rtttl.ParseErrorMessage = invalidDefaultMessage + param
                    return rtttl
                }
            }

            const nts = sections[2].replace(/\s/g, "").split(',')

            const noteRegex = /^(\d{1,2})?([a-zA-Z]#?)(\.)?(\d)?$/
            for (const s of nts) {
                if (!s.trim()) continue

                const note = {}
                const match = s.match(noteRegex)

                // console.log(match)
                if (match == null || match.length < 5 || match[2] == null) {
                    rtttl.HasParseError = true
                    rtttl.ParseErrorMessage = "Invalid note format: " + s
                    return rtttl
                }

                try {
                    note.Duration = match[1] == null ? rtttl.Defaults.Duration : parseInt(match[1])
                } catch {
                    rtttl.HasParseError = true
                    rtttl.ParseErrorMessage = "Invalid note duration: " + s
                    return rtttl
                }
                if (!this.ValidateNoteDuration(note.Duration)) {
                    rtttl.HasParseError = true
                    rtttl.ParseErrorMessage = "Invalid note duration: " + s
                    return rtttl
                }

                note.Pitch = match[2]
                if (!this.ValidateNotePitch(note.Pitch)) {
                    rtttl.HasParseError = true
                    rtttl.ParseErrorMessage = "Invalid note pitch: " + s
                    return rtttl
                }

                note.Dotted = match[3] == null ? false : true

                try {
                    note.Octave = match[4] == null ? rtttl.Defaults.Octave : parseInt(match[4])
                } catch {
                    rtttl.HasParseError = true
                    rtttl.ParseErrorMessage = "Invalid note octave: " + s
                }
                if (!this.ValidateNoteOctave(note.Octave)) {
                    rtttl.HasParseError = true
                    rtttl.ParseErrorMessage = "Invalid note octave: " + s
                    return rtttl
                }
                rtttl.Notes.push(note)
            }
        }
        return rtttl
    }

    static ValidateNoteDotted(dotted) {
        if (dotted == ".") {
            return true
        }
        return false
    }

    static ValidateNoteDuration(duration) {
        if (duration == 1 || duration == 2 || duration == 4 || duration == 8 || duration == 16 || duration == 32) {
            return true
        }
        return false
    }

    static ValidateNotePitch(note) {
        note = note.toUpperCase()
        if (note == "P" || note == "C" || note == "C#" || note == "D" || note == "D#" || note == "E" || note == "F" || note == "F#" ||
            note == "G" || note == "G#" || note == "A" || note == "A#" || note == "B") {
            return true
        }
        return false
    }

    static ValidateNoteOctave(scale) {
        if (scale >= 4 && scale <= 7) {
            return true
        }
        return false
    }

    static IsDotted(nt) {
        let r = false
        const ntChars = nt.split('')
        for (let a = 0; a < ntChars.length; a++) {
            if (ntChars[a] == '.') {
                ntChars[a] = ' '
                r = true
                break
            }
        }
        nt = ntChars.join('').replace(" ", "")
        return r
    }

    static ConvertRtttlToMidi(rtttl, program) {
        const midi = []

        const head = Midi.mfWriteHeaderChunk(0, 1, 384)

        const track_data = []
        track_data.push(...Midi.copyRight(this.CopyrightString))
        track_data.push(...Midi.trackName(rtttl.Name))
        track_data.push(...Midi.setVolume(127))
        track_data.push(...Midi.mfWriteTempo(rtttl.Defaults.BPM))
        track_data.push(...Midi.addProgram(program))
        track_data.push(...this.notes2midi(rtttl))
        track_data.push(...Midi.endTrack())

        const track_head = Midi.mfWriteTrackChunk(track_data)

        const track = []
        track.push(...track_head)
        track.push(...track_data)

        midi.push(...head)
        midi.push(...track)

        var bytes = Buffer.alloc(midi.length)
        for (var i = 0; i < midi.length; i++) {
            bytes[i] = midi[i]
        }
        return bytes
    }

    static notes2midi(rtttl) {
        const r = []

        let rest = 0

        for (const note of rtttl.Notes) {
            const pt = this.get_pitch(note.Pitch, note.Octave - 1)
            const tm = this.get_time(note.Duration, note.Dotted)
            if (pt === -1) {
                rest = rest + tm
            } else {
                r.push(...Midi.writeNote(rest, tm, pt))
                rest = 0
            }
        }

        return r
    }

    static get_pitch(nt, oc) {
        let r = 0

        nt = nt.toLowerCase()
        if (nt === "p") {
            r = -1
        } else {
            switch (nt) {
                case "c":
                    r = 0
                    break
                case "c#":
                    r = 1
                    break
                case "d":
                    r = 2
                    break
                case "d#":
                    r = 3
                    break
                case "e":
                    r = 4
                    break
                case "f":
                    r = 5
                    break
                case "f#":
                    r = 6
                    break
                case "g":
                    r = 7
                    break
                case "g#":
                    r = 8
                    break
                case "a":
                    r = 9
                    break
                case "a#":
                    r = 10
                    break
                case "b":
                    r = 11
                    break
            }
            r = 12 + (12 * oc) + r
        }

        return r
    }

    static get_time(t, isDotted) {
        let r = 0
        switch (t) {
            case 1:
                r = 1536
                break
            case 2:
                r = 768
                break
            case 4:
                r = 384
                break
            case 8:
                r = 192
                break
            case 16:
                r = 96
                break
            case 32:
                r = 48
                break
            case 64:
                r = 24
                break
        }

        if (isDotted) {
            r = r + (r / 2)
        }

        return r
    }
}

class Midi {
    static eputc(code) {
        return Buffer.from([code])
    }

    static write32Bit(data) {
        const r = new Uint8Array(4)
        r[0] = this.eputc((data >> 24) & 0xff)[0]
        r[1] = this.eputc((data >> 16) & 0xff)[0]
        r[2] = this.eputc((data >> 8) & 0xff)[0]
        r[3] = this.eputc(data & 0xff)[0]
        return r
    }

    static write16Bit(data) {
        const r = new Uint8Array(2)
        r[0] = this.eputc((data & 0xff00) >> 8)[0]
        r[1] = this.eputc(data & 0xff)[0]
        return r
    }

    static mfWriteHeaderChunk(format, ntracks, division) {
        const r = []

        const ident = 0x4d546864
        const length = 6

        r.push(...this.write32Bit(ident))
        r.push(...this.write32Bit(length))
        r.push(...this.write16Bit(format))
        r.push(...this.write16Bit(ntracks))
        r.push(...this.write16Bit(division))

        return new Uint8Array(r)
    }

    static mfWriteTrackChunk(track) {
        const r = []

        const trkhdr = 0x4d54726b

        r.push(...this.write32Bit(trkhdr))
        r.push(...this.write32Bit(track.length))

        return new Uint8Array(r)
    }

    static writeVarLen(value) {
        const r = []

        let buffer = 0

        buffer = value & 0x7f
        while ((value >>= 7) > 0) {
            buffer <<= 8
            buffer |= 0x80
            buffer += (value & 0x7f)
        }
        while (true) {
            r.push(this.eputc(buffer & 0xff)[0])

            if ((buffer & 0x80) > 0) {
                buffer >>= 8
            } else {
                return new Uint8Array(r)
            }
        }
    }

    static mfWriteTempo(t) {
        const r = []

        const tempo = Math.floor((60000000 / t))

        r.push(this.eputc(0)[0])
        r.push(this.eputc(0xff)[0])
        r.push(this.eputc(0x51)[0])
        r.push(this.eputc(3)[0])
        r.push(this.eputc((0xff & (tempo >> 16)))[0])
        r.push(this.eputc((0xff & (tempo >> 8)))[0])
        r.push(this.eputc((0xff & tempo))[0])

        return new Uint8Array(r)
    }

    static mfWriteMidiEvent(deltaTime, type, chan, data) {
        const r = []

        let c = 0

        r.push(...this.writeVarLen(deltaTime))

        c = type | chan

        r.push(this.eputc(c)[0])

        for (const i of data) {
            r.push(this.eputc(i)[0])
        }

        return new Uint8Array(r)
    }

    static data(p1, p2) {
        return [p1, p2]
    }

    static data1(p1) {
        return [p1]
    }

    static endTrack() {
        const r = []

        r.push(this.eputc(0)[0])
        r.push(this.eputc(0xff)[0])
        r.push(this.eputc(0x2f)[0])
        r.push(this.eputc(0)[0])

        return new Uint8Array(r)
    }

    static addProgram(prg) {
        const r = []

        r.push(...this.mfWriteMidiEvent(0, 0xc0, 0, this.data1(prg)))

        return new Uint8Array(r)
    }

    static writeNote(s, d, p) {
        const r = []

        r.push(...this.mfWriteMidiEvent(s, 0x90, 0, this.data(p, 100)))
        r.push(...this.mfWriteMidiEvent(d, 0x80, 0, this.data(p, 0)))

        return new Uint8Array(r)
    }

    static copyRight(str) {
        const r = []

        r.push(this.eputc(0)[0])
        r.push(this.eputc(0xff)[0])
        r.push(this.eputc(0x02)[0])
        r.push(this.eputc(str.length)[0])
        r.push(...Array.from(Buffer.from(str, 'ascii')))

        return new Uint8Array(r)
    }

    static trackName(str) {
        const r = []

        r.push(this.eputc(0)[0])
        r.push(this.eputc(0xff)[0])
        r.push(this.eputc(0x03)[0])
        r.push(this.eputc(str.length)[0])
        r.push(...Array.from(Buffer.from(str, 'ascii')))

        return new Uint8Array(r)
    }

    static setVolume(volume) {
        // Volume 0-127
        const r = []

        r.push(...this.mfWriteMidiEvent(0, 0xb0, 0, this.data(0x07, volume)))

        return new Uint8Array(r)
    }

    static dotted(nt) {
        return nt + (nt / 2)
    }
}

// const fs = require('fs')

// var song = 'TocattaFugue:d=32,o=5,b=100:a#.,g#.,2a#,g#,f#,f,d#.,4d.,2d#,a#.,g#.,2a#,8f,8f#,8d,2d#,8d,8f,8g#,8b,8d6,4f6,4g#.,4f.,1g,32p'
// var rtttl = Rtttl.ParseRtttl(song)
// console.log(rtttl)
// fs.writeFile("output.mid", Rtttl.ConvertRtttlToMidi(rtttl), "binary", function (err) {
//     if (err) {
//         console.log(err)
//     } else {
//         console.log("The file was saved!")
//     }
// })
