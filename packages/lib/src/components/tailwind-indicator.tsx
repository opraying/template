export function TailwindIndicator() {
  const handleClick = () => {
    document.body.classList.toggle('debug-screens')
  }

  return (
    <div className="text-foreground uppercase flex h-6 w-6 items-center justify-center p-3" onClick={handleClick}>
      <div className="block sm:hidden">xs</div>
      <div className="hidden sm:block md:hidden">sm</div>
      <div className="hidden md:block lg:hidden">md</div>
      <div className="hidden lg:block xl:hidden">lg</div>
      <div className="hidden xl:block 2xl:hidden">xl</div>
      <div className="hidden 2xl:block">2xl</div>
    </div>
  )
}
