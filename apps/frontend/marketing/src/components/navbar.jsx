import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, AnimatedThemeToggler } from "@smo/ui";

const Navbar = () => {
    const [navIsOpened, setNavIsOpened] = useState(false)
    const closeNavbar = () => {
        setNavIsOpened(false)
    }

    const toggleNavbar = () => {
        setNavIsOpened(navIsOpened => !navIsOpened)
    }
    return (
        <>
            <div className="relative isolate flex items-center gap-x-6 overflow-hidden bg-zinc-800/50 px-6 py-2.5 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-white/10 sm:px-3.5 sm:before:flex-1">
                <div
                    aria-hidden="true"
                    className="absolute top-1/2 left-[max(-7rem,calc(50%-52rem))] -z-10 -translate-y-1/2 transform-gpu blur-2xl"
                >
                    <div
                        style={{
                            clipPath:
                                'polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)',
                        }}
                        className="aspect-577/310 w-144.25 bg-linear-to-r from-[#ff80b5] to-[#9089fc] opacity-40"
                    />
                </div>
                <div
                    aria-hidden="true"
                    className="absolute top-1/2 left-[max(45rem,calc(50%+8rem))] -z-10 -translate-y-1/2 transform-gpu blur-2xl"
                >
                    <div
                        style={{
                            clipPath:
                                'polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)',
                        }}
                        className="aspect-577/310 w-144.25 bg-linear-to-r from-[#ff80b5] to-[#9089fc] opacity-40"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <p className="text-sm/6 text-zinc-100">
                        <strong className="font-semibold">The Webrizen Ecosystem</strong>
                        <svg viewBox="0 0 2 2" aria-hidden="true" className="mx-2 inline size-0.5 fill-current">
                            <circle r={1} cx={1} cy={1} />
                        </svg>
                        Expand your operations. From Employee HR to complete Hotel Management, we build software that scales with you.
                    </p>
                    <a
                        href="#"
                        className="flex-none rounded-full bg-white/10 px-3.5 py-1 text-sm font-semibold text-white shadow-xs inset-ring-white/20 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                        See all products <span aria-hidden="true">&rarr;</span>
                    </a>
                </div>
                <div className="flex flex-1 justify-end">
                    <button type="button" className="-m-3 p-3 focus-visible:-outline-offset-4">
                        <span className="sr-only">Dismiss</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>

                    </button>
                </div>
            </div>
            <div aria-hidden={true} onClick={() => {
                closeNavbar()
            }} className={
                `fixed bg-zinc-800/40 inset-0 z-30 ${navIsOpened ? "lg:hidden" : "hidden lg:hidden"}`
            } />
            <header className="sticky left-0 top-0 w-full flex items-center py-2 border-b border-b-zinc-100 dark:border-b-zinc-900 z-40 bg-white dark:bg-zinc-950 bg-opacity-80 backdrop-filter backdrop-blur-xl">
                <nav className="relative mx-auto container w-full px-5 sm:px-10 md:px-12 lg:px-5 flex gap-x-5 justify-between items-center">
                    <div className="flex items-center min-w-max">
                        <Link to="/" className="flex flex-row items-center gap-3">
                            <img src="/logo.png" alt="Scan My Order" className="h-8 dark:invert" />
                            <div className="flex flex-col">
                                <span className="text-white text-lg font-elsie">Scan My Order</span>
                            </div>
                        </Link>
                    </div>
                    <div className={`
          absolute top-full  left-0 bg-white dark:bg-zinc-950 lg:bg-transparent border-b border-zinc-200 dark:border-zinc-800 py-8 lg:py-0 px-5 sm:px-10 md:px-12 lg:px-0 lg:border-none w-full lg:top-0 lg:relative  lg:flex lg:justify-between duration-300 ease-linear
          ${navIsOpened ? "translate-y-0 opacity-100 visible" : "translate-y-10 opacity-0 invisible lg:visible  lg:translate-y-0 lg:opacity-100"}
        `}>
                        <ul className="flex flex-col lg:flex-row gap-6 lg:items-center text-zinc-700 dark:text-zinc-300 lg:w-full lg:justify-center text-sm">
                            <li>
                                <Link to="/" className="relative py-2.5 duration-300 ease-linear hover:text-yellow-600 after:absolute after:w-full after:left-0 after:bottom-0 after:h-px after:rounded-md after:origin-left after:ease-linear after:duration-300 after:scale-x-0 hover:after:scale-100 after:bg-yellow-600">About</Link>
                            </li>
                            <li>
                                <Link to="/" className="relative py-2.5 duration-300 ease-linear hover:text-yellow-600 after:absolute after:w-full after:left-0 after:bottom-0 after:h-px after:rounded-md after:origin-left after:ease-linear after:duration-300 after:scale-x-0 hover:after:scale-100 after:bg-yellow-600">Features</Link>
                            </li>
                            <li>
                                <Link to="/" className="relative py-2.5 duration-300 ease-linear hover:text-yellow-600 after:absolute after:w-full after:left-0 after:bottom-0 after:h-px after:rounded-md after:origin-left after:ease-linear after:duration-300 after:scale-x-0 hover:after:scale-100 after:bg-yellow-600">How it works</Link>
                            </li>
                            <li>
                                <Link to="/" className="relative py-2.5 duration-300 ease-linear hover:text-yellow-600 after:absolute after:w-full after:left-0 after:bottom-0 after:h-px after:rounded-md after:origin-left after:ease-linear after:duration-300 after:scale-x-0 hover:after:scale-100 after:bg-yellow-600">Pricing</Link>
                            </li>
                            <li>
                                <Link to="/" className="relative py-2.5 duration-300 ease-linear hover:text-yellow-600 after:absolute after:w-full after:left-0 after:bottom-0 after:h-px after:rounded-md after:origin-left after:ease-linear after:duration-300 after:scale-x-0 hover:after:scale-100 after:bg-yellow-600">Contact</Link>
                            </li>

                        </ul>
                        <div className="flex sm:items-center lg:min-w-max mt-10 lg:mt-0 gap-x-3">
                            <AnimatedThemeToggler className="border-none" />
                            <Button asChild>
                                <Link to="/">Get Started</Link>
                            </Button>
                        </div>
                    </div>
                    <div aria-hidden="true" className="flex items-center lg:hidden">
                        <button onClick={() => {
                            toggleNavbar()
                        }} aria-label='toggle navbar' className="outline-none border-l border-l-indigo-100 dark:border-l-zinc-800 pl-3 relative py-3">
                            <span aria-hidden={true} className={`
              flex h-0.5 w-6 rounded bg-zinc-800 dark:bg-zinc-300 transition duration-300
              ${navIsOpened ? "rotate-45 translate-y-[.324rem]" : ""}
            `} />
                            <span aria-hidden={true} className={`
              mt-2 flex h-0.5 w-6 rounded bg-zinc-800 dark:bg-zinc-300 transition duration-300
              ${navIsOpened ? "-rotate-45 -translate-y-[.324rem]" : ""}
              `} />
                        </button>
                    </div>
                </nav>
            </header>
        </>
    )
}
export { Navbar }