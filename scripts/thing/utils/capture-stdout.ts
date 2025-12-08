/**
 * This class captures the stdout and stores each write in an array of strings.
 */
export class CaptureStdout {
  private _capturedText: string[]
  private _orig_stdout_write: typeof process.stdout.write | null

  constructor() {
    this._capturedText = []
    this._orig_stdout_write = null
  }

  /**
   * Starts capturing the writes to process.stdout
   */
  startCapture() {
    this._orig_stdout_write = process.stdout.write
    // @ts-ignore
    process.stdout.write = this._writeCapture.bind(this)
  }

  /**
   * Stops capturing the writes to process.stdout.
   */
  stopCapture() {
    if (this._orig_stdout_write) {
      process.stdout.write = this._orig_stdout_write
    }
  }

  /**
   * Private method that is used as the replacement write function for process.stdout
   * @param string
   * @private
   */
  _writeCapture(string: string) {
    this._capturedText.push(string)
  }

  /**
   * Retrieve the text that has been captured since creation or since the last clear call
   * @returns {Array} of Strings
   */
  getCapturedText() {
    return this._capturedText
  }

  /**
   * Clears all of the captured text
   */
  clearCaptureText() {
    this._capturedText = []
  }
}
