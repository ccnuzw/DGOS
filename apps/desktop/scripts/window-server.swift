import CoreGraphics
import Foundation

guard CommandLine.arguments.count == 2, let pid = Int(CommandLine.arguments[1]) else {
    fputs("usage: window-server.swift PID\n", stderr)
    exit(2)
}

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] ?? []
let matches: [[String: Any]] = windows.compactMap { window in
    guard let owner = window[kCGWindowOwnerPID as String] as? Int, owner == pid else { return nil }
    guard let number = window[kCGWindowNumber as String] as? Int,
          let bounds = window[kCGWindowBounds as String] as? [String: Any] else { return nil }
    return ["windowId": number, "ownerPid": owner, "bounds": bounds,
            "layer": window[kCGWindowLayer as String] as? Int ?? -1,
            "alpha": window[kCGWindowAlpha as String] as? Double ?? 0]
}
let data = try JSONSerialization.data(withJSONObject: matches)
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data([10]))
