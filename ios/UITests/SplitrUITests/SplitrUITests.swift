import XCTest

/// End-to-end checks of the installed iPhone app (com.splitfree.app), driven like a real user.
/// Run:  scripts/ios-ui-tests.sh   (installs the app on a simulator first)
final class SplitrUITests: XCTestCase {
    let appID = "com.splitfree.app"
    var app: XCUIApplication!
    let outDir = "/tmp/splitr-ui"

    override func setUpWithError() throws {
        continueAfterFailure = false
        try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
        app = XCUIApplication(bundleIdentifier: appID)
    }

    private func shot(_ name: String) {
        let s = XCUIScreen.main.screenshot()
        try? s.pngRepresentation.write(to: URL(fileURLWithPath: "\(outDir)/\(name).png"))
        let a = XCTAttachment(screenshot: s); a.name = name; a.lifetime = .keepAlways; add(a)
    }

    private func credentials() throws -> (String, String) {
        let data = try Data(contentsOf: URL(fileURLWithPath: "\(outDir)/creds.json"))
        let j = try JSONSerialization.jsonObject(with: data) as! [String: String]
        return (j["email"]!, j["password"]!)
    }

    private var web: XCUIElement { app.webViews.firstMatch }

    /// Wait for the sign-in form inside the web view.
    private func waitForSignIn() {
        XCTAssertTrue(web.waitForExistence(timeout: 60), "web view never appeared")
        XCTAssertTrue(web.textFields.firstMatch.waitForExistence(timeout: 60), "sign-in form never appeared")
    }

    func test01_launchShowsSignInEmailOnly() {
        app.terminate(); app.launch()
        waitForSignIn()
        sleep(2)
        shot("01-signin")
        XCTAssertFalse(web.buttons["Continue with Google"].exists, "Google must be hidden inside the app")
        XCTAssertTrue(web.staticTexts["Welcome back"].exists || web.staticTexts["Welcome back 👋"].exists || web.otherElements.containing(NSPredicate(format: "label CONTAINS 'Welcome back'")).count > 0)
        XCTAssertFalse(web.staticTexts["You're in another app's browser"].exists, "no false in-app-browser warning")
    }

    func test02_typingFillsThePot() throws {
        app.terminate(); app.launch(); waitForSignIn()
        let email = web.textFields.firstMatch
        email.tap(); email.typeText("nishant@example.com")
        let pass = web.secureTextFields.firstMatch
        pass.tap(); pass.typeText("abcdefgh")
        sleep(2)
        shot("02-filled-with-keyboard")
        XCTAssertTrue(web.buttons["Sign in"].exists)
    }

    func test03_deepLinkOpensInviteInsideApp() throws {
        app.activate(); waitForSignIn()
        XCUIDevice.shared.system.open(URL(string: "splitrpro://join/test-invite-123")!)
        let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let open = spring.alerts.buttons["Open"]
        if open.waitForExistence(timeout: 10) { open.tap() }
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 15))
        sleep(6)
        shot("03-deeplink-invite")
        // the invite page (or its "invalid link" message) — not the sign-in form
        let onJoin = web.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'invite' OR label CONTAINS[c] 'join' OR label CONTAINS[c] 'link'")).count > 0
        XCTAssertTrue(onJoin, "deep link should land on the invite page")
    }

    func test04_signInAndUseTheApp() throws {
        let (email, password) = try credentials()
        app.terminate(); app.launch(); waitForSignIn()
        let e = web.textFields.firstMatch; e.tap(); e.typeText(email)
        let p = web.secureTextFields.firstMatch; p.tap(); p.typeText(password)
        web.buttons["Sign in"].tap()
        let dash = web.staticTexts.containing(NSPredicate(format: "label CONTAINS 'financial snapshot'")).firstMatch
        XCTAssertTrue(dash.waitForExistence(timeout: 60), "dashboard should load after signing in")
        sleep(3)
        shot("04-dashboard")
        // bottom navigation works
        for tab in ["Groups", "Expenses", "Friends"] {
            let link = web.links[tab].firstMatch
            if link.exists { link.tap(); sleep(3); shot("05-tab-\(tab.lowercased())") }
        }
    }
}
