import Link from 'next/link';
import { ArrowRight, MonitorSmartphone, Layers, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="fixed w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-brand w-8 h-8 rounded-lg flex items-center justify-center">
              <MonitorSmartphone className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">NuExis</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Log In
            </Link>
            <Link 
              href="/signup" 
              className="text-sm font-medium bg-brand hover:bg-brand-light text-white px-5 py-2 rounded-full shadow-md hover:shadow-lg transition-all"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-grow pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32 sm:pt-32 sm:pb-40">
          <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-brand opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
          </div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium text-brand bg-blue-50 ring-1 ring-inset ring-blue-100 mb-8">
              Multi-Tenant Digital Signage Platform
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 max-w-4xl mx-auto leading-tight">
              Control every screen, <br className="hidden md:block" /> from one elegant dashboard.
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Deploy beautiful, dynamic content to any display across the globe. NuExis is the premier digital signage solution built for teams that demand excellence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/signup" 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-light text-white px-8 py-4 rounded-full text-lg font-semibold shadow-xl shadow-blue-900/20 hover:shadow-blue-900/30 transition-all hover:-translate-y-0.5"
              >
                Create Workspace <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Enterprise-grade capabilities</h2>
              <p className="text-slate-600 max-w-2xl mx-auto">Everything you need to manage your digital real estate at scale.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12">
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                  <Layers className="text-brand w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Multi-Tenant Architecture</h3>
                <p className="text-slate-600 leading-relaxed">Isolated team workspaces with role-based access control. Manage multiple brands or clients from a single login.</p>
              </div>
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                  <Zap className="text-brand w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Real-Time Delivery</h3>
                <p className="text-slate-600 leading-relaxed">Push updates to your screens instantly. Enjoy pure WebSocket speed without polling or unexpected delays.</p>
              </div>
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                  <MonitorSmartphone className="text-brand w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Device Fleet Management</h3>
                <p className="text-slate-600 leading-relaxed">Monitor, reboot, and configure thousands of devices securely. See real-time screenshots and health metrics.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="w-5 h-5 text-slate-500" />
            <span className="text-lg font-semibold text-slate-200">NuExis</span>
          </div>
          <p className="text-sm">© {new Date().getFullYear()} NuExis. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
