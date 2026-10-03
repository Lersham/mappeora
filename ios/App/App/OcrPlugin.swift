import Capacitor
import UIKit
import Vision

/// On-device text recognition with Apple's Vision framework.
/// Exposed to JavaScript as "MappeoraOcr" (see src/services/ocr/native.ts).
/// We don't use the ML Kit plugin on iOS because its SDK has no Swift Package Manager support.
@objc(OcrPlugin)
public class OcrPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OcrPlugin"
    public let jsName = "MappeoraOcr"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognize", returnType: CAPPluginReturnPromise)
    ]

    @objc func recognize(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            call.reject("missing-path")
            return
        }
        let language = call.getString("language") ?? "it-IT"
        let url = path.hasPrefix("file://") ? URL(string: path) : URL(fileURLWithPath: path)
        guard let fileUrl = url, let image = UIImage(contentsOfFile: fileUrl.path), let cgImage = image.cgImage else {
            call.reject("image-not-readable")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.recognitionLanguages = [language]

            let handler = VNImageRequestHandler(
                cgImage: cgImage,
                orientation: CGImagePropertyOrientation(image.imageOrientation)
            )
            do {
                try handler.perform([request])
                let text = OcrPlugin.joinLines(request.results ?? [])
                call.resolve(["text": text])
            } catch {
                call.reject("ocr-failed", nil, error)
            }
        }
    }

    /// Joins recognised lines, leaving an empty line where a vertical gap
    /// suggests a new paragraph (the JavaScript side merges the other lines).
    static func joinLines(_ observations: [VNRecognizedTextObservation]) -> String {
        var text = ""
        var previous: CGRect?
        for observation in observations {
            guard let candidate = observation.topCandidates(1).first else { continue }
            let box = observation.boundingBox // normalised, origin at the bottom left
            if let prev = previous {
                let gap = prev.minY - box.maxY
                text += gap > box.height * 0.8 ? "\n\n" : "\n"
            }
            text += candidate.string
            previous = box
        }
        return text
    }
}

private extension CGImagePropertyOrientation {
    init(_ orientation: UIImage.Orientation) {
        switch orientation {
        case .up: self = .up
        case .upMirrored: self = .upMirrored
        case .down: self = .down
        case .downMirrored: self = .downMirrored
        case .left: self = .left
        case .leftMirrored: self = .leftMirrored
        case .right: self = .right
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}
