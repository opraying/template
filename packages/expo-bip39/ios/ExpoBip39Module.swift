import ExpoModulesCore
import CommonCrypto

public class ExpoBip39Module: Module {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ExpoBip39')` in JavaScript.
    Name("ExpoBip39")

    AsyncFunction("mnemonicToSeed") { (mnemonic: String, password: String) in
      return try self.deriveSeed(mnemonic: mnemonic, password: password)
    }
  }

  private func deriveSeed(mnemonic: String, password: String) throws -> [String] {
    let salt = "mnemonic" + password
    guard let passData = mnemonic.data(using: .utf8),
          let saltData = salt.data(using: .utf8) else {
      throw Exception(name: "ENCODING_ERROR", description: "Invalid input encoding")
    }

    // 准备输出缓冲区 111
    var derivedKey = [UInt8](repeating: 0, count: 64)

    // 调用 CommonCrypto PBKDF2-HMAC-SHA512
    let status = passData.withUnsafeBytes { passBytes in
      saltData.withUnsafeBytes { saltBytes in
        CCKeyDerivationPBKDF(
          CCPBKDFAlgorithm(kCCPBKDF2),         // 算法
          passBytes.bindMemory(to: Int8.self).baseAddress, passData.count,  // 密码及长度
          saltBytes.bindMemory(to: UInt8.self).baseAddress, saltData.count, // salt 及长度
          CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA512),
          2048,                                 // 迭代次数
          &derivedKey, derivedKey.count        // 输出缓冲区
        )
      }
    }

    guard status == kCCSuccess else {
      throw Exception(name: "PBKDF2_ERROR", description: "Key derivation failed")
    }

    // 转换为字符串数组
    return derivedKey.map { String($0) }
  }
}
