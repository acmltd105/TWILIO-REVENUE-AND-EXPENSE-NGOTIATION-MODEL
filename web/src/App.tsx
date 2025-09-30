import { NegotiationDashboard } from "./features/NegotiationDashboard/NegotiationDashboard";

function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-50 drop-shadow-lg">
          Twilio Revenue & Expense Negotiation
        </h1>
        <p className="mt-2 text-slate-300">
          Live insights powered by Supabase, Twilio notifications, and a liquid-glass interface.
        </p>
      </header>
      <NegotiationDashboard />
    </main>
  );
}

export default App;
