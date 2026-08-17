import { Link } from "react-router-dom";
import { Button } from "@repo/ui";
import { logoWhite } from "@repo/ui/assets";
import { useAuth } from "../context/auth-context.jsx";

const FooterItem = ({ text, link }) => {
    return (
        <li>
            <Link to={link} className="duration-200 hover:text-yellow-500 text-zinc-100/60 text-xs sm:text-sm">{text}</Link>
        </li>
    )
}

const FooterBlockItem = ({ title, items }) => {
    return (
        <div className="space-y-4">
            <h1 className="text-base font-semibold text-zinc-100">
                {title}
            </h1>
            <ul className="space-y-2.5">
                {
                    items.map(item => (
                        <FooterItem key={item.id} {...item} />
                    ))
                }
            </ul>
        </div>
    )
}

const footerBlocks = [
    {
        id: 1,
        title: "Product",
        items: [
            { id: 1, text: "QR Digital Menus", link: "/#features" },
            { id: 2, text: "Kitchen Display (KDS)", link: "/#features" },
            { id: 3, text: "POS & PhonePe Payments", link: "/#features" },
            { id: 4, text: "Pricing & Plans", link: "/#pricing" },
        ]
    },
    {
        id: 2,
        title: "Portal",
        items: [
            { id: 1, text: "Authenticate Account", link: "/authentication" },
            { id: 2, text: "Partner Onboarding", link: "/onboarding" },
            { id: 3, text: "Setup Guide", link: "/#setup" },
        ]
    },
    {
        id: 3,
        title: "Platform",
        items: [
            { id: 1, text: "Why Choose Us", link: "/#why-us" },
            { id: 2, text: "Help Center & FAQ", link: "/#faq" },
        ]
    },
];

const Footer = () => {
    const { isAuthenticated } = useAuth();
    const targetLink = isAuthenticated ? "/onboarding" : "/authentication";

    return (
        <div className="mt-10 relative h-full w-full overflow-hidden font-sans">
            <div className="absolute bottom-0 left-0 top-auto mx-auto right-0 bg-linear-to-br from-yellow-950 via-orange-900 to-amber-950 size-125 blur-[160px]" />
            <div className="absolute bottom-0 left-0 top-auto mx-auto right-0 bg-linear-to-br from-yellow-950/50 via-orange-900/50 to-amber-950/50 h-[80%] rounded-t-full blur-[200px]" />
            <div className="container mx-auto px-5 sm:px-10 md:px-12 lg:px-5 py-26">
                <div className="mx-auto text-center max-w-xl md:max-w-4xl relative space-y-8">
                    <h1 className="text-3xl/tight sm:text-4xl/tight md:text-5xl/tight font-bold text-zinc-100">
                        Modernize your <span className="text-transparent bg-clip-text bg-linear-to-br from-yellow-600 from-20% via-yellow-400 via-30% to-amber-600">Restaurant & Kitchen</span> Operations
                    </h1>
                    <p className="text-zinc-300/60 max-w-xl mx-auto">
                        An all-in-one POS, QR digital menu, and smart Kitchen Display System. Speed up service, unify payments, and take control of your floor.
                    </p>
                    <div className="mx-auto max-w-md sm:max-w-xl flex gap-4 justify-center">
                        <Link to={targetLink}>
                            <Button>Start Restaurant Onboarding</Button>
                        </Link>
                        <Link to={targetLink}>
                            <Button variant="link">Authenticate Partner Account</Button>
                        </Link>
                    </div>
                </div>
            </div>
            <footer className="bg-linear-to-r from-zinc-950 via-zinc-950/5 to-zinc-950/0 text-zinc-300 relative z-10">
                <div className="container mx-auto px-5 sm:px-10 md:px-12 lg:px-5 py-20 flex flex-col lg:flex-row gap-14">
                    <div className="space-y-6 lg:w-96">
                        <Link to="/" className="flex flex-row items-start gap-2">
                            <img src={logoWhite} alt="Scan My Order" className="h-8" />
                            <div className="flex flex-col">
                                <span className="text-white font-bold">Scan My Order</span>
                                <span className="text-white/50 text-[10px] leading-1">It's better than paper</span>
                            </div>
                        </Link>
                        <p className="max-w-lg text-xs sm:text-sm text-zinc-400">
                            A modern solution for restaurants to digitize their ordering process and improve customer experience.
                        </p>
                    </div>
                    <nav className="lg:flex-1 grid grid-cols-2 md:grid-cols-3 gap-10">
                        {
                            footerBlocks.map(footerBlock => (
                                <FooterBlockItem key={footerBlock.id} {...footerBlock} />
                            ))
                        }
                    </nav>
                </div>
                <div className="container mx-auto px-5 sm:px-10 md:px-12 lg:px-5 space-y-5 text-sm">
                    <div className="px-5 sm:px-10 md:px-12 lg:px-5 flex md:flex-row flex-col justify-between items-center text-center py-3 bg-zinc-100/10 text-zinc-100/60 rounded-t-xl text-xs">
                        <p> © {new Date().getFullYear()} Webrizen AI Labs Pvt Ltd. </p>
                        <p className="md:text-xs text-[10px]">All Rights Reserved</p>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default Footer