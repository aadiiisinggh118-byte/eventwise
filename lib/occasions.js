// All planning knowledge lives here as data: budget shares, task templates
// and vendor guidance. The engines are pure functions over this file, so
// changing an assumption never means touching logic.
//
// IMPORTANT: shares are planning *assumptions about how to split a budget*,
// not vendor prices. Nothing in this app predicts or quotes a price.

const guide = (needs, ask) => ({ needs, ask });

const CATEGORIES = {
  venue: {
    label: "Venue",
    perGuest: false,
    guide: guide(
      ["Confirmed date and time slot", "Headcount range it must hold comfortably", "Indoor or outdoor, with a weather backup", "Parking, power backup and step-free access"],
      ["What exactly does the rental include (tables, chairs, AC, power backup)?", "Is there a curfew, noise limit or outside-vendor restriction?", "What is the payment schedule and the cancellation policy?", "Can we visit at the same time of day as the event?"]
    ),
  },
  catering: {
    label: "Catering",
    perGuest: true,
    guide: guide(
      ["Headcount range and dietary mix (veg, jain, non-veg, allergies)", "Service style: buffet, plated or live counters", "Whether service staff and crockery are included"],
      ["Is the quote per plate or a total, and how many guests does it cover?", "Which taxes, service charges and extra staff costs come on top?", "Can we do a tasting, and what happens if the headcount changes?", "When does service start and how is leftover food handled?"]
    ),
  },
  decor: {
    label: "Decor and setup",
    perGuest: false,
    guide: guide(
      ["Theme, colours and a few reference photos", "Areas to decorate (entrance, stage, tables)", "Setup and teardown time windows"],
      ["Which items are rented and which are bought, and who clears them afterwards?", "Are lighting and power included?", "What is the backup if flowers or props are unavailable?", "How many hours before the event can setup begin?"]
    ),
  },
  photography: {
    label: "Photography and video",
    perGuest: false,
    guide: guide(
      ["Coverage hours and a list of must-have moments", "Photos only, or video as well", "Delivery format and deadline"],
      ["How many people cover the event, and for how many hours?", "When will edited photos and video be delivered?", "Who owns the raw files, and are they included?", "What is the overtime rate and the cancellation policy?"]
    ),
  },
  attire: {
    label: "Attire and jewellery",
    perGuest: false,
    guide: guide(
      ["An outfit list for each person involved", "Fitting dates with an alteration buffer"],
      ["What is the stitching or rental timeline, including alterations?", "Is there a rental deposit, and what damage terms apply?", "Can fittings be rescheduled close to the date?"]
    ),
  },
  entertainment: {
    label: "Music and entertainment",
    perGuest: false,
    guide: guide(
      ["Type of act and the age mix of the audience", "Sound, stage and power requirements", "Performance length and breaks"],
      ["What equipment do you bring and what must we provide?", "What is the overtime rate?", "Is there a backup performer if you fall ill?", "Will you give a written agreement?"]
    ),
  },
  logistics: {
    label: "Guest travel and stay",
    perGuest: true,
    guide: guide(
      ["List of guests who need transport or rooms", "Arrival and departure windows", "A point person on the day"],
      ["Is the rate per room or per person, and which meals are included?", "What is the cancellation window for blocked rooms?", "Who coordinates pickups on the day?"]
    ),
  },
  cake: {
    label: "Cake and favours",
    perGuest: true,
    guide: guide(
      ["Servings needed, plus dietary needs (eggless, sugar-free)", "Design reference and delivery time"],
      ["How many servings does that size really give?", "Who delivers, and what if it arrives damaged?", "How early must the order be confirmed?"]
    ),
  },
  av: {
    label: "Sound, lights and AV",
    perGuest: false,
    guide: guide(
      ["Speaking, music and any screen needs", "Stage and seating layout", "Power load and backup"],
      ["What is included: microphones, speakers, projector, a technician?", "Who is on site during the event?", "What is the backup if a device fails?"]
    ),
  },
  permits: {
    label: "Permissions and safety",
    perGuest: false,
    guide: guide(
      ["A list of what the venue and locality may require for gatherings, loudspeakers or road use", "A first-aid kit and a named safety contact", "Crowd flow and exits"],
      ["Does the venue or local authority need prior permission for this event?", "Who is responsible for fire safety and first aid on the day?", "What is the plan if the weather turns?"]
    ),
  },
  publicity: {
    label: "Publicity and invitations",
    perGuest: false,
    guide: guide(
      ["Key message, date, place and how to join", "Channels: messaging groups, posters, local networks", "Someone who answers questions"],
      ["What is the printing or posting turnaround?", "How will people confirm they are coming?", "Who approves the final wording?"]
    ),
  },
  volunteers: {
    label: "Volunteers and logistics",
    perGuest: false,
    guide: guide(
      ["Roles: welcome desk, setup, food, cleanup", "A volunteer count per role", "A briefing time before the event"],
      ["Who leads each role and who is their backup?", "Do volunteers need food, passes or transport?", "Who handles problems during the event?"]
    ),
  },
  buffer: { label: "Contingency buffer", perGuest: false, adjustable: false, guide: null },
};

const t = (id, title, offsetDays, dependsOn = [], category = null) => ({ id, title, offsetDays, dependsOn, category });

