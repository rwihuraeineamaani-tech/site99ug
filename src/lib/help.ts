/** Plain-English guidance for every page, matched by the longest matching path. */
export type HelpGuide = {
  title: string;
  what: string;
  steps: string[];
  tips?: string[];
};

const GUIDES: Record<string, HelpGuide> = {
  "/app": {
    title: "Dashboard",
    what: "Your daily starting point: what is waiting on you, what is happening today and how the studio is performing.",
    steps: [
      "Read the “Waiting on you” card first — it is ordered by what is late, due today and coming next.",
      "Tap any card to jump straight to the work it belongs to.",
      "Check the week strip to see shoots, deadlines and calendar items ahead.",
      "Use the performance figures to compare the last 30 days with the 30 days before.",
    ],
    tips: ["Numbers come from real records, so anything missing usually means the work has not been logged yet."],
  },
  "/app/todo": {
    title: "To-Do",
    what: "Every action assigned to you across content, shoots, approvals, strategy, finance, sales and leadership work.",
    steps: [
      "Switch between Cards and List, whichever you read faster.",
      "Use the filters to see Overdue, Today or a single area of work.",
      "Open an item to do the work — you land on the exact page that needs you.",
      "Leaders can use “Assign work” to give someone a job, a deadline and what evidence you expect back.",
      "Leaders can follow progress under “Assigned by me”, then accept or return submitted work.",
    ],
    tips: ["Assigned work is private: only the assignees, the leader who assigned it and the system admin can see it."],
  },
  "/app/chat": {
    title: "Chat",
    what: "Direct and group conversations with the team and with clients.",
    steps: ["Pick a person or thread on the left.", "Type your message and send.", "Start a new conversation with the new chat button."],
  },
  "/app/briefs": {
    title: "Briefs",
    what: "Shoot day briefs and client briefs in one place.",
    steps: [
      "Shoot day briefs sit at the top — open one to see call time, location and the full run of the day.",
      "Client briefs follow underneath; open one for the detail and any attachment.",
      "Search by title, client or content to find an older brief.",
    ],
  },
  "/app/announcements": {
    title: "Announcements",
    what: "Studio-wide notices from leadership.",
    steps: ["Open a notice to read it in full.", "New notices show a badge in the menu until you open them."],
  },
  "/app/approvals": {
    title: "Approvals",
    what: "Everything waiting for your decision — money, content, strategy and contracts.",
    steps: [
      "Review the request and the detail behind it before deciding.",
      "Approve or send back with a clear reason so the person knows what to change.",
      "Finance actions ask for your payment PIN, which unlocks money work for five minutes.",
    ],
    tips: ["You can never approve your own request — that is blocked on purpose."],
  },
  "/app/calendar": {
    title: "Calendar",
    what: "Your work diary: personal items, shoots, deadlines and busy time.",
    steps: [
      "Add an item with a date and time; items are private unless you share them with the team.",
      "Add a busy block for time you cannot be booked — choose whether it warns people or blocks them completely.",
      "Switch between month, week and agenda views.",
    ],
  },
  "/app/settings": {
    title: "My settings",
    what: "Your profile, appearance, account, notifications and security.",
    steps: [
      "Update your name and job title under Profile.",
      "Choose dark, light or system appearance.",
      "Change your password, and set the six-digit PIN used to release payments.",
      "Turn push notifications on for this device under Notifications.",
    ],
  },
  "/app/content": {
    title: "Content & strategy pipeline",
    what: "Every idea from first thought to posted, with who is on it and what stage it is in.",
    steps: [
      "Everyone sees all content; the items you are involved in are highlighted.",
      "Open an item for the full detail, reference link and crew.",
      "Move work forward through the stages; approved items lock their core details.",
    ],
  },
  "/app/shoots": {
    title: "Shoot days",
    what: "Plan the day, send the brief, run the shoot and report on it.",
    steps: [
      "Open a day for call time, location, crew, gear and the ideas being shot.",
      "Send the brief to the crew and the client contact.",
      "On the day, mark each idea shot, partly shot or missed and log spending.",
      "Finish the day, then open the report for what was shot and what it cost.",
    ],
  },
  "/app/residents": {
    title: "Residents (clients)",
    what: "One full record per client: contacts, money, content, strategy, invoices and brand.",
    steps: [
      "Switch between card and list view.",
      "Open a client for everything about them in one place.",
      "Contracts live in Legal and splits live in Management — they show here but are edited there.",
    ],
  },
  "/app/sales": {
    title: "Sales",
    what: "Leads, pipeline, offers, partnerships and targets.",
    steps: [
      "Move an opportunity through the stages as it progresses.",
      "Build an offer or quote from a package, then send it for Founder approval.",
      "When you win, onboard the client straight into Residents — no retyping.",
    ],
  },
  "/app/legal": {
    title: "Legal",
    what: "Contracts, partnerships, documents and compliance deadlines.",
    steps: ["Register a contract with its dates, value and file.", "Update status as it moves from draft to signed.", "Watch compliance for renewals coming up."],
  },
  "/app/strategy": {
    title: "Strategy",
    what: "Client plans: goals, monthly targets and workflow maps.",
    steps: [
      "Set goals with owners and due dates.",
      "Set monthly targets — approved targets feed the dashboard.",
      "Build the map in the editor, then send the version for Founder sign-off.",
    ],
  },
  "/app/ops": {
    title: "Management",
    what: "People, workload, deadlines, weekly reports, announcements and equipment.",
    steps: ["Check workload before assigning more work.", "Keep deadlines current so they surface on dashboards.", "Publish the weekly report for the team."],
  },
  "/app/finance": {
    title: "Finance",
    what: "Cashbook, requests, payments, invoices, loans, budgets, filing and reports.",
    steps: [
      "Money actions need your six-digit PIN, which unlocks finance for five minutes.",
      "Log every entry in the cashbook with a category, reference and receipt.",
      "Requests go through approval before payment; big payments need a second sign-off.",
      "Record the transaction ID and evidence when a payment is made.",
    ],
    tips: ["Tax guidance in Filing is a plain-English summary — always confirm with your accountant before submitting."],
  },
  "/app/team": {
    title: "People & access",
    what: "This now lives inside System administration.",
    steps: ["Open System administration in the menu.", "Use the People & access tab to add people and set roles."],
  },
  "/app/system-admin": {
    title: "System administration",
    what: "People and access, who is on the system right now, who does what, and the approval routes for finance, content, strategy and contracts.",
    steps: [
      "People & access: add someone, set their role, remove access when they leave.",
      "Activity trail: see who is on now, how long they have been on, and what everyone has been doing — team and clients shown apart.",
      "Set responsibilities per area, then edit and publish approval routes.",
      "Check the audit history when a decision is questioned.",
    ],
    tips: ["The activity trail keeps 90 days and only system administrators can see it."],
  },

  "/app/equipment": { title: "Equipment", what: "The gear list and what is out on shoots.", steps: ["Add or update gear.", "Check availability before booking a shoot day."] },
  "/app/events": { title: "Events", what: "Events, ticket tiers and orders.", steps: ["Create the event and its ticket tiers.", "Confirm payments and email tickets.", "Use the gate scanner on the day."] },
  "/portal": { title: "Client portal", what: "Your work with Site 99: updates, content and messages.", steps: ["Read the latest updates.", "Use Chat to reach your team."] },
};

const DEFAULT_GUIDE: HelpGuide = {
  title: "Using Site 99",
  what: "This is the studio's operating system: work, clients, money and decisions in one place.",
  steps: [
    "Start on the Dashboard for what needs you today.",
    "Use To-Do for every action assigned to you.",
    "Open a section from the menu on the left.",
  ],
  tips: ["Ask a leader if something looks locked — most limits are role-based on purpose."],
};

export function helpFor(pathname: string): HelpGuide {
  const match = Object.keys(GUIDES)
    .filter((key) => pathname === key || pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? GUIDES[match] : DEFAULT_GUIDE;
}
