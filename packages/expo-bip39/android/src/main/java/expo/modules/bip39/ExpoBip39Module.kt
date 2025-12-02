package expo.modules.bip39

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.CodedException
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import java.security.NoSuchAlgorithmException
import java.security.spec.InvalidKeySpecException

class ExpoBip39Module : Module() {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  override fun definition() = ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ExpoBip39')` in JavaScript.
    Name("ExpoBip39")

    // Defines a JavaScript function that always returns a Promise and whose native code
    // is by default dispatched on the different thread than the JavaScript runtime runs on.
    AsyncFunction("mnemonicToSeed") { mnemonic: String, password: String ->
      deriveSeed(mnemonic, password)
    }
  }

  private fun deriveSeed(mnemonic: String, password: String): List<String> {
    val salt = "mnemonic$password"
    
    try {
      val spec = PBEKeySpec(
        mnemonic.toCharArray(),
        salt.toByteArray(Charsets.UTF_8),
        2048, // 迭代次数
        512   // 输出长度 (bits) - 64 bytes
      )
      
      val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA512")
      val derivedKey = factory.generateSecret(spec).encoded
      
      // 转换为字符串列表
      return derivedKey.map { it.toUByte().toString() }
      
    } catch (e: NoSuchAlgorithmException) {
      throw CodedException("PBKDF2_ERROR", "PBKDF2WithHmacSHA512 algorithm not available", e)
    } catch (e: InvalidKeySpecException) {
      throw CodedException("PBKDF2_ERROR", "Key derivation failed", e)
    } catch (e: Exception) {
      throw CodedException("ENCODING_ERROR", "Invalid input encoding", e)
    }
  }
}
