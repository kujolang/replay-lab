import AVFoundation
import AudioToolbox
import Foundation

// Input is a score of original note events. The macOS General MIDI bank supplies the string timbres.
struct Note: Decodable {
    let start: Double
    let length: Double
    let pitch: UInt8
    let velocity: UInt8
    let part: Int
}

struct Event {
    let frame: Int
    let note: Note
    let on: Bool
}

let rate = 48000.0
let duration = 30.0
let score = try JSONDecoder().decode([Note].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let bank = URL(fileURLWithPath: "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")
let engine = AVAudioEngine()
let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 2)!
let programs: [UInt8] = [42, 48, 45]
let pans: [Float] = [-0.31, 0.24, 0.47]
let samplers = try programs.enumerated().map { index, program in
    let sampler = AVAudioUnitSampler()
    engine.attach(sampler)
    engine.connect(sampler, to: engine.mainMixerNode, format: format)
    sampler.pan = pans[index]
    try sampler.loadSoundBankInstrument(at: bank, program: program,
        bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: UInt8(kAUSampler_DefaultBankLSB))
    return sampler
}

let maximum: AVAudioFrameCount = 4096
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: maximum)
try engine.start()
var fileSettings = format.settings
fileSettings[AVLinearPCMIsNonInterleaved] = false
let file = try AVAudioFile(forWriting: output, settings: fileSettings, commonFormat: .pcmFormatFloat32, interleaved: false)
let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: maximum)!
let end = Int(rate * duration)
let events = score.flatMap { note in
    [Event(frame: Int((note.start * rate).rounded()), note: note, on: true),
     Event(frame: Int(((note.start + note.length) * rate).rounded()), note: note, on: false)]
}.sorted { a, b in
    a.frame == b.frame ? !a.on && b.on : a.frame < b.frame
}

var event = 0
var frame = 0
while frame < end {
    while event < events.count && events[event].frame <= frame {
        let next = events[event]
        let sampler = samplers[next.note.part]
        if next.on {
            sampler.startNote(next.note.pitch, withVelocity: next.note.velocity, onChannel: 0)
        } else {
            sampler.stopNote(next.note.pitch, onChannel: 0)
        }
        event += 1
    }
    let nextFrame = event < events.count ? events[event].frame : end
    let count = AVAudioFrameCount(min(Int(maximum), end - frame, nextFrame - frame))
    guard try engine.renderOffline(count, to: buffer) == .success else {
        fatalError("Audio engine did not render the score")
    }
    try file.write(from: buffer)
    frame += Int(count)
}
