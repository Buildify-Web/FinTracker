// Pure payroll planning maths, shared by the server and the what-if planner in the browser.
// The numbers it starts from (cash, collections, expenses, each person's payable) come from SQL;
// this only scales them for "what if I pay X%".

export type PlanInputs = {
  cash: number;
  /** Money expected in before month end. */
  collections: number;
  /** Everything else that goes out in the month apart from payroll. */
  otherExpenses: number;
  debtMinimums: number;
  /** Cash to keep untouched after paying everyone. */
  reserve: number;
};

export type PlanMember = { id: string; payable: number };

/** The most payroll the month can carry while still leaving `reserve` in the bank. */
export function affordablePayroll(i: PlanInputs): number {
  return Math.max(0, i.cash + i.collections - i.otherExpenses - i.debtMinimums - i.reserve);
}

/** Share of each person's bill that can be paid; never above 100%. */
export function idealRatio(affordable: number, total: number): number {
  return total > 0 ? Math.min(1, affordable / total) : 1;
}

export type Scenario = {
  /** Whole rupees per person, rounded down so the total never overshoots the plan. */
  pay: Record<string, number>;
  paid: number;
  unpaid: number;
  endingCash: number;
};

/**
 * `fixed` pins a person to an exact amount (0 = not paid this month); everyone else gets `ratio` of their bill.
 */
export function scenario(i: PlanInputs, members: PlanMember[], ratio: number, fixed: Record<string, number> = {}): Scenario {
  const pay: Record<string, number> = {};
  let paid = 0;
  for (const m of members) {
    pay[m.id] = fixed[m.id] ?? Math.floor(m.payable * ratio);
    paid += pay[m.id];
  }
  const total = members.reduce((s, m) => s + m.payable, 0);
  return { pay, paid, unpaid: Math.max(0, total - paid), endingCash: i.cash + i.collections - i.otherExpenses - i.debtMinimums - paid };
}