// Tasks are listed in dependency order (a task's prerequisites always come
// first) and offsetDays is "days before the event". A prerequisite never has a
// smaller offset than the task that needs it. Both rules are enforced by tests.
const OCCASIONS = {
  wedding: {
    label: "Wedding",
    blurb: "Months of planning and many vendors that depend on each other.",
    leadDays: 120,
    minPerGuest: 2000,
    categories: [
      { id: "venue", weight: 22 }, { id: "catering", weight: 30 }, { id: "decor", weight: 12 },
      { id: "photography", weight: 8 }, { id: "attire", weight: 12 }, { id: "entertainment", weight: 5 },
      { id: "logistics", weight: 5 }, { id: "buffer", weight: 6 },
    ],
    tasks: [
      t("w-budget", "Agree the budget and what matters most", 120),
      t("w-guestlist", "Draft the guest list", 110, ["w-budget"]),
      t("w-venue", "Shortlist and book the venue", 105, ["w-budget"], "venue"),
      t("w-caterer", "Book the caterer", 90, ["w-venue", "w-guestlist"], "catering"),
      t("w-photo", "Book photographer and videographer", 85, ["w-venue"], "photography"),
      t("w-attire", "Order attire and jewellery", 75, ["w-budget"], "attire"),
      t("w-decor", "Book the decorator", 70, ["w-venue"], "decor"),
      t("w-music", "Book music and entertainment", 60, ["w-venue"], "entertainment"),
      t("w-invites", "Finalise and send invitations", 50, ["w-venue", "w-guestlist"]),
      t("w-menu", "Hold the menu tasting", 35, ["w-caterer"], "catering"),
      t("w-transport", "Arrange guest travel and stay", 30, ["w-guestlist", "w-venue"], "logistics"),
      t("w-rsvp", "Collect RSVPs and confirm the headcount", 21, ["w-invites"]),
      t("w-confirm", "Confirm every vendor in writing", 14, ["w-caterer", "w-photo", "w-decor", "w-music"]),
      t("w-payments", "Schedule final payments and tips", 7, ["w-confirm"]),
      t("w-runsheet", "Share the run-sheet with family and vendors", 3, ["w-confirm", "w-rsvp"]),
    ],
  },
  birthday: {
    label: "Birthday",
    blurb: "A few weeks and lots of small decisions.",
    leadDays: 30,
    minPerGuest: 600,
    categories: [
      { id: "venue", weight: 18 }, { id: "catering", weight: 34 }, { id: "decor", weight: 14 },
      { id: "entertainment", weight: 14 }, { id: "cake", weight: 8 }, { id: "photography", weight: 6 },
      { id: "buffer", weight: 6 },
    ],
    tasks: [
      t("b-budget", "Agree the budget and what matters most", 30),
      t("b-guests", "Draft the guest list", 28, ["b-budget"]),
      t("b-theme", "Pick a theme", 26, ["b-budget"]),
      t("b-venue", "Book the venue", 25, ["b-budget"], "venue"),
      t("b-caterer", "Book the caterer", 18, ["b-venue", "b-guests"], "catering"),
      t("b-entertain", "Book entertainment", 16, ["b-venue", "b-theme"], "entertainment"),
      t("b-cake", "Order the cake", 14, ["b-theme"], "cake"),
      t("b-invites", "Send invitations", 14, ["b-venue", "b-guests"]),
      t("b-decor", "Book decor or buy supplies", 12, ["b-theme", "b-venue"], "decor"),
      t("b-rsvp", "Confirm the headcount", 7, ["b-invites"]),
      t("b-confirm", "Confirm every vendor", 5, ["b-caterer", "b-cake", "b-entertain", "b-decor"]),
      t("b-runsheet", "Share the run-sheet", 2, ["b-confirm", "b-rsvp"]),
    ],
  },
  community: {
    label: "Community event",
    blurb: "Volunteers, permissions and publicity to line up.",
    leadDays: 45,
    minPerGuest: 250,
    categories: [
      { id: "venue", weight: 20 }, { id: "catering", weight: 25 }, { id: "av", weight: 15 },
      { id: "permits", weight: 8 }, { id: "publicity", weight: 10 }, { id: "volunteers", weight: 12 },
      { id: "buffer", weight: 10 },
    ],
    tasks: [
      t("c-goal", "Write down the goal and who it is for", 45),
      t("c-budget", "Agree the budget", 43, ["c-goal"]),
      t("c-venue", "Book the venue", 38, ["c-budget"], "venue"),
      t("c-permits", "Check permissions and safety needs", 35, ["c-venue"], "permits"),
      t("c-volunteers", "Recruit and assign volunteers", 30, ["c-goal"], "volunteers"),
      t("c-caterer", "Arrange food and refreshments", 24, ["c-venue"], "catering"),
      t("c-av", "Book sound, lights and AV", 22, ["c-venue"], "av"),
      t("c-publicity", "Start publicity and invitations", 21, ["c-venue"], "publicity"),
      t("c-safety", "Confirm the safety and first-aid plan", 14, ["c-permits", "c-volunteers"]),
      t("c-rsvp", "Track sign-ups and confirm numbers", 10, ["c-publicity"]),
      t("c-briefing", "Brief volunteers and vendors", 5, ["c-volunteers", "c-caterer", "c-av"]),
      t("c-final", "Final walk-through and run-sheet", 2, ["c-briefing", "c-safety"]),
    ],
  },
};

const adjustableCategoryIds = (occasion) =>
  OCCASIONS[occasion].categories.map((c) => c.id).filter((id) => CATEGORIES[id].adjustable !== false);

module.exports = { CATEGORIES, OCCASIONS, adjustableCategoryIds };
