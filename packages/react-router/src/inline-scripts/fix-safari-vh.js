const customViewportCorrectionVariable = 'vh'

function setViewportProperty(element) {
  let previousHeight = 0
  const variableName = `--${customViewportCorrectionVariable || 'vh'}`

  function updateViewportProperty() {
    const currentHeight = element.clientHeight
    if (currentHeight !== previousHeight) {
      window.requestAnimationFrame(() => {
        element.style.setProperty(variableName, `${0.01 * currentHeight}px`)
        previousHeight = currentHeight
      })
    }
  }

  updateViewportProperty()
  return updateViewportProperty
}

window.addEventListener('resize', setViewportProperty(document.documentElement))
