import Capacitor
import UIKit

/// Capacitor only auto-registers plugins installed from npm: the app's own
/// native plugins are registered here (the storyboard points to this class).
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(OcrPlugin())
    }
}
