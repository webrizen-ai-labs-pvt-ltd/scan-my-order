import React from "react"

export default function BentoFeaturesSection() {
  return (
    <section id="features" className="py-12 lg:py-24 bg-zinc-950 border-t border-zinc-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-20 max-w-5xl mx-auto">
          <h3 className="text-4xl md:text-5xl font-bold text-zinc-100 tracking-tight mb-5">
           You can make your operations <span className="bg-linear-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">more efficient, more effective, and more profitable.</span> 
          </h3>
          <p className="md:text-md text-zinc-400 max-w-xl mx-auto font-light">
            Stop bleeding profits to slow table turnover and protect your kitchen against unpaid, wasted food. Scan My Order simplifies and supercharges every dining interaction, from guest seating to your operational dashboard.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:mt-16 lg:grid-cols-3 lg:grid-rows-4">

          <div id="qr-ordering" className="relative lg:col-start-1 lg:row-start-1 lg:row-span-2">
            <div className="absolute inset-px rounded-lg bg-zinc-900 max-lg:rounded-t-4xl lg:rounded-tl-4xl" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] max-lg:rounded-t-[calc(2rem+1px)] lg:rounded-tl-[calc(2rem+1px)]">
              <div className="px-8 pt-8 pb-3 sm:px-10 sm:pt-10 sm:pb-0">
                <p className="mt-2 text-lg font-medium tracking-tight text-zinc-100 max-lg:text-center">Hassle-free QR Ordering</p>
                <p className="mt-2 max-w-lg text-sm/6 text-zinc-400 max-lg:text-center font-light">
                  Guests scan table-top QR codes to view dynamic, digital menus directly on their smartphones—no sign in or app download required.
                </p>
              </div>
              <div className="@container relative min-h-[300px] lg:min-h-120 w-full grow max-lg:mx-auto max-lg:max-w-sm">
                <div className="absolute inset-x-10 top-10 bottom-0 overflow-hidden rounded-t-[12cqw] border-x-[3cqw] border-t-[3cqw] border-zinc-700 bg-zinc-800 outline outline-white/10">
                  <img
                    alt="QR Ordering"
                    src="https://cdn.dribbble.com/userupload/47316707/file/b9d3efa76d4a1f285227890361c895ff.png?resize=1600x1200&vertical=center"
                    className="size-[150%] object-cover object-top"
                  />
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg border border-zinc-800 outline outline-white/5 max-lg:rounded-t-4xl lg:rounded-tl-4xl" />
          </div>

          <div id="kds" className="relative lg:col-start-2 lg:row-start-1">
            <div className="absolute inset-px rounded-lg bg-zinc-900" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)]">
              <div className="px-8 pt-8 sm:px-10 sm:pt-10">
                <p className="mt-2 text-lg font-medium tracking-tight text-zinc-100 max-lg:text-center">Smart Kitchen Management</p>
                <p className="mt-2 max-w-lg text-sm/6 text-zinc-400 max-lg:text-center font-light">
                  Automated routing and smart timers track every order against set prep limits, optimizing kitchen workflow during rush hours.
                </p>
              </div>
              <div className="flex flex-1 items-center justify-center px-8 max-lg:pt-10 max-lg:pb-12 sm:px-10 lg:pb-2">
                <img
                  alt="Kitchen Management"
                  src="https://tailwindcss.com/plus-assets/img/component-images/dark-bento-03-performance.png"
                  className="w-full max-lg:max-w-xs"
                />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg border border-zinc-800 outline outline-white/5" />
          </div>

          <div className="relative lg:col-start-2 lg:row-start-2">
            <div className="absolute inset-px rounded-lg bg-zinc-900" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)]">
              <div className="px-8 pt-8 sm:px-10 sm:pt-10">
                <p className="mt-2 text-lg font-medium tracking-tight text-zinc-100 max-lg:text-center">Secure Verification</p>
                <p className="mt-2 max-w-lg text-sm/6 text-zinc-400 max-lg:text-center font-light">
                  Dual Prepaid & Waiter-Approved Postpaid logic ensures kitchen staff only prep verified orders. Zero wasted food.
                </p>
              </div>
              <div className="@container flex flex-1 items-center max-lg:py-6 lg:pb-2">
                <img
                  alt="Secure Verification"
                  src="https://tailwindcss.com/plus-assets/img/component-images/dark-bento-03-security.png"
                  className="h-[min(152px,40cqw)] object-cover"
                />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg border border-zinc-800 outline outline-white/5" />
          </div>

          <div id="operations" className="relative lg:col-start-3 lg:row-start-1 lg:row-span-2">
            <div className="absolute inset-px rounded-lg bg-zinc-900 lg:rounded-tr-4xl" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] lg:rounded-tr-[calc(2rem+1px)]">
              <div className="px-8 pt-8 pb-3 sm:px-10 sm:pt-10 sm:pb-0">
                <p className="mt-2 text-lg font-medium tracking-tight text-zinc-100 max-lg:text-center">Seamless POS Integration</p>
                <p className="mt-2 max-w-lg text-sm/6 text-zinc-400 max-lg:text-center font-light">
                  Seamlessly integrates with your existing POS billing software, thermal printers, and real-time inventory management dashboards.
                </p>
              </div>
              <div className="relative min-h-[300px] lg:min-h-120 w-full grow">
                <div className="absolute top-10 right-0 bottom-0 left-10 overflow-hidden rounded-tl-xl bg-zinc-800 border border-zinc-700 outline outline-white/5 p-5 sm:p-6 flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-zinc-100">Live Dashboard</div>
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs text-zinc-400">Syncing POS</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-zinc-700/50 border border-zinc-600 p-3">
                      <div className="text-xs text-zinc-400 mb-1">Today's Sales</div>
                      <div className="text-lg font-bold text-zinc-100">₹42,500</div>
                      <div className="text-[10px] text-emerald-400 mt-1">↑ 15% (Upsell Active)</div>
                    </div>
                    <div className="rounded-lg bg-zinc-700/50 border border-zinc-600 p-3">
                      <div className="text-xs text-zinc-400 mb-1">Active Orders</div>
                      <div className="text-lg font-bold text-zinc-100">24</div>
                      <div className="text-[10px] text-amber-400 mt-1">4 awaiting prep</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Recent KOTs</div>
                    <div className="flex items-center justify-between rounded-md bg-zinc-700/50 border border-zinc-600 p-2.5">
                      <div>
                        <div className="text-sm font-medium text-zinc-200">Table 4 <span className="text-zinc-400 text-xs ml-1">· ORD-089</span></div>
                        <div className="text-xs text-zinc-400 mt-0.5">Paid via UPI</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-zinc-100">₹1,240</div>
                        <div className="text-[10px] font-bold text-emerald-400 uppercase mt-0.5">Completed</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-zinc-700/50 border border-zinc-600 p-2.5">
                      <div>
                        <div className="text-sm font-medium text-zinc-200">Table 5 <span className="text-zinc-400 text-xs ml-1">· ORD-090</span></div>
                        <div className="text-xs text-zinc-400 mt-0.5">Postpaid</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-zinc-100">₹850</div>
                        <div className="text-[10px] font-bold text-amber-400 uppercase mt-0.5">Cooking</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg border border-zinc-800 outline outline-white/5 lg:rounded-tr-4xl" />
          </div>

          <div id="waiter-control" className="relative lg:col-start-1 lg:row-start-3 lg:row-span-2">
            <div className="absolute inset-px rounded-lg bg-zinc-900 lg:rounded-bl-4xl" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] lg:rounded-bl-[calc(2rem+1px)]">
              <div className="px-8 pt-8 pb-3 sm:px-10 sm:pt-10 sm:pb-0">
                <p className="mt-2 text-lg font-medium tracking-tight text-zinc-100 max-lg:text-center">Intelligent Waiter Control</p>
                <p className="mt-2 max-w-lg text-sm/6 text-zinc-400 max-lg:text-center font-light">
                  Waiters gatekeep postpaid orders, collect table-side payments, and mark orders completed in one tap from their device.
                </p>
              </div>
              <div className="@container relative min-h-75 lg:min-h-120 w-full grow max-lg:mx-auto max-lg:max-w-sm">
                <div className="absolute inset-x-10 top-10 bottom-0 overflow-hidden rounded-t-[12cqw] border-x-[3cqw] border-t-[3cqw] border-zinc-700 bg-zinc-900 outline outline-white/10 p-4 sm:p-5">

                  <div className="bg-zinc-800/80 rounded-xl rounded-t-3xl p-4 mb-3 border border-zinc-700/50 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </span>
                        <div>
                          <span className="font-bold text-zinc-100 text-sm block">Table 08</span>
                          <span className="text-[10px] text-zinc-500">Order #ORD-091</span>
                        </div>
                      </div>
                      <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Ready to Serve
                      </span>
                    </div>

                    <div className="space-y-2.5 mb-4">
                      <div className="flex justify-between items-center text-xs bg-zinc-900/50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                          <span className="text-zinc-300">2x Iced Latte</span>
                        </div>
                        <span className="font-semibold text-zinc-100">₹400</span>
                      </div>
                      <div className="flex justify-between items-center text-xs bg-zinc-900/50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                          <span className="text-zinc-300">1x Truffle Fries</span>
                        </div>
                        <span className="font-semibold text-zinc-100">₹250</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-zinc-400">Total Amount</span>
                      <span className="text-sm font-bold text-zinc-100">₹650</span>
                    </div>

                    <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2.5 rounded-lg text-xs transition-colors">
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Collect Payment & Close
                      </span>
                    </button>
                  </div>

                  <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl p-3.5 opacity-80 hover:opacity-100 transition-opacity cursor-pointer group">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-zinc-700/50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                        <div>
                          <span className="font-semibold text-zinc-300 text-sm block">Table 12</span>
                          <span className="text-[10px] text-zinc-500">2 items • Est. 8 min</span>
                        </div>
                      </div>
                      <span className="bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-500/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        Cooking
                      </span>
                    </div>

                    <div className="mt-3 w-full bg-zinc-700/50 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-linear-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500" style={{ width: '65%' }}></div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg border border-zinc-800 outline outline-white/5 lg:rounded-bl-4xl" />
          </div>

          <div id="business" className="relative lg:col-start-2 lg:row-start-3">
            <div className="absolute inset-px rounded-lg bg-zinc-900" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)]">
              <div className="px-8 pt-8 sm:px-10 sm:pt-10">
                <p className="mt-2 text-lg font-medium tracking-tight text-zinc-100 max-lg:text-center">Smart AI Upselling</p>
                <p className="mt-2 max-w-lg text-sm/6 text-zinc-400 max-lg:text-center font-light">
                  Automatic checkout prompts suggest high-margin add-ons, increasing Average Order Value (AOV) by 15-25%.
                </p>
              </div>
              <div className="flex flex-1 items-center justify-center px-8 max-lg:pt-10 max-lg:pb-12 sm:px-10 lg:pb-2">
                <div className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-zinc-500 mb-3 uppercase tracking-wider">Suggested Add-on</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center text-xl">🍰</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-zinc-100">Choco Lava Cake</p>
                      <p className="text-xs text-zinc-400">+ ₹149</p>
                    </div>
                    <div className="w-5 h-5 rounded border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg border border-zinc-800 outline outline-white/5" />
          </div>

          <div className="relative lg:col-start-2 lg:row-start-4">
            <div className="absolute inset-px rounded-lg bg-zinc-900" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)]">
              <div className="px-8 pt-8 sm:px-10 sm:pt-10">
                <p className="mt-2 text-lg font-medium tracking-tight text-zinc-100 max-lg:text-center">Tatkal Rush Mode</p>
                <p className="mt-2 max-w-lg text-sm/6 text-zinc-400 max-lg:text-center font-light">
                  Instantly enforce a synchronous First-Come, First-Served token queue during sudden demand spikes.
                </p>
              </div>
              <div className="flex flex-1 items-center justify-center px-8 max-lg:pt-10 max-lg:pb-12 sm:px-10 lg:pb-2">
                <div className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-400">⚡</div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">Tatkal Mode</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wide">FCFS Queue Active</p>
                    </div>
                  </div>
                  <div className="w-10 h-6 bg-emerald-500 rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg border border-zinc-800 outline outline-white/5" />
          </div>

          <div className="relative lg:col-start-3 lg:row-start-3 lg:row-span-2">
            <div className="absolute inset-px rounded-lg bg-zinc-900 max-lg:rounded-b-4xl lg:rounded-br-4xl" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] max-lg:rounded-b-[calc(2rem+1px)] lg:rounded-br-[calc(2rem+1px)]">
              <div className="px-8 pt-8 pb-3 sm:px-10 sm:pt-10 sm:pb-0">
                <p className="mt-2 text-lg font-medium tracking-tight text-zinc-100 max-lg:text-center">Automated Reputation</p>
                <p className="mt-2 max-w-lg text-sm/6 text-zinc-400 max-lg:text-center font-light">
                  Catch diners at their peak moment. Automated triggers convert satisfied guests directly into 5-star Google reviews.
                </p>
              </div>
              <div className="relative min-h-75 lg:min-h-120 w-full grow mt-4">
                <div className="absolute top-10 right-0 bottom-0 left-10 overflow-hidden rounded-tl-xl bg-zinc-800 border-l border-t border-zinc-700 p-5 sm:p-6 flex flex-col gap-4">

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">Post-checkout Trigger</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Automated review request sent after payment</div>
                    </div>
                    <span className="bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-blue-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                      Active
                    </span>
                  </div>

                  <div className="bg-zinc-700/50 border border-zinc-600 rounded-2xl p-5 text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-400" fill="currentColor">
                          <path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
                        </svg>
                      </div>
                      <span className="text-xs text-zinc-400">Google Review Request</span>
                    </div>

                    <p className="text-sm font-bold text-zinc-100 mb-1">Rate your experience!</p>
                    <p className="text-xs text-zinc-400 mb-3">Your feedback helps us improve</p>

                    <div className="flex justify-center gap-2 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className="text-amber-400 text-2xl cursor-pointer hover:text-amber-300 transition-colors">★</span>
                      ))}
                    </div>

                    <div className="text-[10px] text-zinc-500">Tap a star to rate</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-700/30 border border-zinc-600 rounded-xl p-3">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Avg. Rating</div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-zinc-100">4.8</span>
                        <span className="text-amber-400 text-xs">★</span>
                      </div>
                    </div>
                    <div className="bg-zinc-700/30 border border-zinc-600 rounded-xl p-3">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Reviews Today</div>
                      <div className="text-sm font-bold text-zinc-100">12</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-zinc-700/30 border border-zinc-600 rounded-xl p-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-zinc-100">Review Posted Successfully</div>
                      <div className="text-[10px] text-zinc-400">+1 to Local Ranking • Sent to Google</div>
                    </div>
                    <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Recent Reviews</div>
                    <div className="flex items-center gap-3 bg-zinc-700/20 border border-zinc-600/50 rounded-lg p-2.5">
                      <div className="w-7 h-7 rounded-full bg-linear-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400">JD</div>
                      <div className="flex-1">
                        <div className="text-[11px] font-medium text-zinc-200">John D.</div>
                        <div className="text-[10px] text-zinc-500">&quot;Great service!&quot;</div>
                      </div>
                      <div className="flex text-amber-400 text-[10px]">★★★★★</div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg border border-zinc-800 outline outline-white/5 max-lg:rounded-b-4xl lg:rounded-br-4xl" />
          </div>

        </div>
      </div>
    </section>
  )
}
